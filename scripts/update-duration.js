const { execSync } = require('child_process');
const fs = require('fs');

const MP3_PATH = 'public/music/end.mp3';
const ROOT_TSX_PATH = 'src/Root.tsx';
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

  // Update Root.tsx
  let content = fs.readFileSync(ROOT_TSX_PATH, 'utf8');
  content = content.replace(/durationInFrames=\{\d+\}/, `durationInFrames={${totalFrames}}`);
  
  fs.writeFileSync(ROOT_TSX_PATH, content);
  console.log(`Successfully updated ${ROOT_TSX_PATH}`);
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
