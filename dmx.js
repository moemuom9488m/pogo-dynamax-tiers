(function () {
  if (window.__dmx) { window.__dmx.show(); return; }
  var store = {};
  var names = {}, enNames = {};
  try { (window.poke && window.poke.poke || []).forEach(function (p) { if (p.id && !names[p.id]) { names[p.id] = p.zhtw; enNames[p.id] = p.name; } }); } catch (e) {}

  /* 一般團體戰的等級代碼；其他沒見過的代碼都先收進來，標成「未知」方便校正 */
  var RAID = { '1': 1, '2': 1, '3': 1, '4': 1, '5': 1, '6': 1, 'M': 1, '11': 1, '13': 1, '15': 1 };
  function kind(x) {
    var n = String(x.n || '').toUpperCase(), v = String(x.v || '').toUpperCase();
    if (n === 'G' || n === 'GD' || n === 'DG' || v.indexOf('GIGANTAMAX') > -1 || v.indexOf('GMAX') > -1) return 'G';
    if (n === 'D') return 'D';
    if (x.i && n && !RAID[n]) return '?';
    return '';
  }

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

  /* PokeAPI 縮圖：一般用圖鑑編號直接組網址；超極巨化查 /pokemon/{英文名}-gmax，結果存在 localStorage */
  var SPRITE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/';
  var gmaxCache = {};
  try { gmaxCache = JSON.parse(localStorage.getItem('dmx_gmax') || '{}'); } catch (e) {}
  var gmaxPending = {};
  /* PokeAPI 上有型態後綴的超極巨化名稱 */
  var GMAX_SLUG = { 849: 'toxtricity-amped-gmax', 892: 'urshifu-single-strike-gmax' };
  function spriteUrl(x) {
    if (x.__k !== 'G') return SPRITE + (+x.j) + '.png';
    var id = x.j;
    if (gmaxCache[id] !== undefined) return gmaxCache[id] || (SPRITE + (+id) + '.png');
    if (!gmaxPending[id] && enNames[id]) {
      gmaxPending[id] = 1;
      var slug = GMAX_SLUG[id] || (enNames[id].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-gmax');
      fetch('https://pokeapi.co/api/v2/pokemon/' + slug).then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          gmaxCache[id] = (j && j.sprites && j.sprites.front_default) || '';
          try { localStorage.setItem('dmx_gmax', JSON.stringify(gmaxCache)); } catch (e) {}
          render();
        }).catch(function () { gmaxCache[id] = ''; });
    }
    return SPRITE + (+id) + '.png';
  }
  function img(x, size) {
    return '<img src="' + spriteUrl(x) + '" width="' + size + '" height="' + size + '" loading="lazy" onerror="this.style.visibility=\'hidden\'" style="vertical-align:middle;image-rendering:pixelated;margin-right:4px">';
  }

  var BADGE = {
    G: '<span style="background:#6a1b9a;color:#fff;border-radius:3px;padding:0 4px;font-size:11px">超極巨</span>',
    D: '<span style="background:#c2185b;color:#fff;border-radius:3px;padding:0 4px;font-size:11px">極巨</span>',
    '?': '<span style="background:#757575;color:#fff;border-radius:3px;padding:0 4px;font-size:11px">未知</span>'
  };
  /* 星級對照表：打開時讀 GitHub 上每天自動更新的版本，失敗就用內建的舊表；API 本身沒有星級 */
  var TIER = {"D":{"1":1,"4":1,"7":1,"10":1,"25":1,"58":1,"63":1,"66":2,"92":1,"98":1,"106":3,"107":3,"113":3,"125":3,"126":3,"129":1,"133":2,"138":1,"140":1,"146":5,"163":1,"213":2,"237":3,"280":1,"302":3,"320":2,"328":1,"349":2,"363":1,"374":3,"415":1,"519":1,"524":1,"527":1,"529":1,"546":1,"554":2,"568":1,"615":3,"633":3,"686":1,"761":1,"766":3,"780":3,"810":1,"813":1,"816":1,"819":1,"821":1,"831":1,"856":1,"870":3},"G":{},"updated":"2026-10-03"};
  fetch('https://raw.githubusercontent.com/moemuom9488m/pogo-dynamax-tiers/main/tiers.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (t) { if (t && t.D) { TIER = t; render(); } }).catch(function () {});
  /* 超極巨化團體戰一律是 ★6，表上查不到時也能顯示 */
  function star(x) { var s = (TIER[x.__k] || {})[x.j] || (x.__k === 'G' ? 6 : 0); return s ? '<span style="color:#f9a825;font-weight:bold">★' + s + '</span>' : ''; }
  var mode = 'all';

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
  box.innerHTML = '<div id="dmx-h" style="padding:' + (mobile ? '10px 12px' : '8px') + ';background:#c2185b;color:#fff;display:flex;justify-content:space-between;align-items:center;border-radius:' + (mobile ? '9px 9px 0 0' : '0') + '"><b>極巨化 / 超極巨化搜尋</b>' +
    '<span><span id="dmx-min" style="cursor:pointer;padding:0 10px;font-size:18px">－</span><span id="dmx-x" style="cursor:pointer;padding:0 6px 0 10px;font-size:18px">✕</span></span></div>' +
    '<div id="dmx-body" style="display:flex;flex-direction:column;min-height:0;flex:1">' +
    '<div style="padding:8px"><input id="dmx-q" type="search" placeholder="輸入寶可夢名稱，例如：列陣兵" style="width:100%;box-sizing:border-box;padding:' + (mobile ? '10px' : '6px') + ';border:1px solid #ccc;border-radius:6px;font-size:16px">' +
    '<div id="dmx-m" style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap"></div>' +
    '<div id="dmx-s" style="color:#666;font-size:12px;margin-top:4px"></div></div>' +
    '<div id="dmx-l" style="overflow:auto;-webkit-overflow-scrolling:touch;padding:0 8px 8px"></div></div>';
  document.body.appendChild(box);
  var q = box.querySelector('#dmx-q'), list = box.querySelector('#dmx-l'), stat = box.querySelector('#dmx-s'), modes = box.querySelector('#dmx-m');
  var body = box.querySelector('#dmx-body'), minBtn = box.querySelector('#dmx-min');
  function collapse(on) { body.style.display = on ? 'none' : 'flex'; minBtn.textContent = on ? '＋' : '－'; }
  minBtn.onclick = function () { collapse(body.style.display !== 'none'); };
  box.querySelector('#dmx-x').onclick = function () { box.style.display = 'none'; };
  q.oninput = render;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pname(x) { return names[x.j] || ('#' + x.j); }

  function render() {
    var all = Object.keys(store).map(function (k) { return store[k]; });
    var nD = 0, nG = 0, nU = 0;
    all.forEach(function (x) { if (x.__k === 'D') nD++; else if (x.__k === 'G') nG++; else nU++; });
    var opts = [['all', '全部 ' + all.length], ['D', '極巨 ' + nD], ['G', '超極巨 ' + nG]];
    if (nU) opts.push(['?', '未知 ' + nU]);
    modes.innerHTML = opts.map(function (o) {
      var on = mode === o[0];
      return '<span data-m="' + o[0] + '" style="cursor:pointer;padding:' + (mobile ? '6px 12px' : '2px 8px') + ';border-radius:14px;font-size:' + (mobile ? '14px' : '12px') + ';border:1px solid #c2185b;' + (on ? 'background:#c2185b;color:#fff' : 'color:#c2185b') + '">' + o[1] + '</span>';
    }).join('');
    Array.prototype.forEach.call(modes.querySelectorAll('[data-m]'), function (el) { el.onclick = function () { mode = el.getAttribute('data-m'); render(); }; });

    var pool = all.filter(function (x) { return mode === 'all' || x.__k === mode; });
    var kw = q.value.trim();
    var hits = pool.filter(function (x) { return !kw || pname(x).indexOf(kw) > -1 || String(x.j) === kw; });
    stat.textContent = (kw ? '符合 ' + hits.length + ' 個，' : '') + '拖動或縮小地圖可收集更多（星級更新：' + (TIER.updated || '?') + '）';

    if (!kw) {
      var groups = {};
      pool.forEach(function (x) { var key = x.__k + '|' + x.j; (groups[key] = groups[key] || []).push(x); });
      list.innerHTML = Object.keys(groups).sort(function (a, b) {
        var ga = groups[a][0].__k === 'G' ? 0 : 1, gb = groups[b][0].__k === 'G' ? 0 : 1;
        return ga - gb || groups[a].length - groups[b].length;
      }).map(function (key) {
        var x = groups[key][0];
        return '<div class="dmx-n" data-n="' + esc(pname(x)) + '" style="padding:3px 0;border-top:1px solid #eee;cursor:pointer;display:flex;align-items:center">' +
          img(x, 36) + BADGE[x.__k] + '&nbsp;' + star(x) + '&nbsp;' + esc(pname(x)) + '&nbsp;<span style="color:#888">× ' + groups[key].length + '</span></div>';
      }).join('') || '<div style="color:#888;padding:6px 0">還沒收集到資料，請拖動一下地圖</div>';
      Array.prototype.forEach.call(list.querySelectorAll('.dmx-n'), function (el) { el.onclick = function () { q.value = el.getAttribute('data-n'); render(); }; });
      return;
    }
    /* 選定寶可夢時取得定位，依距離由近到遠排序；沒有定位時維持超極巨優先 */
    locate();
    if (me) {
      hits.forEach(function (x) { x.__dist = dist(me[0], me[1], +x.c, +x.d); });
      hits.sort(function (a, b) { return a.__dist - b.__dist; });
    } else {
      hits.sort(function (a, b) { return (a.__k === 'G' ? 0 : 1) - (b.__k === 'G' ? 0 : 1); });
    }
    var locLine = '<div style="font-size:12px;color:#666;padding:4px 0">' +
      (me ? '📍 已依距離排序（定位精度約 ' + Math.round(me[2]) + ' 公尺）' : esc(locMsg || '📍 正在取得定位…')) +
      '　<span id="dmx-relocate" style="color:#1565c0;cursor:pointer">重新定位</span></div>';
    list.innerHTML = locLine + (hits.map(function (x, i) {
      var v = (x.v || '').split('^');
      var raw = x.__k === '?' ? '<br><span style="color:#999;font-size:11px">n=' + esc(x.n) + '　v=' + esc(x.v) + '</span>' : '';
      var d = me ? ' <span style="background:#e3f2fd;color:#1565c0;border-radius:3px;padding:0 4px;font-size:12px;font-weight:bold">' + fmtDist(x.__dist) + '</span>' : '';
      return '<div style="padding:6px 0;border-top:1px solid #eee;display:flex;gap:6px"><div>' + img(x, 48) + '</div><div>' +
        BADGE[x.__k] + ' ' + star(x) + ' <b>' + esc(pname(x)) + '</b>' + d + ' <span style="color:#888">' + esc(v.slice(2, 4).filter(Boolean).join('/')) + '</span><br>' +
        esc(x.g || '(未命名)') + raw + '<br><span class="dmx-go" data-i="' + i + '" style="color:#1565c0;cursor:pointer">在地圖上顯示</span>　' +
        '<a href="https://maps.google.com/?q=' + x.c + ',' + x.d + '" target="_blank" style="color:#c2185b">Google 導航</a></div></div>';
    }).join('') || '<div style="color:#888;padding:6px 0">目前收集到的範圍內沒有，試著拖動或縮小地圖</div>');
    list.querySelector('#dmx-relocate').onclick = function () { me = null; locMsg = ''; locPending = false; render(); };
    Array.prototype.forEach.call(list.querySelectorAll('.dmx-go'), function (el) {
      el.onclick = function () {
        var x = hits[+el.getAttribute('data-i')];
        try { window.map.setView([+x.c, +x.d], 18); if (mobile) collapse(true); } catch (e) { window.open('https://maps.google.com/?q=' + x.c + ',' + x.d); }
      };
    });
  }

  window.__dmx = { show: function () { box.style.display = 'flex'; collapse(false); } };
  render();
})();
