#!/bin/bash

# =============================================================================
# FLY.IO SECRETS SETUP SCRIPT
# =============================================================================
# This script sets up all sensitive environment variables as Fly.io secrets
# Run this script after creating your Fly.io app: fly apps create your-app-name
#
# Usage: ./fly-secrets-setup.sh
# Make sure you have fly CLI installed and are logged in: fly auth login
# =============================================================================

set -e  # Exit on any error

echo "🔐 Setting up Fly.io secrets for Chat with Knowledge Base..."
echo ""

# Check if fly CLI is available
if ! command -v fly &> /dev/null; then
    echo "❌ Error: fly CLI is not installed"
    echo "Install it from: https://fly.io/docs/flyctl/install/"
    exit 1
fi

# Check if user is logged in
if ! fly auth whoami &> /dev/null; then
    echo "❌ Error: Not logged in to Fly.io"
    echo "Run: fly auth login"
    exit 1
fi

echo "📝 Please provide the following sensitive values:"
echo ""

# MySQL Database Credentials
read -s -p "🔑 MySQL Root Password: " MYSQL_ROOT_PASSWORD
echo ""
read -s -p "🔑 MySQL User Password: " MYSQL_PASSWORD
echo ""

# Authentication Secret
echo "🔑 Next Auth Secret (generate with: openssl rand -base64 32)"
read -s -p "Next Auth Secret: " AUTH_SECRET
echo ""

# Email Configuration
read -p "📧 Resend API Key: " RESEND_API_KEY
read -p "📧 Email From Address: " EMAIL_FROM
read -p "📧 Allowed Email Domains (comma-separated): " ALLOWED_EMAIL_DOMAINS

# Maxim AI Configuration
read -p "🤖 Maxim API Key: " MAXIM_API_KEY
read -p "🤖 Maxim Log Repo ID: " MAXIM_LOG_REPO_ID

# Production URLs
read -p "🌐 Production Next Auth URL (e.g., https://your-app.fly.dev): " AUTH_URL

# Optional API Keys
read -p "🔧 Qdrant API Key (optional, press Enter to skip): " QDRANT_API_KEY
read -p "🔧 Bifrost API Key (optional, press Enter to skip): " BIFROST_API_KEY

echo ""
echo "🚀 Setting Fly.io secrets..."

# Set all secrets
fly secrets set \
  MYSQL_ROOT_PASSWORD="$MYSQL_ROOT_PASSWORD" \
  MYSQL_PASSWORD="$MYSQL_PASSWORD" \
  AUTH_SECRET="$AUTH_SECRET" \
  RESEND_API_KEY="$RESEND_API_KEY" \
  EMAIL_FROM="$EMAIL_FROM" \
  ALLOWED_EMAIL_DOMAINS="$ALLOWED_EMAIL_DOMAINS" \
  MAXIM_API_KEY="$MAXIM_API_KEY" \
  MAXIM_LOG_REPO_ID="$MAXIM_LOG_REPO_ID"

# Set optional secrets if provided
if [ ! -z "$QDRANT_API_KEY" ]; then
    fly secrets set QDRANT_API_KEY="$QDRANT_API_KEY"
fi

if [ ! -z "$BIFROST_API_KEY" ]; then
    fly secrets set BIFROST_API_KEY="$BIFROST_API_KEY"
fi

# Generate and set DATABASE_URL
DATABASE_URL="mysql://chatuser:$MYSQL_PASSWORD@localhost:3306/chat_kb"
fly secrets set DATABASE_URL="$DATABASE_URL"

echo ""
echo "✅ All secrets have been set successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Update your fly.toml with the correct app name and region"
echo "2. Update service URLs in fly.toml for your database deployments"
echo "3. Deploy your app: fly deploy"
echo ""
echo "🔍 To view your secrets: fly secrets list"
echo "🗑️  To remove a secret: fly secrets unset SECRET_NAME"
