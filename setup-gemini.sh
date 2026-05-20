#!/bin/bash
# Setup Google Gemini Integration for VS Code

echo "🔧 Setting up Google Gemini integration..."

# Check if Node is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install it first."
    exit 1
fi

# Install axios if needed
npm list axios &>/dev/null || npm install axios

# Instructions for API Key
echo "
📝 SETUP INSTRUCTIONS:

1. GET YOUR GOOGLE API KEY:
   a) Go to: https://makersuite.google.com/app/apikey
   b) Create new API key (or copy existing)
   c) Copy the key

2. GET YOUR PROJECT ID (if using Vertex AI):
   a) Go to: https://console.cloud.google.com
   b) Select your project
   c) Copy Project ID

3. ADD CREDENTIALS TO .claude/settings.json:
   Replace these values:
   - GOOGLE_API_KEY: paste_your_api_key_here
   - GOOGLE_PROJECT_ID: paste_your_project_id_here

4. TEST CONNECTION:
   GOOGLE_API_KEY='your_key' node gemini.js

5. USE IN CODE:
   const GeminiConnector = require('./gemini.js');
   const gemini = new GeminiConnector(apiKey, projectId);
   const result = await gemini.generate('Your prompt');
"

echo "
✅ Setup complete!
   Run: node gemini.js   (to test connection)
"
