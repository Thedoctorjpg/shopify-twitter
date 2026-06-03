# scripts/deploy-app-runner.ps1
# Helper script to deploy shopify-x-integration to AWS App Runner
#
# Prerequisites:
#   - AWS CLI installed and configured (aws configure)
#   - Docker (if building locally)
#   - ECR repo created or use App Runner source from GitHub (recommended)
#
# Usage examples:
#   .\scripts\deploy-app-runner.ps1 -ServiceName shopify-x-integration -Region us-west-2
#   .\scripts\deploy-app-runner.ps1 -FromGitHub  (uses current repo as source - easiest)

param(
    [string]$ServiceName = "shopify-x-integration",
    [string]$Region = "us-west-2",
    [string]$EcrRepo = "",
    [switch]$FromGitHub
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Deploying to AWS App Runner: $ServiceName in $Region" -ForegroundColor Green

if ($FromGitHub) {
    Write-Host "Using GitHub as source (recommended for App Runner). Make sure repo is public or connected."
    # For GitHub source, you usually create via console or use AWS Copilot / CDK.
    # This script shows the update command if service already exists.
    aws apprunner update-service `
        --service-arn "arn:aws:apprunner:$Region:$(aws sts get-caller-identity --query Account --output text):service/$ServiceName" `
        --source-configuration '{"CodeRepository":{"RepositoryUrl":"https://github.com/Thedoctorjpg/shopify-twitter","CodeConfiguration":{"CodeConfigurationValues":{"Runtime":"NODEJS_18","BuildCommand":"npm install && npm run build:frontend","StartCommand":"npm start","Port":"3000"}}}}' `
        --region $Region

    Write-Host "If service doesn't exist yet, create it in the AWS Console (App Runner > Create service > GitHub source)." -ForegroundColor Yellow
    exit 0
}

if (-not $EcrRepo) {
    Write-Error "For container deploys, pass -EcrRepo your-account.dkr.ecr.$Region.amazonaws.com/shopify-x-integration"
}

# Build and push to ECR
Write-Host "Building Docker image..."
docker build -t $ServiceName .

Write-Host "Logging into ECR..."
aws ecr get-login-password --region $Region | docker login --username AWS --password-stdin $EcrRepo

$ImageTag = "$EcrRepo:latest"
docker tag $ServiceName $ImageTag
docker push $ImageTag

Write-Host "Updating or creating App Runner service with new image..."
# This assumes service exists; for first time use console or full create-service command
aws apprunner update-service `
    --service-arn "arn:aws:apprunner:$Region:$(aws sts get-caller-identity --query Account --output text):service/$ServiceName" `
    --source-configuration "{\"ImageRepository\":{\"ImageIdentifier\":\"$ImageTag\",\"ImageRepositoryType\":\"ECR\"}}" `
    --region $Region

Write-Host "✅ Deploy triggered. Check App Runner console for status and your new public URL." -ForegroundColor Green
Write-Host "After deploy, set WEBHOOK_BASE_URL (and other secrets via SSM or App Runner env) and call POST /webhooks/setup"
