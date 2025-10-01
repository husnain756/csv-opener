# CSV Opener Backend

A robust backend service for processing CSV files and generating professional outreach openers using AI services (OpenAI or Hugging Face) with BullMQ for job queuing and PostgreSQL for data persistence.

## 🏗️ Architecture

- **Express.js** - Web framework
- **BullMQ** - Job queue with Redis
- **PostgreSQL** - Database for job and URL tracking
- **AI Services** - Content generation (OpenAI or Hugging Face)
- **Multer** - File upload handling
- **TypeScript** - Type safety

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 12+
- Redis 6+

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp env.example .env
   ```
   
   Update `.env` with your configuration:
   ```env
   # AI Service Configuration
   AI_SERVICE_TYPE=                    # 'openai', 'huggingface', or empty for auto-detection
   
   # Database
   DATABASE_URL=postgresql://localhost:5432/csv_opener
   
   # Redis
   REDIS_URL=redis://localhost:6379
   
   # OpenAI (optional for dummy mode)
   OPENAI_API_KEY=your_api_key_here
   OPENAI_DUMMY_MODE=false
   
   # Hugging Face (optional for dummy mode)
   HUGGINGFACE_API_KEY=your_api_key_here
   HUGGINGFACE_DUMMY_MODE=false
   ```

3. **Set up the database:**
   ```bash
   # Create database
   createdb csv_opener
   
   # Run setup script
   npm run setup-db
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

## 📊 Database Schema

### Jobs Table
- `id` - UUID primary key
- `file_name` - Original CSV filename
- `file_path` - Storage path
- `status` - pending | processing | completed | failed | canceled
- `total_rows` - Total number of URLs
- `processed_rows` - Successfully processed count
- `failed_rows` - Failed processing count
- `progress` - Percentage (0-100)
- `created_at` - Job creation timestamp
- `updated_at` - Last update timestamp

### URLs Table
- `id` - UUID primary key
- `job_id` - Foreign key to jobs table
- `url` - URL from CSV
- `status` - pending | processing | completed | failed
- `opener` - Generated opener text
- `error` - Error message if failed
- `retry_count` - Number of retry attempts
- `created_at` - Record creation timestamp
- `updated_at` - Last update timestamp

## 🔌 API Endpoints

### File Upload
- `POST /api/upload` - Upload CSV file
- `POST /api/upload/process` - Start processing job

### Job Management
- `GET /api/jobs/:id` - Get job status
- `GET /api/jobs/:id/results` - Get job results
- `POST /api/jobs/:id/retry` - Retry failed URLs
- `GET /api/upload/:jobId/download` - Download results as CSV
- `POST /api/upload/:jobId/cancel` - Cancel job

### AI Service Management
- `GET /api/jobs/ai-service/status` - Get current AI service status
- `POST /api/jobs/ai-service/refresh` - Refresh AI service configuration

### Health Check
- `GET /health` - Service health status

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3001 |
| `NODE_ENV` | Environment | development |
| `DATABASE_URL` | PostgreSQL connection string | postgresql://localhost:5432/csv_opener |
| `REDIS_URL` | Redis connection string | redis://localhost:6379 |
| `AI_SERVICE_TYPE` | Force specific AI service ('openai', 'huggingface', or empty for auto) | - |
| `OPENAI_API_KEY` | OpenAI API key | - |
| `OPENAI_DUMMY_MODE` | Enable OpenAI dummy mode for testing | false |
| `HUGGINGFACE_API_KEY` | Hugging Face API key | - |
| `HUGGINGFACE_DUMMY_MODE` | Enable Hugging Face dummy mode for testing | false |
| `MAX_FILE_SIZE` | Max upload size in bytes | 10485760 (10MB) |
| `UPLOAD_DIR` | File upload directory | ./uploads |
| `MAX_CONCURRENT_JOBS` | Max concurrent processing jobs | 10 |
| `MAX_RETRIES` | Max retry attempts | 3 |

## 🔄 Processing Flow

1. **Upload CSV** → File saved, job created in database
2. **Start Processing** → URLs extracted, chunked jobs added to BullMQ queue
3. **Worker Processing** → Chunks processed with AI service API calls
4. **Progress Tracking** → Real-time updates to database
5. **Completion** → Results available for download

## 🛠️ Development

### AI Service Management

The backend supports both OpenAI and Hugging Face services with easy switching:

```bash
# Check current AI service status
node scripts/switch-ai-service.js status

# Switch to OpenAI
node scripts/switch-ai-service.js openai

# Switch to Hugging Face
node scripts/switch-ai-service.js huggingface

# Use auto-detection
node scripts/switch-ai-service.js auto
```

### Dummy Mode

For local development without AI service API costs:

```env
OPENAI_DUMMY_MODE=true
# or
HUGGINGFACE_DUMMY_MODE=true
```

This generates realistic dummy openers with 2-3 second delays.

📚 **For detailed AI service configuration, see [AI_SERVICE_SWITCHING.md](../AI_SERVICE_SWITCHING.md)**

### Chunked Processing

- URLs are processed in chunks of 500 (configurable)
- Each chunk runs as a separate BullMQ job
- Failed URLs can be retried individually
- Progress is tracked at both job and URL level

### Error Handling

- Exponential backoff for API failures
- Individual URL retry mechanism
- Comprehensive error logging
- Graceful degradation

## 🚀 Production Deployment

### Docker Setup

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3001
CMD ["npm", "start"]
```

### Environment Setup

1. Set up PostgreSQL database
2. Configure Redis instance
3. Set production environment variables
4. Run database migrations
5. Deploy with process manager (PM2)

### Scaling

- Multiple worker instances can process chunks in parallel
- Redis clustering for high availability
- Database connection pooling
- Load balancer for API endpoints

## 📝 Logging

- Winston logger with file and console output
- Structured logging with job IDs
- Error tracking and monitoring
- Performance metrics

## 🔒 Security

- Helmet.js for security headers
- CORS configuration
- Rate limiting
- Input validation
- File type restrictions

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## 📈 Monitoring

- Health check endpoint
- Job queue metrics
- Database performance
- API response times
- Error rates

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

