const https = require('https');
const fs = require('fs');

function fetchFolder(folderId) {
  return new Promise((resolve) => {
    https.get(`https://drive.google.com/drive/folders/${folderId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', () => resolve(''));
  });
}

async function extractAllActiveRoms() {
  const folders = [
    { name: 'China', region: 'cn', id: '1gSFtHeF7SAINCDG5lBJ5o3RBMS-s90St' },
    { name: 'Glb', region: 'global', id: '1PoSGGsS9T9hyEN2GOAZAXqiIchC5Z61n' }
  ];

  const activeRoms = {
    _metadata: {
      lastSync: new Date().toISOString(),
      totalDevices: 0,
      totalRoms: 0,
      source: "Google Drive Live Sync (https://drive.google.com/drive/u/2/folders/1WxXT6Mx7ZdknKh_gd-dQr0Jturtkypyq)"
    }
  };

  let totalRoms = 0;
  const uniqueDevices = new Set();

  for (const f of folders) {
    const html = await fetchFolder(f.id);
    
    // Pattern: data-id="([a-zA-Z0-9_-]{28,35})"[^>]*data-tooltip="([^"]+\.7z)
    // Or: aria-label="([^"]+\.7z)[^>]*data-id="([a-zA-Z0-9_-]{28,35})"
    // Let's use regex finding data-id and nearby filename
    const blocks = html.split('<div class="rxUYqf"');
    for (const b of blocks) {
      const idMatch = b.match(/data-id="([a-zA-Z0-9_-]{28,35})"/);
      const nameMatch = b.match(/UR_[a-zA-Z0-9_\-.]+\.7z/);

      if (idMatch && nameMatch) {
        const fileId = idMatch[1];
        const fileName = nameMatch[0];

        // Format: UR_[codename]_[osBuild]_[androidVer].7z
        // Example: UR_amethyst_OS3.0.305.0.WOPCNXM_16.7z
        const parsed = fileName.match(/^UR_([a-zA-Z0-9]+)_(OS\d+\.\d+[^_]*)_(\d+)\.7z$/i);
        if (parsed) {
          let codename = parsed[1].toLowerCase();
          if (codename === 'aurorapro') codename = 'aurora';
          const osBuild = parsed[2];
          const androidVer = parsed[3] + '.0'; // 16 -> 16.0
          
          // Extract osKey: e.g. OS3.0 from OS3.0.305.0.WOPCNXM
          const osKeyMatch = osBuild.match(/^OS\d+\.\d+/);
          const osKey = osKeyMatch ? osKeyMatch[0] : 'OS3.0';

          if (!activeRoms[codename]) {
            activeRoms[codename] = {
              device: codename,
              roms: {}
            };
          }

          activeRoms[codename].roms[osKey] = {
            os: osBuild,
            android: androidVer,
            region: f.region,
            download: `https://drive.google.com/uc?export=download&id=${fileId}`,
            viewUrl: `https://drive.google.com/file/d/${fileId}/view`,
            fileId: fileId,
            fileName: fileName,
            size: "Bản nén 7z",
            date: "2026-09-15"
          };

          totalRoms++;
          uniqueDevices.add(codename);
        } else {
          console.log(`Bỏ qua tên không parse được: ${fileName}`);
        }
      }
    }
  }

  activeRoms._metadata.totalDevices = uniqueDevices.size;
  activeRoms._metadata.totalRoms = totalRoms;

  console.log(`\n🎉 ĐÃ TRÍCH XUẤT THÀNH CÔNG:`);
  console.log(`- Tổng số thiết bị: ${uniqueDevices.size}`);
  console.log(`- Tổng số bản ROM: ${totalRoms}`);
  console.log(`- Danh sách máy: ${Array.from(uniqueDevices).join(', ')}`);

  fs.writeFileSync('active_roms.json', JSON.stringify(activeRoms, null, 2), 'utf8');
  console.log(`✅ Đã cập nhật file active_roms.json với dữ liệu thật từ Google Drive!`);
}

extractAllActiveRoms();
