#!/usr/bin/env node

/**
 * Deployment script for meal-image-mapping Lambda function
 * 
 * This script packages and deploys the Lambda function to AWS.
 * It handles packaging and deployment (dependencies are provided via Lambda layers).
 * 
 * Prerequisites:
 * - Lambda layers must be attached to the function containing:
 *   - @aws-sdk/client-s3
 *   - firebase
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  FUNCTION_NAME: 'meal-image-mapper',
  RUNTIME: 'nodejs22.x',
  MEMORY_SIZE: 1024, // 512 MB
  TIMEOUT: 300, // 5 minutes
  REGION: process.env.AWS_REGION || 'us-east-1',
  ROLE_NAME: 'meal-image-mapping-role',
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
  } catch (error) {
    console.error('❌ AWS CLI is not installed or not in PATH');
    console.error('Please install AWS CLI: https://aws.amazon.com/cli/');
    process.exit(1);
  }
}

/**
 * Check if required environment variables are set
 */
function checkEnvironmentVariables() {
  const required = [
    'FIREBASE_PROJECT_ID',
    'OPENAI_API_KEY'
  ];
  
  const optional = [
    'KHANA_KYA_BANAU_S3_BUCKET'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`  - ${key}`));
    console.error('\nPlease set these environment variables before deployment.');
    process.exit(1);
  }
  
  console.log('✅ All required environment variables are set');
  
  // Log optional variables
  optional.forEach(key => {
    if (process.env[key]) {
      console.log(`ℹ️  Optional variable set: ${key}`);
    } else {
      console.log(`ℹ️  Optional variable not set: ${key} (will use local files)`);
    }
  });
}

/**
 * Install dependencies (skipped when using Lambda layers)
 */
function installDependencies() {
  console.log('📦 Skipping dependency installation (using Lambda layers)...');
  console.log('ℹ️  Make sure your Lambda function has the required layers attached');
  console.log('ℹ️  Required layers: Node.js dependencies (@aws-sdk/client-s3, firebase)');
}

/**
 * Create IAM role for Lambda function
 */
function createIAMRole() {
  console.log('🔐 Creating IAM role...');
  
  const trustPolicy = {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: {
          Service: 'lambda.amazonaws.com'
        },
        Action: 'sts:AssumeRole'
      }
    ]
  };
  
  const policyDocument = {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents'
        ],
        Resource: 'arn:aws:logs:*:*:*'
      }
    ]
  };
  
  try {
    // Create role
    execCommand(`aws iam create-role --role-name ${CONFIG.ROLE_NAME} --assume-role-policy-document '${JSON.stringify(trustPolicy)}'`, { stdio: 'pipe' });
    console.log('✅ IAM role created');
  } catch (error) {
    console.log('ℹ️  IAM role already exists or creation failed');
  }
  
  try {
    // Attach basic execution policy
    execCommand(`aws iam attach-role-policy --role-name ${CONFIG.ROLE_NAME} --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole`, { stdio: 'pipe' });
    console.log('✅ Basic execution policy attached');
  } catch (error) {
    console.log('ℹ️  Policy attachment failed or already attached');
  }
  
  // Wait for role to be ready
  console.log('⏳ Waiting for IAM role to be ready...');
  execCommand('sleep 10');
}

/**
 * Package the Lambda function (excluding node_modules for layers)
 */
function packageFunction() {
  console.log('📦 Packaging Lambda function (excluding node_modules for layers)...');
  
  // Remove existing zip file
  if (fs.existsSync(CONFIG.ZIP_FILE)) {
    fs.unlinkSync(CONFIG.ZIP_FILE);
  }
  
  // Create zip file excluding unnecessary files and node_modules
  const excludePatterns = [
    '*.env',
    '*.git*',
    'node_modules/*',
    'node_modules/.cache/*',
    '*.log',
    'test.js',
    'test-modes.js',
    'test-s3-integration.js',
    'deploy.js',
    'run-local.js',
    'example-usage.js',
    'README.md',
    '*.md',
    'package-lock.json'
  ];
  
  // Build the exclude string with proper quoting for each pattern
  const excludeString = excludePatterns.map(pattern => `"${pattern}"`).join(' ');
  execCommand(`zip -r ${CONFIG.ZIP_FILE} . -x ${excludeString}`);
  console.log(`✅ Function packaged as ${CONFIG.ZIP_FILE} (without node_modules)`);
  console.log('ℹ️  Make sure your Lambda function has the required layers attached');
}

/**
 * Deploy the Lambda function
 */
function deployFunction() {
  console.log('🚀 Deploying Lambda function...');
  
  const roleArn = `arn:aws:iam::${getAccountId()}:role/${CONFIG.ROLE_NAME}`;
  
  try {
    // Try to update existing function
    execCommand(`aws lambda update-function-code --function-name ${CONFIG.FUNCTION_NAME} --zip-file fileb://${CONFIG.ZIP_FILE}`, { stdio: 'pipe' });
    console.log('✅ Function code updated');
    
    // Update function configuration
    // execCommand(`aws lambda update-function-configuration --function-name ${CONFIG.FUNCTION_NAME} --memory-size ${CONFIG.MEMORY_SIZE} --timeout ${CONFIG.TIMEOUT}`, { stdio: 'pipe' });
    // console.log('✅ Function configuration updated');
    
  } catch (error) {
    // Function doesn't exist, create it
    console.log('ℹ️  Function does not exist, creating new function...');
    
    execCommand(`aws lambda create-function --function-name ${CONFIG.FUNCTION_NAME} --runtime ${CONFIG.RUNTIME} --role ${roleArn} --handler index.handler --zip-file fileb://${CONFIG.ZIP_FILE} --memory-size ${CONFIG.MEMORY_SIZE} --timeout ${CONFIG.TIMEOUT} --description "Meal-image mapping function with precomputed embeddings"`, { stdio: 'pipe' });
    console.log('✅ Function created');
  }
}

/**
 * Check if Lambda function is ready for updates
 */
async function waitForFunctionReady() {
  console.log('🔍 Checking if Lambda function is ready for updates...');
  
  const maxChecks = 10;
  const checkDelay = 15000; // 15 seconds
  
  for (let check = 1; check <= maxChecks; check++) {
    try {
      // Try to get function configuration to check if it's ready
      execCommand(`aws lambda get-function-configuration --function-name ${CONFIG.FUNCTION_NAME}`, { stdio: 'pipe' });
      console.log('✅ Function is ready for updates');
      return true;
    } catch (error) {
      if (error.message.includes('ResourceConflictException') && check < maxChecks) {
        console.log(`⚠️  Function still updating, waiting ${checkDelay/1000} seconds before checking again (check ${check}/${maxChecks})...`);
        await new Promise(resolve => setTimeout(resolve, checkDelay));
        continue;
      }
      // If it's not a ResourceConflictException, the function might be ready
      if (!error.message.includes('ResourceConflictException')) {
        console.log('✅ Function appears to be ready');
        return true;
      }
      throw error;
    }
  }
  
  throw new Error('Function did not become ready after maximum checks');
}

/**
 * Set environment variables for the Lambda function with retry logic
 */
async function setEnvironmentVariables() {
  console.log('🔧 Setting environment variables...');
  
  // First, wait for the function to be ready
  await waitForFunctionReady();
  
  const environmentVariables = {
    Variables: {
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      KHANA_KYA_BANAU_S3_BUCKET: process.env.KHANA_KYA_BANAU_S3_BUCKET || '',
      COSINE_SIMILARITY_THRESHOLD: process.env.COSINE_SIMILARITY_THRESHOLD || '0.7',
      TEXT_SIMILARITY_THRESHOLD: process.env.TEXT_SIMILARITY_THRESHOLD || '0.6',
      MAX_MEALS_PER_BATCH: process.env.MAX_MEALS_PER_BATCH || '50'
    }
  };
  
  // Create a temporary file for the environment variables to avoid shell escaping issues
  const tempFile = '/tmp/lambda-env.json';
  fs.writeFileSync(tempFile, JSON.stringify(environmentVariables, null, 2));
  
  const maxRetries = 5;
  const retryDelay = 20000; // 20 seconds
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      execCommand(`aws lambda update-function-configuration --function-name ${CONFIG.FUNCTION_NAME} --cli-input-json file://${tempFile}`, { stdio: 'pipe' });
      console.log('✅ Environment variables set');
      break;
    } catch (error) {
      if (error.message.includes('ResourceConflictException') && attempt < maxRetries) {
        console.log(`⚠️  Update conflict, waiting ${retryDelay/1000} seconds before retry (attempt ${attempt}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }
      throw error;
    }
  }
  
  // Clean up temporary file
  if (fs.existsSync(tempFile)) {
    fs.unlinkSync(tempFile);
  }
}

/**
 * Get AWS account ID
 */
function getAccountId() {
  try {
    const result = execCommand('aws sts get-caller-identity --query Account --output text', { stdio: 'pipe' });
    return result.trim();
  } catch (error) {
    console.error('❌ Failed to get AWS account ID');
    process.exit(1);
  }
}

/**
 * Clean up temporary files
 */
function cleanup() {
  console.log('🧹 Cleaning up...');
  
  if (fs.existsSync(CONFIG.ZIP_FILE)) {
    fs.unlinkSync(CONFIG.ZIP_FILE);
    console.log('✅ Cleanup completed');
  }
}

/**
 * Main deployment function
 */
async function main() {
  console.log('🚀 Starting Lambda deployment...');
  console.log(`📋 Configuration:`, CONFIG);
  
  try {
    checkAWSCLI();
    checkEnvironmentVariables();
    // installDependencies();
    // createIAMRole();
    packageFunction();
    deployFunction();
    // await setEnvironmentVariables();
    
    console.log('✅ Deployment completed successfully!');
    console.log(`🔗 Function ARN: arn:aws:lambda:${CONFIG.REGION}:${getAccountId()}:function:${CONFIG.FUNCTION_NAME}`);
    console.log('📝 You can now invoke the function or set up triggers as needed.');
    
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    process.exit(1);
  } finally {
    cleanup();
  }
}

// Run deployment if this script is executed directly
if (require.main === module) {
  main();
}

module.exports = { main, CONFIG };