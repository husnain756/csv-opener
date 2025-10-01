# CSV Opener App

A web application that generates professional outreach openers from CSV files containing URLs using AI services (OpenAI or Hugging Face). The app processes URLs without scraping content, relying only on URL context to generate tasteful 1-2 sentence openers.

## Features

- 📁 CSV file upload with preview
- 🎯 URL column selection and validation
- 🤖 AI-powered opener generation (OpenAI or Hugging Face)
- 📊 Real-time progress tracking
- 🔄 Automatic retry logic for failed requests
- 📤 CSV export with results
- 🌙 Dark/Light theme toggle
- ⚡ Concurrent processing for performance

## Project Structure

```
csv-opener/
├── frontend/          # Next.js React application
├── backend/           # Express.js API server
├── package.json       # Root package.json with workspace config
└── README.md         # This file
```

## Quick Start

### Option 1: Automated Setup (Recommended)
```bash
# Run the installation script
./install.sh

# Start development servers
./quick-start.sh dev
```

### Option 2: Manual Setup

1. **Install dependencies:**
   ```bash
   npm run install:all
   ```

2. **Set up environment variables:**
   ```bash
   cp backend/env.example backend/.env
   # Edit backend/.env with your AI service API keys, Redis URL, and Database URL
   ```

3. **Prerequisites are automatically handled:**
   ```bash
   # PostgreSQL: Database 'csv_opener' is created automatically
   # Redis 7.2+ is automatically installed from source during setup
   # No additional installation needed!
   # Redis runs on port 6380 (instead of default 6379)
   ```

4. **Start development servers:**
   ```bash
   npm run dev
   ```

5. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001

## Environment Variables

Create `backend/.env` with the following variables:

```env
# AI Service Configuration
AI_SERVICE_TYPE=                    # 'openai', 'huggingface', or empty for auto-detection

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_DUMMY_MODE=false

# Hugging Face Configuration
HUGGINGFACE_API_KEY=your_huggingface_api_key_here
HUGGINGFACE_DUMMY_MODE=false

# Database Configuration
DATABASE_URL=postgresql://localhost:5432/csv_opener

# Redis Configuration
REDIS_URL=redis://localhost:6380

# Server Configuration
PORT=3001
NODE_ENV=development

# File Upload Configuration
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads
OUTPUT_DIR=./outputs

# Job Queue Configuration
MAX_CONCURRENT_JOBS=10
JOB_TIMEOUT=300000

# OpenAI Model Configuration
OPENAI_MODEL=gpt-3.5-turbo
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_TOKENS=100

# Rate Limiting
RATE_LIMIT_REQUESTS_PER_MINUTE=60
RATE_LIMIT_BURST=10

# Retry Configuration
MAX_RETRIES=3
RETRY_DELAY=1000
BACKOFF_MULTIPLIER=2
```

## 🤖 AI Service Configuration

The application supports both **OpenAI** and **Hugging Face** for generating outreach openers. You can easily switch between services or use auto-detection.

### Quick AI Service Setup

```bash
# Check current AI service status
node backend/scripts/switch-ai-service.js status

# Switch to OpenAI
node backend/scripts/switch-ai-service.js openai

# Switch to Hugging Face
node backend/scripts/switch-ai-service.js huggingface

# Use auto-detection (recommended)
node backend/scripts/switch-ai-service.js auto
```

### Auto-Detection Logic
- If `AI_SERVICE_TYPE` is set, uses that service
- If OpenAI has API key and not in dummy mode → uses OpenAI
- If Hugging Face has API key and not in dummy mode → uses Hugging Face
- Falls back to dummy mode for development

### API Endpoints for AI Service Management
- `GET /api/jobs/ai-service/status` - Check current service status
- `POST /api/jobs/ai-service/refresh` - Refresh service configuration

📚 **For detailed AI service configuration, switching, and troubleshooting, see [AI_SERVICE_SWITCHING.md](./AI_SERVICE_SWITCHING.md)**

## Usage

1. **Upload CSV:** Select a CSV file containing URLs
2. **Preview & Configure:** Choose the URL column and review data
3. **Select Content Type:** Choose between Company, LinkedIn/Person, or News/Community
4. **Run Processing:** Start the opener generation process
5. **Monitor Progress:** Watch real-time progress with retry capabilities
6. **Export Results:** Download the processed CSV with generated openers

## API Endpoints

- `POST /api/upload` - Upload CSV file
- `POST /api/upload/process` - Start processing job
- `GET /api/jobs/:id` - Get job status and progress
- `GET /api/jobs/:id/results` - Get processed results
- `POST /api/jobs/:id/retry` - Retry failed URLs
- `GET /api/upload/:jobId/download` - Download results CSV
- `POST /api/upload/:jobId/cancel` - Cancel job
- `GET /health` - Health check endpoint

## Technology Stack

### Frontend
- **Next.js 14** (React) with App Router
- **TailwindCSS** for styling with custom gradients
- **NextUI** for modern UI components
- **Zustand** for state management with persistence
- **Papa Parse** for CSV parsing
- **Lucide React** for icons
- **Next Themes** for dark/light mode

### Backend
- **Node.js** with Express.js
- **TypeScript** for type safety
- **PostgreSQL** for data persistence (jobs and URLs tracking)
- **BullMQ** for job queue management with chunked processing
- **Redis** for queue storage and caching
- **AI Services** integration (OpenAI & Hugging Face) with retry logic and dummy mode
- **Multer** for file uploads
- **Winston** for logging
- **Joi** for validation

### Key Features
- 🎨 **Beautiful UI** with dark/light themes (golden/green colors)
- 📊 **Real-time progress** tracking with Server-Sent Events
- 🔄 **Automatic retry** logic for failed requests
- 💰 **Cost tracking** and estimation
- 📱 **Responsive design** for all devices
- ⚡ **Concurrent processing** with configurable limits
- 🛡️ **Error handling** with detailed feedback
- 🗄️ **Database persistence** with PostgreSQL for job tracking
- 📦 **Chunked processing** for handling large CSV files (50K+ rows)
- 🔄 **Individual URL retry** capability
- 🤖 **Dummy mode** for development without AI service costs

## Backend Implementation

### Database Schema
The backend uses PostgreSQL with two main tables:

**Jobs Table:**
- Tracks overall job status and progress
- Stores file metadata and processing statistics
- Provides real-time progress updates

**URLs Table:**
- Individual URL tracking with status and results
- Stores generated openers and error messages
- Enables individual URL retry functionality

### Processing Flow
1. **Upload** → CSV file saved, job created in database
2. **Processing** → URLs extracted and chunked into BullMQ jobs (500 URLs per chunk)
3. **Worker Processing** → Chunks processed with AI service API calls
4. **Progress Tracking** → Real-time database updates
5. **Completion** → Results available for download

### Chunked Processing
- Handles up to 50K+ rows efficiently
- Configurable batch sizes (default: 500 URLs per chunk)
- Parallel processing with BullMQ workers
- Individual URL retry capability

### Dummy Mode
For local development without AI service API costs:
```env
OPENAI_DUMMY_MODE=true
# or
HUGGINGFACE_DUMMY_MODE=true
```
This generates realistic dummy openers with 2-3 second delays.

## Redis Management

The application automatically installs Redis 7.2+ from source during setup. Redis runs on port 6380 (instead of the default 6379) to avoid conflicts with system Redis.

### Redis Commands
```bash
# Start Redis
~/redis-local/start-redis.sh

# Stop Redis  
~/redis-local/stop-redis.sh

# Or use the quick-start script
./quick-start.sh redis        # Start Redis
./quick-start.sh redis-stop   # Stop Redis
```

### Redis Location
- **Installation**: `~/redis-local/`
- **Configuration**: `~/redis-local/redis.conf`
- **Data Directory**: `~/redis-local/data/`
- **Logs**: `~/redis-local/redis.log`

## Development

### Running Tests
```bash
npm run test
```

### Building for Production
```bash
npm run build
```

### Deployment
The app is designed to run on a single server with:
- Node.js runtime
- Redis instance
- File system storage (or S3 for production)

## Cost Considerations

- **OpenAI API costs** depend on model and token usage (~$0.001-0.002 per URL)
- **Hugging Face API costs** vary by model (some models are free)
- 1,000 URLs ≈ $1-2 in OpenAI costs (varies with Hugging Face)
- Configure concurrency limits to control rate and cost
- Use dummy mode for development to avoid API costs

## 📚 Documentation

This project includes comprehensive documentation for different aspects:

### Core Documentation
- **[AI_SERVICE_SWITCHING.md](./AI_SERVICE_SWITCHING.md)** - Complete guide for AI service configuration and switching
- **[HUGGINGFACE_SETUP.md](./HUGGINGFACE_SETUP.md)** - Hugging Face API setup and configuration
- **[backend/README.md](./backend/README.md)** - Backend architecture, API endpoints, and deployment
- **[frontend/README.md](./frontend/README.md)** - Frontend architecture, components, and development guidelines

### Quick Reference
- **AI Service Switching**: `node backend/scripts/switch-ai-service.js [openai|huggingface|auto|status]`
- **Service Status API**: `GET /api/jobs/ai-service/status`
- **Service Refresh API**: `POST /api/jobs/ai-service/refresh`

## Support

For issues or questions, please check the logs in the browser console and backend terminal output.

## License

MIT License - see LICENSE file for details.