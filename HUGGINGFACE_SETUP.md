# Hugging Face Setup Guide

## Getting Your Free API Key

1. **Create Account**: Go to [https://huggingface.co/join](https://huggingface.co/join) and create a free account

2. **Get API Token**: 
   - Go to [https://huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
   - Click "New token"
   - Give it a name like "CSV Opener App"
   - Select "Read" permissions
   - Click "Generate a token"
   - Copy the token (starts with `hf_...`)

3. **Add to Environment**:
   - Create a `.env` file in the backend directory if it doesn't exist
   - Add your token:
   ```
   HUGGINGFACE_API_KEY=hf_your_token_here
   HUGGINGFACE_DUMMY_MODE=false
   ```

## Free Tier Limits

- **Monthly Credits**: ~$0.10 worth of free inference credits
- **Rate Limits**: 1,000 requests per 5-minute window
- **Perfect for**: Testing and small-scale development

## Testing

The app will automatically:
- Use Hugging Face API when `HUGGINGFACE_API_KEY` is provided
- Fall back to dummy responses if no API key or if API fails
- Show clear logging about which mode is being used

## Model Used

- **Model**: `microsoft/DialoGPT-medium`
- **Type**: Conversational text generation
- **Good for**: Professional outreach messages

## Troubleshooting

If you get rate limit errors:
1. Wait 5 minutes and try again
2. Consider upgrading to PRO ($9/month) for higher limits
3. The app will automatically fall back to dummy responses on errors

## Cost Comparison

- **OpenAI**: $5 free credits (3 months) → then paid
- **Hugging Face**: ~$0.10/month free → then $9/month PRO
- **Dummy Mode**: Free forever (for testing UI/UX)

