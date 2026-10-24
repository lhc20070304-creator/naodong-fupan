/* ============================================================
   脑洞复盘指挥中心 · 彩蛋系统（v2）
   触发方式：Konami 秘籍 ↑↑↓↓←→←→BA / 连击顶部 Logo 5 次
   ============================================================ */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const D = window.DATA;

  function beep(freq, dur) {
    if (window.__sfx === false) return;
    try {
      const AC = new (window.AudioContext || window.webkitAudioContext)();
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = 'square'; o.frequency.value = freq || 880; g.gain.value = 0.04;
      o.connect(g); g.connect(AC.destination);
      o.start(); o.stop(AC.currentTime + (dur || 0.07));
    } catch (e) { /* 静音彩蛋 */ }
  }

  /* ---------- 弹层开关 ---------- */
  function openMask(el) { el.classList.remove('hidden'); }
  function closeMask(el) { el.classList.add('hidden'); }
  $$('.egg-mask').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) closeMask(m); });
  });
  $$('[data-close]').forEach(b => {
    b.addEventListener('click', () => { beep(440); closeMask(b.closest('.egg-mask')); });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') $$('.egg-mask').forEach(closeMask);
  });

  /* ---------- 隐藏控制台 ---------- */
  function openConsole() {
    beep(660); setTimeout(() => beep(880), 90); setTimeout(() => beep(1100), 180);
    openMask($('#console-mask'));
  }
  $('#console-x').addEventListener('click', () => closeMask($('#console-mask')));

  // Konami 秘籍
  const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let ki = 0;
  document.addEventListener('keydown', e => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    ki = (k === KONAMI[ki]) ? ki + 1 : (k === KONAMI[0] ? 1 : 0);
    if (ki === KONAMI.length) { ki = 0; openConsole(); }
  });

  // 连击顶部 Logo 5 次（手滑党专用）
  let logoClicks = 0, logoTimer = null;
  const logo = document.querySelector('.topbar span');
  if (logo) {
    logo.style.cursor = 'pointer';
    logo.addEventListener('click', () => {
      logoClicks++;
      clearTimeout(logoTimer);
      logoTimer = setTimeout(() => { logoClicks = 0; }, 1600);
      beep(500 + logoClicks * 80, 0.05);
      if (logoClicks >= 5) { logoClicks = 0; openConsole(); }
    });
  }

  /* ---------- CRT / 音效 开关（双拨杆同步） ---------- */
  function bindRocker(ids, onChange) {
    const els = ids.map(id => $(id)).filter(Boolean);
    els.forEach(el => el.addEventListener('click', () => {
      const on = !el.classList.contains('on');
      els.forEach(e2 => e2.classList.toggle('on', on));
      beep(on ? 980 : 300);
      onChange(on);
    }));
  }
  bindRocker(['#sw-crt', '#sw-crt2'], on => {
    $('#crt-layer').classList.toggle('hidden', !on);
  });
  $('#sw-crt') && $('#sw-crt').classList.remove('on'); // 默认关
  bindRocker(['#sw-sfx'], on => { window.__sfx = on; });

  /* ---------- 彩蛋页内容填充 ---------- */
  function state() {
    const BR = window.__BR || { S: { nick: '无名氏', stats: null } };
    return BR.S;
  }

  function openEgg(name) {
    const S = state();
    const st = S.stats || { days: '-', persona: '实习脑洞收藏家', collect: 0 };
    const D_ = D;

    if (name === 'health') {
      $('#hl-days').textContent = st.days;
      const tb = $('#tbl-health tbody');
      tb.innerHTML = '';
      D_.HEALTH.rows.forEach(r => {
        const tr = document.createElement('tr');
        r.forEach(c => { const td = document.createElement('td'); td.textContent = c; tr.appendChild(td); });
        tb.appendChild(tr);
      });
      const ol = $('#hl-advice');
      ol.innerHTML = '';
      D_.HEALTH.advice.forEach(a => { const li = document.createElement('li'); li.textContent = a; ol.appendChild(li); });
      $('#hl-doctor').textContent = D_.HEALTH.doctor;
      (window.__BR || {}).drawStampRef && window.__BR.drawStampRef($('#stamp-health'));
    }

    if (name === 'wanted') {
      $('#wt-name').textContent = D_.WANTED.name;
      $('#wt-features').textContent = D_.WANTED.features.join('；');
      $('#wt-crime').textContent = D_.WANTED.crime;
      $('#wt-reward').textContent = D_.WANTED.reward;
      $('#wt-phone').textContent = D_.WANTED.phone;
      (window.__BR || {}).drawStampRef && window.__BR.drawStampRef($('#stamp-wanted'));
    }

    if (name === 'rpg') {
      $('#rpg-job').textContent = quoteSafe(st.persona);
      $('#rpg-status').textContent = D_.RPG.status;
      // HP 执行力 3/9999，MP 收藏欲 9999/9999
      $('#rpg-hp').style.width = '0.3%';
      $('#rpg-hp-t').textContent = '3/9999';
      $('#rpg-mp').style.width = '100%';
      $('#rpg-mp-t').textContent = '9999/9999';
      const sk = $('#rpg-skills'); sk.innerHTML = '';
      D_.RPG.skills.forEach(s => {
        const li = document.createElement('li');
        const n = document.createElement('span'); n.textContent = s[0];
        const l = document.createElement('span'); l.textContent = s[1];
        li.appendChild(n); li.appendChild(l); sk.appendChild(li);
      });
      const eq = $('#rpg-equips'); eq.innerHTML = '';
      D_.RPG.equips.forEach(e => {
        const li = document.createElement('li');
        const n = document.createElement('span'); n.textContent = e;
        li.appendChild(n); eq.appendChild(li);
      });
    }

    openMask($('#egg-' + name));
    beep(760);
  }

  function quoteSafe(p) {
    return (p && p.charAt(0) === '「') ? p : '「' + p + '」';
  }

  // 控制台按钮
  $$('[data-egg]').forEach(b => {
    b.addEventListener('click', () => {
      closeMask($('#console-mask'));
      openEgg(b.getAttribute('data-egg'));
    });
  });

  // 大屏面板直触：告警 → 通缉令；健康 → 体检单
  const pa = $('#panel-alert'); if (pa) pa.addEventListener('click', () => openEgg('wanted'));
  const ph = $('#panel-health'); if (ph) ph.addEventListener('click', () => openEgg('health'));
})();
