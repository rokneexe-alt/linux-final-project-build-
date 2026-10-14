// hints.js — زر التلميح (اللعب الفردي فقط). التلميح يخصم نقاطاً من اللاعب.
// يعمل فوق اللعبة بدون تعديل دوالها، ويُحمَّل بعد السكربت الرئيسي.
(function () {
  'use strict';

  const HINT_COST = 40;         // النقاط التي تُخصم عند كل تلميح
  const MAX_HINTS = 3;          // أقصى عدد تلميحات في الجولة الواحدة
  const REVEAL = 'partial';     // 'partial' = كلمة ناقصة (EL___) | 'full' = الكلمة كاملة

  const STR = {
    en: {
      hintBtn: 'HINT', hintTitle: 'USE A HINT?', hintDesc: 'A hint costs {n} points. The timer is paused while you decide.',
      hintUse: 'USE HINT', hintCancel: 'CANCEL', hintNone: 'No hint available',
      hintPoor: 'Not enough points (need {n})', hintLimit: 'No more hints this round', hintSpent: 'Hint used'
    },
    ar: {
      hintBtn: 'تلميح', hintTitle: 'استخدام تلميح؟', hintDesc: 'التلميح يكلّف {n} نقطة. الوقت متوقف أثناء تفكيرك.',
      hintUse: 'استخدم التلميح', hintCancel: 'إلغاء', hintNone: 'لا يوجد تلميح متاح',
      hintPoor: 'نقاطك لا تكفي (تحتاج {n})', hintLimit: 'انتهت التلميحات في هذه الجولة', hintSpent: 'تم استخدام تلميح'
    }
  };
  Object.assign(translations.en, STR.en);
  Object.assign(translations.ar, STR.ar);
  const TN = k => T(k).replace('{n}', HINT_COST);

  let used = 0, busy = false, target = null, revealAt = -1, pausedMs = 0;

  // ---------- عناصر الواجهة ----------
  const sendBtn = $('sendBtn');
  const hintBtn = document.createElement('button');
  hintBtn.id = 'hintBtn';
  hintBtn.className = 'btn-retro py-3 px-3 text-xs';
  hintBtn.onclick = () => { playBtnSound(); requestHint(); };
  sendBtn.parentElement.insertBefore(hintBtn, sendBtn);

  const reveal = document.createElement('div');
  reveal.id = 'hintReveal';
  reveal.style.cssText = "display:none;text-align:center;font-size:16px;color:#FFCC33;letter-spacing:.2em;text-shadow:0 0 10px #FFCC33;direction:ltr;font-family:'Press Start 2P',monospace;padding:2px 0";
  $('hintLine').after(reveal);

  const modal = document.createElement('div');
  modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:70;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.8)';
  modal.innerHTML =
    '<div style="width:100%;max-width:24rem;background:#0B120C;border:4px solid #FFCC33;border-radius:8px;padding:24px;text-align:center;box-shadow:0 0 40px rgba(255,204,51,.3)">' +
    '<h3 id="hmTitle" style="color:#FFCC33;font-size:16px;margin-bottom:16px"></h3>' +
    '<p id="hmDesc" style="font-size:11px;line-height:1.7;margin-bottom:24px;opacity:.85"></p>' +
    '<div style="display:flex;gap:12px"><button id="hmCancel" class="btn-retro" style="flex:1;padding:12px;font-size:11px"></button>' +
    '<button id="hmUse" class="btn-retro" style="flex:1;padding:12px;font-size:11px;background:#FFCC33;color:#050805;border-color:#FFCC33;font-weight:bold"></button></div></div>';
  document.body.appendChild(modal);
  modal.querySelector('#hmCancel').onclick = () => { playBtnSound(); closeModal(true); };
  modal.querySelector('#hmUse').onclick = () => { playBtnSound(); useHint(); };

  function openModal() {
    modal.querySelector('#hmTitle').textContent = T('hintTitle');
    modal.querySelector('#hmDesc').textContent = TN('hintDesc');
    modal.querySelector('#hmCancel').textContent = T('hintCancel');
    modal.querySelector('#hmUse').textContent = T('hintUse') + ' (-' + HINT_COST + ')';
    modal.style.display = 'flex';
  }
  function closeModal(resume) {
    modal.style.display = 'none';
    if (resume && busy) endPause();
  }

  // ---------- مساعدات ----------
  function flash(msg) {
    $('hintLine').textContent = '';
    const s = document.createElement('span'); s.style.color = '#FF3333'; s.textContent = msg; $('hintLine').appendChild(s);
    beep('C3', '8n');
    setTimeout(() => { if (game.active && game.turn === 'player') updateHint(); }, 1800);
  }

  function pickHintWord() {
    let pool;
    if (game.last) pool = byLetter[game.last] || [];
    else { const ls = Object.keys(byLetter); pool = ls.length ? byLetter[ls[Math.floor(Math.random() * ls.length)]] : []; }
    pool = pool.filter(w => !game.used.has(w));
    const good = pool.filter(w => w.length >= 4 && w.length <= 8);
    const src = good.length ? good : pool;
    return src.length ? src[Math.floor(Math.random() * src.length)] : null;
  }

  function mask(w) {
    const L = w.length;
    return w.toUpperCase().split('').map((ch, i) => {
      if (REVEAL === 'full') return ch;
      const show = i === 0 || i === 1 || (L >= 6 && i === L - 1);
      return show ? ch : '_';
    }).join(' ');
  }

  function showReveal(w) { reveal.textContent = mask(w); reveal.style.display = 'block'; revealAt = game.used.size; }
  function hideReveal() { reveal.style.display = 'none'; reveal.textContent = ''; revealAt = -1; }

  // ---------- إيقاف المؤقت أثناء نافذة التأكيد ----------
  function beginPause() {
    busy = true;
    clearInterval(game.ticker);
    pausedMs = Math.max(0, game.timeLeft * 1000);
    $('wordInput').disabled = true; sendBtn.disabled = true;
  }
  function endPause() {
    busy = false;
    if (!(game.active && game.turn === 'player')) return;
    $('wordInput').disabled = false; sendBtn.disabled = false;
    resumeTimer(pausedMs);
    $('wordInput').focus();
  }
  function resumeTimer(remainingMs) {
    clearInterval(game.ticker);
    const total = settings.timer * 1000;
    const rem = Math.min(total, Math.max(remainingMs, 0));
    const startAt = performance.now() - (total - rem);
    const bar = $('timerBar');
    let lastSecond = null;
    game.ticker = setInterval(() => {
      const left = Math.max(0, total - (performance.now() - startAt));
      game.timeLeft = left / 1000;
      bar.style.width = (left / total * 100) + '%';
      const sec = Math.ceil(left / 1000);
      $('timerText').innerText = sec + 's';
      bar.classList.toggle('timer-warn', sec <= 3);
      if (sec <= 3 && sec !== lastSecond && sec > 0) beep('A4', '32n');
      lastSecond = sec;
      if (left <= 0) { clearInterval(game.ticker); endGame(false, T('reasonTime')); }
    }, 100);
  }

  // ---------- التدفق ----------
  function requestHint() {
    if (busy || !game.active || game.turn !== 'player') return;
    if (used >= MAX_HINTS) return flash(T('hintLimit'));
    if (game.pScore < HINT_COST) return flash(TN('hintPoor'));
    target = pickHintWord();
    if (!target) return flash(T('hintNone'));
    beginPause();
    openModal();
  }

  function useHint() {
    modal.style.display = 'none';
    if (!busy || !target || !game.active || game.turn !== 'player') { busy = false; return; }
    if (game.pScore < HINT_COST) { endPause(); return flash(TN('hintPoor')); }
    used++;
    game.pScore -= HINT_COST;
    updateScores();
    addBubble('sys', T('hintSpent') + ' -' + HINT_COST);
    showReveal(target);
    beep('E5');
    endPause();
  }

  // ---------- مزامنة الواجهة ----------
  setInterval(() => {
    hintBtn.textContent = '💡 ' + T('hintBtn') + ' -' + HINT_COST;
    hintBtn.disabled = busy || !game.active || game.turn !== 'player' || $('wordInput').disabled;
    if (revealAt !== -1 && (!game.active || game.turn !== 'player' || game.used.size !== revealAt)) hideReveal();
  }, 200);

  // إعادة ضبط العدّاد مع كل جولة جديدة
  const origStartRound = window.startRound;
  if (typeof origStartRound === 'function') {
    window.startRound = function () { used = 0; busy = false; hideReveal(); closeModal(false); return origStartRound.apply(this, arguments); };
  }
})();
