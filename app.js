/* ===== HERA Titanium Catalog — 前端逻辑（原生 JS，无依赖） ===== */
(function () {
  'use strict';

  var C = window.CATALOG;
  var MAT_FALLBACK = 'ASTM F136 Titanium';
  var IMG_DIR = 'images/';
  var LS_KEY = 'hera_inquiry_v1';
  var WA_NUMBER = '84949437630';   /* +84 94 943 76 30 */

  var state = { cat: 'all', q: '', showPrice: true, sort: 'default', limit: 24 };
  var albumIndex = new Map();
  C.categories.forEach(function (cat) {
    cat.albums.forEach(function (a) { albumIndex.set(a.id, { a: a, cat: cat }); });
  });

  var entries = [];        // 当前视图的条目列表 {it,a,cat,i}
  var lbList = [], lbPos = 0;

  /* ---------- helpers ---------- */
  function $(s) { return document.querySelector(s); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }
  function round2(p) { return Math.round(p * 100 + 1e-6) / 100; }
  function money(p) { return '$' + round2(p).toFixed(2); }
  function priceRange(a) {
    if (a.pmin == null) return null;
    if (a.pmax != null && a.pmax > a.pmin + 0.001) return money(a.pmin) + ' – ' + money(a.pmax);
    return money(a.pmin);
  }
  function itemPrice(it) {
    if (it.p == null) return null;
    if (it.pm != null && it.pm > it.p + 0.001) return money(it.p) + '–' + money(it.pm);
    return money(it.p);
  }
  function specTokens(it) {
    var out = [];
    (it.s || []).forEach(function (s) {
      String(s.t).split('|').forEach(function (t) {
        t = t.trim();
        if (t && out.indexOf(t) < 0) out.push(t);
      });
    });
    return out;
  }
  function matText(it) { return it.m || MAT_FALLBACK; }
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(t._tm);
    t._tm = setTimeout(function () { t.classList.remove('on'); }, 1700);
  }

  /* ---------- 类目条 ---------- */
  function renderCatBar() {
    var h = '<button class="chip' + (state.cat === 'all' ? ' on' : '') + '" data-cat="all">All <small>' +
      C.meta.albums + '</small></button>';
    C.categories.forEach(function (c) {
      h += '<button class="chip' + (state.cat === c.key ? ' on' : '') + '" data-cat="' + esc(c.key) + '">' +
        c.icon + ' ' + esc(c.en) + ' <small>' + c.ac + '</small></button>';
    });
    var bar = $('#catbar');
    bar.innerHTML = h;
    Array.prototype.forEach.call(bar.querySelectorAll('.chip'), function (b) {
      b.onclick = function () {
        state.cat = b.dataset.cat;
        state.limit = 24;
        if (location.hash) location.hash = '#/'; else viewHome();
        renderCatBar();
        viewHome();
        var on = bar.querySelector('.chip.on');
        if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
      };
    });
  }

  /* ---------- 相册卡片（九宫格） ---------- */
  function albumCard(a, cat, eager) {
    var imgs = a.items.slice(0, 9), cells = '';
    for (var i = 0; i < 9; i++) {
      var it = imgs[i];
      if (!it) { cells += '<div class="cell ph"></div>'; continue; }
      cells += '<div class="cell"><img src="' + IMG_DIR + it.i + '" alt="' + esc(it.n) + '"' +
        (eager ? '' : ' loading="lazy"') + ' decoding="async"></div>';
    }
    var pr = priceRange(a);
    var priceHtml = '';
    if (state.showPrice) {
      priceHtml = pr
        ? '<span class="price">' + (a.pmin !== a.pmax ? 'from ' : '') + money(a.pmin) + '</span>'
        : '<span class="price" style="color:#9aa0a6">Ask price</span>';
    }
    return '<a class="acard" href="#/a/' + a.id + '">' +
      '<div class="mosaic">' + cells + '<span class="count">' + a.c + ' styles</span></div>' +
      '<div class="body">' +
        '<div class="t"><b>' + esc(a.title) + '</b>' + priceHtml + '</div>' +
        '<div class="meta"><span>' + esc(cat.en) + '</span><span>' + esc(cat.zh) + '</span></div>' +
        '<div class="code">' + (a.code ? esc(a.code) : '—') + '</div>' +
      '</div></a>';
  }

  function albumsFor() {
    var out = [];
    C.categories.forEach(function (cat) {
      if (state.cat !== 'all' && cat.key !== state.cat) return;
      cat.albums.forEach(function (a) { out.push({ a: a, cat: cat }); });
    });
    if (state.sort === 'price') {
      out.sort(function (x, y) { return (x.a.pmin == null ? 1e9 : x.a.pmin) - (y.a.pmin == null ? 1e9 : y.a.pmin); });
    } else if (state.sort === 'items') {
      out.sort(function (x, y) { return y.a.c - x.a.c; });
    }
    return out;
  }

  /* ---------- 首页 ---------- */
  function viewHome() {
    var list = albumsFor();
    var shown = list.slice(0, state.limit);
    var catName = 'All collections · 全部系列';
    if (state.cat !== 'all') {
      var c0 = C.categories.filter(function (x) { return x.key === state.cat; })[0];
      if (c0) catName = c0.en + ' · ' + c0.zh;
    }
    var html = '<div class="wrap">' +
      '<div class="hero"><h2>' + esc(catName) + '</h2>' +
      '<p>' + C.meta.categories + ' categories · ' + C.meta.albums + ' collections · ' +
      C.meta.items.toLocaleString() + ' styles — 一个系列一个链接，点进去看全部颜色与尺寸</p></div>' +
      '<div class="toolrow"><span class="count">Showing <b>' + shown.length + '</b> / ' + list.length + ' collections</span>' +
      '<span class="spacer"></span>' +
      '<select class="sort" id="sortSel">' +
        '<option value="default">Sort: catalog order</option>' +
        '<option value="price">Price: low → high</option>' +
        '<option value="items">Most styles first</option>' +
      '</select></div>';

    if (!list.length) {
      html += '<div class="empty"><b>No collections</b>换个类目看看</div>';
    } else {
      html += '<div class="album-grid">';
      shown.forEach(function (rec, i) { html += albumCard(rec.a, rec.cat, i < 4); });
      html += '</div>';
      if (shown.length < list.length) {
        html += '<button class="loadmore" id="loadMore">Load more · 加载更多 (' + (list.length - shown.length) + ')</button>';
      }
    }
    html += '</div>';
    $('#view').innerHTML = html;

    var sel = $('#sortSel');
    if (sel) { sel.value = state.sort; sel.onchange = function () { state.sort = sel.value; viewHome(); }; }
    var lm = $('#loadMore');
    if (lm) lm.onclick = function () { state.limit += 24; viewHome(); };
    entries = [];
  }

  /* ---------- 款式卡片 ---------- */
  function itemCard(it, a, k, cat, showAlbum) {
    var pr = itemPrice(it);
    var toks = specTokens(it);
    var chips = toks.slice(0, 3).map(function (t) { return '<i>' + esc(t) + '</i>'; }).join('');
    if (toks.length > 3) chips += '<i class="more">+' + (toks.length - 3) + '</i>';
    var inq = hasInq(a.id, it);
    var priceHtml = '';
    if (state.showPrice) {
      priceHtml = pr ? '<span class="p">' + pr + '</span>' : '<span class="p ask">Ask price</span>';
    }
    return '<div class="icard" data-k="' + k + '">' +
      '<div class="pic">' +
        '<img src="' + IMG_DIR + it.i + '" alt="' + esc(it.n) + '" loading="lazy" decoding="async">' +
        '<button class="add' + (inq ? ' on' : '') + '" title="Add to inquiry / 加入询价">' + (inq ? '✓' : '＋') + '</button>' +
      '</div>' +
      '<div class="info">' +
        '<div class="l1"><span class="no">#' + esc(it.n || '—') + '</span>' + priceHtml + '</div>' +
        '<div class="mat">' + esc(matText(it)) + '</div>' +
        (chips ? '<div class="specs">' + chips + '</div>' : '') +
        (showAlbum ? '<a class="albl" href="#/a/' + a.id + '">' + esc(cat.en) + ' · ' + esc(a.title) + '</a>'
                   : '<div class="code">' + (it.c ? esc(it.c) : '') + '</div>') +
      '</div></div>';
  }

  /* ---------- 相册详情 ---------- */
  function viewAlbum(id) {
    var rec = albumIndex.get(id);
    if (!rec) { viewHome(); return; }
    var a = rec.a, cat = rec.cat, pr = priceRange(a);
    var html = '<div class="subhead"><div class="wrap in">' +
      '<a class="back" href="#/">‹ Back</a>' +
      '<div><h2>' + esc(a.title) + ' · ' + esc(cat.en) + '</h2>' +
      '<div class="sub">' + esc(cat.zh) + ' · ' + a.c + ' styles' +
      (a.code ? ' · Code ' + esc(a.code) : '') + '</div></div>' +
      (state.showPrice && pr ? '<div class="rng">' + pr + '</div>' : '') +
      '</div></div>' +
      '<div class="wrap"><div class="item-grid" id="itemGrid">';
    entries = a.items.map(function (it, i) { return { it: it, a: a, cat: cat, i: i }; });
    entries.forEach(function (e, k) { html += itemCard(e.it, a, k, cat, false); });
    html += '</div></div>';
    $('#view').innerHTML = html;
    document.title = a.title + ' · ' + cat.en + ' — HERA Titanium Catalog';
  }

  /* ---------- 搜索 ---------- */
  function searchEntries(q) {
    var ql = q.toLowerCase(), out = [];
    C.categories.forEach(function (cat) {
      cat.albums.forEach(function (a) {
        a.items.forEach(function (it, i) {
          var hay = (it.n + ' ' + (it.c || '') + ' ' + (it.m || '') + ' ' + specTokens(it).join(' ') +
            ' ' + a.title + ' ' + a.code + ' ' + cat.en + ' ' + cat.zh).toLowerCase();
          if (hay.indexOf(ql) >= 0) out.push({ it: it, a: a, cat: cat, i: i, k: out.length });
        });
      });
    });
    return out;
  }

  function viewSearch() {
    var res = searchEntries(state.q);
    var shown = res.slice(0, 120);
    entries = shown;
    var html = '<div class="wrap"><div class="sechead"><h3>Results for “' + esc(state.q) + '”</h3>' +
      '<span>' + res.length + ' styles found</span></div>';
    if (!res.length) {
      html += '<div class="empty"><b>Nothing found</b>试试编号、规格（16G / 1.2X8mm）或文件夹编码</div>';
    } else {
      html += '<div class="item-grid">';
      shown.forEach(function (r, k) { html += itemCard(r.it, r.a, k, r.cat, true); });
      html += '</div>';
      if (res.length > shown.length) {
        html += '<p style="text-align:center;color:#6b7280;font-size:12.5px;padding:0 0 34px">' +
          'Showing first 120 of ' + res.length + ' — 请加更精确的关键词</p>';
      }
    }
    html += '</div>';
    $('#view').innerHTML = html;
  }

  /* ---------- 点击委托 ---------- */
  $('#view').addEventListener('click', function (e) {
    var add = e.target.closest('.add');
    if (add) {
      e.preventDefault(); e.stopPropagation();
      var card = add.closest('.icard');
      var en = entries[+card.dataset.k];
      if (en) addInq(en);
      return;
    }
    var pic = e.target.closest('.pic');
    if (pic) {
      var c2 = pic.closest('.icard');
      var en2 = entries[+c2.dataset.k];
      if (en2) {
        var list = entries.length ? entries : [en2];
        openLb(list, list.indexOf(en2));
      }
    }
  });

  /* ---------- 灯箱 ---------- */
  function openLb(list, pos) {
    lbList = list; lbPos = pos;
    $('#lb').classList.add('on');
    document.body.style.overflow = 'hidden';
    paintLb();
  }
  function paintLb() {
    var e = lbList[lbPos];
    if (!e) return;
    var it = e.it, a = e.a;
    $('#lbImg').src = IMG_DIR + it.i;
    $('#lbKick').textContent = e.cat.en + ' · ' + a.title;
    $('#lbNo').textContent = 'Model #' + (it.n || '—');
    var pr = itemPrice(it);
    $('#lbPrice').innerHTML = (state.showPrice && pr)
      ? pr + ' <small>USD / pc</small>'
      : '<small style="color:#6b7280">Price on request · 询价</small>';
    $('#lbCode').textContent = it.c || a.code || '—';
    $('#lbMat').textContent = matText(it);
    $('#lbAlbum').textContent = a.title + ' · ' + e.cat.zh;
    var toks = specTokens(it);
    $('#lbSpecs').innerHTML = toks.length
      ? toks.map(function (t) { return '<i>' + esc(t) + '</i>'; }).join('')
      : '<i style="background:none;border:0;color:#9aa0a6">no spec listed</i>';
    var add = $('#lbAdd');
    var inq = hasInq(a.id, it);
    add.textContent = inq ? '✓ Added · 已加入' : '＋ Add to inquiry';
    add.onclick = function () { addInq(e); };
    $('#lbPrev').style.visibility = lbList.length > 1 ? 'visible' : 'hidden';
    $('#lbNext').style.visibility = lbList.length > 1 ? 'visible' : 'hidden';
  }
  function navLb(d) {
    if (lbList.length < 2) return;
    lbPos = (lbPos + d + lbList.length) % lbList.length;
    paintLb();
  }
  function closeLb() {
    $('#lb').classList.remove('on');
    document.body.style.overflow = '';
  }
  $('#lbPrev').onclick = function (e) { e.stopPropagation(); navLb(-1); };
  $('#lbNext').onclick = function (e) { e.stopPropagation(); navLb(1); };
  document.addEventListener('keydown', function (e) {
    if (!$('#lb').classList.contains('on')) {
      if (e.key === 'Escape') closeDrawer();
      return;
    }
    if (e.key === 'Escape') closeLb();
    if (e.key === 'ArrowLeft') navLb(-1);
    if (e.key === 'ArrowRight') navLb(1);
  });
  $('#lb').addEventListener('click', function (e) {
    if (e.target.id === 'lb') closeLb();
  });

  /* ---------- 询价清单 ---------- */
  function loadInq() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveInq(arr) {
    localStorage.setItem(LS_KEY, JSON.stringify(arr));
    paintInq();
  }
  function inqKey(aid, it) { return aid + '|' + it.i; }
  function hasInq(aid, it) {
    return loadInq().some(function (x) { return x.k === inqKey(aid, it); });
  }
  function addInq(e) {
    var arr = loadInq(), key = inqKey(e.a.id, e.it);
    if (arr.some(function (x) { return x.k === key; })) { toast('已在清单中 · already in list'); return; }
    arr.push({
      k: key, n: e.it.n || '', c: e.it.c || e.a.code || '', p: e.it.p, m: matText(e.it),
      s: specTokens(e.it).join(' / '), img: e.it.i, album: e.cat.en + ' · ' + e.a.title, img2: e.a.id
    });
    saveInq(arr);
    toast('已加入询价清单 · added');
    if ($('#lb').classList.contains('on')) paintLb();
    var card = document.querySelector('.icard[data-k="' + (entries.indexOf(e)) + '"] .add');
    if (card) { card.classList.add('on'); card.textContent = '✓'; }
  }
  function removeInq(key) {
    saveInq(loadInq().filter(function (x) { return x.k !== key; }));
    refreshAddButtons();
  }
  function refreshAddButtons() {
    Array.prototype.forEach.call(document.querySelectorAll('.icard'), function (card) {
      var e = entries[+card.dataset.k];
      if (!e) return;
      var b = card.querySelector('.add');
      var on = hasInq(e.a.id, e.it);
      b.classList.toggle('on', on);
      b.textContent = on ? '✓' : '＋';
    });
  }
  function paintInq() {
    var arr = loadInq();
    var badge = $('#inqBadge');
    badge.textContent = arr.length;
    badge.classList.toggle('hide', !arr.length);
    $('#inqN').textContent = arr.length;
    var total = arr.reduce(function (s, x) { return s + (x.p || 0); }, 0);
    $('#inqTotal').textContent = money(total);
    if (!arr.length) {
      $('#inqList').innerHTML = '<div class="empty" style="padding:40px 0"><b>清单是空的</b>点产品图上的 ＋ 或灯箱里的按钮加入</div>';
      return;
    }
    $('#inqList').innerHTML = arr.map(function (x) {
      return '<div class="qrow"><img src="' + IMG_DIR + x.img + '" alt="" loading="lazy">' +
        '<div><div class="q1">#' + esc(x.n || '—') + ' · ' + (x.p == null ? 'ask' : money(x.p)) + '</div>' +
        '<div class="q2">' + esc(x.album) + (x.c ? ' · ' + esc(x.c) : '') + '</div></div>' +
        '<button class="rm" data-rm="' + esc(x.k) + '">✕</button></div>';
    }).join('');
    Array.prototype.forEach.call($('#inqList').querySelectorAll('.rm'), function (b) {
      b.onclick = function () { removeInq(b.dataset.rm); };
    });
  }
  function inqText() {
    var arr = loadInq();
    var lines = ['HERA Titanium — Inquiry list / 询价清单', ''];
    arr.forEach(function (x, i) {
      lines.push((i + 1) + '. #' + (x.n || '-') + '  ' + (x.c || '') + '  ' +
        (x.p == null ? 'ask price' : money(x.p)) + '  ' + (x.album || ''));
      if (x.s) lines.push('    spec: ' + x.s);
    });
    var total = arr.reduce(function (s, x) { return s + (x.p || 0); }, 0);
    lines.push('', 'Items: ' + arr.length + '  |  Estimated total: ' + money(total));
    return lines.join('\n');
  }
  function copyInquiry() {
    var txt = inqText();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(function () { toast('已复制 · copied'); },
        function () { fallbackCopy(txt); });
    } else fallbackCopy(txt);
  }
  function fallbackCopy(txt) {
    var ta = document.createElement('textarea');
    ta.value = txt; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('已复制 · copied'); } catch (e) { toast('复制失败'); }
    document.body.removeChild(ta);
  }
  function exportCsv() {
    var arr = loadInq();
    if (!arr.length) { toast('清单是空的'); return; }
    var rows = [['No', 'Code', 'Price USD', 'Material', 'Spec', 'Collection', 'Image']];
    arr.forEach(function (x) {
      rows.push([x.n, x.c, x.p == null ? '' : round2(x.p).toFixed(2), x.m, x.s, x.album, x.img]);
    });
    var csv = '\ufeff' + rows.map(function (r) {
      return r.map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(',');
    }).join('\r\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'HERA-inquiry-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
  }
  function sendWa() {
    var arr = loadInq();
    if (!arr.length) { toast('清单是空的'); return; }
    window.open('https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(inqText()), '_blank');
  }
  function closeDrawer() {
    $('#drawer').classList.remove('on');
    $('#backdrop').classList.remove('on');
  }
  $('#inqBtn').onclick = function () {
    $('#drawer').classList.add('on');
    $('#backdrop').classList.add('on');
  };

  /* ---------- 顶栏控件 ---------- */
  $('#priceBtn').onclick = function () {
    state.showPrice = !state.showPrice;
    this.classList.toggle('on', state.showPrice);
    $('#priceLbl').textContent = state.showPrice ? 'Price' : 'Hidden';
    route(true);
  };
  var qTimer;
  $('#q').addEventListener('input', function () {
    var v = this.value.trim();
    $('#qClr').classList.toggle('hide', !v);
    clearTimeout(qTimer);
    qTimer = setTimeout(function () {
      state.q = v;
      if (v) { viewSearch(); } else { route(true); }
    }, 180);
  });
  $('#qClr').onclick = function () {
    $('#q').value = ''; state.q = ''; this.classList.add('hide'); route(true);
  };

  /* ---------- 路由 ---------- */
  function route(keepScroll) {
    var h = location.hash || '';
    if (state.q) { viewSearch(); return; }
    if (h.indexOf('#/a/') === 0) {
      viewAlbum(h.slice(4));
    } else {
      viewHome();
      document.title = 'HERA Titanium Body Jewelry · Wholesale Catalog';
    }
    if (!keepScroll) window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }
  window.addEventListener('hashchange', function () { route(); });

  /* ---------- 启动 ---------- */
  window.closeLb = closeLb;
  window.closeDrawer = closeDrawer;
  window.copyInquiry = copyInquiry;
  window.exportCsv = exportCsv;
  window.sendWa = sendWa;

  /* 吸顶头部高度会随行数/宽度变化，把它量出来给相册页吸顶小标题用 */
  function syncHeadH() {
    var hd = document.querySelector('header.head');
    if (hd) document.documentElement.style.setProperty('--head-h', hd.offsetHeight + 'px');
  }
  window.addEventListener('resize', syncHeadH);

  $('#ftStat').textContent = C.meta.categories + ' categories · ' + C.meta.albums +
    ' collections · ' + C.meta.items.toLocaleString() + ' styles · last update ' +
    new Date(document.lastModified).toISOString().slice(0, 10);
  renderCatBar();
  paintInq();
  route();
  syncHeadH();
})();
