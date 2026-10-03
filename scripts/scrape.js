// 從 snacknap.com/max-battles 抓 Pokémon GO 極巨化 / 超極巨化星級，寫入 tiers.json
// 格式：{ "D": { 圖鑑編號: 星級 }, "G": { 圖鑑編號: 星級 }, "updated": "YYYY-MM-DD" }
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'tiers.json');
const SOURCE = 'https://www.snacknap.com/max-battles';

function parseTiers(html) {
  const tiers = { D: {}, G: {} };
  const cards = html.split(/<div class="to-card" data-tier="t\d+"/).slice(1);
  for (const card of cards) {
    // 以畫面上的「Tier N」為準（超極巨化的區塊代碼是 t7，但顯示為 Tier 6）
    const tier = +((card.match(/to-card-title">\s*Tier\s*(\d+)/) || [])[1] || 0);
    if (!tier) continue;
    for (const m of card.matchAll(/href="\/pokedex\/pokemon\/(\d+)[^"]*"[\s\S]{0,200}?title="([DG])-Max [^"]+"/g)) {
      tiers[m[2]][String(+m[1])] = tier;
    }
  }
  return tiers;
}

(async () => {
  const res = await fetch(SOURCE, { headers: { 'User-Agent': 'Mozilla/5.0 (pogo-dynamax-tiers daily update)' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const fresh = parseTiers(await res.text());
  const count = Object.keys(fresh.D).length + Object.keys(fresh.G).length;
  // 網頁改版時解析可能失敗，太少就不覆蓋，避免把工具弄壞
  if (count < 10) throw new Error(`只解析到 ${count} 筆，網頁可能改版了，保留舊的 tiers.json`);

  const old = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
  const same = JSON.stringify({ D: old.D, G: old.G }) === JSON.stringify(fresh);
  if (same) { console.log('星級表沒有變化'); return; }
  fresh.updated = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10); // 台灣日期
  fs.writeFileSync(OUT, JSON.stringify(fresh, null, 1) + '\n');
  console.log(`已更新：極巨 ${Object.keys(fresh.D).length} 種、超極巨 ${Object.keys(fresh.G).length} 種`);
})().catch(e => { console.error(e.message); process.exit(1); });
