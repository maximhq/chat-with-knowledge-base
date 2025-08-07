# Chat with Knowledge Base

A modern, AI-powered knowledge base application that allows you to upload documents, scrape web links, and chat with your content using advanced RAG (Retrieval Augmented Generation) technology.

## 🚀 Features

- **📁 Document Upload**: Support for PDF, DOCX, TXT, MD, CSV, HTML, XML and more
- **🔗 Web Scraping**: Add web content by URL with automatic scraping and indexing
- **💬 Intelligent Chat**: AI-powered conversations with your documents using RAG
- **🧵 Thread Management**: Organize conversations by topics/projects
- **🔍 Semantic Search**: Find relevant content across all your documents
- **🌐 Public Sharing**: Share knowledge base threads via public chat API
- **🔐 Secure Authentication**: Email-based OTP authentication
- **📊 Vector Storage**: Powered by Qdrant for high-performance semantic search
- **🤖 LLM Integration**: Uses Bifrost gateway for flexible LLM provider management

## 🏗️ Architecture

- **Frontend**: Next.js 15 with React 19, Tailwind CSS v4, Shadcn/ui components
- **Backend**: Next.js API routes with TypeScript
- **Database**: MySQL with Prisma ORM
- **Vector Store**: Qdrant for embeddings and semantic search
- **Document Processing**: LlamaIndex for parsing and chunking
- **Authentication**: Auth.js (NextAuth) with email OTP
- **LLM Gateway**: Bifrost for unified LLM provider access
- **State Management**: Zustand with persistence
- **Deployment**: Docker with multi-service orchestration

## 📋 Prerequisites

- Node.js 20+ and npm
- Docker and Docker Compose
- MySQL database
- Bifrost LLM gateway (for AI features)

## 🛠️ Installation & Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd chat-with-knowledge-base
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Copy the environment template and configure your settings:

```bash
cp env.example .env
```

Update `.env` with your actual values:

```env
# 🔴 SENSITIVE - Required for all environments
MYSQL_ROOT_PASSWORD="your-secure-root-password"
MYSQL_PASSWORD="your-secure-user-password"
NEXTAUTH_SECRET="$(openssl rand -base64 32)"  # Generate with this command
RESEND_API_KEY="re_your_resend_api_key_here"
MAXIM_API_KEY="your-maxim-api-key"
MAXIM_LOG_REPO_ID="your-maxim-log-repo-id"

# 🟡 ENVIRONMENT-SPECIFIC
DATABASE_URL="mysql://chatuser:${MYSQL_PASSWORD}@localhost:3306/chat_kb"
EMAIL_FROM="your-email@yourdomain.com"
ALLOWED_EMAIL_DOMAINS="yourdomain.com,gmail.com"

# 🟢 NON-SENSITIVE (optional to override defaults)
# MYSQL_DATABASE="chat_kb"
# MYSQL_USER="chatuser"
# BIFROST_API_URL="http://bifrost:8080"
# QDRANT_URL="http://qdrant:6333"
```

**Required External Services:**

- **Resend Account**: Sign up at [resend.com](https://resend.com) for email OTP
- **Maxim AI Account**: Get API key from your Maxim AI dashboard

### 4. Database Setup

```bash
# Generate Prisma client and push schema to database
npm run recalibrate
```

## 🚀 Running the Application

### Development Mode

```bash
# Start development server (runs on port 3333)
npm run dev
```

### Production Build

```bash
# Build the application
npm run build

# Start production server
npm start
```

### Docker Deployment (Local)

```bash
# Build and start all services (web, MySQL, Qdrant, Bifrost)
docker-compose up --build

# Run in background
docker-compose up -d --build

# Stop services
docker-compose down
```

## 🚀 Production Deployment

TBD

## 📝 Available Scripts

- `npm run dev` - Start development server with Turbopack on port 3001
- `npm run build` - Build the application for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint for code quality
- `npm run format` - Format code with Prettier
- `npm run recalibrate` - Generate Prisma client and sync database schema
- `npm run check` - Type-check TypeScript without emitting files

## 🔧 Development

### Project Structure

```txt
src/
├── app/                    # Next.js app router pages and API routes
│   ├── api/               # REST API endpoints
│   ├── thread/[id]/       # Dynamic thread pages
│   └── settings/          # Settings page
├── components/            # React components
│   ├── ui/               # Shadcn/ui base components
│   ├── layout/           # Layout components
│   └── knowledge-base/   # Feature-specific components
├── modules/              # Business logic modules
│   ├── auth/             # Authentication
│   ├── storage/          # Database operations
│   ├── rag/              # RAG and document processing
│   ├── llm/              # LLM gateway
│   ├── scraper/          # Web scraping
│   └── api/              # API utilities
├── stores/               # Zustand state management
├── types/                # TypeScript type definitions
└── lib/                  # Utility functions
```

### Key Technologies

- **LlamaIndex**: Document parsing, chunking, and RAG orchestration
- **Qdrant**: Vector database for semantic search
- **Prisma**: Type-safe database ORM
- **Zustand**: Lightweight state management
- **Bifrost**: LLM gateway for provider abstraction
- **Tailwind CSS v4**: Utility-first styling
- **Shadcn/ui**: Modern component library

## 🌐 API Endpoints

### Authentication

- `POST /api/auth/signin` - Email OTP authentication
- `POST /api/auth/verify` - Verify OTP code

### Threads

- `GET /api/threads` - List user threads
- `POST /api/threads` - Create new thread
- `GET /api/threads/[id]` - Get thread details
- `PUT /api/threads/[id]` - Update thread title
- `DELETE /api/threads/[id]` - Delete thread

### Documents

- `GET /api/documents?threadId=` - List thread documents
- `POST /api/documents/upload` - Upload and index documents
- `DELETE /api/documents/[id]` - Delete document

### Links

- `POST /api/links` - Scrape and index web content

### Chat

- `POST /api/chat` - Chat with knowledge base (supports streaming)
- `POST /api/chat/public` - Public chat API (API key authentication)

### Settings

- `GET /api/settings/api-keys` - List API keys
- `POST /api/settings/api-keys` - Create API key
- `DELETE /api/settings/api-keys/[id]` - Delete API key

## 🔐 Authentication

The application uses email-based OTP authentication:

1. User enters email address
2. System sends OTP code via email
3. User enters OTP to complete authentication
4. Session is maintained via secure cookies

### API Key Authentication

For programmatic access, create API keys via the Settings page:

```bash
curl -X POST "http://localhost:3333/api/chat/public" \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"message": "Your question", "threadId": "thread-id"}'
```

## 📚 Usage

1. **Sign In**: Use email OTP authentication
2. **Create Thread**: Start a new conversation topic
3. **Upload Documents**: Add PDF, DOCX, TXT files to your knowledge base
4. **Add Links**: Scrape web content by URL
5. **Chat**: Ask questions about your documents using natural language
6. **Share**: Use public chat API to share knowledge base access

## 🐳 Docker Services

The application runs with multiple services:

- **web**: Next.js application (port 3333)
- **mysql**: MySQL database (port 3306)
- **qdrant**: Vector database (port 6333)
- **bifrost**: LLM gateway (port 8080)

## 🔍 Troubleshooting

### Common Issues

1. **Build Errors**: Ensure all environment variables are set
2. **Database Connection**: Verify MySQL is running and accessible
3. **Vector Search Issues**: Check Qdrant service status
4. **LLM Errors**: Verify Bifrost configuration and API keys

### Logs

```bash
# View application logs
docker-compose logs web

# View all service logs
docker-compose logs

# Follow logs in real-time
docker-compose logs -f
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For issues and questions:

1. Check the troubleshooting section
2. Review Docker service logs
3. Verify environment configuration
4. Create an issue with detailed error information
