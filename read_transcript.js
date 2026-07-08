const fs = require('fs');
const txt = fs.readFileSync('C:\\Users\\Perry\\.gemini\\antigravity-ide\\brain\\42f7e972-d324-4a33-a648-a543c4e8d7a5\\.system_generated\\logs\\transcript.jsonl', 'utf8');
const lines = txt.split('\n');
for(let i=0; i<lines.length; i++) {
  if(lines[i].includes('USER_INPUT')) {
    const p = JSON.parse(lines[i]);
    if(p.content.includes('דוח') || p.content.includes('דו"ח')) {
      console.log('--- USER INPUT ---');
      console.log(p.content);
    }
  }
}
