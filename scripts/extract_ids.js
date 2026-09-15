const https = require('https');
const fs = require('fs');

https.get(`https://drive.google.com/drive/folders/1gSFtHeF7SAINCDG5lBJ5o3RBMS-s90St`, {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    // Look for data array or JSON in data
    // Usually Google Drive has window['_DRIVE_ivd'] = ... or similar
    const filePairs = [];
    
    // Pattern: ["fileId", ... "UR_xxx.7z"]
    const regex = /\["([a-zA-Z0-9_-]{25,})",\["([^"]+\.7z)"/g;
    let match;
    while ((match = regex.exec(data)) !== null) {
      filePairs.push({ id: match[1], name: match[2] });
    }

    if (filePairs.length === 0) {
      // General search around each UR_ file
      const fileNames = [...new Set(data.match(/UR_[a-zA-Z0-9_\-.]+\.7z/gi) || [])];
      fileNames.forEach(fn => {
        const idx = data.indexOf(fn);
        if (idx !== -1) {
          const slice = data.substring(Math.max(0, idx - 200), idx + 200);
          const idMatch = slice.match(/([a-zA-Z0-9_-]{28,35})/);
          if (idMatch) {
            filePairs.push({ id: idMatch[1], name: fn });
          }
        }
      });
    }

    console.log(`Tìm thấy ${filePairs.length} file kèm ID:`);
    filePairs.slice(0, 10).forEach(p => console.log(p));
    fs.writeFileSync('scripts/extracted_pairs.json', JSON.stringify(filePairs, null, 2));
  });
});
