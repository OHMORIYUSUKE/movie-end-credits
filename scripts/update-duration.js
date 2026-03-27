const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const MP3_PATH = 'public/music/end.mp3';
const ROOT_TSX_PATH = 'src/Root.tsx';
const CONFIG_JSON_PATH = 'src/video-config.json';
const FPS = 30;
const BUFFER_SECONDS = 4; // 前後2秒ずつの無音

try {
  // Get duration using afinfo (macOS)
  const output = execSync(`afinfo "${MP3_PATH}" | grep duration`).toString();
  const match = output.match(/duration: ([\d.]+)/);
  if (!match) throw new Error('Could not parse duration');

  const durationSeconds = parseFloat(match[1]);
  const totalFrames = Math.ceil((durationSeconds + BUFFER_SECONDS) * FPS);

  console.log(`MP3 Duration: ${durationSeconds.toFixed(2)}s`);
  console.log(`Total Frames (with ${BUFFER_SECONDS}s buffer): ${totalFrames}`);

  // Update video-config.json
  let config = {};
  if (fs.existsSync(CONFIG_JSON_PATH)) {
    config = JSON.parse(fs.readFileSync(CONFIG_JSON_PATH, 'utf8'));
  }
  
  config.durationInFrames = totalFrames;
  config.fps = FPS;
  if (!config.secondsPerPhoto) config.secondsPerPhoto = 4;
  if (!config.startDelayFrames) config.startDelayFrames = 0.5 * FPS;
  if (!config.endDelayFrames) config.endDelayFrames = 2 * FPS;
  
  fs.writeFileSync(CONFIG_JSON_PATH, JSON.stringify(config, null, 2));
  console.log(`Successfully updated ${CONFIG_JSON_PATH}`);

  // Sync with web directory
  const WEB_CONFIG_PATH = 'web/video-config.json';
  fs.writeFileSync(WEB_CONFIG_PATH, JSON.stringify(config, null, 2));
  console.log(`Successfully updated ${WEB_CONFIG_PATH}`);

  // Calculate capacity
  const activeDurationSeconds = (totalFrames - config.startDelayFrames - config.endDelayFrames) / FPS;
  const capacity = Math.floor(activeDurationSeconds / config.secondsPerPhoto);
  console.log(`Calculated Capacity: ${capacity} photos`);

  // Call API to initialize photo selection
  console.log('Initializing photo selection...');
  try {
    const formData = new URLSearchParams();
    formData.append('action', 'select-initial');
    formData.append('capacity', capacity.toString());

    // Note: This requires the local server to be running.
    // If it's not running, we might need to use deno to run a script that accesses KV directly.
    // But since this is a CLI environment, we can try to call it.
    execSync(`curl -s -X POST -d "${formData.toString()}" http://localhost:8000/api/photos`);
    console.log('Successfully initialized photo selection via API');
  } catch (apiErr) {
    console.warn('Could not call API to initialize photos (is the server running?).');
    console.warn('You may need to click "Initialize" in the admin dashboard.');
  }
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
