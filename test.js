#!/usr/bin/env node

/**
 * Test script for meal-image-mapping Lambda function
 * 
 * This script tests the Lambda function locally with sample data.
 * It simulates the Lambda environment and tests the core functionality.
 */

const fs = require('fs');
const path = require('path');

// Mock AWS Lambda context
const mockContext = {
  getRemainingTimeInMillis: () => 300000, // 5 minutes
  functionName: 'meal-image-mapping',
  functionVersion: '$LATEST',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:meal-image-mapping',
  memoryLimitInMB: '1536',
  awsRequestId: 'test-request-id',
  logGroupName: '/aws/lambda/meal-image-mapping',
  logStreamName: '2024/01/01/[$LATEST]test-stream',
  identity: null,
  clientContext: null,
  callbackWaitsForEmptyEventLoop: true
};

// Mock Firebase client SDK
const mockFirestore = {
  collection: (name) => ({
    get: () => Promise.resolve({
      size: 2,
      forEach: (callback) => {
        // Mock meals data
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

// Set up environment variables for testing
process.env.FIREBASE_PROJECT_ID = 'test-project';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.COSINE_SIMILARITY_THRESHOLD = '0.7';
process.env.TEXT_SIMILARITY_THRESHOLD = '0.6';
process.env.MAX_MEALS_PER_BATCH = '10';

// Mock the Firebase client modules
jest.mock('firebase/app', () => ({ initializeApp: mockFirebase.initializeApp }));
jest.mock('firebase/firestore', () => ({
  getFirestore: mockFirebase.getFirestore,
  collection: mockFirebase.collection,
  getDocs: mockFirebase.getDocs,
  addDoc: mockFirebase.addDoc,
  serverTimestamp: mockFirebase.serverTimestamp
}));

/**
 * Test cosine similarity calculation
 */
function testCosineSimilarity() {
  console.log('🧪 Testing cosine similarity calculation...');
  
  const { calculateCosineSimilarity } = require('./index');
  
  const vectorA = [1, 2, 3];
  const vectorB = [1, 2, 3];
  const vectorC = [-1, -2, -3];
  
  const similarity1 = calculateCosineSimilarity(vectorA, vectorB);
  const similarity2 = calculateCosineSimilarity(vectorA, vectorC);
  
  console.log(`✅ Identical vectors similarity: ${similarity1} (expected: 1.0)`);
  console.log(`✅ Opposite vectors similarity: ${similarity2} (expected: -1.0)`);
  
  if (Math.abs(similarity1 - 1.0) < 0.001 && Math.abs(similarity2 - (-1.0)) < 0.001) {
    console.log('✅ Cosine similarity test passed');
    return true;
  } else {
    console.log('❌ Cosine similarity test failed');
    return false;
  }
}

/**
 * Test text similarity calculation
 */
function testTextSimilarity() {
  console.log('🧪 Testing text similarity calculation...');
  
  const { calculateTextSimilarity } = require('./index');
  
  const text1 = 'Chicken Biryani';
  const text2 = 'Chicken Biryani';
  const text3 = 'Vegetable Curry';
  const text4 = 'Biryani with Chicken';
  
  const similarity1 = calculateTextSimilarity(text1, text2);
  const similarity2 = calculateTextSimilarity(text1, text3);
  const similarity3 = calculateTextSimilarity(text1, text4);
  
  console.log(`✅ Identical text similarity: ${similarity1} (expected: 1.0)`);
  console.log(`✅ Different text similarity: ${similarity2} (expected: low)`);
  console.log(`✅ Similar text similarity: ${similarity3} (expected: medium)`);
  
  if (similarity1 === 1.0 && similarity2 < 0.5 && similarity3 > 0.3) {
    console.log('✅ Text similarity test passed');
    return true;
  } else {
    console.log('❌ Text similarity test failed');
    return false;
  }
}

/**
 * Test embedding loading
 */
function testEmbeddingLoading() {
  console.log('🧪 Testing embedding loading...');
  
  try {
    const { loadEmbeddings } = require('./index');
    const embeddings = loadEmbeddings();
    
    if (embeddings && embeddings.length > 0) {
      console.log(`✅ Loaded ${embeddings.length} embeddings`);
      console.log(`✅ First embedding has ${embeddings[0].embedding.length} dimensions`);
      return true;
    } else {
      console.log('❌ No embeddings loaded');
      return false;
    }
  } catch (error) {
    console.log(`❌ Embedding loading failed: ${error.message}`);
    return false;
  }
}

/**
 * Test meal batch processing
 */
async function testMealBatchProcessing() {
  console.log('🧪 Testing meal batch processing...');
  
  try {
    const { processMealBatch } = require('./index');
    
    const mockMeals = [
      {
        id: 'meal1',
        name: 'Chicken Biryani',
        description: 'Aromatic rice dish with chicken'
      },
      {
        id: 'meal2',
        name: 'Vegetable Curry',
        description: 'Mixed vegetables in curry sauce'
      }
    ];
    
    const mockImageEmbeddings = [
      {
        name: 'Chicken Biryani Image',
        url: 'https://example.com/chicken-biryani.jpg',
        embedding: new Array(1536).fill(0).map(() => Math.random() - 0.5)
      },
      {
        name: 'Vegetable Curry Image',
        url: 'https://example.com/vegetable-curry.jpg',
        embedding: new Array(1536).fill(0).map(() => Math.random() - 0.5)
      }
    ];
    
    const results = await processMealBatch(mockMeals, mockImageEmbeddings);
    
    if (results && results.length === 2) {
      console.log(`✅ Processed ${results.length} meals`);
      console.log(`✅ Results:`, results.map(r => ({ meal: r.mealName, method: r.method })));
      return true;
    } else {
      console.log('❌ Meal batch processing failed');
      return false;
    }
  } catch (error) {
    console.log(`❌ Meal batch processing failed: ${error.message}`);
    return false;
  }
}

/**
 * Test vegetarian detection
 */
function testVegetarianDetection() {
  console.log('🧪 Testing vegetarian detection...');
  
  const { detectMealVegetarian, detectImageNonVegetarian } = require('./vegetarian-detection');
  
  // Test meal detection
  const vegetarianMeal = detectMealVegetarian('Vegetable Curry', 'Mixed vegetables in curry sauce');
  const nonVegetarianMeal = detectMealVegetarian('Chicken Biryani', 'Aromatic rice dish with chicken');
  
  // Test image detection
  const vegetarianImageNonVeg = detectImageNonVegetarian('https://example.com/vegetable-curry.jpg', 'Vegetable Curry Image');
  const nonVegetarianImageNonVeg = detectImageNonVegetarian('https://example.com/chicken-biryani.jpg', 'Chicken Biryani Image');
  const vegetarianImage = !vegetarianImageNonVeg; // Convert to vegetarian boolean
  const nonVegetarianImage = !nonVegetarianImageNonVeg; // Convert to vegetarian boolean
  
  console.log(`✅ Vegetarian meal detected: ${vegetarianMeal} (expected: true)`);
  console.log(`✅ Non-vegetarian meal detected: ${nonVegetarianMeal} (expected: false)`);
  console.log(`✅ Vegetarian image detected: ${vegetarianImage} (expected: true)`);
  console.log(`✅ Non-vegetarian image detected: ${nonVegetarianImage} (expected: false)`);
  
  if (vegetarianMeal && !nonVegetarianMeal && vegetarianImage && !nonVegetarianImage) {
    console.log('✅ Vegetarian detection test passed');
    return true;
  } else {
    console.log('❌ Vegetarian detection test failed');
    return false;
  }
}

/**
 * Test vegetarian fail-safe
 */
function testVegetarianFailSafe() {
  console.log('🧪 Testing vegetarian fail-safe...');
  
  const { findBestImageMatch } = require('./index');
  
  const mealName = 'Vegetable Curry';
  const mealEmbedding = new Array(1536).fill(0).map(() => Math.random() - 0.5);
  const mealIsVegetarian = true;
  
  const imageEmbeddings = [
    {
      name: 'Chicken Biryani Image',
      url: 'https://example.com/chicken-biryani.jpg',
      embedding: new Array(1536).fill(0).map(() => Math.random() - 0.5)
    },
    {
      name: 'Vegetable Curry Image',
      url: 'https://example.com/vegetable-curry.jpg',
      embedding: new Array(1536).fill(0).map(() => Math.random() - 0.5)
    }
  ];
  
  const result = findBestImageMatch(mealName, mealEmbedding, mealIsVegetarian, imageEmbeddings);
  
  // The result should map to the vegetarian image, not the chicken one
  if (result.bestMatch && result.bestMatch.name === 'Vegetable Curry Image') {
    console.log('✅ Vegetarian fail-safe test passed - vegetarian meal mapped to vegetarian image');
    return true;
  } else {
    console.log('❌ Vegetarian fail-safe test failed');
    return false;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('🧪 Starting Lambda function tests...\n');
  
  const tests = [
    { name: 'Cosine Similarity', fn: testCosineSimilarity },
    { name: 'Text Similarity', fn: testTextSimilarity },
    { name: 'Embedding Loading', fn: testEmbeddingLoading },
    { name: 'Vegetarian Detection', fn: testVegetarianDetection },
    { name: 'Meal Batch Processing', fn: testMealBatchProcessing },
    { name: 'Vegetarian Fail-Safe', fn: testVegetarianFailSafe }
  ];
  
  let passed = 0;
  let total = tests.length;
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) passed++;
    } catch (error) {
      console.log(`❌ ${test.name} test failed with error: ${error.message}`);
    }
    console.log(''); // Empty line for readability
  }
  
  console.log(`📊 Test Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('✅ All tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed');
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests();
}

module.exports = { runTests };
