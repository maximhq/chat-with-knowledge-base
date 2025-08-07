# 🚀 Deployment Guide: Docker Compose & Fly.io Secrets Management

This guide covers secure deployment of the Chat with Knowledge Base application using proper secrets management for both local development and Fly.io production deployment.

## 🔒 Security Overview

All sensitive data has been externalized from the codebase and is managed through environment variables and secrets:

- **🔴 Sensitive Variables**: Stored as Fly.io secrets in production, `.env` file locally
- **🟡 Environment-Specific**: Configured per environment
- **🟢 Non-Sensitive**: Safe to keep in configuration files

## 📋 Quick Start

### Local Development Setup

1. **Copy environment template:**

   ```bash
   cp env.example .env
   ```

2. **Fill in your secrets in `.env`:**

   ```bash
   # Generate a secure NextAuth secret
   openssl rand -base64 32

   # Edit .env with your actual values
   nano .env
   ```

3. **Start the application:**

   ```bash
   docker-compose up -d
   ```

### Production Deployment (Fly.io)

1. **Install Fly.io CLI:**

   ```bash
   # macOS
   brew install flyctl

   # Or download from: https://fly.io/docs/hands-on/install-flyctl/
   ```

2. **Login and create app:**

   ```bash
   fly auth login
   fly apps create your-app-name
   ```

3. **Set up secrets:**

   ```bash
   ./fly-secrets-setup.sh
   ```

4. **Deploy:**

   ```bash
   fly deploy
   ```

## 🔐 Environment Variables Reference

### 🔴 Sensitive Variables (Fly.io Secrets)

| Variable | Description | Example |
|----------|-------------|---------|
| `MYSQL_ROOT_PASSWORD` | MySQL root password | `secure-root-password-123` |
| `MYSQL_PASSWORD` | MySQL user password | `secure-user-password-456` |
| `NEXTAUTH_SECRET` | NextAuth.js secret key | `openssl rand -base64 32` |
| `RESEND_API_KEY` | Resend email service API key | `re_AbCdEf123...` |
| `MAXIM_API_KEY` | Maxim AI API key | `maxim_api_key_here` |
| `MAXIM_LOG_REPO_ID` | Maxim AI logging repository ID | `repo_id_here` |
| `QDRANT_API_KEY` | Qdrant API key (optional) | `qdrant_key_here` |
| `BIFROST_API_KEY` | Bifrost API key (optional) | `bifrost_key_here` |

### 🟡 Environment-Specific Variables

| Variable | Local Development | Production |
|----------|------------------|------------|
| `DATABASE_URL` | `mysql://chatuser:password@localhost:3306/chat_kb` | `mysql://chatuser:password@db:3306/chat_kb` |
| `NEXTAUTH_URL` | `http://localhost:3001` | `https://your-app.fly.dev` |
| `EMAIL_FROM` | `dev@yourdomain.com` | `noreply@yourdomain.com` |
| `ALLOWED_EMAIL_DOMAINS` | `yourdomain.com,gmail.com` | `yourdomain.com` |

### 🟢 Non-Sensitive Configuration

These are safe to keep in `docker-compose.yml` and `fly.toml`:

| Variable | Value | Description |
|----------|-------|-------------|
| `MYSQL_DATABASE` | `chat_kb` | Database name |
| `MYSQL_USER` | `chatuser` | Database user |
| `BIFROST_API_URL` | `http://bifrost:8080` | Bifrost service URL |
| `QDRANT_URL` | `http://qdrant:6333` | Qdrant service URL |
| `UPLOAD_DIR` | `/app/uploads` | File upload directory |
| `MAX_FILE_SIZE` | `10485760` | Max file size (10MB) |
| `NODE_ENV` | `production` | Node environment |
| `PORT` | `3000` | Application port |

## 🛠️ Detailed Setup Instructions

### Local Development

1. **Environment Setup:**

   ```bash
   # Copy the template
   cp env.example .env

   # Generate NextAuth secret
   echo "NEXTAUTH_SECRET=$(openssl rand -base64 32)" >> .env

   # Edit other values
   nano .env
   ```

2. **Required Services:**
   - **Resend Account**: Sign up at [resend.com](https://resend.com) for email OTP
   - **Maxim AI Account**: Get API key from your Maxim AI dashboard

3. **Start Services:**

   ```bash
   # Start all services
   docker-compose up -d

   # Check service health
   docker-compose ps

   # View logs
   docker-compose logs -f web
   ```

### Production Deployment

1. **Fly.io App Setup:**

   ```bash
   # Login to Fly.io
   fly auth login

   # Create new app
   fly apps create your-unique-app-name

   # Update fly.toml with your app name
   sed -i 's/chat-kb-app/your-unique-app-name/' fly.toml
   ```

2. **Database Setup:**

   **Option A: Fly.io Postgres (Recommended)**

   ```bash
   # Create Postgres database
   fly postgres create --name your-app-db

   # Attach to your app
   fly postgres attach your-app-db

   # Update DATABASE_URL in secrets
   fly secrets set DATABASE_URL="postgres://..."
   ```

   **Option B: External MySQL**

   ```bash
   # Use PlanetScale, AWS RDS, or other MySQL provider
   fly secrets set DATABASE_URL="mysql://user:pass@host:port/db"
   ```

3. **Vector Database Setup:**

   ```bash
   # Deploy Qdrant (or use Qdrant Cloud)
   # Update QDRANT_URL in fly.toml or use secrets for API key
   ```

4. **Secrets Configuration:**

   ```bash
   # Run the interactive setup script
   ./fly-secrets-setup.sh

   # Or set manually:
   fly secrets set NEXTAUTH_SECRET="$(openssl rand -base64 32)"
   fly secrets set RESEND_API_KEY="your-resend-key"
   # ... etc
   ```

5. **Deploy:**

   ```bash
   # Deploy the application
   fly deploy

   # Check deployment status
   fly status

   # View logs
   fly logs
   ```

## 🔧 Troubleshooting

### Common Issues

1. **Environment Variables Not Loading:**

   ```bash
   # Verify .env file exists and is readable
   ls -la .env

   # Check docker-compose picks up variables
   docker-compose config
   ```

2. **Fly.io Secrets Issues:**

   ```bash
   # List current secrets
   fly secrets list

   # Unset incorrect secret
   fly secrets unset SECRET_NAME

   # Set new value
   fly secrets set SECRET_NAME="new-value"
   ```

3. **Database Connection Issues:**

   ```bash
   # Test local MySQL connection
   docker-compose exec db mysql -u chatuser -p chat_kb

   # Check Fly.io database
   fly postgres connect -a your-app-db
   ```

### Security Checklist

- [ ] `.env` file is in `.gitignore`
- [ ] No hardcoded secrets in `docker-compose.yml`
- [ ] All sensitive variables use Fly.io secrets
- [ ] Production URLs are HTTPS
- [ ] Database passwords are strong and unique
- [ ] NextAuth secret is cryptographically secure

## 📚 Additional Resources

- [Fly.io Secrets Documentation](https://fly.io/docs/reference/secrets/)
- [Docker Compose Environment Variables](https://docs.docker.com/compose/environment-variables/)
- [NextAuth.js Configuration](https://next-auth.js.org/configuration/options)
- [Resend API Documentation](https://resend.com/docs)

## 🆘 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review application logs: `docker-compose logs` or `fly logs`
3. Verify all environment variables are set correctly
4. Ensure all external services (Resend, Maxim AI) are properly configured
