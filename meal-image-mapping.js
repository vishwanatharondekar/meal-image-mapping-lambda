/**
 * AWS Lambda function for meal-image mapping
 * 
 * This function runs on AWS Lambda with 1.5GB RAM, perfect for handling
 * large embeddings files that exceed Vercel's memory limits.
 * 
 * Configuration:
 * - Memory: 1,536MB (1.5GB)
 * - Timeout: 5 minutes
 * - Runtime: Node.js 18.x
 * 
 * Deployment:
 * 1. Zip this file with dependencies
 * 2. Upload to AWS Lambda
 * 3. Set environment variables
 * 4. Configure EventBridge trigger
 */

const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

// Initialize AWS services
const firestore = new AWS.Firehose(); // You'll need to configure Firestore access
const s3 = new AWS.S3();

// Configuration
const CONFIG = {
  // S3 bucket for embeddings (if using S3 storage)
  EMBEDDINGS_BUCKET: process.env.EMBEDDINGS_BUCKET || 'your-embeddings-bucket',
  EMBEDDINGS_KEY: 'data/image-embeddings.json',
  MAPPING_KEY: 'data/name-image-mapping.json',
  
  // OpenAI settings
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  
  // Processing limits
  MAX_MEALS_PER_BATCH: 50,
  COSINE_SIMILARITY_THRESHOLD: 0.7,
  TEXT_SIMILARITY_THRESHOLD: 0.6,
  
  // Memory management
  MAX_EMBEDDINGS_IN_MEMORY: 50000, // Lambda can handle this
};

/**
 * Load embeddings from S3 (or local file in Lambda package)
 */
async function loadEmbeddings() {
  try {
    // Option 1: Load from S3 (recommended for large files)
    if (CONFIG.EMBEDDINGS_BUCKET) {
      const embeddingsParams = {
        Bucket: CONFIG.EMBEDDINGS_BUCKET,
        Key: CONFIG.EMBEDDINGS_KEY
      };
      
      const embeddingsData = await s3.getObject(embeddingsParams).promise();
      const embeddings = JSON.parse(embeddingsData.Body.toString());
      
      const mappingParams = {
        Bucket: CONFIG.EMBEDDINGS_BUCKET,
        Key: CONFIG.MAPPING_KEY
      };
      
      const mappingData = await s3.getObject(mappingParams).promise();
      const nameImageMapping = JSON.parse(mappingData.Body.toString());
      
      return { embeddings, nameImageMapping };
    }
    
    // Option 2: Load from local files (if packaged with Lambda)
    const embeddingsPath = '/tmp/image-embeddings.json';
    const mappingPath = '/tmp/cuisines.json';
    
    if (fs.existsSync(embeddingsPath) && fs.existsSync(mappingPath)) {
      const embeddings = JSON.parse(fs.readFileSync(embeddingsPath, 'utf8'));
      const nameImageMapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
      
      return { embeddings, nameImageMapping };
    }
    
    throw new Error('No embeddings data found');
    
  } catch (error) {
    console.error('Error loading embeddings:', error);
    throw error;
  }
}

/**
 * Generate embedding using OpenAI API
 */
async function generateEmbedding(text) {
  if (!CONFIG.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: text,
        model: 'text-embedding-3-small'
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

/**
 * Calculate cosine similarity
 */
function calculateCosineSimilarity(a, b) {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Calculate text similarity
 */
function calculateTextSimilarity(text1, text2) {
  const normalize = (text) => text.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  
  const norm1 = normalize(text1);
  const norm2 = normalize(text2);
  
  if (norm1 === norm2) return 1.0;
  
  const words1 = norm1.split(/\s+/);
  const words2 = norm2.split(/\s+/);
  
  const intersection = words1.filter(word => words2.includes(word));
  const union = [...new Set([...words1, ...words2])];
  
  return intersection.length / union.length;
}

/**
 * Find best image match for a meal
 */
function findBestImageMatch(mealName, mealEmbedding, mealIsVegetarian, images, mealDescription) {
  let bestMatch = null;
  let bestCosineScore = 0;
  let bestTextScore = 0;
  let method = 'none';
  let reason = 'No suitable match found';

  for (const image of images) {
    // Vegetarian constraint check
    if (mealIsVegetarian && !image.isVegetarian) {
      continue; // Skip non-vegetarian images for vegetarian meals
    }

    // Calculate similarities
    const cosineScore = calculateCosineSimilarity(mealEmbedding, image.embedding);
    const textScore = calculateTextSimilarity(mealName, image.name || '');

    // Check if this is the best match
    if (cosineScore >= CONFIG.COSINE_SIMILARITY_THRESHOLD && cosineScore > bestCosineScore) {
      bestMatch = image;
      bestCosineScore = cosineScore;
      method = 'cosine';
      reason = `Cosine similarity ${cosineScore.toFixed(3)} >= ${CONFIG.COSINE_SIMILARITY_THRESHOLD}`;
    } else if (method !== 'cosine' && textScore >= CONFIG.TEXT_SIMILARITY_THRESHOLD && textScore > bestTextScore) {
      bestMatch = image;
      bestTextScore = textScore;
      method = 'text';
      reason = `Text similarity ${textScore.toFixed(3)} >= ${CONFIG.TEXT_SIMILARITY_THRESHOLD}`;
    }
  }

  return {
    bestMatch,
    cosineScore: bestCosineScore,
    textScore: bestTextScore,
    method,
    reason
  };
}

/**
 * Process a batch of meals
 */
async function processMealBatch(meals, images) {
  const results = [];

  for (const meal of meals) {
    try {
      // Generate embedding for the meal
      const mealEmbedding = await generateEmbedding(meal.name);
      
      // Find best image match
      const matchResult = findBestImageMatch(
        meal.name,
        mealEmbedding,
        meal.isVegetarian,
        images,
        meal.description
      );

      results.push({
        mealId: meal.id,
        mealName: meal.name,
        imageUrl: matchResult.bestMatch?.url || null,
        cosineScore: matchResult.cosineScore,
        textScore: matchResult.textScore,
        method: matchResult.method,
        reason: matchResult.reason,
        processedAt: new Date().toISOString()
      });

    } catch (error) {
      console.error(`Error processing meal ${meal.name}:`, error);
      results.push({
        mealId: meal.id,
        mealName: meal.name,
        imageUrl: null,
        method: 'error',
        error: error.message,
        processedAt: new Date().toISOString()
      });
    }
  }

  return results;
}

/**
 * Main Lambda handler
 */
exports.handler = async (event, context) => {
  console.log('🚀 Starting meal-image mapping Lambda function');
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const startTime = Date.now();
  
  try {
    // Load embeddings and mapping data
    console.log('📖 Loading embeddings and mapping data...');
    const { embeddings, nameImageMapping } = await loadEmbeddings();
    
    // Combine embeddings with image metadata
    const images = [];
    for (const embeddingItem of embeddings) {
      const imageData = nameImageMapping[embeddingItem.name];
      if (imageData) {
        images.push({
          id: `img_${imageData.index}`,
          url: imageData.imageUrl,
          embedding: embeddingItem.embedding,
          isVegetarian: imageData.isVegetarian,
          name: imageData.originalName,
          description: imageData.description
        });
      }
    }
    
    console.log(`✅ Loaded ${images.length} image embeddings`);
    
    // Get meals to process (from event or Firestore)
    const meals = event.meals || []; // You'll need to fetch from Firestore
    
    if (meals.length === 0) {
      console.log('No meals to process');
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'No meals to process',
          processedCount: 0
        })
      };
    }
    
    // Process meals in batches
    const allResults = [];
    const batchSize = CONFIG.MAX_MEALS_PER_BATCH;
    
    for (let i = 0; i < meals.length; i += batchSize) {
      const batch = meals.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(meals.length / batchSize)}`);
      
      const batchResults = await processMealBatch(batch, images);
      allResults.push(...batchResults);
      
      // Check remaining time
      const remainingTime = context.getRemainingTimeInMillis();
      if (remainingTime < 30000) { // Less than 30 seconds left
        console.log('⚠️  Approaching timeout, stopping processing');
        break;
      }
    }
    
    // Update Firestore with results
    // You'll need to implement Firestore updates here
    
    const executionTime = Date.now() - startTime;
    console.log(`✅ Processing completed in ${executionTime}ms`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Meal-image mapping completed',
        processedCount: allResults.length,
        executionTimeMs: executionTime,
        results: allResults
      })
    };
    
  } catch (error) {
    console.error('❌ Error in Lambda function:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message,
        executionTimeMs: Date.now() - startTime
      })
    };
  }
};
