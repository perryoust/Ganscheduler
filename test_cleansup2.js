const cleanSupText = (s) => String(s || '').toLowerCase().replace(/["'״׳`]/g, '').replace(/\s*\(?\s*בע[\s.]*מ\s*\)?\s*/gi, ' ').replace(/\s*\(?\s*ltd\.?\s*\)?\s*/gi, ' ').replace(/[-_.,()]/g, ' ').replace(/\s+/g, ' ').trim();
console.log(cleanSupText('פלוס לגננת בע"מ'));
console.log(cleanSupText('פלוס לגננת בע\'\'מ'));
console.log(cleanSupText('פלוס לגננת בעמ'));
console.log(cleanSupText('פלוס לגננת'));
