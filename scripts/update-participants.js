const fs = require('fs');
const path = require('path');

const CSV_PATH = 'public/credit/event_375981_participants.csv';
const OUTPUT_JSON = 'src/participants.json';

try {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`Error: CSV file ${CSV_PATH} not found.`);
    process.exit(1);
  }

  let content = fs.readFileSync(CSV_PATH, 'utf8');
  // Remove BOM if present
  if (content.startsWith('\ufeff')) {
    content = content.slice(1);
  }

  const lines = content.split('\n');
  const header = lines[0].split(',').map(h => h.trim());

  // find columns: 参加枠名, 表示名, 参加ステータス
  const slotIndex = header.indexOf('参加枠名');
  const nameIndex = header.indexOf('表示名');
  const statusIndex = header.indexOf('参加ステータス');

  if (slotIndex === -1 || nameIndex === -1 || statusIndex === -1) {
    console.error('Error: Required columns not found in CSV.');
    console.error('Found headers:', header);
    process.exit(1);
  }

  const groups = {};

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle CSV quoting (simple version)
    const columns = line.split(',');
    if (columns.length <= Math.max(slotIndex, nameIndex, statusIndex)) continue;

    const status = columns[statusIndex].trim();
    // Skip if not "参加"
    if (status !== '参加') continue;

    let slot = columns[slotIndex].trim();
    const name = columns[nameIndex].trim();

    // Clean up slot name: remove "（ノベルティーあり）" etc
    slot = slot.replace(/（ノベルティーあり）/g, '').replace(/枠/g, '').trim();

    if (!groups[slot]) {
      groups[slot] = [];
    }
    if (name && !groups[slot].includes(name)) {
      groups[slot].push(name);
    }
  }

  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(groups, null, 2));
  console.log(`Successfully updated ${OUTPUT_JSON} with ${Object.keys(groups).length} groups.`);
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
