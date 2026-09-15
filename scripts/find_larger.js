const https = require('https');

https.get(`https://drive.google.com/drive/folders/1gSFtHeF7SAINCDG5lBJ5o3RBMS-s90St`, {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const term = 'UR_amethyst';
    const idx = data.indexOf(term);
    if (idx !== -1) {
      console.log("Larger snippet around UR_amethyst:");
      console.log(data.substring(Math.max(0, idx - 500), idx + 800));
    }
  });
});
