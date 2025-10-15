/**
 * Example configuration file for meal-image-mapping Lambda function
 * 
 * Copy this file to config.js and update with your actual values.
 * Or set these as environment variables in AWS Lambda.
 */

module.exports = {
  // Firebase Configuration
  firebase: {
    projectId: 'your-firebase-project-id'
  },

  // OpenAI Configuration
  openai: {
    apiKey: 'sk-your-openai-api-key'
  },

  // Similarity Thresholds
  similarity: {
    cosineThreshold: 0.7,
    textThreshold: 0.6
  },

  // Processing Configuration
  processing: {
    maxMealsPerBatch: 50,
    maxExecutionTimeMs: 4 * 60 * 1000, // 4 minutes
    timeoutBufferMs: 30000 // 30 seconds
  },

  // Firestore Collections
  collections: {
    meals: 'meals',
    mappings: 'mealImageMappings'
  },

  // AWS Configuration
  aws: {
    region: 'us-east-1'
  },

  // Debug Configuration
  debug: false
};
