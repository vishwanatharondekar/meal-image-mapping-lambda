#!/usr/bin/env node

/**
 * Local runner for meal-image-mapping Lambda function
 * 
 * This script allows you to run the Lambda function locally for testing and development.
 * It provides options to run with mock data or real Firebase connections.
 */

const fs = require('fs');
const path = require('path');

// Mock AWS Lambda context
const mockContext = {
  getRemainingTimeInMillis: () => 300000, // 5 minutes
  functionName: 'meal-image-mapping-local',
  functionVersion: '$LATEST',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:meal-image-mapping-local',
  memoryLimitInMB: '1536',
  awsRequestId: 'local-test-request-id',
  logGroupName: '/aws/lambda/meal-image-mapping-local',
  logStreamName: '2024/01/01/[$LATEST]local-test-stream',
  identity: null,
  clientContext: null,
  callbackWaitsForEmptyEventLoop: true
};

// Mock event for testing
const mockEvent = {
  // Empty event - will fetch all unmapped meals from Firestore
  // You can customize this to test specific scenarios
};

// Mock event for request mode testing
const mockRequestEvent = {
  body: JSON.stringify({
    mealNames: [
      'Patra',
      // Add your custom meal names here for testing
    ]
  })
};

/**
 * Check if required environment variables are set
 */
function checkEnvironmentVariables() {
  const required = [
    'FIREBASE_PROJECT_ID',
    'OPENAI_API_KEY'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.log('⚠️  Missing environment variables:');
    missing.forEach(key => console.log(`   - ${key}`));
    console.log('');
    console.log('You can either:');
    console.log('1. Set them as environment variables');
    console.log('2. Create a .env file in the lambda directory');
    console.log('3. Use the --mock flag to run with mock data');
    console.log('');
    return false;
  }
  
  return true;
}

/**
 * Load environment variables from .env file
 */
function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  
  if (fs.existsSync(envPath)) {
    console.log('📄 Loading environment variables from .env file...');
    
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    
    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        const value = valueParts.join('=').replace(/^["']|["']$/g, ''); // Remove quotes
        
        if (key && value) {
          process.env[key] = value;
        }
      }
    });
    
    console.log('✅ Environment variables loaded from .env file');
    return true;
  }
  
  return false;
}

/**
 * Run with mock data (no Firebase/OpenAI required)
 */
async function runWithMockData() {
  console.log('🎭 Running with mock data (no external dependencies required)...');
  
  // Set mock environment variables
  process.env.FIREBASE_PROJECT_ID = 'mock-project';
  process.env.OPENAI_API_KEY = 'mock-openai-key';
  
  // Mock Firebase client SDK
  const mockFirestore = {
    collection: (name) => ({
      get: () => Promise.resolve({
        size: 2,
        forEach: (callback) => {
          const mockMeals = [
            {
              id: 'meal1',
              data: () => ({
                name: 'Chicken Biryani',
                description: 'Aromatic rice dish with chicken',
                cuisine: 'Indian'
              })
            },
            {
              id: 'meal2',
              data: () => ({
                name: 'Vegetable Curry',
                description: 'Mixed vegetables in curry sauce',
                cuisine: 'Indian'
              })
            }
          ];
          mockMeals.forEach(callback);
        }
      }),
      doc: () => ({
        set: (data) => Promise.resolve(),
        get: () => Promise.resolve({ exists: false })
      })
    })
  };
  
  // Mock Firebase client SDK
  const mockFirebase = {
    initializeApp: () => {},
    getFirestore: () => mockFirestore,
    collection: (firestore, collectionName) => mockFirestore.collection(collectionName),
    getDocs: (collectionRef) => collectionRef.get(),
    addDoc: (collectionRef, data) => Promise.resolve(),
    serverTimestamp: () => new Date()
  };
  
  // Mock fetch for OpenAI API
  global.fetch = async (url, options) => {
    if (url.includes('openai.com')) {
      return {
        ok: true,
        json: () => Promise.resolve({
          data: [{
            embedding: new Array(1536).fill(0).map(() => Math.random() - 0.5)
          }]
        })
      };
    }
    throw new Error('Unexpected fetch call');
  };
  
  // Mock the Firebase client modules
  jest.mock('firebase/app', () => ({ initializeApp: mockFirebase.initializeApp }));
  jest.mock('firebase/firestore', () => ({
    getFirestore: mockFirebase.getFirestore,
    collection: mockFirebase.collection,
    getDocs: mockFirebase.getDocs,
    addDoc: mockFirebase.addDoc,
    serverTimestamp: mockFirebase.serverTimestamp
  }));
  
  try {
    // Import and run the handler
    const { handler } = require('./index');
    const result = await handler(mockEvent, mockContext);
    
    console.log('✅ Mock execution completed successfully!');
    console.log('📊 Result:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('❌ Mock execution failed:', error.message);
    console.error(error.stack);
  }
}

/**
 * Run with real Firebase/OpenAI connections
 */
async function runWithRealData() {
  console.log('🔗 Running with real Firebase and OpenAI connections...');
  
  try {
    // Import and run the handler
    const { handler } = require('./index');
    const result = await handler(mockEvent, mockContext);
    
    console.log('✅ Real execution completed successfully!');
    console.log('📊 Result:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('❌ Real execution failed:', error.message);
    console.error(error.stack);
  }
}

/**
 * Run request mode with real Firebase/OpenAI connections
 */
async function runRequestModeWithRealData() {
  console.log('🔗 Running REQUEST MODE with real Firebase and OpenAI connections...');
  console.log('📝 Testing with specific meal names...\n');
  
  try {
    // Import and run the handler
    const { handler } = require('./index');
    const result = await handler(mockRequestEvent, mockContext);
    
    console.log('✅ Request mode execution completed successfully!');
    console.log('📊 Result:', JSON.stringify(result, null, 2));
    
    // Pretty print the meal image mappings if available
    if (result.body) {
      const response = JSON.parse(result.body);
      if (response.mealImageMappings) {
        console.log('\n🖼️  Meal Image Mappings:');
        console.log('=' .repeat(40));
        Object.entries(response.mealImageMappings).forEach(([mealName, imageUrl]) => {
          console.log(`  ${mealName} -> ${imageUrl}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Request mode execution failed:', error.message);
    console.error(error.stack);
  }
}

/**
 * Create a sample .env file
 */
function createSampleEnvFile() {
  const envPath = path.join(__dirname, '.env');
  
  if (fs.existsSync(envPath)) {
    console.log('ℹ️  .env file already exists');
    return;
  }
  
  const sampleContent = `# Firebase Configuration
FIREBASE_PROJECT_ID=your-firebase-project-id

# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key

# Local Mode Configuration
LOCAL_MODE=true

# S3 Configuration (required when LOCAL_MODE=false)
KHANA_KYA_BANAU_S3_BUCKET=your-s3-bucket-name

# Optional Configuration (with defaults)
COSINE_SIMILARITY_THRESHOLD=0.2
TEXT_SIMILARITY_THRESHOLD=0.2
MAX_MEALS_PER_BATCH=50
AWS_REGION=us-east-1

# Debug Mode
DEBUG=false
`;

  fs.writeFileSync(envPath, sampleContent);
  console.log('✅ Created sample .env file');
  console.log('📝 Please update the values in .env file with your actual credentials');
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  console.log('🚀 Local Lambda Runner for Meal-Image Mapping');
  console.log('===============================================\n');
  
  // Handle command line arguments
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node run-local.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --mock          Run with mock data (no external dependencies)');
    console.log('  --real          Run with real Firebase/OpenAI connections (fetch mode)');
    console.log('  --request       Run with real connections in REQUEST mode (specific meal names)');
    console.log('  --create-env    Create a sample .env file');
    console.log('  --help, -h      Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  node run-local.js --mock          # Run with mock data');
    console.log('  node run-local.js --real          # Run with real connections (fetch mode)');
    console.log('  node run-local.js --request       # Run with real connections (request mode)');
    console.log('  node run-local.js --create-env    # Create sample .env file');
    return;
  }
  
  if (args.includes('--create-env')) {
    createSampleEnvFile();
    return;
  }
  
  // Load environment variables from .env file if it exists
  loadEnvFile();
  
  if (args.includes('--mock')) {
    await runWithMockData();
  } else if (args.includes('--request')) {
    if (checkEnvironmentVariables()) {
      await runRequestModeWithRealData();
    } else {
      console.log('❌ Cannot run with real data - missing environment variables');
      console.log('💡 Use --mock flag to run with mock data, or set up environment variables');
    }
  } else if (args.includes('--real')) {
    if (checkEnvironmentVariables()) {
      await runWithRealData();
    } else {
      console.log('❌ Cannot run with real data - missing environment variables');
      console.log('💡 Use --mock flag to run with mock data, or set up environment variables');
    }
  } else {
    // Default behavior - try real first, fallback to mock
    if (checkEnvironmentVariables()) {
      console.log('🔗 Attempting to run with real connections...');
      await runWithRealData();
    } else {
      console.log('⚠️  Missing environment variables, running with mock data...');
      await runWithMockData();
    }
  }
}

// Run if this script is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { main, runWithMockData, runWithRealData };
