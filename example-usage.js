/**
 * Example usage of the meal-image mapping Lambda function
 * 
 * This file demonstrates how to invoke the Lambda function in both modes
 * from a client application or another service.
 */

const AWS = require('aws-sdk');

// Configure AWS SDK
const lambda = new AWS.Lambda({
  region: process.env.AWS_REGION || 'us-east-1'
});

/**
 * Example: Fetch Mode
 * Automatically processes unmapped meals from Firestore
 */
async function exampleFetchMode() {
  console.log('📋 Example: Fetch Mode');
  console.log('This will process all unmapped meals from Firestore...\n');
  
  try {
    const params = {
      FunctionName: 'meal-image-mapping',
      Payload: JSON.stringify({}) // Empty payload triggers fetch mode
    };
    
    const result = await lambda.invoke(params).promise();
    const response = JSON.parse(result.Payload);
    
    console.log('✅ Fetch Mode Response:');
    console.log(`Mode: ${response.mode}`);
    console.log(`Processed: ${response.processedCount} meals`);
    console.log(`Successful mappings: ${response.successfulMappings}`);
    console.log(`Execution time: ${response.executionTimeMs}ms`);
    
    if (response.results && response.results.length > 0) {
      console.log('\n📊 Sample Results:');
      response.results.slice(0, 3).forEach((result, index) => {
        console.log(`${index + 1}. ${result.mealName} -> ${result.imageUrl || 'No match'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Fetch Mode Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
}

/**
 * Example: Request Mode
 * Process specific meal names provided in request
 */
async function exampleRequestMode() {
  console.log('📋 Example: Request Mode');
  console.log('This will process specific meal names...\n');
  
  const mealNames = [
    'Paneer Tikka Masala',
    'Chicken Biryani',
    'Dal Makhani',
    'Butter Chicken',
    'Palak Paneer'
  ];
  
  try {
    const params = {
      FunctionName: 'meal-image-mapping',
      Payload: JSON.stringify({
        mealNames: mealNames
      })
    };
    
    const result = await lambda.invoke(params).promise();
    const response = JSON.parse(result.Payload);
    
    console.log('✅ Request Mode Response:');
    console.log(`Mode: ${response.mode}`);
    console.log(`Processed: ${response.processedCount} meals`);
    console.log(`Successful mappings: ${response.successfulMappings}`);
    console.log(`Execution time: ${response.executionTimeMs}ms`);
    
    if (response.mealImageMappings) {
      console.log('\n🖼️  Meal Image Mappings:');
      Object.entries(response.mealImageMappings).forEach(([mealName, imageUrl]) => {
        console.log(`  ${mealName} -> ${imageUrl}`);
      });
    }
    
    if (response.results && response.results.length > 0) {
      console.log('\n📊 Detailed Results:');
      response.results.forEach((result, index) => {
        console.log(`${index + 1}. ${result.mealName}`);
        console.log(`   Image: ${result.imageUrl || 'No match'}`);
        console.log(`   Method: ${result.method}`);
        console.log(`   Cosine Score: ${result.cosineScore?.toFixed(3) || 'N/A'}`);
        console.log(`   Text Score: ${result.textScore?.toFixed(3) || 'N/A'}`);
        console.log(`   Vegetarian: ${result.mealIsVegetarian ? 'Yes' : 'No'}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Request Mode Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
}

/**
 * Example: Using the function from a web application
 */
function exampleWebAppUsage() {
  console.log('📋 Example: Web Application Usage');
  console.log('How to use this from a frontend application...\n');
  
  const exampleCode = `
// Frontend JavaScript example
async function getMealImages(mealNames) {
  try {
    const response = await fetch('/api/meal-image-mapping', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mealNames: mealNames
      })
    });
    
    const result = await response.json();
    
    if (result.mealImageMappings) {
      // Use the simplified mapping object
      return result.mealImageMappings;
    }
    
    // Fallback to processing results array
    const mappings = {};
    result.results.forEach(item => {
      if (item.imageUrl) {
        mappings[item.mealName] = item.imageUrl;
      }
    });
    
    return mappings;
    
  } catch (error) {
    console.error('Error fetching meal images:', error);
    return {};
  }
}

// Usage
const mealNames = ['Paneer Tikka Masala', 'Chicken Biryani'];
const imageMappings = await getMealImages(mealNames);
console.log(imageMappings);
// Output: { "Paneer Tikka Masala": "paneer-tikka-masala.jpg", ... }
  `;
  
  console.log('Frontend JavaScript Code:');
  console.log(exampleCode);
  
  console.log('\n' + '='.repeat(60) + '\n');
}

/**
 * Example: Error handling
 */
async function exampleErrorHandling() {
  console.log('📋 Example: Error Handling');
  console.log('How to handle errors and edge cases...\n');
  
  try {
    // Example with invalid meal names
    const params = {
      FunctionName: 'meal-image-mapping',
      Payload: JSON.stringify({
        mealNames: ['', null, 'Valid Meal Name', undefined]
      })
    };
    
    const result = await lambda.invoke(params).promise();
    const response = JSON.parse(result.Payload);
    
    console.log('✅ Error Handling Response:');
    console.log(`Status Code: ${result.StatusCode}`);
    console.log(`Mode: ${response.mode}`);
    console.log(`Processed: ${response.processedCount} meals`);
    
    if (response.error) {
      console.log(`Error: ${response.error}`);
    }
    
  } catch (error) {
    console.error('❌ Error Handling Example Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
}

/**
 * Run all examples
 */
async function runAllExamples() {
  console.log('🚀 Meal-Image Mapping Lambda Function - Usage Examples');
  console.log('='.repeat(60));
  console.log('This script demonstrates how to use both processing modes');
  console.log('='.repeat(60));
  console.log('\n');
  
  // Run examples
  await exampleFetchMode();
  await exampleRequestMode();
  exampleWebAppUsage();
  await exampleErrorHandling();
  
  console.log('🎉 All examples completed!');
  console.log('='.repeat(60));
  console.log('\n📚 Next Steps:');
  console.log('1. Deploy the Lambda function to AWS');
  console.log('2. Set up proper IAM permissions');
  console.log('3. Configure environment variables');
  console.log('4. Test with your actual meal data');
  console.log('5. Integrate with your application');
}

// Run examples if this script is executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}

module.exports = {
  exampleFetchMode,
  exampleRequestMode,
  exampleWebAppUsage,
  exampleErrorHandling,
  runAllExamples
};
