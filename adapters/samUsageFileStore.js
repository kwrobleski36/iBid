'use strict';
// Node-only: persists the SAM daily call counter to data/sam_usage.json.
const fs = require('fs');
const path = require('path');
const USAGE_PATH = path.join(__dirname, '..', 'data', 'sam_usage.json');

module.exports = {
  load(todayIso) {
    try {
      const u = JSON.parse(fs.readFileSync(USAGE_PATH, 'utf-8'));
      if (u.date === todayIso) return u;
    } catch (_) {}
    return { date: todayIso, calls: 0 };
  },
  save(usage) {
    fs.writeFileSync(USAGE_PATH, JSON.stringify(usage));
  }
};
