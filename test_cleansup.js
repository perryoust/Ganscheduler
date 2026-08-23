const cleanSupText = (s) => String(s || '').toLowerCase().replace(/["'״׳`]/g, '').replace(/\bבעמ\b/g, '').replace(/[-_.,()]/g, ' ').replace(/\s+/g, ' ').trim();
console.log(cleanSupText('פלוס לגננת בע"מ'));
console.log(cleanSupText('פלוס לגננת בע\'\'מ'));
console.log(cleanSupText('פלוס לגננת בעמ'));
console.log(cleanSupText('פלוס לגננת'));
