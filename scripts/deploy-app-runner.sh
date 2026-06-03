#!/bin/bash
# scripts/deploy-app-runner.sh
# Linux/Mac helper for AWS App Runner deploy (container image path)

set -e

SERVICE_NAME=${1:-shopify-x-integration}
REGION=${2:-us-west-2}
ECR_REPO=${3:-}

echo "🚀 Deploying $SERVICE_NAME to App Runner in $REGION"

if [ -z "$ECR_REPO" ]; then
  echo "Usage: ./scripts/deploy-app-runner.sh [service] [region] your-ecr-repo"
  echo "Or use GitHub source in AWS Console for easiest deploys."
  exit 1
fi

docker build -t $SERVICE_NAME .

echo "Ensuring ECR repository exists..."
aws ecr describe-repositories --repository-names shopify-x-integration --region $REGION 2>/dev/null || aws ecr create-repository --repository-name shopify-x-integration --region $REGION --image-scanning-configuration scanOnPush=true

aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_REPO

IMAGE_TAG="$ECR_REPO:latest"
docker tag $SERVICE_NAME $IMAGE_TAG
docker push $IMAGE_TAG

aws apprunner update-service \
  --service-arn "arn:aws:apprunner:$REGION:$(aws sts get-caller-identity --query Account --output text):service/$SERVICE_NAME" \
  --source-configuration "{\"ImageRepository\":{\"ImageIdentifier\":\"$IMAGE_TAG\",\"ImageRepositoryType\":\"ECR\"}}" \
  --region $REGION

echo "✅ Deploy started. Monitor in App Runner console."
echo "Set WEBHOOK_BASE_URL after deploy and POST /webhooks/setup + /cron etc."
