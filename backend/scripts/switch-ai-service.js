#!/usr/bin/env node

/**
 * AI Service Configuration Switcher
 * 
 * This script helps you easily switch between OpenAI and Hugging Face services
 * Usage: node scripts/switch-ai-service.js [openai|huggingface|auto]
 */

const fs = require('fs');
const path = require('path');

const ENV_FILE = path.join(__dirname, '..', '.env');
const ENV_EXAMPLE_FILE = path.join(__dirname, '..', 'env.example');

function readEnvFile() {
  if (!fs.existsSync(ENV_FILE)) {
    console.log('❌ .env file not found. Creating from env.example...');
    if (fs.existsSync(ENV_EXAMPLE_FILE)) {
      fs.copyFileSync(ENV_EXAMPLE_FILE, ENV_FILE);
      console.log('✅ Created .env file from env.example');
    } else {
      console.log('❌ env.example file not found either!');
      process.exit(1);
    }
  }
  
  return fs.readFileSync(ENV_FILE, 'utf8');
}

function writeEnvFile(content) {
  fs.writeFileSync(ENV_FILE, content);
}

function updateEnvVariable(content, key, value) {
  const lines = content.split('\n');
  let found = false;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith(`${key}=`)) {
      lines[i] = `${key}=${value}`;
      found = true;
      break;
    }
  }
  
  if (!found) {
    lines.push(`${key}=${value}`);
  }
  
  return lines.join('\n');
}

function getCurrentConfig() {
  const content = readEnvFile();
  const lines = content.split('\n');
  
  const config = {
    aiServiceType: '',
    openaiApiKey: '',
    openaiDummyMode: '',
    huggingfaceApiKey: '',
    huggingfaceDummyMode: ''
  };
  
  lines.forEach(line => {
    if (line.startsWith('AI_SERVICE_TYPE=')) {
      config.aiServiceType = line.split('=')[1] || '';
    } else if (line.startsWith('OPENAI_API_KEY=')) {
      config.openaiApiKey = line.split('=')[1] || '';
    } else if (line.startsWith('OPENAI_DUMMY_MODE=')) {
      config.openaiDummyMode = line.split('=')[1] || '';
    } else if (line.startsWith('HUGGINGFACE_API_KEY=')) {
      config.huggingfaceApiKey = line.split('=')[1] || '';
    } else if (line.startsWith('HUGGINGFACE_DUMMY_MODE=')) {
      config.huggingfaceDummyMode = line.split('=')[1] || '';
    }
  });
  
  return config;
}

function displayCurrentConfig() {
  const config = getCurrentConfig();
  
  console.log('\n📋 Current AI Service Configuration:');
  console.log('=====================================');
  console.log(`AI Service Type: ${config.aiServiceType || 'auto (auto-detect)'}`);
  console.log(`OpenAI API Key: ${config.openaiApiKey ? '✅ Set' : '❌ Not set'}`);
  console.log(`OpenAI Dummy Mode: ${config.openaiDummyMode}`);
  console.log(`Hugging Face API Key: ${config.huggingfaceApiKey ? '✅ Set' : '❌ Not set'}`);
  console.log(`Hugging Face Dummy Mode: ${config.huggingfaceDummyMode}`);
  
  // Show what service would be used
  if (config.aiServiceType === 'openai') {
    console.log('\n🎯 Active Service: OpenAI');
  } else if (config.aiServiceType === 'huggingface') {
    console.log('\n🎯 Active Service: Hugging Face');
  } else {
    // Auto-detect logic
    if (config.openaiApiKey && config.openaiDummyMode !== 'true') {
      console.log('\n🎯 Active Service: OpenAI (auto-detected)');
    } else if (config.huggingfaceApiKey && config.huggingfaceDummyMode !== 'true') {
      console.log('\n🎯 Active Service: Hugging Face (auto-detected)');
    } else if (config.openaiApiKey) {
      console.log('\n🎯 Active Service: OpenAI (dummy mode)');
    } else {
      console.log('\n🎯 Active Service: Hugging Face (dummy mode)');
    }
  }
}

function switchToService(serviceType) {
  const content = readEnvFile();
  let updatedContent = content;
  
  if (serviceType === 'openai') {
    updatedContent = updateEnvVariable(updatedContent, 'AI_SERVICE_TYPE', 'openai');
    console.log('✅ Switched to OpenAI service');
  } else if (serviceType === 'huggingface') {
    updatedContent = updateEnvVariable(updatedContent, 'AI_SERVICE_TYPE', 'huggingface');
    console.log('✅ Switched to Hugging Face service');
  } else if (serviceType === 'auto') {
    updatedContent = updateEnvVariable(updatedContent, 'AI_SERVICE_TYPE', '');
    console.log('✅ Switched to auto-detection mode');
  } else {
    console.log('❌ Invalid service type. Use: openai, huggingface, or auto');
    return;
  }
  
  writeEnvFile(updatedContent);
  console.log('📝 Updated .env file');
}

function showHelp() {
  console.log(`
🤖 AI Service Configuration Switcher

Usage:
  node scripts/switch-ai-service.js [command]

Commands:
  openai        - Switch to OpenAI service
  huggingface   - Switch to Hugging Face service  
  auto          - Use auto-detection (default)
  status        - Show current configuration
  help          - Show this help message

Examples:
  node scripts/switch-ai-service.js openai
  node scripts/switch-ai-service.js huggingface
  node scripts/switch-ai-service.js auto
  node scripts/switch-ai-service.js status

Auto-detection logic:
  1. If AI_SERVICE_TYPE is set, use that service
  2. If OpenAI has API key and not in dummy mode → use OpenAI
  3. If Hugging Face has API key and not in dummy mode → use Hugging Face
  4. If OpenAI has API key → use OpenAI (dummy mode)
  5. Otherwise → use Hugging Face (dummy mode)
`);
}

// Main execution
const command = process.argv[2];

if (!command || command === 'help') {
  showHelp();
} else if (command === 'status') {
  displayCurrentConfig();
} else if (['openai', 'huggingface', 'auto'].includes(command)) {
  switchToService(command);
  console.log('\n🔄 Please restart your backend server for changes to take effect.');
  displayCurrentConfig();
} else {
  console.log('❌ Invalid command. Use "help" to see available commands.');
}

