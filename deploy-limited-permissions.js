#!/usr/bin/env node

/**
 * Deployment script for meal-image-mapping Lambda function with limited IAM permissions
 * 
 * This script is designed to work when your AWS user has limited IAM permissions.
 * It assumes you already have a Lambda execution role available.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  FUNCTION_NAME: 'meal-image-mapping',
  RUNTIME: 'nodejs18.x',
  MEMORY_SIZE: 1536, // 1.5GB
  TIMEOUT: 300, // 5 minutes
  REGION: process.env.AWS_REGION || 'us-west-2', // Your region
  ZIP_FILE: 'meal-image-mapping.zip'
};

/**
 * Execute shell command with error handling
 */
function execCommand(command, options = {}) {
  try {
    console.log(`🔧 Executing: ${command}`);
    const result = execSync(command, { 
      stdio: 'inherit', 
      encoding: 'utf8',
      ...options 
    });
    return result;
  } catch (error) {
    console.error(`❌ Command failed: ${command}`);
    console.error(error.message);
    process.exit(1);
  }
}

/**
 * Check if AWS CLI is installed and configured
 */
function checkAWSCLI() {
  try {
    execCommand('aws --version', { stdio: 'pipe' });
    console.log('✅ AWS CLI is installed');
    
    // Check AWS credentials
    execCommand('aws sts get-caller-identity', { stdio: 'pipe' });
    console.log('✅ AWS credentials are configured');
  } catch (error) {
    console.error('❌ AWS CLI not configured properly');
    process.exit(1);
  }
}

/**
 * Install dependencies
 */
function installDependencies() {
  console.log('📦 Installing dependencies...');
  
  // Clean install
  if (fs.existsSync('node_modules')) {
    execCommand('rm -rf node_modules');
  }
  
  // Install production dependencies only
  execCommand('npm install --production');
  console.log('✅ Dependencies installed');
}

/**
 * Package the function
 */
function packageFunction() {
  console.log('📦 Packaging function...');
  
  // Remove existing zip file
  if (fs.existsSync(CONFIG.ZIP_FILE)) {
    execCommand(`rm ${CONFIG.ZIP_FILE}`);
  }
  
  // Create zip file excluding unnecessary files
  const excludeFiles = [
    'node_modules/.cache/**',
    '*.log',
    '.env',
    'test*.js',
    'deploy*.js',
    'run-local.js',
    'example-usage.js',
    'README.md',
    '.git/**'
  ];
  
  let zipCommand = `zip -r ${CONFIG.ZIP_FILE} .`;
  excludeFiles.forEach(file => {
    zipCommand += ` -x "${file}"`;
  });
  
  execCommand(zipCommand);
  console.log(`✅ Function packaged as ${CONFIG.ZIP_FILE}`);
}

/**
 * Deploy the Lambda function (update existing or create new)
 */
function deployFunction() {
  console.log('🚀 Deploying Lambda function...');
  
  try {
    // Try to update existing function
    execCommand(`aws lambda update-function-code --function-name ${CONFIG.FUNCTION_NAME} --zip-file fileb://${CONFIG.ZIP_FILE}`, { stdio: 'pipe' });
    console.log('✅ Function code updated');
    
    // Update function configuration
    execCommand(`aws lambda update-function-configuration --function-name ${CONFIG.FUNCTION_NAME} --memory-size ${CONFIG.MEMORY_SIZE} --timeout ${CONFIG.TIMEOUT}`, { stdio: 'pipe' });
    console.log('✅ Function configuration updated');
    
  } catch (error) {
    // Function doesn't exist, need to create it
    console.log('❌ Function does not exist. You need to create it first through AWS Console.');
    console.log('\n📋 To create the function manually:');
    console.log('1. Go to AWS Lambda Console: https://console.aws.amazon.com/lambda/');
    console.log('2. Click "Create function"');
    console.log('3. Choose "Author from scratch"');
    console.log(`4. Function name: ${CONFIG.FUNCTION_NAME}`);
    console.log(`5. Runtime: ${CONFIG.RUNTIME}`);
    console.log('6. Execution role: Choose "Create a new role with basic Lambda permissions"');
    console.log('7. Click "Create function"');
    console.log('\nThen run this script again to update the function code.');
    process.exit(1);
  }
}

/**
 * Set environment variables for the Lambda function
 */
function setEnvironmentVariables() {
  console.log('🔧 Setting environment variables...');
  
  const environmentVariables = {
    Variables: {
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      COSINE_SIMILARITY_THRESHOLD: process.env.COSINE_SIMILARITY_THRESHOLD || '0.7',
      TEXT_SIMILARITY_THRESHOLD: process.env.TEXT_SIMILARITY_THRESHOLD || '0.6',
      MAX_MEALS_PER_BATCH: process.env.MAX_MEALS_PER_BATCH || '50'
    }
  };
  
  try {
    execCommand(`aws lambda update-function-configuration --function-name ${CONFIG.FUNCTION_NAME} --environment Variables='${JSON.stringify(environmentVariables.Variables)}'`, { stdio: 'pipe' });
    console.log('✅ Environment variables set');
  } catch (error) {
    console.error('❌ Failed to set environment variables:', error.message);
    console.log('ℹ️  You can set them manually in the AWS Console');
  }
}

/**
 * Create Lambda URL for the function
 */
function createLambdaURL() {
  console.log('🌐 Creating/updating Lambda URL...');
  
  try {
    // Try to create Lambda URL
    const createCommand = `aws lambda create-function-url-config \
      --function-name ${CONFIG.FUNCTION_NAME} \
      --auth-type NONE \
      --cors '{
        "AllowCredentials": false,
        "AllowHeaders": ["content-type"],
        "AllowMethods": ["POST", "GET", "OPTIONS"],
        "AllowOrigins": ["*"],
        "ExposeHeaders": [],
        "MaxAge": 86400
      }'`;
    
    const result = execCommand(createCommand, { stdio: 'pipe' });
    console.log('✅ Lambda URL created');
    
    // Extract URL from result
    const urlMatch = result.match(/"FunctionUrl":\s*"([^"]+)"/);
    if (urlMatch) {
      console.log(`🔗 Lambda URL: ${urlMatch[1]}`);
    }
    
  } catch (error) {
    console.log('ℹ️  Lambda URL might already exist, checking...');
    
    try {
      const getCommand = `aws lambda get-function-url-config --function-name ${CONFIG.FUNCTION_NAME}`;
      const result = execCommand(getCommand, { stdio: 'pipe' });
      
      const urlMatch = result.match(/"FunctionUrl":\s*"([^"]+)"/);
      if (urlMatch) {
        console.log(`🔗 Existing Lambda URL: ${urlMatch[1]}`);
      }
    } catch (getError) {
      console.log('⚠️  Could not retrieve Lambda URL');
    }
  }
}

/**
 * Clean up temporary files
 */
function cleanup() {
  console.log('🧹 Cleaning up...');
  
  if (fs.existsSync(CONFIG.ZIP_FILE)) {
    execCommand(`rm ${CONFIG.ZIP_FILE}`);
    console.log('✅ Cleanup completed');
  }
}

/**
 * Main deployment function
 */
async function main() {
  console.log('🚀 Deploying meal-image-mapping Lambda function (Limited Permissions Mode)');
  console.log('=' .repeat(70));
  
  try {
    // Check prerequisites
    checkAWSCLI();
    
    // Check required environment variables
    const required = ['FIREBASE_PROJECT_ID', 'OPENAI_API_KEY'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      console.log('⚠️  Missing environment variables:');
      missing.forEach(key => console.log(`   - ${key}`));
      console.log('\nPlease set these environment variables before deployment.');
      process.exit(1);
    }
    
    // Deploy steps
    installDependencies();
    packageFunction();
    deployFunction();
    setEnvironmentVariables();
    createLambdaURL();
    cleanup();
    
    console.log('\n🎉 Deployment completed successfully!');
    console.log('=' .repeat(70));
    console.log('📝 Next steps:');
    console.log('1. Test your function using the Lambda URL');
    console.log('2. Check CloudWatch logs for any issues');
    console.log('3. Monitor function performance and adjust memory/timeout if needed');
    
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    cleanup();
    process.exit(1);
  }
}

// Run if this script is executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  deployFunction,
  setEnvironmentVariables,
  createLambdaURL
};
