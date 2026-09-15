const https = require('https');

async function getFolderHtml(folderId) {
  return new Promise((resolve) => {
    https.get(`https://drive.google.com/drive/folders/${folderId}`, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' 
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', () => resolve(''));
  });
}

async function inspectAll() {
  const folders = [
    { name: 'China', region: 'cn', id: '1gSFtHeF7SAINCDG5lBJ5o3RBMS-s90St' },
    { name: 'Glb', region: 'global', id: '1PoSGGsS9T9hyEN2GOAZAXqiIchC5Z61n' }
  ];

  for (const f of folders) {
    const html = await getFolderHtml(f.id);
    console.log(`\n=== THƯ MỤC: ${f.name} (Region: ${f.region}, ID: ${f.id}) ===`);
    
    // Extract UR_ files
    const matches = [...new Set(html.match(/UR_[a-zA-Z0-9_\-.]+\.(7z|zip|tar)/gi) || [])];
    console.log(`Tìm thấy ${matches.length} file:`);
    matches.forEach(m => console.log(' - ' + m));

    // Also look for [fileId, fileName] pairs if present in drive JSON
    // Drive often has [null, "fileId", null, "fileName"]
    const idMatches = html.match(/\["([a-zA-Z0-9_-]{25,})",\s*\[?"(UR_[^"]+)"/g) || [];
    console.log(`Khớp File ID & File Name:`, idMatches.length);
  }
}

inspectAll();
