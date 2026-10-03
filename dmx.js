(function () {
  if (window.__dmx) { window.__dmx.show(); return; }
  var store = {};
  var names = {}, enNames = {};
  try { (window.poke && window.poke.poke || []).forEach(function (p) { if (p.id && !names[p.id]) { names[p.id] = p.zhtw; enNames[p.id] = p.name; } }); } catch (e) {}

  /* 種類：G = 超極巨化、D = 極巨化、R = 一般團體戰（含 Mega、暗影）、? = 沒見過的等級代碼（顯示原始值方便校正） */
  var RAID = { '1': 1, '2': 1, '3': 1, '4': 1, '5': 1, '6': 1, 'M': 1, '11': 1, '13': 1, '15': 1 };
  function kind(x) {
    var n = String(x.n || '').toUpperCase(), v = String(x.v || '').toUpperCase();
    if (n === 'G' || n === 'GD' || n === 'DG' || v.indexOf('GIGANTAMAX') > -1 || v.indexOf('GMAX') > -1) return 'G';
    if (n === 'D') return 'D';
    if (RAID[n]) return 'R';
    if (x.i && n) return '?';
    return '';
  }
  /* 一般團體戰的細分：mega / shadow / normal */
  function raidType(x) {
    var n = String(x.n), tag = (String(x.v || '').split('^')[7] || '').toLowerCase();
    if (n === 'M' || tag === 'mega') return 'mega';
    if (n === '11' || n === '13' || n === '15' || tag === 'shadow') return 'shadow';
    return 'normal';
  }
  function raidStars(x) { var n = +x.n; return n > 10 ? n - 10 : n || 0; }
  function parseTime(s) { var t = Date.parse(String(s || '').replace(/\//g, '-').replace(' ', 'T')); return isNaN(t) ? 0 : t; }
  function alive(x) { var end = parseTime(x.p); return !end || end > Date.now(); }

  function ingest(text) {
    var d;
    try { d = JSON.parse(text); } catch (e) { return; }
    if (d && !Array.isArray(d)) d = d.fp;
    if (!Array.isArray(d)) return;
    var added = 0;
    d.forEach(function (x) {
      if (!x || !x.a || !x.c || !x.d) return;
      var k = kind(x);
      if (k) { x.__k = k; store[x.a] = x; added++; }
    });
    if (added) render();
  }

  var XO = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function () {
    this.addEventListener('load', function () {
      try { if (typeof this.responseText === 'string' && this.responseText.indexOf('"n"') > -1) ingest(this.responseText); } catch (e) {}
    });
    return XO.apply(this, arguments);
  };
  if (window.fetch) {
    var FO = window.fetch;
    window.fetch = function () {
      return FO.apply(this, arguments).then(function (r) {
        try { r.clone().text().then(function (t) { if (t.indexOf('"n"') > -1) ingest(t); }); } catch (e) {}
        return r;
      });
    };
  }

  /* PokeAPI 縮圖：一般用圖鑑編號直接組網址；超極巨化、Mega、地區型態查 /pokemon/{英文名}-{型態}，結果存在 localStorage */
  var SPRITE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/';
  var spriteCache = {};
  try { spriteCache = JSON.parse(localStorage.getItem('dmx_sprite') || '{}'); } catch (e) {}
  var spritePending = {};
  /* PokeAPI 上有型態後綴的超極巨化名稱 */
  var GMAX_SLUG = { 849: 'toxtricity-amped-gmax', 892: 'urshifu-single-strike-gmax' };
  var FORM_SUFFIX = { GALARIAN: 'galar', ALOLA: 'alola', ALOLAN: 'alola', HISUIAN: 'hisui', PALDEA: 'paldea' };
  function baseSlug(id) {
    return (enNames[id] || '').toLowerCase().replace(/['’.]/g, '').replace(/♀/g, '-f').replace(/♂/g, '-m').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  /* 依序嘗試的 PokeAPI 名稱；回傳空陣列代表直接用一般的圖 */
  function variantSlugs(x) {
    var id = x.j, base = baseSlug(id);
    if (!base) return [];
    if (x.__k === 'G') return [GMAX_SLUG[id] || base + '-gmax'];
    if (x.__k === 'R' && raidType(x) === 'mega') return [base + '-mega', base + '-mega-x', base + '-mega-y'];
    var f = (String(x.v || '').split('^')[4] || '').toUpperCase();
    if (FORM_SUFFIX[f]) return [base + '-' + FORM_SUFFIX[f]];
    return [];
  }
  function lookup(key, slugs) {
    if (!slugs.length) { spriteCache[key] = ''; try { localStorage.setItem('dmx_sprite', JSON.stringify(spriteCache)); } catch (e) {} render(); return; }
    fetch('https://pokeapi.co/api/v2/pokemon/' + slugs[0]).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var url = j && j.sprites && j.sprites.front_default;
        if (!url) return lookup(key, slugs.slice(1));
        spriteCache[key] = url;
        try { localStorage.setItem('dmx_sprite', JSON.stringify(spriteCache)); } catch (e) {}
        render();
      }).catch(function () { spriteCache[key] = ''; });
  }
  function spriteUrl(x) {
    var plain = SPRITE + (+x.j) + '.png';
    var slugs = variantSlugs(x);
    if (!slugs.length) return plain;
    var key = slugs[0];
    if (spriteCache[key] !== undefined) return spriteCache[key] || plain;
    if (!spritePending[key]) { spritePending[key] = 1; lookup(key, slugs); }
    return plain;
  }
  /* 極巨化在遊戲裡是一般外觀加紅色光芒，暗影是紫色光芒，用光暈表示 */
  function glow(x) {
    if (x.__k === 'D') return 'filter:drop-shadow(0 0 3px #e53935) drop-shadow(0 0 2px #e53935);';
    if (x.__k === 'R' && raidType(x) === 'shadow') return 'filter:drop-shadow(0 0 3px #7b1fa2) drop-shadow(0 0 2px #7b1fa2);';
    return '';
  }
  function img(x, size) {
    if (x.i === 'egg') return '<span style="display:inline-block;width:' + size + 'px;text-align:center;font-size:' + Math.round(size * 0.6) + 'px;vertical-align:middle;margin-right:4px">🥚</span>';
    return '<img src="' + spriteUrl(x) + '" width="' + size + '" height="' + size + '" loading="lazy" onerror="this.style.visibility=\'hidden\'" style="vertical-align:middle;image-rendering:pixelated;margin-right:4px;' + glow(x) + '">';
  }

  function tag(bg, text) { return '<span style="background:' + bg + ';color:#fff;border-radius:3px;padding:0 4px;font-size:11px">' + text + '</span>'; }
  function badge(x) {
    if (x.__k === 'G') return tag('#6a1b9a', '超極巨');
    if (x.__k === 'D') return tag('#c2185b', '極巨');
    if (x.__k === '?') return tag('#757575', '未知');
    var t = raidType(x);
    return t === 'mega' ? tag('#00897b', 'Mega') : t === 'shadow' ? tag('#37474f', '暗影') : tag('#1565c0', '團體戰');
  }
  /* 極巨化星級對照表：打開時讀 GitHub 上每天自動更新的版本，失敗就用內建的舊表；API 本身沒有極巨化星級 */
  var TIER = {"D":{"1":1,"4":1,"7":1,"10":1,"25":1,"58":1,"63":1,"66":2,"92":1,"98":1,"106":3,"107":3,"113":3,"125":3,"126":3,"129":1,"133":2,"138":1,"140":1,"146":5,"163":1,"213":2,"237":3,"280":1,"302":3,"320":2,"328":1,"349":2,"363":1,"374":3,"415":1,"519":1,"524":1,"527":1,"529":1,"546":1,"554":2,"568":1,"615":3,"633":3,"686":1,"761":1,"766":3,"780":3,"810":1,"813":1,"816":1,"819":1,"821":1,"831":1,"856":1,"870":3},"G":{"815":6},"updated":"2026-10-03"};
  fetch('https://raw.githubusercontent.com/moemuom9488m/pogo-dynamax-tiers/main/tiers.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (t) { if (t && t.D) { TIER = t; render(); } }).catch(function () {});
  function starNum(x) {
    if (x.__k === 'R') return raidType(x) === 'mega' ? 0 : raidStars(x);
    /* 超極巨化團體戰一律是 ★6，表上查不到時也能顯示 */
    return (TIER[x.__k] || {})[x.j] || (x.__k === 'G' ? 6 : 0);
  }
  /* 蛋的名稱裡已經有星級（例如「★5蛋」），不重複顯示 */
  function star(x) { var s = x.i === 'egg' ? 0 : starNum(x); return s ? '<span style="color:#f9a825;font-weight:bold">★' + s + '</span>' : ''; }

  var FORM = { GALARIAN: '伽勒爾', ALOLA: '阿羅拉', ALOLAN: '阿羅拉', HISUIAN: '洗翠', PALDEA: '帕底亞', INCARNATE: '化身', THERIAN: '靈獸' };
  function pname(x) {
    if (x.i === 'egg') return (raidType(x) === 'mega' ? 'Mega' : (raidType(x) === 'shadow' ? '暗影' : '') + '★' + raidStars(x)) + '蛋';
    var f = (String(x.v || '').split('^')[4] || '').toUpperCase();
    return (names[x.j] || ('#' + x.j)) + (f ? '（' + (FORM[f] || f) + '）' : '');
  }
  function hm(t) { var d = new Date(t); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  /* 一般團體戰才顯示時間；極巨化點是整天開放（05:00～隔天 05:00） */
  function timeInfo(x) {
    if (x.__k !== 'R') return '';
    var start = parseTime(x.o), end = parseTime(x.p), now = Date.now();
    if (x.i === 'egg' && start > now) return '⏳ ' + hm(start) + ' 孵化（' + Math.ceil((start - now) / 60000) + ' 分後）';
    if (end) return '⏱ 剩 ' + Math.max(0, Math.ceil((end - now) / 60000)) + ' 分（到 ' + hm(end) + '）';
    return '';
  }
  var ORDER = { G: 0, D: 1, R: 2, '?': 3 };
  var mode = 'all';
  /* 排序方式：dist = 距離、time = 時間（蛋看孵化時間、王看結束時間），記在瀏覽器裡 */
  var sortBy = 'dist';
  try { sortBy = localStorage.getItem('dmx_sort') === 'time' ? 'time' : 'dist'; } catch (e) {}
  /* 時間排序的依據：還沒孵化的蛋 = 孵化時間；已出現的王 = 結束時間；極巨化點沒有時間，排最後 */
  function timeKey(x) {
    if (x.__k !== 'R') return Infinity;
    var start = parseTime(x.o), end = parseTime(x.p);
    if (x.i === 'egg' && start > Date.now()) return start;
    return end || Infinity;
  }
  /* 距離篩選（公里，0 = 不限），記在瀏覽器裡 */
  var radius = 0;
  try { radius = +localStorage.getItem('dmx_radius') || 0; } catch (e) {}
  function chip(attr, val, label, on) {
    return '<span ' + attr + '="' + val + '" style="cursor:pointer;padding:' + (mobile ? '6px 12px' : '2px 8px') + ';border-radius:14px;font-size:' + (mobile ? '14px' : '12px') + ';border:1px solid #c2185b;' + (on ? 'background:#c2185b;color:#fff' : 'color:#c2185b') + '">' + label + '</span>';
  }

  /* 目前位置：[緯度, 經度, 精度公尺] */
  var me = null, locMsg = '', locPending = false;
  /* 搜尋的地點：[緯度, 經度, 名稱]；有設定時取代手機定位，成為距離的基準點 */
  var origin = null, originMarker = null;
  function locate() {
    if (origin || me || locPending || locMsg) return;
    if (!navigator.geolocation) { locMsg = '📍 這個瀏覽器不支援定位'; return; }
    locPending = true;
    navigator.geolocation.getCurrentPosition(function (p) {
      locPending = false;
      me = [p.coords.latitude, p.coords.longitude, p.coords.accuracy];
      render();
    }, function (err) {
      locPending = false;
      locMsg = '📍 無法取得定位：' + (err.code === 1 ? '請允許瀏覽器使用位置權限' : err.code === 3 ? '定位逾時' : '目前無法定位');
      render();
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }
  function dist(lat1, lng1, lat2, lng2) {
    var R = 6371000, rad = Math.PI / 180;
    var a = Math.pow(Math.sin((lat2 - lat1) * rad / 2), 2) +
      Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.pow(Math.sin((lng2 - lng1) * rad / 2), 2);
    return 2 * R * Math.asin(Math.sqrt(a));
  }
  function fmtDist(m) { return m < 1000 ? Math.round(m) + ' 公尺' : (m / 1000).toFixed(m < 10000 ? 1 : 0) + ' 公里'; }

  /* 手機（窄螢幕）改成從下方滑出的面板，可收合，避免擋住地圖 */
  var mobile = Math.min(window.innerWidth, screen.width) < 700;
  var box = document.createElement('div');
  box.style.cssText = (mobile
    ? 'position:fixed;left:0;right:0;bottom:0;max-height:50vh;border-radius:12px 12px 0 0;font:16px "Microsoft JhengHei",sans-serif;'
    : 'position:fixed;top:10px;left:10px;width:340px;max-height:85vh;border-radius:8px;font:14px "Microsoft JhengHei",sans-serif;') +
    'z-index:99999;display:flex;flex-direction:column;background:#fff;color:#222;border:2px solid #c2185b;box-shadow:0 4px 16px rgba(0,0,0,.3)';
  box.innerHTML = '<div id="dmx-h" style="padding:' + (mobile ? '10px 12px' : '8px') + ';background:#c2185b;color:#fff;display:flex;justify-content:space-between;align-items:center;border-radius:' + (mobile ? '9px 9px 0 0' : '0') + '"><b>團體戰 / 極巨化搜尋</b>' +
    '<span><span id="dmx-min" style="cursor:pointer;padding:0 10px;font-size:18px">－</span><span id="dmx-x" style="cursor:pointer;padding:0 6px 0 10px;font-size:18px">✕</span></span></div>' +
    '<div id="dmx-body" style="display:flex;flex-direction:column;min-height:0;flex:1">' +
    '<div style="padding:8px"><input id="dmx-q" type="search" placeholder="輸入寶可夢名稱，例如：列陣兵、蛋" style="width:100%;box-sizing:border-box;padding:' + (mobile ? '10px' : '6px') + ';border:1px solid #ccc;border-radius:6px;font-size:16px">' +
    '<div id="dmx-ft" style="margin-top:6px;font-size:13px;color:#c2185b;cursor:pointer;user-select:none;padding:' + (mobile ? '4px 0' : '2px 0') + '"></div>' +
    '<div id="dmx-f" style="display:none">' +
    '<div id="dmx-m" style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap"></div>' +
    '<div id="dmx-o" style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;align-items:center"></div>' +
    '<div id="dmx-r" style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;align-items:center"></div>' +
    '<div id="dmx-g" style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;align-items:center"></div></div>' +
    '<div id="dmx-s" style="color:#666;font-size:12px;margin-top:4px"></div></div>' +
    '<div id="dmx-l" style="overflow:auto;-webkit-overflow-scrolling:touch;padding:0 8px 8px"></div></div>';
  document.body.appendChild(box);
  var q = box.querySelector('#dmx-q'), list = box.querySelector('#dmx-l'), stat = box.querySelector('#dmx-s'), modes = box.querySelector('#dmx-m');
  var sortBar = box.querySelector('#dmx-o');
  /* 篩選與排序區塊：預設摺疊，摺疊時顯示目前條件的摘要 */
  var filterBox = box.querySelector('#dmx-f'), filterToggle = box.querySelector('#dmx-ft'), filterOpen = false;
  filterToggle.onclick = function () { filterOpen = !filterOpen; filterBox.style.display = filterOpen ? 'block' : 'none'; render(); };
  /* 範圍輸入框只建立一次，render 時不重畫，打字才不會被打斷 */
  var radiusBar = box.querySelector('#dmx-r');
  radiusBar.innerHTML = '<span style="font-size:13px;color:#666">📍 只顯示</span>' +
    '<input id="dmx-km" type="number" inputmode="decimal" min="0" step="0.5" placeholder="不限" style="width:' + (mobile ? '72px' : '60px') + ';padding:' + (mobile ? '6px' : '3px') + ';border:1px solid #ccc;border-radius:6px;font-size:16px;text-align:center">' +
    '<span style="font-size:13px;color:#666">公里內</span>' +
    '<span id="dmx-km-x" style="cursor:pointer;color:#c2185b;font-size:13px;padding:0 4px">清除</span>' +
    '<span id="dmx-km-msg" style="font-size:12px;color:#e65100"></span>';
  var kmInput = radiusBar.querySelector('#dmx-km'), kmMsg = radiusBar.querySelector('#dmx-km-msg');
  if (radius) kmInput.value = radius;
  function setRadius(v) {
    radius = v > 0 ? v : 0;
    try { localStorage.setItem('dmx_radius', radius); } catch (e) {}
    if (radius && locMsg) locMsg = '';
    render();
  }
  kmInput.oninput = function () { setRadius(parseFloat(kmInput.value)); };
  radiusBar.querySelector('#dmx-km-x').onclick = function () { kmInput.value = ''; setRadius(0); };

  /* 地址 / 地點搜尋（OpenStreetMap Nominatim）：按下搜尋才查，地圖跳過去，並把那裡當成距離基準點 */
  var geoBar = box.querySelector('#dmx-g');
  geoBar.innerHTML = '<input id="dmx-addr" type="search" enterkeyhint="search" placeholder="地址或地點，例如：台北車站" style="flex:1;min-width:150px;padding:' + (mobile ? '8px' : '4px 6px') + ';border:1px solid #ccc;border-radius:6px;font-size:16px">' +
    '<span id="dmx-addr-go" style="cursor:pointer;background:#c2185b;color:#fff;border-radius:6px;padding:' + (mobile ? '8px 14px' : '4px 10px') + ';font-size:14px">搜尋</span>' +
    '<div id="dmx-sug" style="display:none;width:100%;border:1px solid #ddd;border-radius:6px;background:#fff;max-height:' + (mobile ? '30vh' : '220px') + ';overflow:auto;box-shadow:0 2px 8px rgba(0,0,0,.15)"></div>' +
    '<div id="dmx-addr-msg" style="width:100%;font-size:12px;color:#666"></div>';
  var addrInput = geoBar.querySelector('#dmx-addr'), addrMsg = geoBar.querySelector('#dmx-addr-msg'), sugBox = geoBar.querySelector('#dmx-sug');
  function showOrigin() {
    try {
      if (originMarker) { window.map.removeLayer(originMarker); originMarker = null; }
      if (origin && window.L) originMarker = window.L.circleMarker([origin[0], origin[1]], { radius: 9, color: '#c2185b', weight: 3, fillColor: '#fff', fillOpacity: 1 }).addTo(window.map).bindTooltip(origin[2]);
    } catch (e) {}
  }
  function clearOrigin() {
    origin = null; showOrigin();
    addrMsg.innerHTML = '';
    render();
  }
  /* 跳到某個地點並設為距離基準點，同時記進「最近搜尋」 */
  var recent = [];
  try { recent = JSON.parse(localStorage.getItem('dmx_recent') || '[]'); } catch (e) {}
  function setOrigin(lat, lon, name) {
    origin = [+lat, +lon, name];
    try { window.map.setView([origin[0], origin[1]], 16); } catch (e) {}
    showOrigin();
    recent = [{ n: name, a: +lat, o: +lon }].concat(recent.filter(function (r) { return r.n !== name; })).slice(0, 5);
    try { localStorage.setItem('dmx_recent', JSON.stringify(recent)); } catch (e) {}
    addrInput.value = name;
    hideSug();
    addrMsg.innerHTML = '📍 以「<b>' + esc(name) + '</b>」為中心計算距離　<span id="dmx-addr-x" style="color:#1565c0;cursor:pointer">改回我的位置</span>';
    addrMsg.querySelector('#dmx-addr-x').onclick = clearOrigin;
    render();
  }
  var geoBusy = false;
  /* 完整搜尋（按「搜尋」或 Enter）：OpenStreetMap Nominatim，只在按下時查一次 */
  function searchPlace() {
    var text = addrInput.value.trim();
    if (!text || geoBusy) return;
    geoBusy = true;
    hideSug();
    addrMsg.textContent = '搜尋中…';
    var url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=tw&accept-language=zh-TW&q=' + encodeURIComponent(text);
    fetch(url).then(function (r) { return r.ok ? r.json() : []; }).then(function (res) {
      geoBusy = false;
      if (!res || !res.length) { addrMsg.innerHTML = '<span style="color:#e65100">找不到「' + esc(text) + '」，試試更完整的地址或地標名稱</span>'; return; }
      var p = res[0];
      setOrigin(p.lat, p.lon, (p.name || p.display_name || text).split(',')[0]);
    }).catch(function () { geoBusy = false; addrMsg.innerHTML = '<span style="color:#e65100">搜尋失敗，請檢查網路後再試一次</span>'; });
  }

  /* 打字時的建議：最近搜尋 → 已收集的道館 / 能量點 → Photon 地點建議（Nominatim 禁止拿來做自動完成，所以用專為自動完成設計的 Photon） */
  var sugItems = [], sugTimer = null, sugSeq = 0;
  function hideSug() { sugBox.style.display = 'none'; sugItems = []; }
  function drawSug(text, places) {
    var t = text.toLowerCase();
    var items = [], seen = {};
    function add(icon, name, sub, lat, lon) {
      var key = name + '|' + sub;
      if (seen[key] || !name) return;
      seen[key] = 1;
      items.push({ icon: icon, name: name, sub: sub, lat: lat, lon: lon });
    }
    recent.forEach(function (r) { if (!t || r.n.toLowerCase().indexOf(t) > -1) add('🕘', r.n, '最近搜尋', r.a, r.o); });
    if (t) {
      var gyms = 0;
      Object.keys(store).forEach(function (k) {
        var x = store[k];
        if (gyms < 5 && x.g && x.g.toLowerCase().indexOf(t) > -1) { add('🏟', x.g, x.__k === 'D' || x.__k === 'G' ? '能量點' : '道館', +x.c, +x.d); gyms++; }
      });
    }
    (places || []).forEach(function (p) { add('📍', p.name, p.sub, p.lat, p.lon); });
    sugItems = items.slice(0, 10);
    if (!sugItems.length) { sugBox.style.display = 'none'; return; }
    sugBox.innerHTML = sugItems.map(function (s, i) {
      return '<div class="dmx-sug-i" data-i="' + i + '" style="padding:' + (mobile ? '9px 10px' : '6px 8px') + ';border-top:' + (i ? '1px solid #f0f0f0' : '0') + ';cursor:pointer;font-size:14px">' +
        s.icon + ' ' + esc(s.name) + ' <span style="color:#999;font-size:12px">' + esc(s.sub || '') + '</span></div>';
    }).join('');
    sugBox.style.display = 'block';
    Array.prototype.forEach.call(sugBox.querySelectorAll('.dmx-sug-i'), function (el) {
      /* 用 mousedown 先擋住失焦，點選才不會因為輸入框 blur 而被收掉 */
      el.onmousedown = function (e) { e.preventDefault(); };
      el.onclick = function () { var s = sugItems[+el.getAttribute('data-i')]; if (s) setOrigin(s.lat, s.lon, s.name); };
    });
  }
  function suggest() {
    var text = addrInput.value.trim();
    drawSug(text, []);
    clearTimeout(sugTimer);
    if (text.length < 2) return;
    var seq = ++sugSeq;
    sugTimer = setTimeout(function () {
      var c = origin || me || (function () { try { var m = window.map.getCenter(); return [m.lat, m.lng]; } catch (e) { return [25.05, 121.55]; } })();
      fetch('https://photon.komoot.io/api/?limit=8&bbox=119.3,21.8,122.1,25.4&lat=' + c[0] + '&lon=' + c[1] + '&q=' + encodeURIComponent(text))
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (seq !== sugSeq || !j || !j.features) return;
          drawSug(addrInput.value.trim(), j.features.map(function (f) {
            var p = f.properties || {};
            return { name: p.name || p.street || '', sub: [p.district, p.city].filter(Boolean).join(' '), lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] };
          }));
        }).catch(function () {});
    }, 350);
  }
  addrInput.oninput = suggest;
  addrInput.onfocus = suggest;
  addrInput.onblur = function () { setTimeout(hideSug, 200); };
  geoBar.querySelector('#dmx-addr-go').onclick = searchPlace;
  addrInput.onkeydown = function (e) {
    if (e.key === 'Enter') { e.preventDefault(); addrInput.blur(); searchPlace(); }
    else if (e.key === 'Escape') hideSug();
  };
  var body = box.querySelector('#dmx-body'), minBtn = box.querySelector('#dmx-min');
  function collapse(on) { body.style.display = on ? 'none' : 'flex'; minBtn.textContent = on ? '＋' : '－'; }
  minBtn.onclick = function () { collapse(body.style.display !== 'none'); };
  box.querySelector('#dmx-x').onclick = function () { box.style.display = 'none'; };
  q.oninput = render;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function render() {
    /* 已結束的團體戰不顯示 */
    var all = Object.keys(store).map(function (k) { return store[k]; }).filter(alive);
    /* 距離基準點：搜尋的地點優先，其次是手機定位；選了距離範圍就只留範圍內的點 */
    if (radius) locate();
    var here = origin || me;
    if (here) all.forEach(function (x) { x.__dist = dist(here[0], here[1], +x.c, +x.d); });
    if (radius && here) all = all.filter(function (x) { return x.__dist <= radius * 1000; });
    kmMsg.textContent = radius && !here ? (locMsg || '取得定位中…') : '';
    var MODE_NAME = { all: '全部', R: '團體戰', D: '極巨', G: '超極巨', '?': '未知' };
    filterToggle.innerHTML = (filterOpen ? '▾' : '▸') + ' 篩選與排序：<b>' + MODE_NAME[mode] + '・' + (sortBy === 'time' ? '時間' : '距離') + '・' +
      (radius ? radius + ' 公里內' : '不限距離') + (origin ? '・以' + esc(origin[2]) + '為中心' : '') + '</b>' + (radius && !here ? ' <span style="color:#e65100">（' + esc(locMsg || '取得定位中…') + '）</span>' : '');
    var cnt = { G: 0, D: 0, R: 0, '?': 0 };
    all.forEach(function (x) { cnt[x.__k]++; });
    var opts = [['all', '全部 ' + all.length], ['R', '團體戰 ' + cnt.R], ['D', '極巨 ' + cnt.D], ['G', '超極巨 ' + cnt.G]];
    if (cnt['?']) opts.push(['?', '未知 ' + cnt['?']]);
    modes.innerHTML = opts.map(function (o) { return chip('data-m', o[0], o[1], mode === o[0]); }).join('');
    Array.prototype.forEach.call(modes.querySelectorAll('[data-m]'), function (el) { el.onclick = function () { mode = el.getAttribute('data-m'); render(); }; });
    sortBar.innerHTML = '<span style="font-size:13px;color:#666">排序</span>' + chip('data-o', 'dist', '📍 距離', sortBy === 'dist') + chip('data-o', 'time', '⏱ 時間', sortBy === 'time');
    Array.prototype.forEach.call(sortBar.querySelectorAll('[data-o]'), function (el) {
      el.onclick = function () {
        sortBy = el.getAttribute('data-o');
        try { localStorage.setItem('dmx_sort', sortBy); } catch (e) {}
        render();
      };
    });

    var pool = all.filter(function (x) { return mode === 'all' || x.__k === mode; });
    var kw = q.value.trim();
    var hits = pool.filter(function (x) { return !kw || pname(x).indexOf(kw) > -1 || String(x.j) === kw; });
    stat.textContent = (kw ? '符合 ' + hits.length + ' 個，' : '') + '拖動或縮小地圖可收集更多（極巨星級更新：' + (TIER.updated || '?') + '）';

    if (!kw && sortBy === 'dist') {
      /* 依種類、寶可夢分組；超極巨 → 極巨 → 團體戰（高星級在前） */
      var groups = {};
      pool.forEach(function (x) { var key = x.__k + '|' + pname(x); (groups[key] = groups[key] || []).push(x); });
      list.innerHTML = Object.keys(groups).sort(function (a, b) {
        var xa = groups[a][0], xb = groups[b][0];
        return ORDER[xa.__k] - ORDER[xb.__k] ||
          (xa.__k === 'R' ? (raidType(xb) === 'mega') - (raidType(xa) === 'mega') || raidStars(xb) - raidStars(xa) : 0) ||
          groups[a].length - groups[b].length;
      }).map(function (key) {
        var x = groups[key][0];
        var near = here ? Math.min.apply(null, groups[key].map(function (y) { return y.__dist; })) : null;
        return '<div class="dmx-n" data-n="' + esc(pname(x)) + '" style="padding:3px 0;border-top:1px solid #eee;cursor:pointer;display:flex;align-items:center">' +
          img(x, 36) + badge(x) + '&nbsp;' + star(x) + '&nbsp;' + esc(pname(x)) + '&nbsp;<span style="color:#888">× ' + groups[key].length + '</span>' +
          (near !== null ? '&nbsp;<span style="color:#1565c0;font-size:12px">最近 ' + fmtDist(near) + '</span>' : '') + '</div>';
      }).join('') || '<div style="color:#888;padding:6px 0">' + (radius && here ? radius + ' 公里內沒有，試著放大範圍' : '還沒收集到資料，請拖動一下地圖') + '</div>';
      Array.prototype.forEach.call(list.querySelectorAll('.dmx-n'), function (el) { el.onclick = function () { q.value = el.getAttribute('data-n'); render(); }; });
      return;
    }
    /* 逐筆清單：時間排序 = 越快孵化 / 越快結束的在前（同時間再看距離）；距離排序 = 由近到遠，沒有定位時依種類 */
    locate();
    var byDist = function (a, b) { return here ? a.__dist - b.__dist : ORDER[a.__k] - ORDER[b.__k]; };
    if (sortBy === 'time') hits.sort(function (a, b) { return (timeKey(a) - timeKey(b)) || byDist(a, b); });
    else hits.sort(byDist);
    var locText = origin ? '📍 距離從「' + esc(origin[2]) + '」算起' : me ? '📍 定位精度約 ' + Math.round(me[2]) + ' 公尺' : esc(locMsg || '📍 正在取得定位…');
    var locLine = '<div style="font-size:12px;color:#666;padding:4px 0">' +
      (sortBy === 'time' ? '⏱ 依時間排序：蛋看孵化時間、王看結束時間　' + locText : (origin ? '📍 依距離「' + esc(origin[2]) + '」由近到遠排序' : me ? '📍 已依距離排序（定位精度約 ' + Math.round(me[2]) + ' 公尺）' : locText)) +
      '　<span id="dmx-relocate" style="color:#1565c0;cursor:pointer">' + (origin ? '改回我的位置' : '重新定位') + '</span></div>';
    list.innerHTML = locLine + (hits.map(function (x, i) {
      var v = (x.v || '').split('^');
      var raw = x.__k === '?' ? '<br><span style="color:#999;font-size:11px">n=' + esc(x.n) + '　v=' + esc(x.v) + '</span>' : '';
      var d = here ? ' <span style="background:#e3f2fd;color:#1565c0;border-radius:3px;padding:0 4px;font-size:12px;font-weight:bold">' + fmtDist(x.__dist) + '</span>' : '';
      var t = timeInfo(x);
      return '<div style="padding:6px 0;border-top:1px solid #eee;display:flex;gap:6px"><div>' + img(x, 48) + '</div><div>' +
        badge(x) + ' ' + star(x) + ' <b>' + esc(pname(x)) + '</b>' + d + ' <span style="color:#888">' + esc(v.slice(2, 4).filter(Boolean).join('/')) + '</span><br>' +
        esc(x.g || '(未命名)') + (t ? '<br><span style="color:#e65100;font-size:13px">' + esc(t) + '</span>' : '') + raw +
        '<br><span class="dmx-go" data-i="' + i + '" style="color:#1565c0;cursor:pointer">在地圖上顯示</span>　' +
        '<a href="https://maps.google.com/?q=' + x.c + ',' + x.d + '" target="_blank" style="color:#c2185b">Google 導航</a></div></div>';
    }).join('') || '<div style="color:#888;padding:6px 0">' + (radius && here ? radius + ' 公里內沒有，試著放大範圍' : '目前收集到的範圍內沒有，試著拖動或縮小地圖') + '</div>');
    list.querySelector('#dmx-relocate').onclick = function () { if (origin) { clearOrigin(); return; } me = null; locMsg = ''; locPending = false; render(); };
    Array.prototype.forEach.call(list.querySelectorAll('.dmx-go'), function (el) {
      el.onclick = function () {
        var x = hits[+el.getAttribute('data-i')];
        try { window.map.setView([+x.c, +x.d], 18); if (mobile) collapse(true); } catch (e) { window.open('https://maps.google.com/?q=' + x.c + ',' + x.d); }
      };
    });
  }

  /* 每分鐘刷新一次，讓剩餘時間更新、已結束的團體戰消失 */
  setInterval(function () { if (box.style.display !== 'none' && body.style.display !== 'none') render(); }, 60000);
  window.__dmx = { show: function () { box.style.display = 'flex'; collapse(false); } };
  render();
})();
