# CSV Opener App

A web application that generates professional outreach openers from CSV files containing URLs using OpenAI. The app processes URLs without scraping content, relying only on URL context to generate tasteful 1-2 sentence openers.

## Features

- 📁 CSV file upload with preview
- 🎯 URL column selection and validation
- 🤖 OpenAI-powered opener generation
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
   # Edit backend/.env with your OpenAI API key and Redis URL
   ```

3. **Redis is automatically installed and configured:**
   ```bash
   # Redis 7.2+ is automatically installed from source during setup
   # No additional Redis installation needed!
   # Runs on port 6380 (instead of default 6379)
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
OPENAI_API_KEY=your_openai_api_key_here
REDIS_URL=redis://localhost:6380
PORT=3001
NODE_ENV=development
MAX_FILE_SIZE=10485760
MAX_CONCURRENT_JOBS=10
OPENAI_MODEL=gpt-3.5-turbo
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_TOKENS=100
```

## Usage

1. **Upload CSV:** Select a CSV file containing URLs
2. **Preview & Configure:** Choose the URL column and review data
3. **Select Content Type:** Choose between Company, LinkedIn/Person, or News/Community
4. **Run Processing:** Start the opener generation process
5. **Monitor Progress:** Watch real-time progress with retry capabilities
6. **Export Results:** Download the processed CSV with generated openers

## API Endpoints

- `POST /api/upload` - Upload and preview CSV
- `POST /api/process` - Start processing job
- `GET /api/jobs/:id` - Get job status and progress
- `GET /api/jobs/:id/download` - Download results CSV
- `POST /api/jobs/:id/retry` - Retry failed rows

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
- **BullMQ** for job queue management
- **Redis** for queue storage and caching
- **OpenAI API** integration with retry logic
- **Multer** for file uploads
- **Winston** for logging
- **Joi** for validation

### Key Features
- 🎨 **Beautiful UI** with dark/light themes (golden/green colors)
- 📊 **Real-time progress** tracking with WebSocket-like polling
- 🔄 **Automatic retry** logic for failed requests
- 💰 **Cost tracking** and estimation
- 📱 **Responsive design** for all devices
- ⚡ **Concurrent processing** with configurable limits
- 🛡️ **Error handling** with detailed feedback

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

- OpenAI API costs depend on model and token usage
- Typical cost: ~$0.001-0.002 per URL processed
- 1,000 URLs ≈ $1-2 in API costs
- Configure concurrency limits to control rate and cost

## Support

For issues or questions, please check the logs in the browser console and backend terminal output.

## License

MIT License - see LICENSE file for details.