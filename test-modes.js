#!/usr/bin/env node

/**
 * Test script for both processing modes of the meal-image mapping Lambda function
 * 
 * This script demonstrates how to test both:
 * 1. Fetch Mode: Automatically fetches unmapped meals from Firestore
 * 2. Request Mode: Processes specific meal names provided in request body
 */

const { handler } = require('./index');

// Mock AWS Lambda context
const mockContext = {
  getRemainingTimeInMillis: () => 300000 // 5 minutes
};

async function testFetchMode() {
  console.log('🧪 Testing FETCH MODE...');
  console.log('=' .repeat(50));
  
  try {
    // Empty event body triggers fetch mode
    const event = {};
    
    const result = await handler(event, mockContext);
    
    console.log('✅ Fetch Mode Test Result:');
    console.log('Status Code:', result.statusCode);
    console.log('Response Body:', JSON.stringify(JSON.parse(result.body), null, 2));
    
  } catch (error) {
    console.error('❌ Fetch Mode Test Failed:', error.message);
  }
  
  console.log('\n');
}

async function testRequestMode() {
  console.log('🧪 Testing REQUEST MODE...');
  console.log('=' .repeat(50));
  
  try {
    // Event with meal names triggers request mode
    const event = {
      body: JSON.stringify({
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
      })
    };
    
    const result = await handler(event, mockContext);
    
    console.log('✅ Request Mode Test Result:');
    console.log('Status Code:', result.statusCode);
    console.log('Response Body:', JSON.stringify(JSON.parse(result.body), null, 2));
    
  } catch (error) {
    console.error('❌ Request Mode Test Failed:', error.message);
  }
  
  console.log('\n');
}

async function testInvalidRequest() {
  console.log('🧪 Testing INVALID REQUEST...');
  console.log('=' .repeat(50));
  
  try {
    // Invalid JSON in body should fall back to fetch mode
    const event = {
      body: 'invalid json'
    };
    
    const result = await handler(event, mockContext);
    
    console.log('✅ Invalid Request Test Result:');
    console.log('Status Code:', result.statusCode);
    console.log('Response Body:', JSON.stringify(JSON.parse(result.body), null, 2));
    
  } catch (error) {
    console.error('❌ Invalid Request Test Failed:', error.message);
  }
  
  console.log('\n');
}

async function testEmptyMealNames() {
  console.log('🧪 Testing EMPTY MEAL NAMES...');
  console.log('=' .repeat(50));
  
  try {
    // Empty meal names array should return appropriate message
    const event = {
      body: JSON.stringify({
        mealNames: []
      })
    };
    
    const result = await handler(event, mockContext);
    
    console.log('✅ Empty Meal Names Test Result:');
    console.log('Status Code:', result.statusCode);
    console.log('Response Body:', JSON.stringify(JSON.parse(result.body), null, 2));
    
  } catch (error) {
    console.error('❌ Empty Meal Names Test Failed:', error.message);
  }
  
  console.log('\n');
}

async function runAllTests() {
  console.log('🚀 Starting Meal-Image Mapping Lambda Function Tests');
  console.log('=' .repeat(60));
  console.log('Testing both processing modes: FETCH and REQUEST');
  console.log('=' .repeat(60));
  console.log('\n');
  
  // Test all scenarios
  await testFetchMode();
  await testRequestMode();
  await testInvalidRequest();
  await testEmptyMealNames();
  
  console.log('🎉 All tests completed!');
  console.log('=' .repeat(60));
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testFetchMode,
  testRequestMode,
  testInvalidRequest,
  testEmptyMealNames,
  runAllTests
};
