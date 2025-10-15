# Meal-Image Mapping Lambda Function

A self-contained AWS Lambda function that generates mappings from meal names to image URLs using precomputed embeddings. The function fetches unmapped meals from Firestore, computes similarity scores using both cosine similarity and text-based similarity, and updates Firestore with the mappings.

## Features

- **Dual Processing Modes**: 
  - **Fetch Mode**: Automatically fetches unmapped meals from Firestore (default)
  - **Request Mode**: Processes specific meal names provided in request body
- **Precomputed Embeddings**: Uses local embeddings stored within the Lambda package
- **Dual Similarity Matching**: Combines cosine similarity and text-based similarity for better accuracy
- **Vegetarian Fail-Safe**: Ensures vegetarian meals are never mapped to non-vegetarian images
- **Batch Processing**: Processes meals in configurable batches to handle large datasets
- **Timeout Handling**: Monitors execution time and stops before Lambda timeout
- **Comprehensive Logging**: Detailed logging for debugging and monitoring
- **Firestore Integration**: Fetches meals and updates mappings in Firestore

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Firestore     │    │   Lambda Function │    │  Local Embeddings│
│                 │    │                  │    │                 │
│ • Fetch meals   │───▶│ • Load embeddings│◀───│ • image-        │
│ • Update        │◀───│ • Compute        │    │   embeddings.json│
│   mappings      │    │   similarity     │    │                 │
└─────────────────┘    │ • Match images   │    └─────────────────┘
                       │ • Update DB      │
                       └──────────────────┘
```

## Directory Structure

```
lambda/
├── index.js                    # Main Lambda handler
├── package.json               # Dependencies and scripts
├── deploy.js                  # Deployment script
├── test.js                    # Test script
├── README.md                  # This file
└── data/
    └── image-embeddings.json  # Precomputed embeddings
```

## Prerequisites

### 1. AWS CLI Setup
```bash
# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configure AWS credentials
aws configure
```

### 2. Environment Variables
Set the following environment variables before deployment:

```bash
# Firebase Configuration
export FIREBASE_PROJECT_ID="your-firebase-project-id"

# OpenAI Configuration
export OPENAI_API_KEY="sk-your-openai-api-key"

# Optional Configuration (with defaults)
export COSINE_SIMILARITY_THRESHOLD="0.7"  # Default: 0.7
export TEXT_SIMILARITY_THRESHOLD="0.6"    # Default: 0.6
export MAX_MEALS_PER_BATCH="50"           # Default: 50
export AWS_REGION="us-east-1"             # Default: us-east-1
```

### 3. Firebase Project Setup
1. Go to Firebase Console → Project Settings
2. Copy your Project ID
3. Ensure your Firestore database has the required collections: `meals` and `mealImageMappings`

## Installation

### 1. Install Dependencies
```bash
cd lambda
npm install --production
```

### 2. Verify Data Files
Ensure the embeddings file exists:
```bash
ls -la data/image-embeddings.json
```

## Deployment

### Quick Deployment
```bash
# Make deploy script executable
chmod +x deploy.js

# Deploy to AWS Lambda
npm run deploy
```

### Manual Deployment
```bash
# 1. Package the function
npm run package

# 2. Create IAM role (if not exists)
aws iam create-role --role-name meal-image-mapping-role --assume-role-policy-document '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}'

# 3. Attach execution policy
aws iam attach-role-policy --role-name meal-image-mapping-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# 4. Deploy function
aws lambda create-function \
  --function-name meal-image-mapping \
  --runtime nodejs18.x \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/meal-image-mapping-role \
  --handler index.handler \
  --zip-file fileb://meal-image-mapping.zip \
  --memory-size 1536 \
  --timeout 300 \
  --description "Meal-image mapping function with precomputed embeddings"

# 5. Set environment variables
aws lambda update-function-configuration \
  --function-name meal-image-mapping \
  --environment Variables='{
    "FIREBASE_PROJECT_ID":"your-project-id",
    "OPENAI_API_KEY":"your-openai-key"
  }'
```

## Configuration

### Lambda Function Settings
- **Memory**: 1,536 MB (1.5 GB)
- **Timeout**: 5 minutes
- **Runtime**: Node.js 18.x
- **Handler**: index.handler

### Similarity Thresholds
- **Cosine Similarity**: 0.7 (configurable via environment variable)
- **Text Similarity**: 0.6 (configurable via environment variable)

### Batch Processing
- **Max Meals per Batch**: 50 (configurable via environment variable)
- **Timeout Buffer**: 30 seconds (stops processing before Lambda timeout)

## Usage

### Processing Modes

The Lambda function supports two processing modes:

#### 1. Fetch Mode (Default)
Automatically fetches unmapped meals from Firestore and processes them.

```bash
# Invoke with empty payload (will fetch all unmapped meals)
aws lambda invoke \
  --function-name meal-image-mapping \
  --payload '{}' \
  response.json
```

#### 2. Request Mode
Process specific meal names provided in the request body.

```bash
# Invoke with meal names in request body
aws lambda invoke \
  --function-name meal-image-mapping \
  --payload '{
    "mealNames": [
      "Paneer Tikka Masala",
      "Chicken Biryani",
      "Dal Makhani",
      "Butter Chicken"
    ]
  }' \
  response.json
```

### Response Format

#### Fetch Mode Response
```json
{
  "message": "Meal-image mapping completed",
  "mode": "fetch",
  "processedCount": 15,
  "successfulMappings": 12,
  "executionTimeMs": 45000,
  "results": [
    {
      "mealId": "user123_2024-01-01_monday_breakfast",
      "mealName": "Paneer Tikka Masala",
      "imageUrl": "paneer-tikka-masala.jpg",
      "imageName": "Paneer Tikka Masala",
      "cosineScore": 0.85,
      "textScore": 0.92,
      "method": "cosine",
      "reason": "Cosine similarity 0.850 >= 0.200",
      "mealIsVegetarian": true,
      "imageIsVegetarian": true,
      "day": "monday",
      "mealType": "breakfast",
      "weekStartDate": "2024-01-01",
      "userId": "user123",
      "originalDocId": "user123_2024-01-01",
      "processedAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

#### Request Mode Response
```json
{
  "message": "Meal-image mapping completed",
  "mode": "request",
  "processedCount": 4,
  "successfulMappings": 3,
  "executionTimeMs": 12000,
  "mealImageMappings": {
    "Paneer Tikka Masala": "paneer-tikka-masala.jpg",
    "Chicken Biryani": "chicken-biryani.jpg",
    "Dal Makhani": "dal-makhani.jpg"
  },
  "results": [
    {
      "mealId": "request_0_1705312200000",
      "mealName": "Paneer Tikka Masala",
      "imageUrl": "paneer-tikka-masala.jpg",
      "imageName": "Paneer Tikka Masala",
      "cosineScore": 0.85,
      "textScore": 0.92,
      "method": "cosine",
      "reason": "Cosine similarity 0.850 >= 0.200",
      "mealIsVegetarian": true,
      "imageIsVegetarian": true,
      "source": "request",
      "processedAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

### Invoke Function
```bash
# Test invocation (fetch mode)
aws lambda invoke \
  --function-name meal-image-mapping \
  --payload '{}' \
  response.json

# View response
cat response.json
```

### EventBridge Trigger (Recommended)
Set up an EventBridge rule to trigger the function periodically:

```bash
# Create EventBridge rule (daily at 2 AM UTC)
aws events put-rule \
  --name meal-image-mapping-schedule \
  --schedule-expression "cron(0 2 * * ? *)" \
  --description "Daily meal-image mapping"

# Add Lambda target
aws events put-targets \
  --rule meal-image-mapping-schedule \
  --targets "Id"="1","Arn"="arn:aws:lambda:us-east-1:YOUR_ACCOUNT_ID:function:meal-image-mapping"
```

### Manual Trigger
```bash
# Invoke with empty payload (will fetch all unmapped meals)
aws lambda invoke \
  --function-name meal-image-mapping \
  --payload '{}' \
  response.json
```

## Testing

### Run Local Tests
```bash
# Run basic test suite
npm test

# Run tests for both processing modes (fetch and request)
npm run test-modes

# Run usage examples
npm run example

# Or run directly
node test.js
node test-modes.js
node example-usage.js
```

### Run Lambda Function Locally
```bash
# Run with mock data (no external dependencies required)
npm run run-local:mock

# Run with real Firebase/OpenAI connections
npm run run-local:real

# Create a sample .env file for configuration
npm run create-env

# Run with automatic fallback (real if env vars set, mock otherwise)
npm run run-local
```

#### Local Running Options

1. **Mock Mode** (`--mock`): Runs with simulated data, no Firebase or OpenAI API calls
   - Perfect for testing the core logic
   - No external dependencies required
   - Uses sample meal data

2. **Real Mode** (`--real`): Runs with actual Firebase and OpenAI connections
   - Requires proper environment variables
   - Fetches real meals from Firestore
   - Makes actual OpenAI API calls for embeddings

3. **Environment Setup**: Create a `.env` file with your credentials:
   ```bash
   npm run create-env
   # Then edit the .env file with your actual values
   ```

#### Local Running Examples
```bash
# Quick test with mock data
node run-local.js --mock

# Test with real connections (requires .env file)
node run-local.js --real

# Create environment file template
node run-local.js --create-env

# Show help
node run-local.js --help
```

### Test Individual Components
```javascript
// Test cosine similarity
const { calculateCosineSimilarity } = require('./index');
const similarity = calculateCosineSimilarity([1,2,3], [1,2,3]);
console.log(similarity); // Should be 1.0

// Test text similarity
const { calculateTextSimilarity } = require('./index');
const textSim = calculateTextSimilarity('Chicken Biryani', 'Chicken Biryani');
console.log(textSim); // Should be 1.0
```

## Monitoring

### CloudWatch Logs
Monitor function execution in CloudWatch:
```bash
# View recent logs
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/meal-image-mapping

# Stream logs
aws logs tail /aws/lambda/meal-image-mapping --follow
```

### Key Metrics to Monitor
- **Duration**: Should be under 5 minutes
- **Memory Usage**: Should be under 1.5 GB
- **Error Rate**: Should be 0%
- **Throttles**: Should be 0

## Troubleshooting

### Common Issues

#### 1. Firebase Authentication Error
```
Error: Failed to initialize Firebase
```
**Solution**: Verify environment variables are set correctly:
```bash
echo $FIREBASE_PROJECT_ID
echo $FIREBASE_CLIENT_EMAIL
```

#### 2. Embeddings File Not Found
```
Error: Embeddings file not found
```
**Solution**: Ensure the embeddings file exists:
```bash
ls -la data/image-embeddings.json
```

#### 3. OpenAI API Error
```
Error: OpenAI API error: 401
```
**Solution**: Verify OpenAI API key is valid and has sufficient credits.

#### 4. Lambda Timeout
```
Task timed out after 300.00 seconds
```
**Solution**: Reduce batch size or increase timeout:
```bash
export MAX_MEALS_PER_BATCH="25"
```

### Debug Mode
Enable detailed logging by setting:
```bash
export DEBUG="true"
```

## Performance Optimization

### Memory Usage
- Current: 1.5 GB (handles ~50,000 embeddings)
- For larger datasets: Increase to 3 GB

### Batch Size Tuning
- Small datasets (< 100 meals): 50 per batch
- Medium datasets (100-1000 meals): 25 per batch
- Large datasets (> 1000 meals): 10 per batch

### Similarity Thresholds
- **High Precision**: cosine=0.8, text=0.7
- **Balanced**: cosine=0.7, text=0.6 (default)
- **High Recall**: cosine=0.6, text=0.5

## Security

### IAM Permissions
The function requires minimal permissions:
- CloudWatch Logs (for logging)
- No additional AWS services needed

### Environment Variables
- Store sensitive data in AWS Systems Manager Parameter Store
- Use AWS Secrets Manager for API keys
- Never commit credentials to version control

### Network Security
- Function runs in VPC (optional)
- No outbound network restrictions needed
- HTTPS only for external API calls

## Cost Estimation

### AWS Lambda Costs (us-east-1)
- **Requests**: $0.20 per 1M requests
- **Duration**: $0.0000166667 per GB-second
- **Estimated monthly cost**: $5-20 (depending on usage)

### OpenAI API Costs
- **Embeddings**: $0.00002 per 1K tokens
- **Estimated cost**: $0.01-0.05 per 100 meals

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review CloudWatch logs
3. Create an issue in the repository
4. Contact the development team

---

**Note**: This Lambda function is designed to be self-contained and deployable without external setup. All dependencies and data files are included in the package.