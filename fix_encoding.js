const fs = require('fs');
const { TextDecoder, TextEncoder } = require('util');

function fixEncoding(filePath) {
  try {
    const raw = fs.readFileSync(filePath);
    
    // Check for UTF-8 BOM
    let bytes = raw;
    if (raw[0] === 0xEF && raw[1] === 0xBB && raw[2] === 0xBF) {
      console.log(`${filePath}: Found UTF-8 BOM. Stripping it.`);
      bytes = raw.slice(3);
    }

    // Try to detect if it's already UTF-8. 
    // If it's pure ASCII, both decoders work the same.
    // If it has Hebrew D7 xx sequences, it's UTF-8.
    // If it has single bytes in E0-FA range, it's Windows-1255.
    
    const decoder1255 = new TextDecoder('windows-1255');
    const decoderUTF8 = new TextDecoder('utf-8', { fatal: true });
    
    let content;
    try {
      // Try UTF-8 first. If it fails, it's likely Windows-1255.
      content = decoderUTF8.decode(bytes);
      console.log(`${filePath}: File is already valid UTF-8. No conversion needed.`);
    } catch (e) {
      console.log(`${filePath}: Not valid UTF-8. Converting from Windows-1255...`);
      content = decoder1255.decode(bytes);
    }

    // Write back as UTF-8 without BOM
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`${filePath}: Re-encoded successfully.`);
  } catch (err) {
    console.error(`Error processing ${filePath}:`, err);
  }
}

// Target files
const files = ['index.html', 'activity.js', 'cal.js', 'core.js', 'data.js', 'suppliers.js'];
files.forEach(fixEncoding);
