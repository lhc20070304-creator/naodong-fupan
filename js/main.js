/* ============================================================
   脑洞复盘指挥中心 · 主逻辑
   ============================================================ */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const D = window.DATA;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const quoteTitle = p => (p && p.charAt(0) === '「') ? p : '「' + p + '」';

  /* ---------- 五毛钱音效（方波滴） ---------- */
  let AC = null;
  function beep(freq = 880, dur = 0.07) {
    if (window.__sfx === false) return; // 控制台可静音
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = 'square'; o.frequency.value = freq; g.gain.value = 0.04;
      o.connect(g); g.connect(AC.destination);
      o.start(); o.stop(AC.currentTime + dur);
    } catch (e) { /* 没声音也很五毛 */ }
  }

  /* ---------- 确定性随机（同昵称同答案 → 同报告） ---------- */
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  const S = { nick: '无名氏', qs: [], ansByTag: {}, score: 0, stats: null };
  // 彩蛋系统需要读取状态与公章画法
  window.__BR = { S, drawStampRef: cv => drawStamp(cv, '脑洞复盘指挥中心') };

  function show(id) {
    $$('.screen').forEach(e => e.classList.remove('active'));
    $('#' + id).classList.add('active');
    // 报告页隐藏固定页脚，避免遮挡正文与「前往领奖」按钮
    const foot = $('#foot-wrap');
    if (id === 'screen-form') foot.classList.remove('hidden');
    else foot.classList.add('hidden');
    window.scrollTo(0, 0);
  }

  /* ============================================================
     一、假正经 Loading
     ============================================================ */
  let loadDone = false;
  function completeLoading(skipped) {
    if (loadDone) return;
    loadDone = true;
    if (skipped) {
      const div = document.createElement('div');
      div.textContent = '已跳过片头动画（评委时间宝贵）';
      div.style.color = '#ffff00';
      $('#load-log').appendChild(div);
    }
    $('#loadbar-fill').style.width = '100%';
    $('#load-pct').textContent = '100%';
    $('#btn-enter').classList.remove('hidden');
    $('#btn-skip').classList.add('hidden');
  }

  async function runLoading() {
    const log = $('#load-log'), bar = $('#loadbar-fill'), pct = $('#load-pct');
    const logs = D.BOOT_LOGS;
    for (let i = 0; i < logs.length; i++) {
      if (loadDone) return;
      const div = document.createElement('div');
      div.textContent = logs[i];
      log.appendChild(div);
      const p = Math.min(99, Math.round((i + 1) / logs.length * 100));
      bar.style.width = p + '%'; pct.textContent = p + '%';
      await sleep(240);
    }
    if (loadDone) return;
    // 祖传 99% 卡顿
    await sleep(700);
    if (loadDone) return;
    const stuck = document.createElement('div');
    stuck.textContent = '99% 卡住了……正在贿赂进度条（花费 5 毛）';
    log.appendChild(stuck);
    await sleep(900);
    if (loadDone) return;
    const ok = document.createElement('div');
    ok.textContent = '系统就绪。请严肃对待本次复盘。';
    ok.style.color = '#7cffb2';
    log.appendChild(ok);
    completeLoading(false);
  }

  $('#btn-skip').addEventListener('click', () => { beep(520); completeLoading(true); });
  $('#btn-enter').addEventListener('click', () => {
    beep(660); show('screen-form');
  });

  /* ============================================================
     二、登记表（3 道核心题 + 1 道随机加试）
     ============================================================ */
  function renderQuestions() {
    const box = $('#questions');
    box.innerHTML = '';
    // 核心题必出，加试题随机抽 1 道（每次复盘题目不完全一样，像人生）
    const filler = D.FILLER_QUESTIONS[Math.floor(Math.random() * D.FILLER_QUESTIONS.length)];
    S.qs = D.CORE_QUESTIONS.concat([filler]);
    S.qs.forEach((q, qi) => {
      const div = document.createElement('div');
      div.className = 'q-block';
      const t = document.createElement('div');
      t.className = 'q-title';
      t.textContent = '第 ' + (qi + 1) + ' 题：' + q.title;
      div.appendChild(t);
      q.options.forEach((opt, oi) => {
        const lab = document.createElement('label');
        lab.className = 'q-opt';
        const inp = document.createElement('input');
        inp.type = 'radio'; inp.name = 'q' + qi; inp.value = oi;
        inp.addEventListener('change', () => beep(660 + oi * 110, 0.05));
        lab.appendChild(inp);
        lab.appendChild(document.createTextNode(opt));
        div.appendChild(lab);
      });
      box.appendChild(div);
    });
  }

  function warn(msg) {
    const w = $('#form-warn');
    w.textContent = msg; w.classList.remove('hidden');
    w.style.animation = 'none'; void w.offsetWidth; w.style.animation = '';
    beep(220, 0.15);
  }

  $('#btn-start').addEventListener('click', () => {
    const nick = $('#in-nick').value.trim();
    S.nick = nick ? nick.slice(0, 12) : '无名氏';
    S.ansByTag = {};
    S.score = 0;
    for (let i = 0; i < S.qs.length; i++) {
      const checked = document.querySelector('input[name="q' + i + '"]:checked');
      if (!checked) { warn('⚠ 第 ' + (i + 1) + ' 题还没选，组织正看着你。'); return; }
      const v = +checked.value;
      S.ansByTag[S.qs[i].tag] = v;
      S.score += v;
    }
    beep(880);
    buildReport();
    show('screen-report');
    gotoPage(0);
  });

  /* ============================================================
     三、报告生成
     ============================================================ */
  function fmtDate(d) {
    return d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日';
  }

  function buildReport() {
    const key = S.nick + '|' + S.qs.map(q => S.ansByTag[q.tag]).join(',');
    const rng = mulberry32(hashStr(key));
    const collect = Math.floor(128 + rng() * 640);
    const started = 1 + Math.floor(rng() * 4);
    const alive = rng() < 0.18 ? 1 : 0;
    const rate = (alive / collect * 100).toFixed(2);
    // 与病程时间线「2023.02 收藏」保持同源，避免跨页数字打架
    const days = Math.max(1, Math.floor((Date.now() - new Date(2023, 1, 1).getTime()) / 86400000));
    const gaitian = Math.floor(collect * (0.3 + rng() * 0.5));
    const persona = D.PERSONAS.find(p => S.score >= p[0])[1];
    S.stats = { collect, started, alive, rate, days, gaitian, persona };

    // 昵称注入
    $$('[data-nick]').forEach(el => { el.textContent = S.nick; });

    // 封面
    $('#cover-date').textContent = fmtDate(new Date());
    drawStamp($('#stamp-cover'), '脑洞复盘指挥中心');

    // 数据总览
    $('#st-collect').textContent = collect;
    $('#st-started').textContent = started;
    $('#st-alive').textContent = alive;
    $('#st-rate').textContent = rate;
    $('#st-days').textContent = days;
    $('#st-gaitian').textContent = gaitian;
    drawBar3D($('#chart-life'), {
      title: '脑洞生命周期漏斗',
      labels: ['收藏立项', '实际开工', '顽强存活'],
      values: [collect, started, alive],
      colors: D.BAR_COLORS,
      ymax: Math.ceil(collect * 1.1)
    });

    // 脑洞成分雷达图：执行力永远可怜，其余靠答题与运气
    const a = S.ansByTag;
    const radarVals = [
      Math.min(100, 82 + Math.floor(rng() * 18)),                 // 收藏欲：永远拉满
      Math.max(2, 12 - S.score * 0.8 + Math.floor(rng() * 5)),    // 执行力：基本没有
      Math.min(100, 60 + S.score * 3 + Math.floor(rng() * 15)),   // 拖延力
      Math.min(100, 55 + (a.death === 0 ? 35 : 0) + Math.floor(rng() * 20)), // 三分钟热度
      Math.min(100, 30 + (a.death === 3 ? 60 : 0) + (a.mind === 3 ? 20 : 0) + Math.floor(rng() * 15)) // 嘴硬度
    ].map(v => Math.round(v));
    drawRadar($('#chart-radar'), D.RADAR_DIMS, radarVals);

    // 死因分析
    $('#vd-no').textContent = 1000 + hashStr(key) % 9000;
    $('#vd-main').textContent = D.VERDICT_MAIN[a.death];
    $('#vd-mind').textContent = D.VERDICT_MIND[a.mind];
    $('#vd-relic').textContent = D.VERDICT_RELIC[a.relic];
    drawPie3D($('#chart-cause'), D.PIE.labels, D.PIE.values, D.PIE.colors);
    drawStamp($('#stamp-verdict'), '脑洞复盘指挥中心');

    // 病程回顾
    const relicQ = D.CORE_QUESTIONS.find(q => q.tag === 'relic');
    const relicShort = relicQ.options[a.relic];
    const rows = D.TIMELINE.map(r => r.map(c => String(c).replace('{relic}', relicShort)));
    $('#mq-timeline').textContent = rows.map(r => '【' + r[0] + '】' + r[1]).join('　★　');
    const tb = $('#tbl-timeline tbody');
    tb.innerHTML = '';
    rows.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td>' +
        '<td class="' + (r[3] === '已凉' ? 'st-dead' : 'st-live') + '">' + r[3] + '</td>';
      tb.appendChild(tr);
    });

    // 横向对比
    drawBar3D($('#chart-vs'), {
      title: '收藏数量对比',
      labels: [S.nick, '全国网友平均'],
      values: [collect, 88],
      colors: ['#990000', '#000080'],
      ymax: Math.ceil(collect * 1.15)
    });
    const times = (collect / 88).toFixed(1);
    // 行动率 = 实际开工 / 收藏，与第 2 页「实际开工」同源；第 2 页的「存活率」另算
    const actRate = (started / collect * 100).toFixed(2);
    const gap = Math.max(0, 6.4 - Number(actRate)).toFixed(1);
    $('#vs-text').innerHTML =
      '<p>一、收藏数量：你是全国平均水平的 <b class="red">' + times + ' 倍</b>，超越了 <b class="red">' + (95 + rng() * 4.9).toFixed(1) + '%</b> 的网友（收藏维度）。</p>' +
      '<p>二、行动率：你 <b class="red">' + actRate + '%</b>，全国平均 6.4%。差距约 <b class="red">' + gap + ' 个百分点</b>——换算成脑洞距离，约等于一个银河。</p>' +
      '<p>三、综合点评：<b>在收藏这条赛道上，你一骑绝尘；只可惜赛道尽头是陵园。</b></p>';

    // 结论
    $('#concl-persona').textContent = quoteTitle(persona);

    // 收藏家 MBTI
    const mbti =
      (a.mind <= 1 ? 'F' : 'M') +
      (a.relic === 3 ? 'W' : 'C') +
      (a.death === 3 ? 'Y' : 'X') +
      (rng() < 0.85 ? 'G' : 'J');
    $('#mbti-code').textContent = mbti;
    $('#mbti-desc').innerHTML = mbti.split('').map((ch, i) =>
      '<p>' + (i + 1) + '．<b>' + ch + '</b> — ' + D.MBTI_LETTERS[ch] + '</p>'
    ).join('');

    const ol = $('#ol-measures');
    ol.innerHTML = '';
    D.MEASURES.forEach(m => { const li = document.createElement('li'); li.textContent = m; ol.appendChild(li); });

    // 页脚跑马灯
    $('#foot-jokes').textContent = D.JOKES.join('　　');

    // 监控大屏（第 2 页，假实时全家桶）
    initScreen(rng);

    // 奖状
    drawAward();
  }

  /* ============================================================
     四、Excel 2003 · 3D 图表引擎（五毛渲染）
     ============================================================ */
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, (n >> 16) * f), g = Math.min(255, ((n >> 8) & 255) * f), b = Math.min(255, (n & 255) * f);
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  }

  function drawBar3D(cv, opt) {
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    // 标题
    ctx.fillStyle = '#000'; ctx.font = 'bold 15px SimSun, serif'; ctx.textAlign = 'center';
    ctx.fillText(opt.title, W / 2, 24);

    const ml = 52, mr = 18, mt = 40, mb = 56;
    const pw = W - ml - mr, ph = H - mt - mb, base = mt + ph;
    const dx = 12, dy = -12;

    // 3D 背景墙与地板
    ctx.fillStyle = '#e8e8e8';
    ctx.beginPath(); ctx.moveTo(ml, mt); ctx.lineTo(ml + dx, mt + dy); ctx.lineTo(ml + pw + dx, mt + dy); ctx.lineTo(ml + pw, mt); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d0d0d0';
    ctx.beginPath(); ctx.moveTo(ml, base); ctx.lineTo(ml + dx, base + dy); ctx.lineTo(ml + pw + dx, base + dy); ctx.lineTo(ml + pw, base); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f2f2f2'; ctx.fillRect(ml, mt, pw, ph);

    // 网格线 + 刻度
    ctx.strokeStyle = '#c0c0c0'; ctx.fillStyle = '#666'; ctx.font = '11px SimSun'; ctx.textAlign = 'right';
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const y = base - ph * i / steps;
      ctx.beginPath(); ctx.moveTo(ml, y); ctx.lineTo(ml + pw, y); ctx.stroke();
      ctx.fillText(Math.round(opt.ymax * i / steps), ml - 6, y + 4);
    }
    ctx.strokeStyle = '#808080'; ctx.strokeRect(ml, mt, pw, ph);

    // 柱子
    const n = opt.values.length, gw = pw / n, bw = gw * 0.45;
    opt.values.forEach((v, i) => {
      const x = ml + gw * i + (gw - bw) / 2;
      const h = opt.ymax ? v / opt.ymax * ph : 0;
      const y = base - h;
      const c = opt.colors[i % opt.colors.length];
      // 侧面
      ctx.fillStyle = shade(c, 0.55);
      ctx.beginPath(); ctx.moveTo(x + bw, y); ctx.lineTo(x + bw + dx, y + dy);
      ctx.lineTo(x + bw + dx, base + dy); ctx.lineTo(x + bw, base); ctx.closePath(); ctx.fill();
      // 顶面
      ctx.fillStyle = shade(c, 1.35);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx, y + dy);
      ctx.lineTo(x + bw + dx, y + dy); ctx.lineTo(x + bw, y); ctx.closePath(); ctx.fill();
      // 正面（渐变）
      const g = ctx.createLinearGradient(x, 0, x + bw, 0);
      g.addColorStop(0, shade(c, 1.2)); g.addColorStop(1, shade(c, 0.75));
      ctx.fillStyle = g; ctx.fillRect(x, y, bw, Math.max(h, v === 0 ? 0 : 1));
      ctx.strokeStyle = shade(c, 0.5); ctx.strokeRect(x, y, bw, Math.max(h, 0));
      // 数值
      ctx.fillStyle = '#000'; ctx.font = 'bold 13px SimSun'; ctx.textAlign = 'center';
      ctx.fillText(v, x + bw / 2 + dx / 2, y + dy - 4);
      // 类目标签
      ctx.font = '13px SimSun';
      ctx.fillText(opt.labels[i], x + bw / 2 + dx / 2, base + 20);
    });

    // 图例
    ctx.textAlign = 'left'; ctx.font = '12px SimSun';
    ctx.fillStyle = opt.colors[0]; ctx.fillRect(ml, H - 22, 12, 12);
    ctx.strokeStyle = '#000'; ctx.strokeRect(ml, H - 22, 12, 12);
    ctx.fillStyle = '#000'; ctx.fillText('系列 1（单位：个 / 死得很安详）', ml + 18, H - 11);
  }

  function drawPie3D(cv, labels, values, colors) {
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#000'; ctx.font = 'bold 15px SimSun, serif'; ctx.textAlign = 'center';
    ctx.fillText('脑洞死因构成', W / 2, 24);

    const cx = 185, cy = 165, rx = 135, ry = 80, depth = 26;
    const total = values.reduce((a, b) => a + b, 0);
    let a0 = -Math.PI / 2;
    const slices = values.map((v, i) => {
      const a1 = a0 + v / total * Math.PI * 2;
      const s = { a0, a1, c: colors[i], v };
      a0 = a1; return s;
    });
    function drawSlice(y, color, s) {
      ctx.beginPath(); ctx.moveTo(cx, y);
      ctx.ellipse(cx, y, rx, ry, 0, s.a0, s.a1);
      ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    }
    // 挤出厚度
    for (let d = depth; d >= 1; d--) slices.forEach(s => drawSlice(cy + d, shade(s.c, 0.5), s));
    // 顶面
    slices.forEach(s => {
      drawSlice(cy, s.c, s);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      // 百分比标签
      const mid = (s.a0 + s.a1) / 2;
      const px = cx + Math.cos(mid) * (rx + 28), py = cy + Math.sin(mid) * (ry + 20);
      ctx.fillStyle = '#000'; ctx.font = 'bold 13px SimSun'; ctx.textAlign = 'center';
      ctx.fillText(s.v + '%', px, py);
    });

    // 图例（右侧，Excel 2003 风）
    const lx = 380, ly = 90;
    ctx.font = '13px SimSun'; ctx.textAlign = 'left';
    labels.forEach((l, i) => {
      const y = ly + i * 34;
      ctx.fillStyle = colors[i]; ctx.fillRect(lx, y, 14, 14);
      ctx.strokeStyle = '#000'; ctx.strokeRect(lx, y, 14, 14);
      ctx.fillStyle = '#000'; ctx.fillText(l + '（' + values[i] + '%）', lx + 22, y + 12);
    });
    ctx.strokeStyle = '#c0c0c0'; ctx.strokeRect(lx - 10, ly - 14, 175, labels.length * 34 + 8);
  }

  /* ============================================================
     四点五、脑洞成分雷达图（Excel 2003 山寨雷达）
     ============================================================ */
  function drawRadar(cv, dims, vals) {
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#000'; ctx.font = 'bold 15px SimSun, serif'; ctx.textAlign = 'center';
    ctx.fillText('脑洞成分分析（满分 100）', W / 2, 24);

    const cx = W / 2, cy = H / 2 + 12, R = Math.min(W, H) / 2 - 58;
    const n = dims.length;
    const pt = (i, r) => {
      const ang = -Math.PI / 2 + i * 2 * Math.PI / n;
      return [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r];
    };
    // 网格（4 圈）
    for (let g = 1; g <= 4; g++) {
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const p = pt(i % n, R * g / 4);
        i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
      }
      ctx.strokeStyle = '#c0c0c0'; ctx.stroke();
    }
    // 轴线 + 标签
    ctx.font = '13px SimSun'; ctx.fillStyle = '#333';
    for (let i = 0; i < n; i++) {
      const p = pt(i, R);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(p[0], p[1]);
      ctx.strokeStyle = '#a0a0a0'; ctx.stroke();
      const lp = pt(i, R + 22);
      ctx.fillText(dims[i], lp[0], lp[1] + 4);
    }
    // 数据面
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const p = pt(i % n, R * vals[i % n] / 100);
      i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 0, 128, .25)'; ctx.fill();
    ctx.strokeStyle = '#000080'; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1;
    // 顶点 + 数值
    ctx.font = 'bold 12px SimSun';
    for (let i = 0; i < n; i++) {
      const p = pt(i, R * vals[i] / 100);
      ctx.fillStyle = '#c00000';
      ctx.beginPath(); ctx.arc(p[0], p[1], 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillText(vals[i], p[0], p[1] - 7);
    }
    // 图例
    ctx.textAlign = 'left'; ctx.font = '12px SimSun';
    ctx.fillStyle = '#000080'; ctx.fillRect(14, H - 26, 12, 12);
    ctx.strokeStyle = '#000'; ctx.strokeRect(14, H - 26, 12, 12);
    ctx.fillStyle = '#000'; ctx.fillText('系列 1：该同志（执行力那一格请自行放大）', 32, H - 15);
  }

  /* ============================================================
     四点八、监控大屏（假实时全家桶）
     ============================================================ */
  const MS = { timers: [] };
  function msClear() { MS.timers.forEach(clearInterval); MS.timers = []; }

  function initScreen(rng) {
    msClear();
    const t = S.stats;

    // 顶部假时钟（任务时间：从首个脑洞死亡起算）
    const t0 = Date.now();
    const clock = $('#ms-clock');
    const tickClock = () => {
      const el = Math.floor((Date.now() - t0) / 1000);
      const d = t.days, h = String(Math.floor(el / 3600)).padStart(2, '0'),
        m = String(Math.floor(el / 60) % 60).padStart(2, '0'),
        s = String(el % 60).padStart(2, '0');
      clock.textContent = 'T+' + d + '天 ' + h + ':' + m + ':' + s;
    };
    tickClock();
    MS.timers.push(setInterval(tickClock, 1000));

    // 大数字与计数
    $('#ms-rate').textContent = t.rate;
    $('#ms-collect').textContent = t.collect;
    $('#ms-alive').textContent = t.alive;
    $('#ms-lost').textContent = t.collect - t.alive;

    // 实时告警：每 2.6s 播报一条，最新置顶
    const box = $('#ms-alerts');
    box.innerHTML = '';
    const pushAlert = () => {
      const li = document.createElement('li');
      let msg = D.ALERTS[Math.floor(Math.random() * D.ALERTS.length)].replace('{nick}', S.nick);
      if (msg.charAt(0) === 'ℹ') li.className = 'info';
      const now = new Date();
      li.textContent = '[' + String(now.getHours()).padStart(2, '0') + ':' +
        String(now.getMinutes()).padStart(2, '0') + ':' +
        String(now.getSeconds()).padStart(2, '0') + '] ' + msg;
      box.insertBefore(li, box.firstChild);
      while (box.children.length > 8) box.lastChild.remove();
      if (msg.charAt(0) === '⚠') beep(1200, 0.05);
    };
    pushAlert(); pushAlert(); pushAlert();
    MS.timers.push(setInterval(pushAlert, 2600));

    // 状态灯墙：120 盏灯，绿的 = 存活，红的 = 失联，黄的装模作样
    const wall = $('#ms-wall');
    wall.innerHTML = '';
    const LAMPS = 120;
    const idx = Array.from({ length: LAMPS }, (_, i) => i);
    // 洗牌（确定性）
    for (let i = LAMPS - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = idx[i]; idx[i] = idx[j]; idx[j] = tmp;
    }
    const greenSet = new Set(idx.slice(0, Math.min(t.alive, LAMPS)));
    const yellowSet = new Set(idx.slice(LAMPS - 3)); // 3 盏「抢救中」
    idx.forEach((lampIdx, pos) => {
      const l = document.createElement('i');
      const no = pos + 1;
      if (greenSet.has(pos)) {
        l.className = 'ms-lamp g';
        l.title = '脑洞 #' + String(no).padStart(3, '0') + '：在轨存活！快去看它一眼，它快感动哭了';
      } else if (yellowSet.has(pos)) {
        l.className = 'ms-lamp y';
        l.title = '脑洞 #' + String(no).padStart(3, '0') + '：抢救中……骗你的，没人抢救';
      } else {
        l.className = 'ms-lamp r';
        l.title = '脑洞 #' + String(no).padStart(3, '0') + ' 墓志铭：' +
          D.EPITAPHS[Math.floor(rng() * D.EPITAPHS.length)];
      }
      l.addEventListener('click', () => { beep(greenSet.has(pos) ? 980 : 300, 0.08); });
      wall.appendChild(l);
    });

    // 存活率走势：一路下跌，每 2s 追加一个点
    const tcv = $('#ms-trend'), tctx = tcv.getContext('2d');
    const pts = [];
    let v = 96;
    for (let i = 0; i < 36; i++) { pts.push(v); v = Math.max(0.5, v - (2 + rng() * 4)); }
    const drawTrend = () => {
      const W = tcv.width, H = tcv.height, base = H - 24, top = 12;
      tctx.clearRect(0, 0, W, H);
      tctx.fillStyle = '#03101f'; tctx.fillRect(0, 0, W, H);
      // 网格
      tctx.strokeStyle = 'rgba(0,229,255,.15)';
      for (let i = 1; i < 4; i++) {
        tctx.beginPath(); tctx.moveTo(0, top + (base - top) * i / 4);
        tctx.lineTo(W, top + (base - top) * i / 4); tctx.stroke();
      }
      // 折线
      tctx.beginPath();
      pts.forEach((p, i) => {
        const x = i / (pts.length - 1) * (W - 8) + 4;
        const y = base - (p / 100) * (base - top);
        i ? tctx.lineTo(x, y) : tctx.moveTo(x, y);
      });
      tctx.strokeStyle = '#ff5050'; tctx.lineWidth = 2; tctx.stroke(); tctx.lineWidth = 1;
      // 最新点
      const lx = W - 4, ly = base - (pts[pts.length - 1] / 100) * (base - top);
      tctx.fillStyle = '#ff5050';
      tctx.beginPath(); tctx.arc(lx, ly, 3.5, 0, Math.PI * 2); tctx.fill();
      tctx.font = '11px Courier New'; tctx.textAlign = 'right';
      tctx.fillText(pts[pts.length - 1].toFixed(2) + '%', W - 10, ly - 8);
      tctx.fillStyle = '#7fb8dd'; tctx.textAlign = 'left';
      tctx.fillText('趋势：稳定归零中', 8, H - 8);
    };
    drawTrend();
    MS.timers.push(setInterval(() => {
      let last = pts[pts.length - 1];
      pts.push(Math.max(0.05, last - Math.random() * 1.6));
      pts.shift();
      drawTrend();
    }, 2000));

    // 仪表盘：收藏欲望指数（爆表）
    const gcv = $('#ms-gauge'), gctx = gcv.getContext('2d');
    const drawGauge = val => {
      const W = gcv.width, H = gcv.height, cx = W / 2, cy = H - 26, R = Math.min(W / 2 - 14, H - 44);
      gctx.clearRect(0, 0, W, H);
      gctx.fillStyle = '#03101f'; gctx.fillRect(0, 0, W, H);
      // 刻度弧：绿→黄→红
      const zones = [[0, .6, '#26ff7a'], [.6, .85, '#ffd700'], [.85, 1, '#ff4040']];
      zones.forEach(z => {
        gctx.beginPath();
        gctx.arc(cx, cy, R, Math.PI + z[0] * Math.PI, Math.PI + z[1] * Math.PI);
        gctx.strokeStyle = z[2]; gctx.lineWidth = 10; gctx.stroke();
      });
      gctx.lineWidth = 1;
      // 刻度字
      gctx.fillStyle = '#7fb8dd'; gctx.font = '10px Courier New'; gctx.textAlign = 'center';
      for (let i = 0; i <= 4; i++) {
        const ang = Math.PI + i / 4 * Math.PI;
        gctx.fillText(String(i * 25), cx + Math.cos(ang) * (R - 18), cy + Math.sin(ang) * (R - 18) + 3);
      }
      // 指针
      const a2 = Math.PI + val / 100 * Math.PI;
      gctx.beginPath(); gctx.moveTo(cx, cy);
      gctx.lineTo(cx + Math.cos(a2) * (R - 26), cy + Math.sin(a2) * (R - 26));
      gctx.strokeStyle = '#fff'; gctx.lineWidth = 2; gctx.stroke(); gctx.lineWidth = 1;
      gctx.beginPath(); gctx.arc(cx, cy, 4, 0, Math.PI * 2);
      gctx.fillStyle = '#ffd700'; gctx.fill();
      // 读数
      gctx.fillStyle = '#ff5050'; gctx.font = 'bold 20px Courier New';
      gctx.fillText(val.toFixed(0) + '%', cx, cy - 8);
    };
    let gv = 96 + rng() * 3;
    drawGauge(gv);
    MS.timers.push(setInterval(() => {
      gv = Math.min(99.9, Math.max(92, gv + (Math.random() - 0.5) * 3));
      drawGauge(gv);
    }, 1600));
  }

  /* ============================================================
     五、公章（红圈五角星 · 微微歪斜才正宗）
     ============================================================ */
  function drawStamp(cv, name) {
    const ctx = cv.getContext('2d'), R = cv.width / 2;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.save();
    ctx.translate(R, R); ctx.rotate(-0.12);
    ctx.strokeStyle = ctx.fillStyle = '#d40000';
    // 外圈
    ctx.lineWidth = R * 0.055;
    ctx.beginPath(); ctx.arc(0, 0, R * 0.86, 0, Math.PI * 2); ctx.stroke();
    // 五角星
    const sr = R * 0.30;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + i * 4 * Math.PI / 5;
      ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * sr, Math.sin(a) * sr);
    }
    ctx.closePath(); ctx.fill();
    // 环形文字
    ctx.font = 'bold ' + (R * 0.155) + 'px SimSun, serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const arc = Math.PI * 1.5, start = -Math.PI / 2 - arc / 2;
    for (let i = 0; i < name.length; i++) {
      const a = start + arc * i / (name.length - 1);
      ctx.save();
      ctx.rotate(a);
      ctx.translate(0, -R * 0.66);
      ctx.fillText(name[i], 0, 0);
      ctx.restore();
    }
    // 底部横排
    ctx.font = 'bold ' + (R * 0.14) + 'px SimSun, serif';
    ctx.fillText('复盘专用', 0, R * 0.45);
    ctx.restore();
  }

  /* ============================================================
     六、土味奖状
     ============================================================ */
  function drawAward() {
    const cv = $('#award-canvas'), ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height, t = S.stats;

    // 底
    ctx.fillStyle = '#fffbe8'; ctx.fillRect(0, 0, W, H);
    // 边框
    ctx.strokeStyle = '#d40000'; ctx.lineWidth = 10; ctx.strokeRect(14, 14, W - 28, H - 28);
    ctx.strokeStyle = '#d4a000'; ctx.lineWidth = 2; ctx.strokeRect(32, 32, W - 64, H - 64);
    // 四角装饰
    ctx.fillStyle = '#d40000';
    [[32, 32], [W - 32, 32], [32, H - 32], [W - 32, H - 32]].forEach(p => {
      ctx.beginPath(); ctx.arc(p[0], p[1], 8, 0, Math.PI * 2); ctx.fill();
    });

    // 标题
    ctx.textAlign = 'center';
    ctx.fillStyle = '#d40000';
    ctx.font = 'bold 110px SimHei, sans-serif';
    ctx.shadowColor = '#d4a000'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 5; ctx.shadowOffsetY = 5;
    ctx.fillText('奖　状', W / 2, 165);
    ctx.shadowColor = 'transparent';

    // 缎带分隔线
    const grad = ctx.createLinearGradient(80, 0, W - 80, 0);
    grad.addColorStop(0, '#d40000'); grad.addColorStop(.5, '#d4a000'); grad.addColorStop(1, '#d40000');
    ctx.fillStyle = grad; ctx.fillRect(80, 195, W - 160, 6);

    // 正文
    ctx.fillStyle = '#222'; ctx.font = '34px SimSun, serif'; ctx.textAlign = 'left';
    ctx.fillText(S.nick + ' 同志：', 90, 270);
    ctx.font = '28px SimSun, serif';
    const lines = [
      '　　在 2026 年度「脑洞收藏与安葬」工作中表现突出，',
      '累计安葬脑洞 ' + t.collect + ' 个，抢救记录 0 次，',
      '经脑洞复盘指挥中心研究决定，授予'
    ];
    lines.forEach((l, i) => ctx.fillText(l, 90, 330 + i * 48));

    // 称号（金光闪闪）
    ctx.textAlign = 'center';
    ctx.font = 'bold 44px SimHei, sans-serif';
    const pg = ctx.createLinearGradient(0, 470, 0, 520);
    pg.addColorStop(0, '#ff8000'); pg.addColorStop(.5, '#d40000'); pg.addColorStop(1, '#800000');
    ctx.fillStyle = pg;
    ctx.fillText(quoteTitle(t.persona), W / 2, 505);
    ctx.fillStyle = '#222'; ctx.font = '28px SimSun, serif';
    ctx.fillText('荣誉称号。特发此状，以资鼓励！', W / 2, 565);

    // 落款
    ctx.font = '24px SimSun, serif'; ctx.textAlign = 'right';
    ctx.fillText('脑洞复盘指挥中心', W - 90, H - 110);
    ctx.fillText(fmtDate(new Date()), W - 90, H - 72);
    // 编号
    ctx.textAlign = 'left'; ctx.font = '18px SimSun, serif'; ctx.fillStyle = '#888';
    ctx.fillText('编号：脑奖字〔2026〕第 1024 号', 60, H - 62);
    ctx.fillText('本奖状最终解释权归收藏夹所有', 60, H - 36);

    // 盖章
    const sc = document.createElement('canvas');
    sc.width = sc.height = 220;
    drawStamp(sc, '脑洞复盘指挥中心');
    ctx.drawImage(sc, W - 330, H - 300, 220, 220);
  }

  /* ============================================================
     七、翻页导航
     ============================================================ */
  let cur = 0;
  const pages = () => $$('#report-pages .page');
  function gotoPage(i) {
    const ps = pages();
    cur = Math.max(0, Math.min(ps.length - 1, i));
    ps.forEach((p, idx) => { p.style.display = idx === cur ? 'block' : 'none'; });
    const p = ps[cur];
    p.style.animation = 'none'; void p.offsetWidth; p.style.animation = '';
    $('#page-ind').textContent = (cur + 1) + ' / ' + ps.length;
    $('#btn-prev').disabled = cur === 0;
    $('#btn-next').disabled = cur === ps.length - 1;
    window.scrollTo(0, 0);
  }
  $('#btn-prev').addEventListener('click', () => { beep(520); gotoPage(cur - 1); });
  $('#btn-next').addEventListener('click', () => { beep(780); gotoPage(cur + 1); });
  $('#btn-go-award').addEventListener('click', () => { beep(1040); gotoPage(pages().length - 1); });
  document.addEventListener('keydown', e => {
    if (!$('#screen-report').classList.contains('active')) return;
    const tag = (e.target && e.target.tagName || '').toLowerCase();
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault(); gotoPage(cur - 1);
    } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
      e.preventDefault(); gotoPage(cur + 1);
    } else if (e.key === 'Home') {
      e.preventDefault(); gotoPage(0);
    } else if (e.key === 'End') {
      e.preventDefault(); gotoPage(pages().length - 1);
    } else if (e.key === ' ' && tag !== 'button' && tag !== 'input' && tag !== 'textarea') {
      e.preventDefault(); gotoPage(cur + 1);
    }
  });

  /* ============================================================
     八、奖状下载 / 分享 / 重开
     ============================================================ */
  $('#btn-download').addEventListener('click', () => {
    beep(880);
    const a = document.createElement('a');
    a.download = '脑洞奖状_' + S.nick + '.png';
    a.href = $('#award-canvas').toDataURL('image/png');
    a.click();
  });
  $('#btn-copy').addEventListener('click', async () => {
    beep(880);
    const text = D.shareText(S.nick, S.stats.collect, S.stats.persona);
    try { await navigator.clipboard.writeText(text); alert('分享文案已复制，快去丢人吧。'); }
    catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
      alert('分享文案已复制，快去丢人吧。');
    }
  });
  $('#btn-restart').addEventListener('click', () => {
    beep(440);
    msClear();
    $$('input[type=radio]').forEach(r => { r.checked = false; });
    $('#in-nick').value = '';
    $('#form-warn').classList.add('hidden');
    renderQuestions(); // 重新抽一道加试题
    show('screen-form');
  });

  /* ============================================================
     九、鼠标拖尾（QQ空间联名款）
     ============================================================ */
  let lastTrail = 0;
  window.addEventListener('pointermove', e => {
    const now = performance.now();
    if (now - lastTrail < 45) return;
    lastTrail = now;
    const s = document.createElement('span');
    s.className = 'trail';
    s.textContent = Math.random() < 0.5 ? '✦' : '★';
    s.style.left = e.clientX + 'px';
    s.style.top = e.clientY + 'px';
    s.style.color = ['#ffd700', '#ff4040', '#7cffb2'][Math.floor(Math.random() * 3)];
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 820);
  });

  /* ---------- 演示模式（?demo=1 / ?demo=2，可加 &auto=1） ---------- */
  function setupDemo(which, params) {
    document.body.classList.add('demo');
    const presets = {
      '1': { nick: '演示员', ans: { relic: 0, mind: 1, death: 2 } },
      '2': { nick: '倒霉蛋', ans: { relic: 3, mind: 2, death: 1 } }
    };
    const preset = presets[which] || presets['1'];
    $('#in-nick').value = preset.nick;
    S.qs.forEach((q, qi) => {
      const v = (q.tag in preset.ans) ? preset.ans[q.tag] : 0;
      const el = document.querySelector('input[name="q' + qi + '"][value="' + v + '"]');
      if (el) el.checked = true;
    });
    show('screen-form');
    if (params.get('auto') === '1') {
      setTimeout(() => { $('#btn-start').click(); }, 350);
    }
  }

  /* ---------- 启动 ---------- */
  renderQuestions();
  const params = new URLSearchParams(location.search);
  if (params.get('demo')) setupDemo(params.get('demo'), params);
  else runLoading();
})();
