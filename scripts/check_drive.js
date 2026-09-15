const https = require('https');

const urls = [
  { name: 'Link Tong (Root)', id: '1WxXT6Mx7ZdknKh_gd-dQr0Jturtkypyq' },
  { name: 'Thu muc 1', id: '1gSFtHeF7SAINCDG5lBJ5o3RBMS-s90St' },
  { name: 'Thu muc 2', id: '1PoSGGsS9T9hyEN2GOAZAXqiIchC5Z61n' }
];

async function checkFolder(item) {
  return new Promise((resolve) => {
    https.get(`https://drive.google.com/drive/folders/${item.id}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const titleMatch = data.match(/<meta property="og:title" content="(.*?)"/) || data.match(/<title>(.*?)<\/title>/);
        const title = titleMatch ? titleMatch[1] : 'Unknown';
        console.log(`[${item.name}] ID: ${item.id}`);
        console.log(`  Title: ${title}`);

        // Search for subfolders or zip files
        const zipMatches = [...new Set(data.match(/[a-zA-Z0-9_\-.]+\.(zip|tar|gz|7z)/gi) || [])];
        if (zipMatches.length > 0) {
          console.log(`  Files:`, zipMatches.slice(0, 10));
        }

        // Search for folder names / JSON embedded data
        const folderNames = [...new Set(data.match(/"title":"([^"]+)"/g) || [])];
        if (folderNames.length > 0) {
          console.log(`  Folder items:`, folderNames.slice(0, 5));
        }
        resolve();
      });
    }).on('error', err => {
      console.error(`Error fetching ${item.name}:`, err.message);
      resolve();
    });
  });
}

async function run() {
  for (const item of urls) {
    await checkFolder(item);
  }
}

run();
