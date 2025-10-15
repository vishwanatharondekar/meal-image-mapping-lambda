#!/usr/bin/env node

/**
 * Test script for Lambda URL requests
 * 
 * This script demonstrates how to make HTTP requests to your Lambda function
 * using the Lambda URL in both request mode and fetch mode.
 */

const https = require('https');
const http = require('http');

// Your Lambda URL
const LAMBDA_URL = 'https://vraiw2cclkog6jntkxfcpet7oy0eeicy.lambda-url.us-west-2.on.aws/';

/**
 * Make HTTP request to Lambda URL
 */
function makeRequest(payload, description) {
  return new Promise((resolve, reject) => {
    console.log(`\n🧪 ${description}`);
    console.log('=' .repeat(50));
    
    const url = new URL(LAMBDA_URL);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const postData = JSON.stringify(payload);
    
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 300000 // 5 minutes timeout
    };
    
    const req = client.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = {
            statusCode: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null
          };
          
          console.log(`📊 Status Code: ${response.statusCode}`);
          console.log(`📋 Response:`, JSON.stringify(response.body, null, 2));
          
          resolve(response);
        } catch (error) {
          console.error('❌ Error parsing response:', error.message);
          console.log('Raw response:', data);
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ Request error:', error.message);
      reject(error);
    });
    
    req.on('timeout', () => {
      console.error('❌ Request timeout');
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.write(postData);
    req.end();
  });
}

/**
 * Test Request Mode - Process specific meal names
 */
async function testRequestMode() {
  const payload = {
    mealNames: [
      'Paneer Tikka Masala',
      'Chicken Biryani',
      'Dal Makhani',
      'Butter Chicken',
      'Palak Paneer',
      'Chicken Curry',
      'Rajma Chawal',
      'Fish Curry'
    ]
  };
  
  try {
    await makeRequest(payload, 'Testing REQUEST MODE - Processing specific meal names');
  } catch (error) {
    console.error('❌ Request mode test failed:', error.message);
  }
}

/**
 * Test Fetch Mode - Process unmapped meals from Firestore
 */
async function testFetchMode() {
  const payload = {}; // Empty payload triggers fetch mode
  
  try {
    await makeRequest(payload, 'Testing FETCH MODE - Processing unmapped meals from Firestore');
  } catch (error) {
    console.error('❌ Fetch mode test failed:', error.message);
  }
}

/**
 * Test with empty meal names array
 */
async function testEmptyMealNames() {
  const payload = {
    mealNames: []
  };
  
  try {
    await makeRequest(payload, 'Testing EMPTY MEAL NAMES - Should return appropriate message');
  } catch (error) {
    console.error('❌ Empty meal names test failed:', error.message);
  }
}

/**
 * Test with invalid JSON (should fall back to fetch mode)
 */
async function testInvalidRequest() {
  console.log('\n🧪 Testing INVALID REQUEST - Should fall back to fetch mode');
  console.log('=' .repeat(50));
  
  return new Promise((resolve, reject) => {
    const url = new URL(LAMBDA_URL);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const postData = 'invalid json';
    
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 300000
    };
    
    const req = client.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = {
            statusCode: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null
          };
          
          console.log(`📊 Status Code: ${response.statusCode}`);
          console.log(`📋 Response:`, JSON.stringify(response.body, null, 2));
          
          resolve(response);
        } catch (error) {
          console.error('❌ Error parsing response:', error.message);
          console.log('Raw response:', data);
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ Request error:', error.message);
      reject(error);
    });
    
    req.on('timeout', () => {
      console.error('❌ Request timeout');
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.write(postData);
    req.end();
  });
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🚀 Testing Lambda URL for meal-image-mapping function');
  console.log(`🔗 Lambda URL: ${LAMBDA_URL}`);
  console.log('=' .repeat(60));
  
  try {
    // Test all scenarios
    await testRequestMode();
    await testFetchMode();
    await testEmptyMealNames();
    await testInvalidRequest();
    
    console.log('\n🎉 All tests completed!');
    console.log('=' .repeat(60));
    
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
  }
}

/**
 * Run specific test based on command line argument
 */
async function main() {
  const args = process.argv.slice(2);
  const testType = args[0];
  
  switch (testType) {
    case 'request':
      await testRequestMode();
      break;
    case 'fetch':
      await testFetchMode();
      break;
    case 'empty':
      await testEmptyMealNames();
      break;
    case 'invalid':
      await testInvalidRequest();
      break;
    case 'all':
    default:
      await runAllTests();
      break;
  }
}

// Run if this script is executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testRequestMode,
  testFetchMode,
  testEmptyMealNames,
  testInvalidRequest,
  runAllTests,
  makeRequest
};
