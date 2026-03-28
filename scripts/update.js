const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');

const GENERATED_DIR = path.join(__dirname, '../src/generated');
const MP3_PATH = path.join(__dirname, '../public/music/end.mp3');
const CONFIG_JSON_PATH = path.join(GENERATED_DIR, 'video-config.json');
const CREDITS_JSON_PATH = path.join(GENERATED_DIR, 'credits.json');
const PARTICIPANTS_CSV = path.join(__dirname, '../public/credit/event_375981_participants.csv');
const SPONSORS_CSV = path.join(__dirname, '../public/credit/event_384080_participants.csv');

const FPS = 30;
const BUFFER_SECONDS = 4;

const http = require('http');

// --- Helper Functions ---
const fetchJSON = (url) => new Promise((resolve, reject) => {
  const client = url.startsWith('https') ? https : http;
  client.get(url, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
  }).on('error', reject);
});

const parseCSV = (filePath) => {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, "utf-8").replace(/^\ufeff/, '');
  const lines = content.split("\n").filter(line => line.trim() !== "");
  const header = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = []; let current = ""; let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') inQuotes = !inQuotes;
      else if (char === "," && !inQuotes) { values.push(current.trim()); current = ""; }
      else current += char;
    }
    values.push(current.trim());
    const row = {}; header.forEach((h, i) => row[h] = values[i]);
    return row;
  });
};

// --- Main Execution ---
async function main() {
  const isSetupOnly = process.argv.includes('--setup-only');

  // 1. Setup Phase: Ensure directory and default files exist
  if (!fs.existsSync(GENERATED_DIR)) fs.mkdirSync(GENERATED_DIR, { recursive: true });
  
  const files = [
    { name: 'credits.json', example: 'credits.example.json' },
    { name: 'video-config.json', example: 'video-config.example.json' }
  ];

  files.forEach(file => {
    const target = path.join(GENERATED_DIR, file.name);
    const example = path.join(GENERATED_DIR, file.example);
    if (!fs.existsSync(target) && fs.existsSync(example)) {
      fs.copyFileSync(example, target);
      console.log(`Initialized ${file.name} from default.`);
    }
  });

  if (isSetupOnly) return;

  console.log('--- Updating Video Metadata & Credits ---');

  // 2. Update Duration & Logo Phase
  try {
    let durationSeconds = 0;
    try {
      const allMusic = await fetchJSON('http://localhost:8000/api/music');
      const activeMusic = allMusic.find(m => m.active) || allMusic[0];
      if (activeMusic) {
        if (activeMusic.duration) {
          durationSeconds = activeMusic.duration;
          console.log(`Fetched active music duration from API: ${durationSeconds.toFixed(2)}s (${activeMusic.name})`);
        } else {
          console.log(`Active music duration missing in API, measuring via download...`);
          try {
            execSync(`curl -s "http://localhost:8000/api/music?id=${activeMusic.id}" -o /tmp/active_music.mp3`);
            const output = execSync(`afinfo /tmp/active_music.mp3 | grep duration`).toString();
            durationSeconds = parseFloat(output.match(/duration: ([\d.]+)/)[1]);
            console.log(`Measured downloaded music duration: ${durationSeconds.toFixed(2)}s`);
          } catch (measureErr) {
            console.warn('Failed to measure downloaded music:', measureErr.message);
          }
        }
      }
    } catch (e) {
      console.warn('Could not fetch music from API, falling back to local file.');
    }

    if (durationSeconds === 0) {
      try {
        const output = execSync(`afinfo "${MP3_PATH}" | grep duration`).toString();
        durationSeconds = parseFloat(output.match(/duration: ([\d.]+)/)[1]);
        console.log(`Using local music duration: ${durationSeconds.toFixed(2)}s`);
      } catch (err) {
        console.warn(`Local music (end.mp3) missing or afinfo failed. Using default duration (180s).`);
        durationSeconds = 180;
      }
    }

    const config = JSON.parse(fs.readFileSync(CONFIG_JSON_PATH, 'utf8'));
    const startDelay = config.startDelayFrames ?? 15;
    const endDelay = config.endDelayFrames ?? 60;
    const totalFrames = Math.ceil((durationSeconds + (startDelay / FPS) + (endDelay / FPS)) * FPS);
    
    config.durationInFrames = totalFrames;
    config.fps = FPS;
    config.startDelayFrames = startDelay;
    config.endDelayFrames = endDelay;

    // Logo detection
    const logoDir = path.join(__dirname, '../public/logo');
    if (fs.existsSync(logoDir)) {
      const logoFile = fs.readdirSync(logoDir).find(f => f.startsWith('logo.') && !f.endsWith('.gitkeep'));
      if (logoFile) {
        config.logoPath = `logo/${logoFile}`;
        console.log(`Detected logo: ${logoFile}`);
      }
    }

    fs.writeFileSync(CONFIG_JSON_PATH, JSON.stringify(config, null, 2));
    console.log(`Updated video duration: ${durationSeconds.toFixed(2)}s (${totalFrames} frames)`);

    // Initialize photo selection if server is running
    const capacity = Math.floor((totalFrames - (config.startDelayFrames || 0) - (config.endDelayFrames || 0)) / FPS / (config.secondsPerPhoto || 4));
    try {
      execSync(`curl -s -X POST -d "action=select-initial&capacity=${capacity}" http://localhost:8000/api/photos`);
    } catch (e) {}
  } catch (e) { console.warn('Duration update failed:', e.message); }

  // 3. Update Credits Phase
  try {
    const [staffData, timetableData] = await Promise.all([
      fetchJSON('https://fortee.jp/engineers-anime-2026/api/staff?type=simple'),
      fetchJSON('https://fortee.jp/engineers-anime-2026/api/timetable')
    ]);

    const result = {
      sections: [
        { title: "一般参加", names: Array.from(new Set(parseCSV(PARTICIPANTS_CSV).filter(r => r['参加ステータス'] === '参加' && r['参加枠名'].includes('一般参加')).map(r => r['表示名']))) },
        { title: "登壇者", names: (timetableData.timetable || []).filter(e => e.type === 'talk').map(e => e.speaker.name) },
        { title: "スタッフ", names: (staffData.staff.core || []).map(s => s.name) }
      ],
      sponsors: parseCSV(SPONSORS_CSV).reduce((acc, r) => {
        if (r['参加ステータス'] !== '参加') return acc;
        const rank = r['参加枠名'];
        const name = r['掲載するお名前があればご記入ください。'] || r['表示名'];
        if (name) { (acc[rank] = acc[rank] || []).push(name); }
        return acc;
      }, {})
    };

    fs.writeFileSync(CREDITS_JSON_PATH, JSON.stringify(result, null, 2));
    console.log('Updated credits data.');
  } catch (e) { console.error('Credits update failed:', e.message); }
}

main();
