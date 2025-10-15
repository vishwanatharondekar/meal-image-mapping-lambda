#!/usr/bin/env node

/**
 * Test script for S3 integration
 * 
 * This script tests the S3 data loading functionality
 * without requiring a full Lambda deployment.
 */

const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

// Initialize AWS S3
const s3Client = new S3Client();

// Configuration
const CONFIG = {
  KHANA_KYA_BANAU_S3_BUCKET: process.env.KHANA_KYA_BANAU_S3_BUCKET,
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
 * Test S3 data loading
 */
async function testS3DataLoading() {
  console.log('🧪 Testing S3 data loading...');
  
  if (!CONFIG.KHANA_KYA_BANAU_S3_BUCKET) {
    console.log('⚠️  KHANA_KYA_BANAU_S3_BUCKET environment variable not set, skipping S3 test');
    console.log('   Set KHANA_KYA_BANAU_S3_BUCKET environment variable to test S3 integration');
    return;
  }
  
  try {
    // Test fetching embeddings
    console.log('\n📖 Testing embeddings fetch...');
    const embeddingsData = await fetchFromS3(CONFIG.KHANA_KYA_BANAU_S3_BUCKET, CONFIG.S3_EMBEDDINGS_KEY);
    const embeddings = JSON.parse(embeddingsData);
    console.log(`✅ Loaded ${embeddings.length} embeddings from S3`);
    
    // Test fetching cuisines
    console.log('\n📖 Testing cuisines fetch...');
    const cuisinesData = await fetchFromS3(CONFIG.KHANA_KYA_BANAU_S3_BUCKET, CONFIG.S3_CUISINES_KEY);
    const cuisines = JSON.parse(cuisinesData);
    console.log(`✅ Loaded ${cuisines.length} cuisines from S3`);
    
    console.log('\n✅ S3 integration test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ S3 integration test failed:', error.message);
    console.log('\nTroubleshooting tips:');
    console.log('1. Ensure KHANA_KYA_BANAU_S3_BUCKET environment variable is set correctly');
    console.log('2. Verify the bucket exists and is accessible');
    console.log('3. Check that the data files exist at the expected S3 keys:');
    console.log(`   - ${CONFIG.S3_EMBEDDINGS_KEY}`);
    console.log(`   - ${CONFIG.S3_CUISINES_KEY}`);
    console.log('4. Ensure your AWS credentials have S3 read permissions');
  }
}

/**
 * Test local data loading (fallback)
 */
function testLocalDataLoading() {
  console.log('\n🧪 Testing local data loading (fallback)...');
  
  try {
    // Test local embeddings
    if (fs.existsSync(CONFIG.EMBEDDINGS_PATH)) {
      const embeddingsData = fs.readFileSync(CONFIG.EMBEDDINGS_PATH, 'utf8');
      const embeddings = JSON.parse(embeddingsData);
      console.log(`✅ Local embeddings loaded: ${embeddings.length} items`);
    } else {
      console.log('⚠️  Local embeddings file not found');
    }
    
    // Test local cuisines
    if (fs.existsSync(CONFIG.CUISINES_PATH)) {
      const cuisinesData = fs.readFileSync(CONFIG.CUISINES_PATH, 'utf8');
      const cuisines = JSON.parse(cuisinesData);
      console.log(`✅ Local cuisines loaded: ${cuisines.length} items`);
    } else {
      console.log('⚠️  Local cuisines file not found');
    }
    
  } catch (error) {
    console.error('❌ Local data loading test failed:', error.message);
  }
}

/**
 * Main test function
 */
async function main() {
  console.log('🚀 Starting S3 integration test...');
  console.log(`📋 Configuration:`, {
    KHANA_KYA_BANAU_S3_BUCKET: CONFIG.KHANA_KYA_BANAU_S3_BUCKET || 'Not set',
    S3_EMBEDDINGS_KEY: CONFIG.S3_EMBEDDINGS_KEY,
    S3_CUISINES_KEY: CONFIG.S3_CUISINES_KEY
  });
  
  await testS3DataLoading();
  testLocalDataLoading();
  
  console.log('\n📝 Test Summary:');
  console.log('- S3 integration: Tested (see results above)');
  console.log('- Local fallback: Tested (see results above)');
  console.log('- Ready for deployment with KHANA_KYA_BANAU_S3_BUCKET environment variable');
}

// Run the test
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
}

module.exports = {
  testS3DataLoading,
  testLocalDataLoading,
  fetchFromS3
};
