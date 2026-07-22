/**
 * Gemini API Integration for VS Code
 * Connects Google Gemini Pro to Claude environment
 */

const axios = require('axios');

class GeminiConnector {
  constructor(apiKey, projectId) {
    this.apiKey = apiKey;
    this.projectId = projectId;
    this.model = 'gemini-2.5-pro';
    this.endpoint = `https://generativelanguage.googleapis.com/v1/models/${this.model}:generateContent?key=${apiKey}`;
  }

  async generate(prompt, options = {}) {
    try {
      console.log(`🔗 Connecting to: ${this.endpoint}`);

      const response = await axios.post(this.endpoint, {
        contents: [
          {
            role: "user",
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: options.temperature || 0.7,
          topK: options.topK || 40,
          topP: options.topP || 0.95,
          maxOutputTokens: options.maxTokens || 2048
        }
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        text: response.data.candidates[0].content.parts[0].text,
        usage: {
          inputTokens: response.data.usageMetadata?.inputTokens,
          outputTokens: response.data.usageMetadata?.outputTokens
        }
      };
    } catch (error) {
      console.error(`❌ Error: ${error.response?.status} - ${error.message}`);
      console.error(`📋 Details:`, error.response?.data);

      return {
        success: false,
        error: error.message,
        details: error.response?.data,
        status: error.response?.status,
        url: this.endpoint
      };
    }
  }

  async analyzeCode(code, language = 'javascript') {
    const prompt = `
Analyze this ${language} code for:
1. Potential bugs
2. Performance issues
3. Security concerns
4. Best practices

Code:
\`\`\`${language}
${code}
\`\`\`

Provide concise analysis with specific recommendations.
    `;
    return this.generate(prompt);
  }

  async generateDocumentation(code, language = 'javascript') {
    const prompt = `
Generate clear documentation for this ${language} code:

\`\`\`${language}
${code}
\`\`\`

Include:
- Function purpose
- Parameters
- Return values
- Usage examples
    `;
    return this.generate(prompt);
  }

  async refactorCode(code, language = 'javascript', requirement = '') {
    const prompt = `
Refactor this ${language} code to:
${requirement ? `- ${requirement}` : '- Improve readability and performance'}
- Follow best practices
- Maintain functionality

Current code:
\`\`\`${language}
${code}
\`\`\`

Provide refactored code with explanations.
    `;
    return this.generate(prompt);
  }
}

// Export for use in VS Code
module.exports = GeminiConnector;

// CLI Usage Example
if (require.main === module) {
  const apiKey = process.env.GOOGLE_API_KEY;
  const projectId = process.env.GOOGLE_PROJECT_ID;

  if (!apiKey) {
    console.error('❌ GOOGLE_API_KEY not found in environment');
    process.exit(1);
  }

  const gemini = new GeminiConnector(apiKey, projectId);

  // Test connection
  gemini.generate('Hello, this is a test prompt. Respond with "Connection successful"')
    .then(result => {
      if (result.success) {
        console.log('✅ Gemini connection successful');
        console.log('Response:', result.text);
      } else {
        console.error('❌ Gemini connection failed:', result.error);
      }
    });
}
