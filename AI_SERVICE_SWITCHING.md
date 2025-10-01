# AI Service Switching Guide

This guide explains how to easily switch between OpenAI and Hugging Face services in the CSV Opener application.

## 🚀 Quick Start

### Method 1: Using the Configuration Script (Recommended)

```bash
# Check current configuration
node backend/scripts/switch-ai-service.js status

# Switch to OpenAI
node backend/scripts/switch-ai-service.js openai

# Switch to Hugging Face
node backend/scripts/switch-ai-service.js huggingface

# Use auto-detection (default)
node backend/scripts/switch-ai-service.js auto
```

### Method 2: Manual Configuration

Edit the `.env` file in the backend directory:

```bash
# Force OpenAI
AI_SERVICE_TYPE=openai

# Force Hugging Face
AI_SERVICE_TYPE=huggingface

# Auto-detection (default)
AI_SERVICE_TYPE=
```

## 🔧 Configuration Options

### Environment Variables

| Variable | Description | Options |
|----------|-------------|---------|
| `AI_SERVICE_TYPE` | Force a specific service | `openai`, `huggingface`, or empty for auto |
| `OPENAI_API_KEY` | OpenAI API key | Your OpenAI API key |
| `OPENAI_DUMMY_MODE` | Use OpenAI dummy mode | `true` or `false` |
| `HUGGINGFACE_API_KEY` | Hugging Face API key | Your Hugging Face API key |
| `HUGGINGFACE_DUMMY_MODE` | Use Hugging Face dummy mode | `true` or `false` |

### Auto-Detection Logic

When `AI_SERVICE_TYPE` is empty or not set, the system uses this priority:

1. **OpenAI with real API** - If `OPENAI_API_KEY` is set and `OPENAI_DUMMY_MODE` is `false`
2. **Hugging Face with real API** - If `HUGGINGFACE_API_KEY` is set and `HUGGINGFACE_DUMMY_MODE` is `false`
3. **OpenAI dummy mode** - If `OPENAI_API_KEY` is set (fallback to dummy)
4. **Hugging Face dummy mode** - Final fallback

## 📊 Service Status API

### Check Current Service

```bash
curl http://localhost:3001/api/jobs/ai-service/status
```

Response:
```json
{
  "success": true,
  "data": {
    "currentType": "openai",
    "configuredType": "openai",
    "openaiAvailable": true,
    "huggingfaceAvailable": true,
    "openaiDummyMode": false,
    "huggingfaceDummyMode": true
  }
}
```

### Refresh Service (After Config Changes)

```bash
curl -X POST http://localhost:3001/api/jobs/ai-service/refresh
```

## 🎯 Use Cases

### Development with Dummy Data

```bash
# Use OpenAI dummy mode for development
AI_SERVICE_TYPE=openai
OPENAI_DUMMY_MODE=true
```

### Production with OpenAI

```bash
# Use real OpenAI API
AI_SERVICE_TYPE=openai
OPENAI_API_KEY=your_real_api_key
OPENAI_DUMMY_MODE=false
```

### Production with Hugging Face

```bash
# Use real Hugging Face API
AI_SERVICE_TYPE=huggingface
HUGGINGFACE_API_KEY=your_real_api_key
HUGGINGFACE_DUMMY_MODE=false
```

### Testing Both Services

```bash
# Test OpenAI
node backend/scripts/switch-ai-service.js openai
# Run your tests...

# Test Hugging Face
node backend/scripts/switch-ai-service.js huggingface
# Run your tests...
```

## 🔄 Switching Process

1. **Update Configuration**: Use the script or edit `.env` file
2. **Restart Backend**: The service factory will pick up the new configuration
3. **Verify**: Check the service status via API or logs

## 📝 Logs

The system logs which service is being used:

```
🤖 AI Service Factory: Using OpenAI Service
🤗 AI Service Factory: Using Hugging Face Service
```

## 🛠️ Troubleshooting

### Service Not Switching

1. Check if the backend was restarted after config changes
2. Verify the `.env` file has the correct values
3. Use the refresh API endpoint: `POST /api/jobs/ai-service/refresh`

### API Key Issues

1. Ensure API keys are set correctly in `.env`
2. Check if dummy mode is enabled when you want real API calls
3. Verify API key permissions and quotas

### Auto-Detection Not Working

1. Check the auto-detection logic in the logs
2. Manually set `AI_SERVICE_TYPE` to force a specific service
3. Verify all environment variables are set correctly

## 🎉 Benefits

- **Easy Switching**: Change services with a single command
- **Auto-Detection**: Smart fallback based on available API keys
- **Development Friendly**: Dummy modes for testing without API costs
- **Production Ready**: Real API integration for both services
- **Monitoring**: API endpoints to check service status
- **Flexible**: Works with any combination of API keys

## 📚 Examples

### Complete Development Setup

```bash
# .env file
AI_SERVICE_TYPE=
OPENAI_API_KEY=your_openai_key
OPENAI_DUMMY_MODE=true
HUGGINGFACE_API_KEY=your_hf_key
HUGGINGFACE_DUMMY_MODE=true
```

This setup will use OpenAI dummy mode by default, but you can easily switch to Hugging Face dummy mode for testing.

### Production Setup

```bash
# .env file
AI_SERVICE_TYPE=openai
OPENAI_API_KEY=your_real_openai_key
OPENAI_DUMMY_MODE=false
HUGGINGFACE_API_KEY=your_real_hf_key
HUGGINGFACE_DUMMY_MODE=false
```

This setup forces OpenAI but keeps Hugging Face as a backup option.

