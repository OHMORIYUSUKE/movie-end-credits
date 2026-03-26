const fs = require("fs");
const path = require("path");

const parseCSV = (filePath) => {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter(line => line.trim() !== "");
  const headers = lines[0].split(",");
  return lines.slice(1).map(line => {
    // Simple CSV parser that handles quotes
    const values = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  });
};

const participantsFile = "public/credit/event_375981_participants.csv";
const sponsorsFile = "public/credit/event_384080_participants.csv";

const participantsData = parseCSV(participantsFile);
const sponsorsData = parseCSV(sponsorsFile);

// Process participants: use "表示名" (index 2)
const participants = participantsData.map(row => row[2]).filter(name => name && name !== "");

// Process sponsors: group by "参加枠名" (index 0)
// Use "掲載するお名前..." (index 10) if available, else "表示名" (index 2)
const sponsorsGroups = {};
sponsorsData.forEach(row => {
  const rank = row[0];
  let name = row[10];
  if (!name || name === "") {
    name = row[2];
  }
  
  if (name && name !== "") {
    if (!sponsorsGroups[rank]) {
      sponsorsGroups[rank] = [];
    }
    sponsorsGroups[rank].push(name);
  }
});

const result = {
  participants: Array.from(new Set(participants)), // Deduplicate
  sponsors: sponsorsGroups
};

fs.writeFileSync("src/credits.json", JSON.stringify(result, null, 2));
console.log("Updated src/credits.json");
