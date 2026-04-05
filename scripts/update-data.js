const fs = require('fs');
const path = require('path');
const { styleText } = require('node:util');
const { execSync } = require('child_process');
const exifr = require('exifr');

// Load configurations
const SCRIPT_CONFIG_PATH = 'scripts/config.json';
const scriptConfig = JSON.parse(fs.readFileSync(SCRIPT_CONFIG_PATH, 'utf8'));

// Configuration
const PARTICIPANTS_CSV = scriptConfig.participantsCsv;
const SPONSORS_CSV = scriptConfig.sponsorsCsv;
const CREDITS_JSON = 'src/credits.json';

const PHOTOS_DIR = scriptConfig.mediaPath;
const MAX_PHOTOS = 1000;

const MP3_PATH = scriptConfig.audioPath;
const LOGO_PATH = scriptConfig.logoPath;
const GENERATED_CONFIG_JSON = 'src/generated-config.json';
const FPS = 30;
const BUFFER_SECONDS = 4;

// Constants matching Composition.tsx
const DELAY_FRAMES = 0.5 * FPS;
const END_DELAY_FRAMES = 2 * FPS;

/**
* Simple CSV parser that handles quotes and BOM
*/
const parseCSV = (filePath) => {
if (!fs.existsSync(filePath)) {
  console.error(styleText('red', `Error: File not found: ${filePath}`));
  return [];
}
let content = fs.readFileSync(filePath, 'utf-8');

  if (content.startsWith('\ufeff')) {
    content = content.slice(1);
  }
  
  const lines = content.split('\n').filter(line => line.trim() !== '');
  return lines.map(line => {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  });
};

/**
 * Update credits (participants and sponsors)
 */
function updateCredits() {
  console.log('Updating credits...');
  
  if (!fs.existsSync(PARTICIPANTS_CSV) || !fs.existsSync(SPONSORS_CSV)) {
    console.error(styleText('red', 'Error: CSV files not found.'), { participants: PARTICIPANTS_CSV, sponsors: SPONSORS_CSV });
    return;
  }

  const participantsData = parseCSV(PARTICIPANTS_CSV);
  const sponsorsData = parseCSV(SPONSORS_CSV);

  const participantHeader = participantsData[0];
  const slotIndex = participantHeader.indexOf('参加枠名');
  const nameIndex = participantHeader.indexOf('表示名');
  const statusIndex = participantHeader.indexOf('参加ステータス');

  if (slotIndex === -1 || nameIndex === -1 || statusIndex === -1) {
    console.error(styleText('red', 'Error: Required columns not found in participants CSV.'));
    return;
  }

  // Process Participants (Grouped)
  const participantsGroups = {};
  participantsData.slice(1).forEach(row => {
    const status = row[statusIndex];
    if (status !== '参加') return;

    let slot = row[slotIndex];
    const name = row[nameIndex];

    if (!name) return;

    // Apply slot mapping from config
    for (const [key, value] of Object.entries(scriptConfig.slotMappings)) {
      slot = slot.split(key).join(value);
    }
    slot = slot.trim();

    if (!participantsGroups[slot]) {
      participantsGroups[slot] = [];
    }
    if (!participantsGroups[slot].includes(name)) {
      participantsGroups[slot].push(name);
    }
  });

  // Process Sponsors (Grouped)
  const sponsorsGroups = {};
  sponsorsData.slice(1).forEach(row => {
    const rank = row[0];
    let name = row[10]; // 掲載するお名前
    if (!name || name === '') {
      name = row[2]; // 表示名
    }
    
    if (name && name !== '') {
      if (!sponsorsGroups[rank]) {
        sponsorsGroups[rank] = [];
      }
      sponsorsGroups[rank].push(name);
    }
  });

  const result = {
    participants: participantsGroups,
    sponsors: sponsorsGroups
  };

  fs.writeFileSync(CREDITS_JSON, JSON.stringify(result, null, 2));
  console.log(`Successfully updated ${CREDITS_JSON}`);
}

/**
 * Update photos list and duration
 */
async function updateGeneratedData() {
  console.log('Updating generated data (photos)...');

  // 1. Calculate Duration First
  let durationInFrames = 3000; // Default fallback
  if (fs.existsSync(MP3_PATH)) {
    try {
      const output = execSync(`afinfo "${MP3_PATH}" | grep duration`).toString();
      const match = output.match(/duration: ([\d.]+)/);
      if (match) {
        const durationSeconds = parseFloat(match[1]);
        durationInFrames = Math.ceil((durationSeconds + BUFFER_SECONDS) * FPS);
      }
    } catch (err) {
      console.error('Error calculating duration:', err.message);
    }
  } else {
    console.warn(styleText('red', `Warning: MP3 file ${MP3_PATH} not found.`));
  }

  const activeDurationFrames = durationInFrames - DELAY_FRAMES - END_DELAY_FRAMES;

  // 2. Determine photo selection logic
  const displaySeconds = scriptConfig.photoDisplaySeconds;
  const fadeSeconds = scriptConfig.photoFadeSeconds !== undefined ? scriptConfig.photoFadeSeconds : 0.5;
  const fadeFrames = Math.round(fadeSeconds * FPS);
  
  let targetPhotoCount = MAX_PHOTOS;
  if (displaySeconds) {
    const displayFrames = displaySeconds * FPS;
    targetPhotoCount = Math.ceil(activeDurationFrames / displayFrames);
    
    if (displayFrames <= fadeFrames * 2) {
      console.warn(styleText('yellow', `Warning: photoDisplaySeconds (${displaySeconds}s) is too short for photoFadeSeconds (${fadeSeconds}s). Photos will fade out before fully appearing.`));
    }
  }

  // 3. Collect and Sort Photos
  let photos = [];
  if (fs.existsSync(PHOTOS_DIR)) {
    const files = fs.readdirSync(PHOTOS_DIR);
    const photoData = await Promise.all(
      files
        .filter(f => /\.(jpg|jpeg|png|heic|heif|webp|avif|tiff|bmp)$/i.test(f))
        .map(async f => {
          const fullPath = path.join(PHOTOS_DIR, f);
          let time = fs.statSync(fullPath).mtime.getTime();
          try {
            const exif = await exifr.parse(fullPath, {
              pick: ['DateTimeOriginal', 'CreateDate'],
            });
            const captureDate = exif ? (exif.DateTimeOriginal || exif.CreateDate) : null;
            if (captureDate) {
              time = new Date(captureDate).getTime();
            }
          } catch (err) {}
          return { name: f, time };
        })
    );

    if(photoData.length === 0) {
      console.warn(styleText('red', `Warning: Photos directory is empty or contains no valid images: ${PHOTOS_DIR}`));
    }

    photoData.sort((a, b) => a.time - b.time);

    // 4. Pick Exactly the Needed Number of Photos (evenly spaced)
    const count = Math.min(targetPhotoCount, photoData.length);
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const index = Math.floor(i * (photoData.length / count));
        photos.push(photoData[index].name);
      }
    }
    
    console.log(`Selected ${photos.length} photos (Target was ${targetPhotoCount}).`);
  } else {
    console.warn(styleText('red', `Warning: Directory ${PHOTOS_DIR} not found.`));
  }

  if (LOGO_PATH && !fs.existsSync(LOGO_PATH)) {
    console.warn(styleText('red', `Warning: Logo file not found at: ${LOGO_PATH}`));
  }

  const generatedConfig = {
    mediaPath: scriptConfig.mediaPath,
    audioPath: scriptConfig.audioPath,
    logoPath: scriptConfig.logoPath,
    photoDisplaySeconds: scriptConfig.photoDisplaySeconds || null,
    photoFadeFrames: fadeFrames,
    sponsorHeader: scriptConfig.sponsorHeader || "スポンサー",
    photos,
    durationInFrames
  };

  fs.writeFileSync(GENERATED_CONFIG_JSON, JSON.stringify(generatedConfig, null, 2));
  console.log(`Successfully updated ${GENERATED_CONFIG_JSON}`);
}

// Run all
(async () => {
  updateCredits();
  await updateGeneratedData();
})().catch(err => {
  console.error('Fatal error during update:', err);
  process.exit(1);
});
