const fs = require("fs");
const https = require("https");

const PARTICIPANTS_CSV = "public/credit/event_375981_participants.csv";
const SPONSORS_CSV = "public/credit/event_384080_participants.csv";
const OUTPUT_JSON = "src/credits.json";

const fetchJSON = (url) => {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
};

const parseCSV = (filePath) => {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, "utf-8").replace(/^\ufeff/, '');
  const lines = content.split("\n").filter(line => line.trim() !== "");
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
      } else current += char;
    }
    values.push(current.trim());
    
    const row = {};
    header.forEach((h, i) => row[h] = values[i]);
    return row;
  });
};

async function main() {
  try {
    console.log('Fetching API data (Speakers & Staff)...');
    const [staffData, timetableData] = await Promise.all([
      fetchJSON('https://fortee.jp/engineers-anime-2026/api/staff?type=simple'),
      fetchJSON('https://fortee.jp/engineers-anime-2026/api/timetable')
    ]);

    const staffNames = (staffData.staff.core || []).map(s => s.name);
    const speakerNames = (timetableData.timetable || [])
      .filter(entry => entry.type === 'talk')
      .map(entry => entry.speaker.name);

    console.log('Parsing CSVs...');
    const participantsRows = parseCSV(PARTICIPANTS_CSV);
    const sponsorsRows = parseCSV(SPONSORS_CSV);

    // 一般参加者の抽出 (ステータスが「参加」かつ、枠名に「一般参加」を含む)
    const generalParticipants = participantsRows
      .filter(row => row['参加ステータス'] === '参加' && row['参加枠名'].includes('一般参加'))
      .map(row => row['表示名'])
      .filter(name => name && name !== "");

    // スポンサーの抽出 (ランクごとにグルーピング)
    const sponsorsGroups = {};
    sponsorsRows.forEach(row => {
      if (row['参加ステータス'] !== '参加') return;
      const rank = row['参加枠名'];
      let name = row['掲載するお名前があればご記入ください。'] || row['表示名'];
      
      if (name && name !== "") {
        if (!sponsorsGroups[rank]) sponsorsGroups[rank] = [];
        if (!sponsorsGroups[rank].includes(name)) {
          sponsorsGroups[rank].push(name);
        }
      }
    });

    // データの集約
    const result = {
      // メインのスクロール用
      sections: [
        { title: "一般参加", names: Array.from(new Set(generalParticipants)) },
        { title: "登壇者", names: Array.from(new Set(speakerNames)) },
        { title: "スタッフ", names: Array.from(new Set(staffNames)) }
      ],
      // スポンサー用 (逆順で表示することが多いためそのまま保持)
      sponsors: sponsorsGroups
    };

    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(result, null, 2));
    console.log(`Successfully updated ${OUTPUT_JSON}`);
    
    // 不要になった participants.json があれば削除 (または空にする)
    if (fs.existsSync("src/participants.json")) {
      fs.unlinkSync("src/participants.json");
      console.log("Removed redundant src/participants.json");
    }

  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
