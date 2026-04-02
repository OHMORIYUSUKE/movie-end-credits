const fs = require('fs');
const path = require('path');
const https = require('https');

// Defaults
const PARTICIPANTS_CSV = path.join(__dirname, '../public/credit/event_375981_participants.csv');
const SPONSORS_CSV = path.join(__dirname, '../public/credit/event_384080_participants.csv');
const OUTPUT_FILE = path.join(__dirname, '../credits.json');

const fetchJSON = (url) => new Promise((resolve, reject) => {
  https.get(url, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
  }).on('error', reject);
});

const parseCSV = (filePath) => {
  if (!fs.existsSync(filePath)) {
    console.warn(`Warning: File not found: ${filePath}`);
    return [];
  }
  const content = fs.readFileSync(filePath, "utf-8").replace(/^\ufeff/, '');
  const lines = content.split("\n").filter(line => line.trim() !== "");
  if (lines.length === 0) return [];
  
  const header = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') inQuotes = !inQuotes;
      else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    const row = {};
    header.forEach((h, i) => row[h] = values[i]);
    return row;
  });
};

async function main() {
  console.log('--- Converting CSV and Fortee data to JSON ---');
  
  const FORTEE_STAFF_API_URL = process.env.FORTEE_STAFF_API_URL || 'https://fortee.jp/engineers-anime-2026/api/staff?type=simple';
  const FORTEE_TIMETABLE_API_URL = process.env.FORTEE_TIMETABLE_API_URL || 'https://fortee.jp/engineers-anime-2026/api/timetable';

  try {
    const [staffData, timetableData] = await Promise.all([
      fetchJSON(FORTEE_STAFF_API_URL),
      fetchJSON(FORTEE_TIMETABLE_API_URL)
    ]);

    const participants = parseCSV(PARTICIPANTS_CSV);
    const sponsorRows = parseCSV(SPONSORS_CSV);

    const result = {
      sections: [
        { 
          title: "一般参加", 
          names: Array.from(new Set(
            participants
              .filter(r => r['参加ステータス'] === '参加' && r['参加枠名'] && r['参加枠名'].includes('一般参加'))
              .map(r => r['表示名'])
              .filter(Boolean)
          )) 
        },
        { 
          title: "登壇者", 
          names: (timetableData.timetable || [])
            .filter(e => e.type === 'talk')
            .map(e => e.speaker.name) 
        },
        { 
          title: "スタッフ", 
          names: (staffData.staff.core || []).map(s => s.name) 
        }
      ],
      sponsors: sponsorRows.reduce((acc, r) => {
        if (r['参加ステータス'] !== '参加') return acc;
        const rank = r['参加枠名'];
        const name = r['掲載するお名前があればご記入ください。'] || r['表示名'];
        if (name && rank) {
          (acc[rank] = acc[rank] || []).push(name);
        }
        return acc;
      }, {})
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
    console.log(`Success! Created: ${OUTPUT_FILE}`);
  } catch (e) {
    console.error('Conversion failed:', e.message);
  }
}

main();
