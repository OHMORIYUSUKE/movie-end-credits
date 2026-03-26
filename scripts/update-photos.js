const fs = require('fs');
const path = require('path');

const PHOTOS_DIR = 'public/photos';
const OUTPUT_JSON = 'src/photos.json';
const MAX_PHOTOS = 20;

try {
  if (!fs.existsSync(PHOTOS_DIR)) {
    console.error(`Error: Directory ${PHOTOS_DIR} not found.`);
    process.exit(1);
  }

  const files = fs.readdirSync(PHOTOS_DIR);
  const photoData = files
    .filter(f => /\.(jpg|jpeg|png)$/i.test(f))
    .map(f => {
      const fullPath = path.join(PHOTOS_DIR, f);
      return {
        name: f,
        time: fs.statSync(fullPath).mtime.getTime()
      };
    })
    .sort((a, b) => a.time - b.time);

  if (photoData.length === 0) {
    console.warn('No photos found in', PHOTOS_DIR);
    fs.writeFileSync(OUTPUT_JSON, JSON.stringify([]));
    process.exit(0);
  }

  // Pick up to MAX_PHOTOS distributed evenly
  const selected = [];
  const count = Math.min(MAX_PHOTOS, photoData.length);
  for (let i = 0; i < count; i++) {
    const index = Math.floor(i * (photoData.length / count));
    selected.push(photoData[index].name);
  }

  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(selected, null, 2));
  console.log(`Successfully selected ${selected.length} photos and updated ${OUTPUT_JSON}`);
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
