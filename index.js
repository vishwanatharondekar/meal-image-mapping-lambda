/**
 * AWS Lambda function for meal-image mapping
 * 
 * This function generates mappings from meal names to image URLs using precomputed embeddings.
 * It fetches unmapped meals from Firestore, computes similarity scores, and updates mappings.
 * 
 * Configuration:
 * - Memory: 1,536MB (1.5GB)
 * - Timeout: 5 minutes
 * - Runtime: Node.js 18.x
 * 
 * Environment Variables Required:
 * - FIREBASE_PROJECT_ID: Firebase project ID
 * - OPENAI_API_KEY: OpenAI API key for generating embeddings
 * - KHANA_KYA_BANAU_S3_BUCKET: S3 bucket name for data files (optional, falls back to local files)
 * - COSINE_SIMILARITY_THRESHOLD: Minimum cosine similarity (default: 0.7)
 * - TEXT_SIMILARITY_THRESHOLD: Minimum text similarity (default: 0.6)
 * - MAX_MEALS_PER_BATCH: Maximum meals to process per batch (default: 50)
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, addDoc, serverTimestamp } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { detectMealVegetarian, detectImageVegetarian, validateVegetarianConstraint } = require('./vegetarian-detection');

// Initialize AWS S3
const s3Client = new S3Client();

// Initialize Firebase client SDK
let firestore;
try {
  const firebaseConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    // For client SDK, we don't need private key and client email
    // The Lambda function will use the project ID to connect
  };

  const app = initializeApp(firebaseConfig);
  firestore = getFirestore(app);
  console.log('Firebase client SDK initialized');
} catch (error) {
  console.error('❌ Failed to initialize Firebase:', error);
  throw error;
}

// Configuration with environment variable overrides
const CONFIG = {
  // Similarity thresholds
  COSINE_SIMILARITY_THRESHOLD: parseFloat(process.env.COSINE_SIMILARITY_THRESHOLD) || 0.2,
  TEXT_SIMILARITY_THRESHOLD: parseFloat(process.env.TEXT_SIMILARITY_THRESHOLD) || 0.2,
  
  // Processing limits
  MAX_MEALS_PER_BATCH: parseInt(process.env.MAX_MEALS_PER_BATCH) || 50,
  MAX_EXECUTION_TIME_MS: 4 * 60 * 1000, // 4 minutes (leave 1 minute buffer)
  
  // Firestore collections
  MEALS_COLLECTION: 'mealPlans',
  MAPPINGS_COLLECTION: 'mealImageMappings',
  
  // S3 configuration
  S3_BUCKET: process.env.KHANA_KYA_BANAU_S3_BUCKET,
  S3_EMBEDDINGS_KEY: 'data/image-embeddings.json',
  S3_CUISINES_KEY: 'data/cuisines.json',
  
  // Local data paths (fallback)
  EMBEDDINGS_PATH: path.join(__dirname, 'data', 'image-embeddings.json'),
  CUISINES_PATH: path.join(__dirname, 'data', 'cuisines.json'),
};

/**
 * Fetch data from S3
 */
async function fetchFromS3(bucket, key) {
  try {
    console.log(`📥 Fetching ${key} from S3 bucket: ${bucket}`);
    
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key
    });
    
    const response = await s3Client.send(command);
    const content = await response.Body.transformToString('utf8');
    
    console.log(`✅ Successfully fetched ${key} from S3 (${content.length} characters)`);
    return content;
    
  } catch (error) {
    console.error(`❌ Error fetching ${key} from S3:`, error);
    throw error;
  }
}

/**
 * Load cuisines data and create a map for quick lookup
 */
async function loadCuisineMap() {
  try {
    let cuisinesData;
    if (CONFIG.S3_BUCKET) {
      try {
        console.log('📖 Loading cuisines data from S3...');
        cuisinesData = await fetchFromS3(CONFIG.S3_BUCKET, CONFIG.S3_CUISINES_KEY);
      } catch (s3Error) {
        console.warn('⚠️  Failed to load from S3, falling back to local file:', s3Error.message);
        cuisinesData = null;
      }
    }

    if (!cuisinesData) {
      throw new Error('No cuisines data found');
    }
    
    const cuisines = JSON.parse(cuisinesData);
    
    // Create a map for quick lookup by name
    const cuisineMap = new Map();
    cuisines.forEach(cuisine => {
      if (cuisine.name && cuisine.imageUrl) {
        cuisineMap[cuisine.name] = cuisine;
      }
    });
    
    console.log(`✅ Loaded ${Object.entries(cuisineMap).length} cuisines into map`);
    return cuisineMap;
    
  } catch (error) {
    console.error('❌ Error loading cuisines data:', error);
    return new Map();
  }
}

// Global variables for loaded data
let cuisineMap = null;
let imageEmbeddings = null;

/**
 * Load precomputed embeddings from S3 or local file
 */
async function loadEmbeddings() {
  try {
    let embeddingsData;
    
    // Try S3 first if bucket is configured
    if (CONFIG.S3_BUCKET) {
      try {
        console.log('📖 Loading embeddings from S3...');
        embeddingsData = await fetchFromS3(CONFIG.S3_BUCKET, CONFIG.S3_EMBEDDINGS_KEY);
      } catch (s3Error) {
        console.warn('⚠️  Failed to load from S3, falling back to local file:', s3Error.message);
        embeddingsData = null;
      }
    }

    if (!embeddingsData) {
      throw new Error('No embeddings data found');
    }
    
    const embeddings = JSON.parse(embeddingsData);
    
    console.log(`✅ Loaded ${embeddings.length} image embeddings`);
    return embeddings;
    
  } catch (error) {
    console.error('❌ Error loading embeddings:', error);
    throw error;
  }
}

/**
 * Process meal names from request body
 */
async function processRequestMeals(mealNames) {
  try {
    console.log(`🔄 Processing ${mealNames.length} meal names from request...`);
    
    const meals = mealNames.map((mealName, index) => {
      // Detect vegetarian status using the vegetarian detection module
      const isVegetarian = detectMealVegetarian(mealName, '');
      
      return {
        id: `request_${index}_${Date.now()}`,
        name: mealName,
        isVegetarian: isVegetarian,
        description: `Requested meal: ${mealName}`,
        cuisine: 'Indian', // Default cuisine
        source: 'request'
      };
    });
    
    console.log(`✅ Processed ${meals.length} meals from request`);
    return meals;
    
  } catch (error) {
    console.error('❌ Error processing request meals:', error);
    throw error;
  }
}

/**
 * Fetch unmapped meals from Firestore
 */
async function fetchUnmappedMeals() {
  try {
    console.log('🔍 Fetching unmapped meals from Firestore...');
    
    // Get all meals
    const mealsCollection = collection(firestore, CONFIG.MEALS_COLLECTION);
    const mealsSnapshot = await getDocs(mealsCollection);
    
    // Get existing mappings
    const mappingsCollection = collection(firestore, CONFIG.MAPPINGS_COLLECTION);
    const mappingsSnapshot = await getDocs(mappingsCollection);
    const existingMappings = new Set();
    
    mappingsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.mealName) {
        existingMappings.add(data.mealName);
      }
    });
    
    // Filter out already mapped meals and detect vegetarian status
    const unmappedMeals = [];
    mealsSnapshot.forEach(doc => {
      const mealData = doc.data();
      
      console.log('Processing meal data:', doc.id);
      
      // Parse meals from the nested structure (weekly meal plans)
      if (mealData.meals) {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const mealTypes = ['breakfast', 'lunch', 'dinner', 'morningSnack', 'eveningSnack'];
        
        days.forEach(day => {
          if (mealData.meals[day]) {
            mealTypes.forEach(mealType => {
              const mealDataItem = mealData.meals[day][mealType];
              
              // Handle both string and object formats
              let mealName;
              if (typeof mealDataItem === 'string') {
                mealName = mealDataItem;
              } else if (mealDataItem && typeof mealDataItem === 'object' && mealDataItem.name) {
                mealName = mealDataItem.name;
              } else {
                // Skip if not a valid meal name
                return;
              }
              
              if (mealName && !existingMappings.has(mealName)) {
                // Detect vegetarian status using the vegetarian detection module
                const isVegetarian = detectMealVegetarian(mealName, '');
                
                unmappedMeals.push({
                  id: `${doc.id}_${day}_${mealType}`,
                  name: mealName,
                  isVegetarian: isVegetarian,
                  description: `${mealType} for ${day}`,
                  cuisine: 'Indian', // Default cuisine
                  day: day,
                  mealType: mealType,
                  weekStartDate: mealData.weekStartDate,
                  userId: mealData.userId,
                  originalDocId: doc.id
                });
                
                console.log(`Found unmapped meal: "${mealName}" (${day} ${mealType})`);
              }
            });
          }
        });
      }
      // Handle legacy format with direct name field
      else if (mealData.name && !existingMappings.has(mealData.name)) {
        // Detect vegetarian status using the vegetarian detection module
        const isVegetarian = detectMealVegetarian(mealData.name, mealData.description);
        
        unmappedMeals.push({
          id: doc.id,
          name: mealData.name,
          isVegetarian: isVegetarian,
          description: mealData.description || '',
          cuisine: mealData.cuisine || '',
          ...mealData
        });
        
        console.log(`Found unmapped meal: "${mealData.name}"`);
      }
    });
    
    console.log(`✅ Found ${unmappedMeals.length} unmapped meals out of ${mealsSnapshot.size} total meals`);
    return unmappedMeals;
    
  } catch (error) {
    console.error('❌ Error fetching unmapped meals:', error);
    throw error;
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
function calculateCosineSimilarity(vectorA, vectorB) {
  if (vectorA.length !== vectorB.length) {
    throw new Error(`Vector length mismatch: ${vectorA.length} vs ${vectorB.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
    normA += vectorA[i] * vectorA[i];
    normB += vectorB[i] * vectorB[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

/**
 * Calculate text-based similarity using Jaccard similarity
 */
function calculateTextSimilarity(text1, text2) {
  const normalize = (text) => {
    return text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0);
  };
  
  const words1 = normalize(text1);
  const words2 = normalize(text2);
  
  if (words1.length === 0 && words2.length === 0) return 1.0;
  if (words1.length === 0 || words2.length === 0) return 0.0;
  
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  
  const intersection = new Set([...set1].filter(word => set2.has(word)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

/**
 * Find the best matching image for a meal
 */
function findBestImageMatch(mealName, mealEmbedding, mealIsVegetarian, imageEmbeddings) {
  let bestMatch = null;
  let bestCosineScore = 0;
  let bestTextScore = 0;
  let method = 'none';
  let reason = 'No suitable match found';

  console.log(`🔍 Finding best match for meal: "${mealName}" (vegetarian: ${mealIsVegetarian})`);

  for (const imageEmbedding of imageEmbeddings) {
    // Detect vegetarian status for the image if not already set
    const imageIsVegetarian = imageEmbedding.isVegetarian !== undefined 
      ? imageEmbedding.isVegetarian 
      : detectImageVegetarian(imageEmbedding.url, imageEmbedding.name, imageEmbedding.description);
    
    // Vegetarian fail-safe: never map vegetarian meal to non-vegetarian image
    if (mealIsVegetarian && !imageIsVegetarian) {
      continue;
    }

    // Calculate cosine similarity
    const cosineScore = calculateCosineSimilarity(mealEmbedding, imageEmbedding.embedding);
    
    // Calculate text similarity
    const textScore = calculateTextSimilarity(mealName, imageEmbedding.name || '');

    // Determine if this is a better match
    if (cosineScore >= CONFIG.COSINE_SIMILARITY_THRESHOLD && cosineScore > bestCosineScore) {
      bestMatch = imageEmbedding;
      bestCosineScore = cosineScore;
      method = 'cosine';
      reason = `Cosine similarity ${cosineScore.toFixed(3)} >= ${CONFIG.COSINE_SIMILARITY_THRESHOLD}`;
    } else if (method !== 'cosine' && textScore >= CONFIG.TEXT_SIMILARITY_THRESHOLD && textScore > bestTextScore) {
      bestMatch = imageEmbedding;
      bestTextScore = textScore;
      method = 'text';
      reason = `Text similarity ${textScore.toFixed(3)} >= ${CONFIG.TEXT_SIMILARITY_THRESHOLD}`;
    }
  }

  const result = {
    bestMatch,
    cosineScore: bestCosineScore,
    textScore: bestTextScore,
    method,
    reason,
    url: cuisineMap[bestMatch.name].imageUrl
  };

  console.log(`📊 Match result for "${mealName}": ${method} (cosine: ${bestCosineScore.toFixed(3)}, text: ${bestTextScore.toFixed(3)})`);
  
  return result;
}

/**
 * Generate embedding for meal name using OpenAI API
 */
async function generateMealEmbedding(mealName) {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: mealName,
        model: 'text-embedding-3-small'
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
    
  } catch (error) {
    console.error(`❌ Error generating embedding for "${mealName}":`, error);
    throw error;
  }
}

/**
 * Process a batch of meals
 */
async function processMealBatch(meals, imageEmbeddings) {
  const results = [];
  
  console.log(`🔄 Processing batch of ${meals.length} meals...`);

  for (const meal of meals) {
    try {
      // Generate embedding for the meal
      const mealEmbedding = await generateMealEmbedding(meal.name);

      // Find best image match
      const matchResult = findBestImageMatch(
        meal.name,
        mealEmbedding,
        meal.isVegetarian,
        imageEmbeddings
      );


      const result = {
        mealId: meal.id,
        mealName: meal.name,
        imageUrl: matchResult.url || null,
        imageName: matchResult.bestMatch?.name || null,
        cosineScore: matchResult.cosineScore,
        textScore: matchResult.textScore,
        method: matchResult.method,
        reason: matchResult.reason,
        mealIsVegetarian: meal.isVegetarian,
        imageIsVegetarian: matchResult.bestMatch ? 
          (matchResult.bestMatch.isVegetarian !== undefined 
            ? matchResult.bestMatch.isVegetarian 
            : detectImageVegetarian(matchResult.bestMatch.url, matchResult.bestMatch.name, matchResult.bestMatch.description)) 
          : null,
        // Additional metadata for weekly meal plans
        day: meal.day || null,
        mealType: meal.mealType || null,
        weekStartDate: meal.weekStartDate || null,
        userId: meal.userId || null,
        originalDocId: meal.originalDocId || null,
        processedAt: new Date().toISOString()
      };

      results.push(result);
      
      // Log successful mapping
      if (result.imageUrl) {
        console.log(`✅ Mapped "${meal.name}" -> "${result.imageName}" (${result.method})`);
      } else {
        console.log(`⚠️  No suitable image found for "${meal.name}"`);
      }

    } catch (error) {
      console.error(`❌ Error processing meal "${meal.name}":`, error);
      results.push({
        mealId: meal.id,
        mealName: meal.name,
        imageUrl: null,
        method: 'error',
        error: error.message,
        // Additional metadata for weekly meal plans
        day: meal.day || null,
        mealType: meal.mealType || null,
        weekStartDate: meal.weekStartDate || null,
        userId: meal.userId || null,
        originalDocId: meal.originalDocId || null,
        processedAt: new Date().toISOString()
      });
    }
  }

  return results;
}

/**
 * Update Firestore with mapping results
 */
async function updateFirestoreMappings(results) {
  try {
    console.log(`💾 Updating Firestore with ${results.length} mappings...`);
    
    const mappingsCollection = collection(firestore, CONFIG.MAPPINGS_COLLECTION);
    let updateCount = 0;

    for (const result of results) {
      if (result.imageUrl && result.method !== 'error') {
        await addDoc(mappingsCollection, {
          mealId: result.mealId,
          mealName: result.mealName,
          imageUrl: result.imageUrl,
          imageName: result.imageName,
          cosineScore: result.cosineScore,
          textScore: result.textScore,
          method: result.method,
          reason: result.reason,
          mealIsVegetarian: result.mealIsVegetarian,
          imageIsVegetarian: result.imageIsVegetarian,
          // Additional metadata for weekly meal plans
          day: result.day || null,
          mealType: result.mealType || null,
          weekStartDate: result.weekStartDate || null,
          userId: result.userId || null,
          originalDocId: result.originalDocId || null,
          createdAt: serverTimestamp(),
          processedAt: result.processedAt
        });
        
        updateCount++;
      }
    }

    if (updateCount > 0) {
      console.log(`✅ Successfully updated ${updateCount} mappings in Firestore`);
    } else {
      console.log('ℹ️  No mappings to update in Firestore');
    }
    
  } catch (error) {
    console.error('❌ Error updating Firestore mappings:', error);
    throw error;
  }
}

/**
 * Main Lambda handler
 */
exports.handler = async (event, context) => {
  console.log('🚀 Starting meal-image mapping Lambda function');
  console.log('📋 Configuration:', {
    cosineThreshold: CONFIG.COSINE_SIMILARITY_THRESHOLD,
    textThreshold: CONFIG.TEXT_SIMILARITY_THRESHOLD,
    maxBatchSize: CONFIG.MAX_MEALS_PER_BATCH,
    maxExecutionTime: CONFIG.MAX_EXECUTION_TIME_MS
  });
  
  const startTime = Date.now();
  let processedCount = 0;
  let mode = 'fetch'; // Default mode: fetch from Firestore
  
  try {
    // Load data from S3 or local files
    if(!cuisineMap || !imageEmbeddings) {
      [cuisineMap, imageEmbeddings] = await Promise.all([
        loadCuisineMap(),
        loadEmbeddings()
      ]);
    }

    // Determine processing mode based on event
    let mealsToProcess = [];
    
    // Check if this is a request with meal names
    if (event.body) {
      try {
        const requestBody = JSON.parse(event.body);
        if (requestBody.mealNames && Array.isArray(requestBody.mealNames) && requestBody.mealNames.length > 0) {
          mode = 'request';
          console.log('📝 Processing mode: REQUEST - meal names provided in request body');
          mealsToProcess = await processRequestMeals(requestBody.mealNames);
        }
      } catch (parseError) {
        console.log('⚠️  Could not parse request body, falling back to fetch mode');
      }
    }
    
    // If not request mode, fetch unmapped meals from Firestore
    if (mode === 'fetch') {
      console.log('🔍 Processing mode: FETCH - fetching unmapped meals from Firestore');
      mealsToProcess = await fetchUnmappedMeals();
    }
    
    if (mealsToProcess.length === 0) {
      const message = mode === 'request' ? 'No meal names provided in request' : 'No unmapped meals found';
      console.log(`✅ ${message}`);
      return {
        statusCode: 200,
        body: JSON.stringify({
          message,
          mode,
          processedCount: 0,
          executionTimeMs: Date.now() - startTime
        })
      };
    }
    
    // Process meals in batches
    const allResults = [];
    const batchSize = CONFIG.MAX_MEALS_PER_BATCH;
    
    for (let i = 0; i < mealsToProcess.length; i += batchSize) {
      // Check remaining execution time
      const remainingTime = context.getRemainingTimeInMillis();
      if (remainingTime < 30000) { // Less than 30 seconds left
        console.log('⚠️  Approaching timeout, stopping processing');
        break;
      }
      
      const batch = mealsToProcess.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(mealsToProcess.length / batchSize);
      
      console.log(`🔄 Processing batch ${batchNumber}/${totalBatches} (${batch.length} meals)`);
      console.log('imageEmbeddings', imageEmbeddings.length);
      console.log('cuisineMap length', Object.entries(cuisineMap).length);
      const batchResults = await processMealBatch(batch, imageEmbeddings);
      allResults.push(...batchResults);
      processedCount += batch.length;
      
      // Update Firestore after each batch to avoid losing progress
      await updateFirestoreMappings(batchResults);
    }
    
    const executionTime = Date.now() - startTime;
    const successfulMappings = allResults.filter(r => r.imageUrl && r.method !== 'error').length;
    
    console.log(`✅ Processing completed in ${executionTime}ms`);
    console.log(`📊 Results: ${successfulMappings}/${processedCount} meals successfully mapped`);
    
    // Format response based on mode
    const response = {
      message: 'Meal-image mapping completed',
      mode,
      processedCount,
      successfulMappings,
      executionTimeMs: executionTime,
      results: allResults
    };
    
    // For request mode, also provide a simplified mapping object
    if (mode === 'request') {
      const mealImageMappings = {};
      allResults.forEach(result => {
        if (result.imageUrl && result.method !== 'error') {
          mealImageMappings[result.mealName] = result.imageUrl;
        }
      });
      response.mealImageMappings = mealImageMappings;
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify(response)
    };
    
  } catch (error) {
    console.error('❌ Error in Lambda function:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message,
        mode,
        processedCount,
        executionTimeMs: Date.now() - startTime
      })
    };
  }
};
