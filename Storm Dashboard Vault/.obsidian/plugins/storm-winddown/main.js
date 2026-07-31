'use strict';

/*
 * Storm Wind-Down — a vault-wide nudge to log off.
 *
 *   21:30  → wind-down warning (prominent amber banner, calm)
 *   22:30  → OBNOXIOUS mode (flashing red vignette + shaking banner, silent)
 *   02:00  → everything switches off for the night
 *
 * To make it go away early, type the opening paragraph of Moby-Dick into the
 * box (paste is blocked — you have to actually type it). That snoozes it until
 * tomorrow evening. Otherwise it clears itself at 2 AM.
 *
 * Tweak the four constants below to change the schedule.
 */

const obsidian = require('obsidian');

// ---- schedule (minutes since midnight) -----------------------------------
const WINDDOWN_START = 21 * 60 + 30; // 21:30  begin the gentle warning
const OBNOXIOUS_START = 22 * 60 + 30; // 22:30  escalate to obnoxious
const AUTO_OFF        =  2 * 60;      // 02:00  clear everything for the night
const WHO = 'friend';                  // name used in the messages

// The penance. Public-domain (Melville, 1851). Keep the punctuation authentic;
// matching is punctuation-insensitive so the em-dashes don't have to be exact.
const MOBY =
  'Call me Ishmael. Some years ago—never mind how long precisely—having ' +
  'little or no money in my purse, and nothing particular to interest me on ' +
  'shore, I thought I would sail about a little and see the watery part of the ' +
  'world. It is a way I have of driving off the spleen and regulating the ' +
  'circulation. Whenever I find myself growing grim about the mouth; whenever ' +
  'it is a damp, drizzly November in my soul; whenever I find myself ' +
  'involuntarily pausing before coffin warehouses, and bringing up the rear of ' +
  'every funeral I meet; and especially whenever my hypos get such an upper ' +
  "hand of me, that it requires a strong moral principle to prevent me from " +
  'deliberately stepping into the street, and methodically knocking ' +
  "people's hats off—then, I account it high time to get to sea as soon as I " +
  'can.';

// ---- pure helpers (exported for tests) -----------------------------------
const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const MOBY_WORDS = norm(MOBY).split(' ').filter(Boolean);
const MOBY_NORM = MOBY_WORDS.join(' ');

// which phase are we in, given minutes-since-midnight?
function phaseOf(mins) {
  const active = mins >= WINDDOWN_START || mins < AUTO_OFF;
  if (!active) return 'off';
  if (mins >= OBNOXIOUS_START || mins < AUTO_OFF) return 'obnoxious';
  return 'winddown';
}

// a stable id for "the night": after midnight but before 2 AM belongs to the
// evening that just passed, so a snooze at 11 PM still holds at 12:30 AM.
function nightKey(date) {
  const mins = date.getHours() * 60 + date.getMinutes();
  const d = new Date(date.getTime());
  if (mins < AUTO_OFF) d.setDate(d.getDate() - 1);
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

// count how many leading words of the input match the target (for the meter)
function prefixMatch(inputNorm) {
  const w = inputNorm.split(' ').filter(Boolean);
  let m = 0;
  while (m < w.length && m < MOBY_WORDS.length && w[m] === MOBY_WORDS[m]) m++;
  return m;
}

// --------------------------------------------------------------------------
class StormWindDown extends obsidian.Plugin {
  async onload() {
    this.snoozedNight = null;
    try {
      const saved = await this.loadData();
      if (saved && saved.snoozedNight) this.snoozedNight = saved.snoozedNight;
    } catch (e) { /* first run */ }

    this.injectStyle();
    this.buildDom();
    this.tick();
    this.registerInterval(window.setInterval(() => this.tick(), 15000));
    // re-assert if Obsidian re-lays-out and drops our node
    this.registerEvent(this.app.workspace.on('layout-change', () => this.reassert()));
  }

  onunload() {
    if (this.el) this.el.remove();
    if (this.styleEl) this.styleEl.remove();
  }

  reassert() {
    if (this.el && !document.body.contains(this.el)) document.body.appendChild(this.el);
  }

  // ---- DOM ---------------------------------------------------------------
  buildDom() {
    const el = document.createElement('div');
    el.id = 'storm-wd';
    el.setAttribute('data-phase', 'off');
    el.innerHTML =
      '<div class="storm-wd-veil"></div>' +
      '<div class="storm-wd-bar"><div class="storm-wd-inner">' +
        '<div class="storm-wd-row">' +
          '<span class="storm-wd-icon">🌙</span>' +
          '<div class="storm-wd-text">' +
            '<div class="storm-wd-msg"></div>' +
            '<div class="storm-wd-sub"></div>' +
          '</div>' +
          '<button class="storm-wd-reveal" type="button">make it stop →</button>' +
        '</div>' +
        '<div class="storm-wd-penance">' +
          '<div class="storm-wd-phead">Type the opening of <i>Moby-Dick</i> to dismiss for tonight &nbsp;(or just wait until 2 AM):</div>' +
          '<div class="storm-wd-target">' + MOBY.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</div>' +
          '<textarea class="storm-wd-input" rows="4" spellcheck="false" autocomplete="off" placeholder="Call me Ishmael…"></textarea>' +
          '<div class="storm-wd-progwrap"><div class="storm-wd-progbar"></div></div>' +
          '<div class="storm-wd-prog"></div>' +
        '</div>' +
      '</div></div>';
    document.body.appendChild(el);

    this.el = el;
    this.iconEl = el.querySelector('.storm-wd-icon');
    this.msgEl = el.querySelector('.storm-wd-msg');
    this.subEl = el.querySelector('.storm-wd-sub');
    this.input = el.querySelector('.storm-wd-input');
    this.prog = el.querySelector('.storm-wd-prog');
    this.progbar = el.querySelector('.storm-wd-progbar');
    this.prog.textContent = '0 / ' + MOBY_WORDS.length + ' words';

    el.querySelector('.storm-wd-reveal').addEventListener('click', () => {
      el.classList.add('reveal');
      this.input.focus();
    });
    // block paste — the point is to actually type it
    this.input.addEventListener('paste', (e) => {
      e.preventDefault();
      this.flashNoPaste();
    });
    this.input.addEventListener('drop', (e) => e.preventDefault());
    this.input.addEventListener('input', () => this.onInput());
  }

  onInput() {
    const v = norm(this.input.value);
    const m = prefixMatch(v);
    const pct = Math.round((100 * m) / MOBY_WORDS.length);
    this.prog.textContent = m + ' / ' + MOBY_WORDS.length + ' words';
    this.progbar.style.width = pct + '%';
    this.progbar.classList.toggle('full', v === MOBY_NORM);
    if (v === MOBY_NORM) this.complete();
  }

  flashNoPaste() {
    this.prog.textContent = 'No pasting — you have to type it, ' + WHO + '.';
    this.prog.classList.add('warn');
    window.setTimeout(() => {
      this.prog.classList.remove('warn');
      const m = prefixMatch(norm(this.input.value));
      this.prog.textContent = m + ' / ' + MOBY_WORDS.length + ' words';
    }, 1600);
  }

  async complete() {
    this.snoozedNight = nightKey(new Date());
    try { await this.saveData({ snoozedNight: this.snoozedNight }); } catch (e) { /* ignore */ }
    this.el.classList.add('done');
    this.msgEl.textContent = '⚓ Thar she blows. Goodnight, ' + WHO + '.';
    this.subEl.textContent = 'See you tomorrow.';
    window.setTimeout(() => {
      this.el.classList.remove('show', 'done', 'reveal');
      this.input.value = '';
      this.prog.classList.remove('warn');
      this.prog.textContent = '0 / ' + MOBY_WORDS.length + ' words';
      this.progbar.style.width = '0%';
      this.progbar.classList.remove('full');
    }, 2600);
  }

  // ---- clock -------------------------------------------------------------
  tick() {
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const phase = phaseOf(mins);
    const snoozed = this.snoozedNight === nightKey(now);
    const show = phase !== 'off' && !snoozed;

    this.el.setAttribute('data-phase', phase);
    if (show && !this.el.classList.contains('done')) this.render(phase);
    if (!show && !this.el.classList.contains('done')) this.el.classList.remove('show', 'reveal');
    else if (show) this.el.classList.add('show');
  }

  render(phase) {
    if (phase === 'obnoxious') {
      this.iconEl.textContent = '🚨';
      this.msgEl.textContent = "It's past 10:30. Put it down and go to bed, " + WHO + '.';
      this.subEl.textContent = 'This is not a suggestion anymore.';
    } else {
      this.iconEl.textContent = '🌙';
      this.msgEl.textContent = "It's past 9:30 — time to start winding down.";
      this.subEl.textContent = 'Wrap up, close the laptop, get ready for bed.';
    }
  }

  // ---- styles ------------------------------------------------------------
  injectStyle() {
    const css = `
#storm-wd{ position:fixed; inset:0; z-index:2000000; pointer-events:none; display:none;
  font-family:var(--font-interface,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif); }
#storm-wd.show{ display:block; }

/* full-screen red vignette — obnoxious only, never blocks clicks */
#storm-wd .storm-wd-veil{ position:absolute; inset:0; pointer-events:none; opacity:0;
  transition:opacity .5s ease; box-shadow:inset 0 0 120px 20px rgba(214,26,26,.5); }
#storm-wd[data-phase="obnoxious"].show .storm-wd-veil{ opacity:1; animation:stormPulse 1.15s ease-in-out infinite; }
@keyframes stormPulse{
  0%,100%{ box-shadow:inset 0 0 80px 10px rgba(214,26,26,.30); }
  50%    { box-shadow:inset 0 0 200px 46px rgba(255,32,32,.78); } }

/* the banner — sits below the macOS window controls so you can still close the window */
#storm-wd .storm-wd-bar{ pointer-events:auto; position:absolute; top:44px; left:0; right:0;
  color:#fff; box-shadow:0 10px 34px -8px rgba(0,0,0,.6); }
#storm-wd .storm-wd-inner{ max-width:900px; margin:0 auto; padding:14px 22px; }
#storm-wd .storm-wd-row{ display:flex; align-items:center; gap:14px; }
#storm-wd .storm-wd-icon{ font-size:26px; line-height:1; flex:none; filter:drop-shadow(0 2px 6px rgba(0,0,0,.4)); }
#storm-wd .storm-wd-text{ flex:1; min-width:0; }
#storm-wd .storm-wd-msg{ font-size:17px; font-weight:800; letter-spacing:-.01em; }
#storm-wd .storm-wd-sub{ font-size:12.5px; opacity:.9; margin-top:2px; font-weight:600; }
#storm-wd .storm-wd-reveal{ pointer-events:auto; flex:none; cursor:pointer; font:inherit;
  font-size:12px; font-weight:700; color:#fff; background:rgba(255,255,255,.16);
  border:1px solid rgba(255,255,255,.4); border-radius:9px; padding:6px 12px; transition:.12s; }
#storm-wd .storm-wd-reveal:hover{ background:rgba(255,255,255,.28); }

/* wind-down look: calm amber */
#storm-wd[data-phase="winddown"] .storm-wd-bar{
  background:linear-gradient(180deg,#c98a1e,#b3781a); border-bottom:1px solid rgba(0,0,0,.25); }

/* obnoxious look: loud red, flashing + shaking */
#storm-wd[data-phase="obnoxious"] .storm-wd-bar{
  background:linear-gradient(180deg,#d21c22,#a3121a); border-bottom:2px solid #ffd0d0;
  animation:stormFlash 1.05s steps(1,end) infinite, stormShake 3s ease-in-out infinite; }
#storm-wd[data-phase="obnoxious"] .storm-wd-msg{ font-size:20px; text-transform:uppercase; letter-spacing:.01em; }
#storm-wd[data-phase="obnoxious"] .storm-wd-reveal{ display:none; }
@keyframes stormFlash{ 0%{ background:linear-gradient(180deg,#e11c22,#a3121a);} 50%{ background:linear-gradient(180deg,#8f0f16,#6d0a10);} }
@keyframes stormShake{
  0%,17%,100%{ transform:translateX(0) rotate(0); }
  2%{ transform:translateX(-6px) rotate(-.2deg);} 5%{ transform:translateX(6px) rotate(.2deg);}
  8%{ transform:translateX(-5px);} 11%{ transform:translateX(5px);} 14%{ transform:translateX(-2px);} }

/* the Moby-Dick penance box */
#storm-wd .storm-wd-penance{ display:none; margin-top:12px; }
#storm-wd[data-phase="obnoxious"].show .storm-wd-penance{ display:block; }
#storm-wd.reveal .storm-wd-penance{ display:block; }
#storm-wd .storm-wd-phead{ font-size:12.5px; font-weight:700; opacity:.95; margin-bottom:7px; }
#storm-wd .storm-wd-target{ font-size:12.5px; line-height:1.5; background:rgba(0,0,0,.24);
  border:1px solid rgba(255,255,255,.22); border-radius:9px; padding:9px 12px; max-height:88px;
  overflow:auto; user-select:none; -webkit-user-select:none; opacity:.92; }
#storm-wd .storm-wd-input{ width:100%; box-sizing:border-box; margin-top:9px; resize:vertical;
  font:inherit; font-size:13.5px; line-height:1.45; color:#fff; background:rgba(0,0,0,.32);
  border:1px solid rgba(255,255,255,.45); border-radius:9px; padding:9px 12px; outline:none; }
#storm-wd .storm-wd-input::placeholder{ color:rgba(255,255,255,.55); }
#storm-wd .storm-wd-input:focus{ border-color:#fff; box-shadow:0 0 0 2px rgba(255,255,255,.25); }
#storm-wd .storm-wd-progwrap{ height:6px; background:rgba(0,0,0,.3); border-radius:4px; margin-top:9px; overflow:hidden; }
#storm-wd .storm-wd-progbar{ height:100%; width:0; background:#ffd9a0; border-radius:4px; transition:width .15s ease; }
#storm-wd .storm-wd-progbar.full{ background:#8be08b; }
#storm-wd .storm-wd-prog{ font-size:11.5px; font-weight:700; opacity:.9; margin-top:5px; text-align:right; }
#storm-wd .storm-wd-prog.warn{ color:#ffe08a; opacity:1; }

/* completion flourish */
#storm-wd.done .storm-wd-bar{ animation:none; background:linear-gradient(180deg,#2f8f6a,#227052); }
#storm-wd.done .storm-wd-veil{ opacity:0 !important; animation:none; }
#storm-wd.done .storm-wd-penance{ display:none; }

@media (prefers-reduced-motion: reduce){
  #storm-wd .storm-wd-bar,#storm-wd[data-phase="obnoxious"] .storm-wd-bar{ animation:none !important; }
  #storm-wd[data-phase="obnoxious"].show .storm-wd-veil{ animation:none; opacity:1; }
}
`;
    const style = document.createElement('style');
    style.id = 'storm-wd-style';
    style.textContent = css;
    document.head.appendChild(style);
    this.styleEl = style;
  }
}

module.exports = StormWindDown;
// exposed for offline tests (harmless to Obsidian, which uses the default export)
module.exports.__test = { norm, phaseOf, nightKey, prefixMatch, MOBY, MOBY_WORDS, MOBY_NORM,
  WINDDOWN_START, OBNOXIOUS_START, AUTO_OFF };
