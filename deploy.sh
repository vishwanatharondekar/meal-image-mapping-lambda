#!/bin/bash

# Deployment script for meal-image-mapping Lambda function
# This script automates the deployment process

set -e  # Exit on any error

echo "🚀 Starting Lambda deployment..."

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first."
    echo "   https://aws.amazon.com/cli/"
    exit 1
fi

# Check if required environment variables are set
missing_vars=()

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo "❌ Missing required environment variables:"
    printf '   - %s\n' "${missing_vars[@]}"
    echo ""
    echo "Please set these environment variables before deployment."
    echo "Example:"
    echo "   export FIREBASE_PROJECT_ID='your-project-id'"
    echo "   export FIREBASE_PRIVATE_KEY='your-private-key'"
    echo "   export FIREBASE_CLIENT_EMAIL='your-client-email'"
    echo "   export OPENAI_API_KEY='your-openai-key'"
    exit 1
fi

echo "✅ All required environment variables are set"

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Run tests
echo "🧪 Running tests..."
if ! npm test; then
    echo "❌ Tests failed. Please fix issues before deployment."
    exit 1
fi

# Deploy using Node.js script
echo "🚀 Deploying to AWS Lambda..."
node deploy.js

echo "✅ Deployment completed successfully!"
echo ""
echo "📝 Next steps:"
echo "   1. Test the function: aws lambda invoke --function-name meal-image-mapping --payload '{}' response.json"
echo "   2. Set up EventBridge trigger for scheduled execution"
echo "   3. Monitor logs in CloudWatch"
echo ""
echo "🔗 Function ARN: arn:aws:lambda:${AWS_REGION:-us-east-1}:$(aws sts get-caller-identity --query Account --output text):function:meal-image-mapping"
