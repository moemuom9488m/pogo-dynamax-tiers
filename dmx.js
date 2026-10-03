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
  var TIER = {"D":{"1":1,"4":1,"7":1,"10":1,"25":1,"58":1,"63":1,"66":2,"92":1,"98":1,"106":3,"107":3,"113":3,"125":3,"126":3,"129":1,"133":2,"138":1,"140":1,"146":5,"163":1,"213":2,"237":3,"280":1,"302":3,"320":2,"328":1,"349":2,"363":1,"374":3,"415":1,"519":1,"524":1,"527":1,"529":1,"546":1,"554":2,"568":1,"615":3,"633":3,"686":1,"761":1,"766":3,"780":3,"810":1,"813":1,"816":1,"819":1,"821":1,"831":1,"856":1,"870":3},"G":{},"updated":"2026-10-03"};
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
  /* 距離篩選（公里，0 = 不限），記在瀏覽器裡 */
  var RADII = [0, 1, 3, 5, 10];
  var radius = 0;
  try { radius = +localStorage.getItem('dmx_radius') || 0; } catch (e) {}
  function chip(attr, val, label, on) {
    return '<span ' + attr + '="' + val + '" style="cursor:pointer;padding:' + (mobile ? '6px 12px' : '2px 8px') + ';border-radius:14px;font-size:' + (mobile ? '14px' : '12px') + ';border:1px solid #c2185b;' + (on ? 'background:#c2185b;color:#fff' : 'color:#c2185b') + '">' + label + '</span>';
  }

  /* 目前位置：[緯度, 經度, 精度公尺] */
  var me = null, locMsg = '', locPending = false;
  function locate() {
    if (me || locPending || locMsg) return;
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
    '<div id="dmx-m" style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap"></div>' +
    '<div id="dmx-r" style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;align-items:center"></div>' +
    '<div id="dmx-s" style="color:#666;font-size:12px;margin-top:4px"></div></div>' +
    '<div id="dmx-l" style="overflow:auto;-webkit-overflow-scrolling:touch;padding:0 8px 8px"></div></div>';
  document.body.appendChild(box);
  var q = box.querySelector('#dmx-q'), list = box.querySelector('#dmx-l'), stat = box.querySelector('#dmx-s'), modes = box.querySelector('#dmx-m');
  var radiusBar = box.querySelector('#dmx-r');
  var body = box.querySelector('#dmx-body'), minBtn = box.querySelector('#dmx-min');
  function collapse(on) { body.style.display = on ? 'none' : 'flex'; minBtn.textContent = on ? '＋' : '－'; }
  minBtn.onclick = function () { collapse(body.style.display !== 'none'); };
  box.querySelector('#dmx-x').onclick = function () { box.style.display = 'none'; };
  q.oninput = render;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function render() {
    /* 已結束的團體戰不顯示 */
    var all = Object.keys(store).map(function (k) { return store[k]; }).filter(alive);
    /* 有定位就算出每個點的距離；選了距離範圍就只留範圍內的點 */
    if (radius) locate();
    if (me) all.forEach(function (x) { x.__dist = dist(me[0], me[1], +x.c, +x.d); });
    if (radius && me) all = all.filter(function (x) { return x.__dist <= radius * 1000; });
    radiusBar.innerHTML = '<span style="font-size:12px;color:#666">📍範圍</span>' + RADII.map(function (r) {
      return chip('data-r', r, r ? r + ' 公里' : '不限', radius === r);
    }).join('') + (radius && !me ? '<span style="font-size:12px;color:#e65100">' + esc(locMsg || '取得定位中…') + '</span>' : '');
    Array.prototype.forEach.call(radiusBar.querySelectorAll('[data-r]'), function (el) {
      el.onclick = function () {
        radius = +el.getAttribute('data-r');
        try { localStorage.setItem('dmx_radius', radius); } catch (e) {}
        if (radius && locMsg) { locMsg = ''; }
        render();
      };
    });
    var cnt = { G: 0, D: 0, R: 0, '?': 0 };
    all.forEach(function (x) { cnt[x.__k]++; });
    var opts = [['all', '全部 ' + all.length], ['R', '團體戰 ' + cnt.R], ['D', '極巨 ' + cnt.D], ['G', '超極巨 ' + cnt.G]];
    if (cnt['?']) opts.push(['?', '未知 ' + cnt['?']]);
    modes.innerHTML = opts.map(function (o) { return chip('data-m', o[0], o[1], mode === o[0]); }).join('');
    Array.prototype.forEach.call(modes.querySelectorAll('[data-m]'), function (el) { el.onclick = function () { mode = el.getAttribute('data-m'); render(); }; });

    var pool = all.filter(function (x) { return mode === 'all' || x.__k === mode; });
    var kw = q.value.trim();
    var hits = pool.filter(function (x) { return !kw || pname(x).indexOf(kw) > -1 || String(x.j) === kw; });
    stat.textContent = (kw ? '符合 ' + hits.length + ' 個，' : '') + '拖動或縮小地圖可收集更多（極巨星級更新：' + (TIER.updated || '?') + '）';

    if (!kw) {
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
        var near = me ? Math.min.apply(null, groups[key].map(function (y) { return y.__dist; })) : null;
        return '<div class="dmx-n" data-n="' + esc(pname(x)) + '" style="padding:3px 0;border-top:1px solid #eee;cursor:pointer;display:flex;align-items:center">' +
          img(x, 36) + badge(x) + '&nbsp;' + star(x) + '&nbsp;' + esc(pname(x)) + '&nbsp;<span style="color:#888">× ' + groups[key].length + '</span>' +
          (near !== null ? '&nbsp;<span style="color:#1565c0;font-size:12px">最近 ' + fmtDist(near) + '</span>' : '') + '</div>';
      }).join('') || '<div style="color:#888;padding:6px 0">' + (radius && me ? radius + ' 公里內沒有，試著放大範圍' : '還沒收集到資料，請拖動一下地圖') + '</div>';
      Array.prototype.forEach.call(list.querySelectorAll('.dmx-n'), function (el) { el.onclick = function () { q.value = el.getAttribute('data-n'); render(); }; });
      return;
    }
    /* 選定寶可夢時取得定位，依距離由近到遠排序；沒有定位時依種類排列 */
    locate();
    if (me) {
      hits.sort(function (a, b) { return a.__dist - b.__dist; });
    } else {
      hits.sort(function (a, b) { return ORDER[a.__k] - ORDER[b.__k]; });
    }
    var locLine = '<div style="font-size:12px;color:#666;padding:4px 0">' +
      (me ? '📍 已依距離排序（定位精度約 ' + Math.round(me[2]) + ' 公尺）' : esc(locMsg || '📍 正在取得定位…')) +
      '　<span id="dmx-relocate" style="color:#1565c0;cursor:pointer">重新定位</span></div>';
    list.innerHTML = locLine + (hits.map(function (x, i) {
      var v = (x.v || '').split('^');
      var raw = x.__k === '?' ? '<br><span style="color:#999;font-size:11px">n=' + esc(x.n) + '　v=' + esc(x.v) + '</span>' : '';
      var d = me ? ' <span style="background:#e3f2fd;color:#1565c0;border-radius:3px;padding:0 4px;font-size:12px;font-weight:bold">' + fmtDist(x.__dist) + '</span>' : '';
      var t = timeInfo(x);
      return '<div style="padding:6px 0;border-top:1px solid #eee;display:flex;gap:6px"><div>' + img(x, 48) + '</div><div>' +
        badge(x) + ' ' + star(x) + ' <b>' + esc(pname(x)) + '</b>' + d + ' <span style="color:#888">' + esc(v.slice(2, 4).filter(Boolean).join('/')) + '</span><br>' +
        esc(x.g || '(未命名)') + (t ? '<br><span style="color:#e65100;font-size:13px">' + esc(t) + '</span>' : '') + raw +
        '<br><span class="dmx-go" data-i="' + i + '" style="color:#1565c0;cursor:pointer">在地圖上顯示</span>　' +
        '<a href="https://maps.google.com/?q=' + x.c + ',' + x.d + '" target="_blank" style="color:#c2185b">Google 導航</a></div></div>';
    }).join('') || '<div style="color:#888;padding:6px 0">' + (radius && me ? radius + ' 公里內沒有，試著放大範圍' : '目前收集到的範圍內沒有，試著拖動或縮小地圖') + '</div>');
    list.querySelector('#dmx-relocate').onclick = function () { me = null; locMsg = ''; locPending = false; render(); };
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
