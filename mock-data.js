/* ================================================================
   MOCK DATA LAYER
   ------------------------------------------------------------------
   This file stands in for Firebase. Every function here is written
   to match the shape it will have once a real backend is wired in,
   so swapping the internals later shouldn't change any calling code.

   PRODUCTION MAPPING:
   - MatchStore.subscribe()      -> onSnapshot(collection(db,'matches'), ...)
   - MatchStore.updateScore()    -> runTransaction() or updateDoc() with
                                     FieldValue.increment(delta), never
                                     read-then-write, so two scorekeepers
                                     tapping at once can't clobber each other
   - MatchStore.setStatus()      -> updateDoc(), value validated against
                                     ['upcoming','live','finished'] both
                                     client-side and in Firestore rules
   - MatchStore.upsertMatch()    -> setDoc()/addDoc()
   - AUTH.login()                -> signInWithEmailAndPassword()
   - AUTH.isLoggedIn()           -> onAuthStateChanged() + checking the
                                     signed-in UID against an allowlist
                                     (custom claim or an /admins collection)
   - localStorage 'storage' event -> replaced entirely by onSnapshot's
                                     real push updates across clients
   ================================================================ */

const STORAGE_KEY = 'sportsday_matches_v1';
const DEMO_AUTOPLAY = true; // flip off once a real backend drives updates

const SPORTS = [
  { id:'badminton', label:'Badminton', icon:'🏸', scoringType:'sets', categories:null },
  { id:'sepak_takraw', label:'Sepak Takraw', icon:'🟠', scoringType:'sets', categories:null },
  { id:'pickleball', label:'Pickleball', icon:'🎾', scoringType:'sets', categories:null },
  { id:'ping_pong', label:'Ping Pong', icon:'🏓', scoringType:'sets', categories:null },
  { id:'bola_tampar', label:'Bola Tampar', icon:'🏐', scoringType:'sets',
    categories:[{id:'lelaki',label:'Lelaki'},{id:'wanita',label:'Wanita'}] },
  { id:'futsal', label:'Futsal', icon:'⚽', scoringType:'simple',
    categories:[{id:'lelaki',label:'Lelaki'},{id:'wanita',label:'Wanita'},{id:'veteran',label:'Veteran'}] },
  { id:'petanque', label:'Petanque', icon:'🥎', scoringType:'simple', categories:null },
  { id:'karom', label:'Karom', icon:'🎱', scoringType:'simple', categories:null },
  { id:'dart', label:'Dart', icon:'🎯', scoringType:'countdown', startValue:501, categories:null },
];
// categories:null means the sport has one division, no selector needed.
// Icon honesty note: sepak_takraw, pickleball, petanque, karom have no
// exact Unicode emoji — these are reasonable stand-ins, swap freely.
const sportMeta = id => SPORTS.find(s => s.id === id) || { label:id, icon:'🏅' };
function isSetsSport(sportId){ return sportMeta(sportId).scoringType === 'sets'; }
function isCountdownSport(sportId){ return sportMeta(sportId).scoringType === 'countdown'; }
function countdownRemaining(sportId, scored){ return sportMeta(sportId).startValue - scored; }
function categoryLabel(sportId, categoryId){
  const meta = sportMeta(sportId);
  if(!meta.categories || !categoryId) return '';
  const c = meta.categories.find(c => c.id === categoryId);
  return c ? c.label : '';
}
function sportDisplayLabel(sportId, categoryId){
  const label = sportMeta(sportId).label;
  const cat = categoryLabel(sportId, categoryId);
  return cat ? `${label} (${cat})` : label;
}

const VENUES = [
  'Dewan Badminton, KSTA', 'Gelanggang 1, KSTA', 'Gelanggang 2, KSTA',
  'Gelanggang 3, KSTA', 'Gelanggang 4, KSTA', 'Gelanggang 5, KSTA',
  'Gelanggang Pickleball 1, KSTA', 'Gelanggang Pickleball 2, KSTA',
  'Gelanggang Pickleball 3, KSTA', 'Gelanggang Pickleball 4, KSTA',
  'Gelanggang Bola Tampar 5, KSTA', 'Gelanggang Bola Tampar 6, KSTA',
  'Bilik Dart, KSTA', 'Gelanggang Petanque, KSTA',
  'Gelanggang Futsal 1, KSTA', 'Gelanggang Futsal 3, KSTA',
  'Gelanggang Futsal 4, KSTA', 'Arena Futsal 1, KSTA', 'Arena Futsal 2, KSTA',
];

// EVENT_DAYS match the real PESAWI ke-13 schedule (3-6 Okt 2026).
const EVENT_DAYS = [
  '2026-10-03','2026-10-04','2026-10-05','2026-10-06',
];

// scoreA/scoreB on a sets-scoring match are a derived count of sets won,
// not directly editable — this is the only place that may write them.
function recomputeSetsSummary(m){
  m.scoreA = m.sets.filter(s => s.scoreA > s.scoreB).length;
  m.scoreB = m.sets.filter(s => s.scoreB > s.scoreA).length;
}

function seedMatches(){
  const now = Date.now();
  const matches = [
    // ---- Badminton (sets, no category) — finished w/ complete set record + live w/ sets in progress
    { id:'m1', sport:'badminton', category:null, venue:'Dewan Badminton, KSTA', date:'2026-10-03', groupA:'Rumah Merah', groupB:'Rumah Biru', scoreA:0, scoreB:0, sets:[{scoreA:21,scoreB:18},{scoreA:19,scoreB:21},{scoreA:21,scoreB:15}], status:'finished', tiktokLiveUrl:'', updatedAt:now },
    { id:'m2', sport:'badminton', category:null, venue:'Dewan Badminton, KSTA', date:'2026-10-04', groupA:'Rumah Kuning', groupB:'Rumah Hijau', scoreA:0, scoreB:0, sets:[{scoreA:21,scoreB:15},{scoreA:14,scoreB:17}], status:'live', tiktokLiveUrl:'https://www.tiktok.com/@sportsday.live/live', updatedAt:now },

    // ---- Sepak Takraw (sets, no category)
    { id:'m3', sport:'sepak_takraw', category:null, venue:'Gelanggang 1, KSTA', date:'2026-10-03', groupA:'Rumah Merah', groupB:'Rumah Kuning', scoreA:0, scoreB:0, sets:[], status:'upcoming', tiktokLiveUrl:'', updatedAt:now },
    { id:'m4', sport:'sepak_takraw', category:null, venue:'Gelanggang 2, KSTA', date:'2026-10-05', groupA:'Rumah Biru', groupB:'Rumah Hijau', scoreA:0, scoreB:0, sets:[{scoreA:21,scoreB:10},{scoreA:21,scoreB:14}], status:'finished', tiktokLiveUrl:'', updatedAt:now },

    // ---- Pickleball (sets, no category)
    { id:'m5', sport:'pickleball', category:null, venue:'Gelanggang Pickleball 1, KSTA', date:'2026-10-04', groupA:'Rumah Merah', groupB:'Rumah Hijau', scoreA:0, scoreB:0, sets:[], status:'upcoming', tiktokLiveUrl:'', updatedAt:now },
    { id:'m6', sport:'pickleball', category:null, venue:'Gelanggang Pickleball 2, KSTA', date:'2026-10-06', groupA:'Rumah Kuning', groupB:'Rumah Biru', scoreA:0, scoreB:0, sets:[{scoreA:11,scoreB:9},{scoreA:9,scoreB:11},{scoreA:11,scoreB:7}], status:'finished', tiktokLiveUrl:'', updatedAt:now },

    // ---- Ping Pong (sets, no category)
    { id:'m7', sport:'ping_pong', category:null, venue:'Gelanggang 3, KSTA', date:'2026-10-03', groupA:'Rumah Hijau', groupB:'Rumah Merah', scoreA:0, scoreB:0, sets:[], status:'upcoming', tiktokLiveUrl:'', updatedAt:now },
    { id:'m8', sport:'ping_pong', category:null, venue:'Gelanggang 4, KSTA', date:'2026-10-05', groupA:'Rumah Biru', groupB:'Rumah Kuning', scoreA:0, scoreB:0, sets:[], status:'upcoming', tiktokLiveUrl:'', updatedAt:now },

    // ---- Petanque (simple, no category)
    { id:'m9', sport:'petanque', category:null, venue:'Gelanggang Petanque, KSTA', date:'2026-10-04', groupA:'Rumah Merah', groupB:'Rumah Biru', scoreA:0, scoreB:0, sets:[], status:'upcoming', tiktokLiveUrl:'', updatedAt:now },
    { id:'m10', sport:'petanque', category:null, venue:'Gelanggang Petanque, KSTA', date:'2026-10-06', groupA:'Rumah Kuning', groupB:'Rumah Hijau', scoreA:13, scoreB:9, sets:[], status:'finished', tiktokLiveUrl:'', updatedAt:now },

    // ---- Karom (simple, no category)
    { id:'m11', sport:'karom', category:null, venue:'Gelanggang 5, KSTA', date:'2026-10-03', groupA:'Rumah Biru', groupB:'Rumah Merah', scoreA:0, scoreB:0, sets:[], status:'upcoming', tiktokLiveUrl:'', updatedAt:now },
    { id:'m12', sport:'karom', category:null, venue:'Gelanggang 5, KSTA', date:'2026-10-05', groupA:'Rumah Hijau', groupB:'Rumah Kuning', scoreA:4, scoreB:3, sets:[], status:'live', tiktokLiveUrl:'', updatedAt:now },

    // ---- Dart (countdown from 501, no category)
    { id:'m13', sport:'dart', category:null, venue:'Bilik Dart, KSTA', date:'2026-10-04', groupA:'Rumah Kuning', groupB:'Rumah Biru', scoreA:0, scoreB:0, sets:[], status:'upcoming', tiktokLiveUrl:'', updatedAt:now },
    { id:'m14', sport:'dart', category:null, venue:'Bilik Dart, KSTA', date:'2026-10-06', groupA:'Rumah Merah', groupB:'Rumah Hijau', scoreA:501, scoreB:410, sets:[], status:'finished', tiktokLiveUrl:'', updatedAt:now },

    // ---- Bola Tampar (sets, categories: lelaki/wanita) — one finished, one live w/ sets in progress
    { id:'m15', sport:'bola_tampar', category:'lelaki', venue:'Gelanggang Bola Tampar 5, KSTA', date:'2026-10-03', groupA:'Rumah Merah', groupB:'Rumah Kuning', scoreA:0, scoreB:0, sets:[{scoreA:25,scoreB:20},{scoreA:25,scoreB:18}], status:'finished', tiktokLiveUrl:'', updatedAt:now },
    { id:'m16', sport:'bola_tampar', category:'wanita', venue:'Gelanggang Bola Tampar 6, KSTA', date:'2026-10-05', groupA:'Rumah Biru', groupB:'Rumah Hijau', scoreA:0, scoreB:0, sets:[{scoreA:25,scoreB:22},{scoreA:18,scoreB:25}], status:'live', tiktokLiveUrl:'https://www.tiktok.com/@sportsday.live/live', updatedAt:now },

    // ---- Futsal (simple, categories: lelaki/wanita/veteran) — all 3 categories finished,
    // Lelaki kept as the required draw case
    { id:'m17', sport:'futsal', category:'lelaki', venue:'Gelanggang Futsal 1, KSTA', date:'2026-10-04', groupA:'Rumah Kuning', groupB:'Rumah Merah', scoreA:3, scoreB:3, sets:[], status:'finished', tiktokLiveUrl:'', updatedAt:now },
    { id:'m18', sport:'futsal', category:'wanita', venue:'Gelanggang Futsal 3, KSTA', date:'2026-10-06', groupA:'Rumah Biru', groupB:'Rumah Hijau', scoreA:2, scoreB:1, sets:[], status:'finished', tiktokLiveUrl:'', updatedAt:now },
    { id:'m19', sport:'futsal', category:'veteran', venue:'Arena Futsal 1, KSTA', date:'2026-10-03', groupA:'Rumah Hijau', groupB:'Rumah Biru', scoreA:4, scoreB:2, sets:[], status:'finished', tiktokLiveUrl:'', updatedAt:now },
  ];
  // derive scoreA/scoreB from the sets array for every sets-scoring match,
  // instead of hand-computing them above where a typo could desync the two
  matches.forEach(m => { if(isSetsSport(m.sport)) recomputeSetsSummary(m); });
  return matches;
}

function loadMatches(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw) return JSON.parse(raw);
  }catch(e){ /* fall through to reseed */ }
  const seeded = seedMatches();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}

function saveMatches(matches){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(matches));
}

const MatchStore = (() => {
  let matches = loadMatches();
  const listeners = new Set();

  function notify(){
    listeners.forEach(cb => cb(matches.slice()));
  }

  // cross-tab sync: fires in every OTHER tab when this tab (or the
  // real Firestore listener, later) writes a change — this is the
  // stand-in for onSnapshot's live push.
  window.addEventListener('storage', e => {
    if(e.key === STORAGE_KEY){
      matches = loadMatches();
      notify();
    }
  });

  function persist(){
    saveMatches(matches);
    notify(); // same-tab listeners re-render immediately
  }

  return {
    subscribe(callback){
      listeners.add(callback);
      callback(matches.slice()); // immediate fire, like onSnapshot's first read
      return () => listeners.delete(callback);
    },

    getById(id){
      return matches.find(m => m.id === id) || null;
    },

    updateScore(id, team, delta){
      const m = matches.find(x => x.id === id);
      if(!m) return;
      const key = team === 'home' ? 'scoreA' : 'scoreB';
      m[key] = Math.max(0, m[key] + delta); // == FieldValue.increment(delta) in a transaction
      m.updatedAt = Date.now();
      persist();
    },

    setScore(id, team, value){
      const m = matches.find(x => x.id === id);
      if(!m) return;
      const key = team === 'home' ? 'scoreA' : 'scoreB';
      m[key] = Math.max(0, parseInt(value, 10) || 0);
      m.updatedAt = Date.now();
      persist();
    },

    setStatus(id, status){
      if(!['upcoming','live','finished'].includes(status)) return; // mirrors Firestore rules validation
      const m = matches.find(x => x.id === id);
      if(!m) return;
      m.status = status;
      m.updatedAt = Date.now();
      persist();
    },

    addSet(id){
      const m = matches.find(x => x.id === id);
      if(!m || m.sets.length >= 5) return; // hard cap, silent no-op past that
      m.sets.push({ scoreA:0, scoreB:0 });
      recomputeSetsSummary(m);
      m.updatedAt = Date.now();
      persist();
    },

    removeSet(id, setIndex){
      const m = matches.find(x => x.id === id);
      if(!m || !m.sets[setIndex]) return;
      m.sets.splice(setIndex, 1);
      recomputeSetsSummary(m);
      m.updatedAt = Date.now();
      persist();
    },

    setSetScore(id, setIndex, team, value){
      const m = matches.find(x => x.id === id);
      if(!m || !m.sets[setIndex]) return;
      const key = team === 'home' ? 'scoreA' : 'scoreB';
      m.sets[setIndex][key] = Math.max(0, parseInt(value, 10) || 0);
      recomputeSetsSummary(m);
      m.updatedAt = Date.now();
      persist();
    },

    addThrow(matchId, team, points){
      const m = matches.find(x => x.id === matchId);
      if(!m) return;
      const meta = sportMeta(m.sport);
      const key = team === 'home' ? 'scoreA' : 'scoreB';
      const attempted = m[key] + points;
      if(attempted > meta.startValue) return; // bust rule: throw doesn't count, no error shown, just ignored
      m[key] = attempted;
      m.updatedAt = Date.now();
      persist();
    },

    upsertMatch(data){
      if(data.id){
        const m = matches.find(x => x.id === data.id);
        if(m){ Object.assign(m, data, { updatedAt: Date.now() }); persist(); return m; }
      }
      const newMatch = {
        id: 'm' + Math.random().toString(36).slice(2,9),
        scoreA:0, scoreB:0, status:'upcoming', tiktokLiveUrl:'', category:null, sets:[],
        ...data,
        updatedAt: Date.now(),
      };
      matches.push(newMatch);
      persist();
      return newMatch;
    },

    all(){ return matches.slice(); },
  };
})();

// ---- lightweight demo simulator so the public page shows real motion
// even with nobody in the Admin tab. Uses the same store methods a real
// scorekeeper action would use, so it's indistinguishable to listeners. ----
if(DEMO_AUTOPLAY){
  setInterval(() => {
    // sets-scoring matches are excluded: their scoreA/scoreB are derived from
    // the sets array (see recomputeSetsSummary) — ticking them directly here
    // would desync the two and show impossible "set" counts.
    // countdown-scoring matches are excluded too: updateScore() has no bust
    // check, so blind increments here could push a dart score past 501.
    const liveMatches = MatchStore.all().filter(m => m.status === 'live' && !isSetsSport(m.sport) && !isCountdownSport(m.sport));
    if(liveMatches.length === 0) return;
    const target = liveMatches[Math.floor(Math.random() * liveMatches.length)];
    const team = Math.random() > 0.5 ? 'home' : 'away';
    const points = Math.random() > 0.7 ? 2 : 1;
    MatchStore.updateScore(target.id, team, points);
  }, 9000);
}

/* ================================================================
   AUTH — mock scorekeeper login
   Fixed allowlist stands in for Firebase Auth + an admin allowlist
   ================================================================ */
const AUTH = (() => {
  const SCOREKEEPERS = [
    { email:'scorekeeper1@example.com', password:'demo1234' },
    { email:'scorekeeper2@example.com', password:'demo1234' },
  ];
  const SESSION_KEY = 'sportsday_admin_session';

  return {
    login(email, password){
      const match = SCOREKEEPERS.find(s => s.email === email.trim().toLowerCase() && s.password === password);
      if(!match) return false;
      sessionStorage.setItem(SESSION_KEY, match.email);
      return true;
    },
    isLoggedIn(){ return !!sessionStorage.getItem(SESSION_KEY); },
    currentUser(){ return sessionStorage.getItem(SESSION_KEY); },
    logout(){ sessionStorage.removeItem(SESSION_KEY); },
  };
})();

/* ================================================================
   SHARED HELPERS
   ================================================================ */
const MS_WEEKDAYS = ['Ahad','Isnin','Selasa','Rabu','Khamis','Jumaat','Sabtu']; // index = Date.getDay()
const MS_MONTHS = ['Jan','Feb','Mac','Apr','Mei','Jun','Jul','Ogos','Sep','Okt','Nov','Dis'];

function dayLabel(iso){
  const idx = EVENT_DAYS.indexOf(iso);
  const d = new Date(iso + 'T00:00:00');
  const weekday = MS_WEEKDAYS[d.getDay()];
  const short = `${weekday}, ${d.getDate()} ${MS_MONTHS[d.getMonth()]}`;
  return { dayNumber: idx + 1, short };
}

function statusBadgeHTML(status){
  const map = {
    live:{ cls:'badge--live', text:'Langsung' },
    upcoming:{ cls:'badge--upcoming', text:'Akan Datang' },
    finished:{ cls:'badge--finished', text:'Selesai' },
  };
  const s = map[status] || map.upcoming;
  return `<span class="badge ${s.cls}"><span class="dot"></span>${s.text}</span>`;
}

function tiktokIconSVG(){
  // Generic play-triangle glyph — deliberately not a reproduction of any platform's logo.
  return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.6c0-1.1 1.2-1.8 2.1-1.2l11 6.9a1.4 1.4 0 0 1 0 2.4l-11 6.9c-.9.6-2.1-.1-2.1-1.2V4.6Z"/></svg>`;
}

// Scorekeeper-entered fields (team names, venue, TikTok URL) are free text
// that flows straight into innerHTML on public pages — escape before display.
function escapeHtml(str){
  if(str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeUrl(url){
  if(!url) return '';
  try {
    const parsed = new URL(url, window.location.href);
    if(parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.href;
  } catch(e) {}
  return ''; // anything that isn't a real http(s) URL becomes no link at all
}

/* ================================================================
   ADMIN MATCH RENDERING — shared between admin.html (all matches) and
   admin-sport.html (one sport/category at a time). Relocated out of
   admin.html unchanged so both pages render and wire identically
   instead of duplicating this logic.
   ================================================================ */
function simpleScorePanelHTML(m){
  return `
  <div class="score-panel">
    <div class="score-control">
      <span class="score-control__team">${escapeHtml(m.groupA)}</span>
      <div class="score-control__row">
        <button class="icon-btn icon-btn--minus" data-score-action="dec" data-team="home" aria-label="Decrease ${escapeHtml(m.groupA)} score">&minus;</button>
        <span class="score-control__value">${m.scoreA}</span>
        <button class="icon-btn icon-btn--plus" data-score-action="inc" data-team="home" aria-label="Increase ${escapeHtml(m.groupA)} score">+</button>
      </div>
      <div class="score-set">
        <input type="number" min="0" data-set-input data-team="home" value="${m.scoreA}" aria-label="Set ${escapeHtml(m.groupA)} score" />
        <button class="btn btn--ghost btn--sm" data-set-action data-team="home" type="button">Tetapkan</button>
      </div>
    </div>
    <div class="score-control">
      <span class="score-control__team">${escapeHtml(m.groupB)}</span>
      <div class="score-control__row">
        <button class="icon-btn icon-btn--minus" data-score-action="dec" data-team="away" aria-label="Decrease ${escapeHtml(m.groupB)} score">&minus;</button>
        <span class="score-control__value">${m.scoreB}</span>
        <button class="icon-btn icon-btn--plus" data-score-action="inc" data-team="away" aria-label="Increase ${escapeHtml(m.groupB)} score">+</button>
      </div>
      <div class="score-set">
        <input type="number" min="0" data-set-input data-team="away" value="${m.scoreB}" aria-label="Set ${escapeHtml(m.groupB)} score" />
        <button class="btn btn--ghost btn--sm" data-set-action data-team="away" type="button">Tetapkan</button>
      </div>
    </div>
  </div>`;
}

function setsScorePanelHTML(m){
  const rows = m.sets.map((s, i) => `
    <div class="set-row" data-set-index="${i}" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
      <span class="muted" style="min-width:44px;">Set ${i+1}</span>
      <input type="number" min="0" class="input" style="width:64px; text-align:center;" data-set-score data-team="home" data-set-index="${i}" value="${s.scoreA}" aria-label="Set ${i+1} skor ${escapeHtml(m.groupA)}" />
      <span class="muted">–</span>
      <input type="number" min="0" class="input" style="width:64px; text-align:center;" data-set-score data-team="away" data-set-index="${i}" value="${s.scoreB}" aria-label="Set ${i+1} skor ${escapeHtml(m.groupB)}" />
      <button class="icon-btn" data-remove-set data-set-index="${i}" type="button" aria-label="Buang Set ${i+1}" style="margin-left:auto;">&times;</button>
    </div>`).join('');
  return `
  <div class="score-panel" style="flex-direction:column; align-items:stretch; gap:var(--sp-3);">
    <div class="muted" style="font-weight:700; color:var(--ink-800);">Set dimenangi: <span style="font-family:var(--font-display); font-size:1.1rem; color:var(--maroon-800);">${m.scoreA}–${m.scoreB}</span></div>
    <div style="display:flex; flex-direction:column; gap:8px;">
      ${rows || `<p class="muted" style="margin:0;">Belum ada set direkodkan.</p>`}
    </div>
    <button class="btn btn--ghost btn--sm" data-add-set type="button" ${m.sets.length >= 5 ? 'disabled' : ''}>+ Tambah Set</button>
  </div>`;
}

function countdownScorePanelHTML(m){
  const teamBlock = (team, groupName, scored) => `
    <div class="score-control">
      <span class="score-control__team">${escapeHtml(groupName)}</span>
      <div style="font-family:var(--font-display); font-weight:700; font-size:2rem; color:var(--maroon-800);">
        Baki: <span data-countdown-display data-team="${team}">${countdownRemaining(m.sport, scored)}</span>
      </div>
      <div style="display:flex; gap:6px; align-items:center;">
        <input type="number" min="0" class="input" style="width:84px; text-align:center;" data-throw-input data-team="${team}" placeholder="Mata" aria-label="Mata lontaran ${escapeHtml(groupName)}" />
        <button class="btn btn--ghost btn--sm" data-add-throw data-team="${team}" type="button">Tambah Lontaran</button>
      </div>
      <p class="muted" data-bust-message data-team="${team}" style="display:none; color:var(--live); margin:0;">Bust — lontaran tidak dikira</p>
    </div>`;
  return `
  <div class="score-panel">
    ${teamBlock('home', m.groupA, m.scoreA)}
    ${teamBlock('away', m.groupB, m.scoreB)}
  </div>`;
}

function adminMatchHTML(m){
  const meta = sportMeta(m.sport);
  const { dayNumber, short } = dayLabel(m.date);
  const displayLabel = sportDisplayLabel(m.sport, m.category);
  return `
  <div class="card admin-match" data-id="${m.id}">
    <div class="ribbon ribbon--${m.status}"></div>
    <div class="admin-match__top">
      <div class="admin-match__info">
        <span class="sport-icon">${meta.icon}</span>
        <div class="admin-match__names">
          <strong>${escapeHtml(m.groupA)} vs ${escapeHtml(m.groupB)}</strong>
          <span class="admin-match__meta">${displayLabel} · ${escapeHtml(m.venue)} · Hari ${dayNumber} · ${short}${m.tiktokLiveUrl ? ' · 🔗 ada pautan siaran' : ''}</span>
        </div>
      </div>
      <div class="segmented">
        <button type="button" data-status="upcoming" class="${m.status==='upcoming'?'is-active':''}">Upcoming</button>
        <button type="button" data-status="live" class="${m.status==='live'?'is-active':''}">Live</button>
        <button type="button" data-status="finished" class="${m.status==='finished'?'is-active':''}">Finished</button>
      </div>
    </div>

    ${isSetsSport(m.sport) ? setsScorePanelHTML(m) : isCountdownSport(m.sport) ? countdownScorePanelHTML(m) : simpleScorePanelHTML(m)}

    <div class="admin-match__actions">
      <button class="btn btn--ghost btn--sm" data-edit type="button">Edit Butiran</button>
      <a class="btn btn--ghost btn--sm" href="schedule.html#match-${m.id}" target="_blank">Lihat Kad Awam ↗</a>
    </div>
  </div>`;
}

// toast feedback — shared by any page that calls wireAdminMatchEvents.
// Requires a `<div class="toast-stack" id="toastStack"></div>` on the page;
// no-ops harmlessly if that element isn't present.
function showToast(msg){
  const stack = document.getElementById('toastStack');
  if(!stack) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>${msg}`;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

// Wires every match-card interaction (status toggle, score +/-, set
// add/remove/score, throw entry, edit) via event delegation on containerEl.
// Reused by every admin page that renders adminMatchHTML() cards.
// onEdit(match) fires when "Edit Butiran" is clicked — admin.html passes a
// callback that opens its local form modal; admin-sport.html (which has no
// form modal) passes one that navigates to admin.html instead.
function wireAdminMatchEvents(containerEl, onEdit){
  containerEl.addEventListener('click', e => {
    const card = e.target.closest('[data-id]');
    if(!card) return;
    const id = card.dataset.id;

    const statusBtn = e.target.closest('[data-status]');
    if(statusBtn){ MatchStore.setStatus(id, statusBtn.dataset.status); showToast('Status dikemas kini'); return; }

    const scoreBtn = e.target.closest('[data-score-action]');
    if(scoreBtn){
      const delta = scoreBtn.dataset.scoreAction === 'inc' ? 1 : -1;
      MatchStore.updateScore(id, scoreBtn.dataset.team, delta);
      return;
    }

    const setBtn = e.target.closest('[data-set-action]');
    if(setBtn){
      const team = setBtn.dataset.team;
      const input = card.querySelector(`[data-set-input][data-team="${team}"]`);
      MatchStore.setScore(id, team, input.value);
      showToast('Skor ditetapkan');
      return;
    }

    const addSetBtn = e.target.closest('[data-add-set]');
    if(addSetBtn){ MatchStore.addSet(id); return; }

    const removeSetBtn = e.target.closest('[data-remove-set]');
    if(removeSetBtn){ MatchStore.removeSet(id, parseInt(removeSetBtn.dataset.setIndex, 10)); return; }

    const addThrowBtn = e.target.closest('[data-add-throw]');
    if(addThrowBtn){
      const team = addThrowBtn.dataset.team;
      const input = card.querySelector(`[data-throw-input][data-team="${team}"]`);
      const bustMsg = card.querySelector(`[data-bust-message][data-team="${team}"]`);
      const points = parseInt(input.value, 10) || 0;
      const match = MatchStore.getById(id);
      const meta = sportMeta(match.sport);
      const key = team === 'home' ? 'scoreA' : 'scoreB';
      const attempted = match[key] + points;
      if(attempted > meta.startValue){
        if(bustMsg){
          bustMsg.style.display = 'block';
          clearTimeout(bustMsg._hideTimer);
          bustMsg._hideTimer = setTimeout(() => { bustMsg.style.display = 'none'; }, 2500);
        }
        return;
      }
      MatchStore.addThrow(id, team, points);
      input.value = '';
      showToast('Lontaran ditambah');
      return;
    }

    const editBtn = e.target.closest('[data-edit]');
    if(editBtn){ if(typeof onEdit === 'function') onEdit(MatchStore.getById(id)); return; }
  });

  containerEl.addEventListener('change', e => {
    const card = e.target.closest('[data-id]');
    if(!card) return;
    const setInput = e.target.closest('[data-set-score]');
    if(setInput){
      MatchStore.setSetScore(card.dataset.id, parseInt(setInput.dataset.setIndex, 10), setInput.dataset.team, setInput.value);
      showToast('Skor set dikemas kini');
    }
  });
}

/* ================================================================
   STANDINGS COMPUTATION — shared between standings.html (all sports)
   and sport.html (one sport/category, via pre-filtered input). Relocated
   out of standings.html unchanged: still takes only a matches array and
   returns the same ranked output, with no sport-filtering added inside
   it — callers decide what subset of matches to pass in.
   ================================================================ */
// perSport breakdown is keyed by sport+category combined, so e.g. Futsal
// Lelaki/Wanita/Veteran get separate W-D-L tallies instead of one blended
// "Futsal" bucket. categoryId is null for sports with no divisions.
function sportCatKey(sportId, categoryId){ return sportId + (categoryId ? '::' + categoryId : ''); }

function computeStandings(matches){
  const houses = {};
  function ensure(name){
    if(!houses[name]) houses[name] = { name, wins:0, draws:0, losses:0, points:0, perSport:{} };
    return houses[name];
  }
  matches.filter(m => m.status === 'finished').forEach(m => {
    const a = ensure(m.groupA), b = ensure(m.groupB);
    const key = sportCatKey(m.sport, m.category);
    if(!a.perSport[key]) a.perSport[key] = {w:0,d:0,l:0};
    if(!b.perSport[key]) b.perSport[key] = {w:0,d:0,l:0};
    if(m.scoreA > m.scoreB){ a.wins++; a.points+=2; b.losses++; a.perSport[key].w++; b.perSport[key].l++; }
    else if(m.scoreA < m.scoreB){ b.wins++; b.points+=2; a.losses++; b.perSport[key].w++; a.perSport[key].l++; }
    else { a.draws++; b.draws++; a.points++; b.points++; a.perSport[key].d++; b.perSport[key].d++; }
  });
  return Object.values(houses).sort((x,y) =>
    y.points - x.points || y.wins - x.wins || x.name.localeCompare(y.name));
}

/* ================================================================
   PUBLIC MATCH CARD — shared between index.html (live strip) and
   sport.html (this sport/category's live matches). Relocated out of
   index.html unchanged. NOTE: still uses plain sportMeta().label, not
   sportDisplayLabel() — kept byte-identical to index.html's current
   output for this move. schedule.html has its own separate card
   renderer (opens a modal instead of linking) and was left untouched.
   ================================================================ */
function publicMatchCardHTML(m){
  const meta = sportMeta(m.sport);
  return `
  <a class="card match-card" href="schedule.html#match-${m.id}" style="text-decoration:none;">
    <div class="ribbon ribbon--${m.status}"></div>
    <div class="match-card__body">
      <div class="match-card__top">
        <span class="sport-tag"><span class="sport-icon">${meta.icon}</span>${meta.label}</span>
        ${statusBadgeHTML(m.status)}
      </div>
      <div class="match-card__teams">
        <span class="team-name">${escapeHtml(m.groupA)}</span>
        <div class="score-display score-display--card">
          <span>${m.scoreA}</span><span class="vs-sep">–</span><span>${m.scoreB}</span>
        </div>
        <span class="team-name team-name--b">${escapeHtml(m.groupB)}</span>
      </div>
      <div class="match-card__meta">
        <span class="meta-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.3"/></svg>
          ${escapeHtml(m.venue)}
        </span>
      </div>
    </div>
  </a>`;
}
