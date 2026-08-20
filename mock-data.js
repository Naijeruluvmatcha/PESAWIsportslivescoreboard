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

// bump this version suffix whenever seedMatches()'s shape or content changes,
// or old cached localStorage data will silently keep showing instead of it.
// v3: clear all mock data for real production use — seedMatches() now
// returns [] instead of the demo match list, so this bump abandons any
// v2 (or earlier) cached data still sitting in a browser's localStorage.
const STORAGE_KEY = 'sportsday_matches_v3';

// racquet/cue/throw sports that share the 5-category MS/WS/MD/WD/XD split
const RACQUET_CATEGORIES = [
  { id:'MS', label:'Perseorangan Lelaki' },
  { id:'WS', label:'Perseorangan Wanita' },
  { id:'MD', label:'Beregu Lelaki' },
  { id:'WD', label:'Beregu Wanita' },
  { id:'XD', label:'Beregu Campuran' },
];

const SPORTS = [
  { id:'badminton', label:'Badminton', icon:'🏸', scoringType:'sets', isTieAggregated:true, categories:RACQUET_CATEGORIES },
  { id:'sepak_takraw', label:'Sepak Takraw', icon:'🟠', scoringType:'sets', maxSetScore:17, isTieAggregated:false,
    categories:[{id:'MT',label:'Pasukan Lelaki'},{id:'WT',label:'Pasukan Wanita'}] },
  { id:'pickleball', label:'Pickleball', icon:'🎾', scoringType:'sets', isTieAggregated:true, categories:RACQUET_CATEGORIES },
  { id:'ping_pong', label:'Ping Pong', icon:'🏓', scoringType:'sets', isTieAggregated:true, categories:RACQUET_CATEGORIES },
  { id:'bola_tampar', label:'Bola Tampar', icon:'🏐', scoringType:'sets', isTieAggregated:false,
    categories:[{id:'lelaki',label:'Lelaki'},{id:'wanita',label:'Wanita'}] },
  { id:'futsal', label:'Futsal', icon:'⚽', scoringType:'simple', scoreIncrements:[1], isTieAggregated:false,
    categories:[{id:'lelaki',label:'Lelaki'},{id:'wanita',label:'Wanita'},{id:'veteran',label:'Veteran'}] },
  { id:'petanque', label:'Petanque', icon:'🥎', scoringType:'simple', scoreIncrements:[1,5], isTieAggregated:false,
    categories:[{id:'MS',label:'Perseorangan Lelaki'},{id:'WS',label:'Perseorangan Wanita'},{id:'MX',label:'Tiga Beregu Campuran'}] },
  { id:'karom', label:'Karom', icon:'🎱', scoringType:'simple', scoreIncrements:[1,5], isTieAggregated:true, categories:RACQUET_CATEGORIES },
  { id:'dart', label:'Dart', icon:'🎯', scoringType:'countdown', startValue:501, isTieAggregated:true, categories:RACQUET_CATEGORIES },
];
// isTieAggregated: Phase B will use this to know which sports combine their
// categories into a single tie result between two zones, instead of scoring
// each category as an independent standalone match. Not consumed anywhere
// yet in this pass — just establishing the field so Phase B doesn't need
// another SPORTS-array edit.
// scoreIncrements (simple-scoring sports only) drives which quick-add
// buttons the admin score panel shows. Futsal is [1] only — a goal is
// always worth exactly 1, so a ±5 button there would be a data-entry
// hazard, not a convenience. Petanque/Karom get [1,5] as a flexible
// data-entry speed option, not because ±5 is a confirmed real scoring
// unit for those sports.
// maxSetScore (sets-scoring sports only) is an optional per-sport ceiling
// on a single set's score, enforced in setSetScore()/adjustSetScore()
// below. Sepak Takraw's 17-point set is a confirmed, stable rule, so it's
// capped. Badminton deliberately has none: the sport is currently
// mid-transition between two competing official point formats, and
// capping either wrong number would block a real, valid score.
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

// the 5 real PESAWI zones (Sabah districts) — single source of truth for
// every groupA/groupB value; replaces the old 4 placeholder house names.
const ZONES = ['KK', 'Tawau', 'Sandakan', 'Lahad Datu', 'Keningau'];

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

// Shared by setSetScore() and adjustSetScore() so the ceiling logic exists
// in exactly one place. Ceiling only applies where a maxSetScore is
// confirmed for that sport (currently just Sepak Takraw's 17) — everything
// else only floors at 0, same as every other score-writing method here.
function clampSetScore(sportId, value){
  const maxSetScore = sportMeta(sportId).maxSetScore;
  const floored = Math.max(0, value);
  return maxSetScore != null ? Math.min(floored, maxSetScore) : floored;
}

// Emptied for real production use — this used to return ~30 demo matches
// across every sport/category (badminton, futsal, etc.) for development
// and screenshots. The function itself stays so loadMatches()/localStorage
// initialization keeps working unchanged; it just seeds nothing now.
function seedMatches(){
  return [];
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
      m.sets[setIndex][key] = clampSetScore(m.sport, parseInt(value, 10) || 0);
      recomputeSetsSummary(m);
      m.updatedAt = Date.now();
      persist();
    },

    // Delta-based, same read-modify-write-in-one-call pattern as
    // updateScore()/addThrow() above (not "read current, compute client-side,
    // call setSetScore with the result") — that keeps two scorekeepers
    // tapping +1 on the same set at once from clobbering each other, same
    // reason updateScore() itself is delta-based instead of read-then-write.
    adjustSetScore(id, setIndex, team, delta){
      const m = matches.find(x => x.id === id);
      if(!m || !m.sets[setIndex]) return;
      const key = team === 'home' ? 'scoreA' : 'scoreB';
      m.sets[setIndex][key] = clampSetScore(m.sport, m.sets[setIndex][key] + delta);
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

    // Real delete, not a soft-delete flag — a single match record, and the
    // git checkpoint already covers catastrophic recovery if ever needed.
    deleteMatch(id){
      const idx = matches.findIndex(x => x.id === id);
      if(idx === -1) return false;
      matches.splice(idx, 1);
      persist();
      return true;
    },

    all(){ return matches.slice(); },
  };
})();

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
  // sport-specific quick-add magnitudes — see the scoreIncrements comment
  // on the SPORTS array for why Futsal only gets ±1
  const increments = sportMeta(m.sport).scoreIncrements || [1];
  const descending = [...increments].sort((a, b) => b - a); // decrement row: largest magnitude first (−5 −1)
  const ascending = [...increments].sort((a, b) => a - b);  // increment row: smallest first (+1 +5)

  function teamBlock(team, groupName, score){
    const decButtons = descending.map(n => `
        <button class="icon-btn icon-btn--minus" data-score-delta="${-n}" data-team="${team}" aria-label="Decrease ${escapeHtml(groupName)} score${n === 1 ? '' : ` by ${n}`}">${n === 1 ? '&minus;' : `−${n}`}</button>`).join('');
    const incButtons = ascending.map(n => `
        <button class="icon-btn icon-btn--plus" data-score-delta="${n}" data-team="${team}" aria-label="Increase ${escapeHtml(groupName)} score${n === 1 ? '' : ` by ${n}`}">${n === 1 ? '+' : `+${n}`}</button>`).join('');
    // left border in the zone's own color — same zoneColor() used on
    // standings.html/sport.html, not a separate copy of that lookup
    return `
    <div class="score-control" style="border-left:3px solid ${zoneColor(groupName)}; padding-left:var(--sp-3);">
      <span class="score-control__team">${escapeHtml(groupName)}</span>
      <div class="score-control__row">
        ${decButtons}
        <span class="score-control__value">${score}</span>
        ${incButtons}
      </div>
      <div class="score-set">
        <input type="number" min="0" data-set-input data-team="${team}" value="${score}" aria-label="Set ${escapeHtml(groupName)} score" />
        <button class="btn btn--ghost btn--sm" data-set-action data-team="${team}" type="button">Tetapkan</button>
      </div>
    </div>`;
  }

  return `
  <div class="score-panel">
    ${teamBlock('home', m.groupA, m.scoreA)}
    ${teamBlock('away', m.groupB, m.scoreB)}
  </div>`;
}

function setsScorePanelHTML(m){
  // +1/−1 pair per box, alongside the existing direct-type input — additive
  // fast path for tapping through a live set point-by-point; typing the
  // final number is still the better choice for an already-finished set.
  // +1 respects maxSetScore where one exists (Sepak Takraw 17), −1
  // respects the same 0 floor as everywhere else in this file.
  const setInputGroup = (team, groupName, setIndex, value) => `
      <div style="display:flex; align-items:center; gap:4px; min-height:44px;">
        <span class="muted" style="min-width:36px; white-space:nowrap;">Set ${setIndex+1}</span>
        <button class="icon-btn icon-btn--minus" data-set-score-delta="-1" data-team="${team}" data-set-index="${setIndex}" type="button" aria-label="Kurangkan skor set ${setIndex+1} ${escapeHtml(groupName)}">&minus;</button>
        <input type="number" min="0" class="input" style="width:64px; text-align:center;" data-set-score data-team="${team}" data-set-index="${setIndex}" value="${value}" aria-label="Set ${setIndex+1} skor ${escapeHtml(groupName)}" />
        <button class="icon-btn icon-btn--plus" data-set-score-delta="1" data-team="${team}" data-set-index="${setIndex}" type="button" aria-label="Tambah skor set ${setIndex+1} ${escapeHtml(groupName)}">+</button>
      </div>`;

  const removeSetRow = setIndex => `
      <div style="display:flex; align-items:center; justify-content:center; min-height:44px;">
        <button class="icon-btn" data-remove-set data-set-index="${setIndex}" type="button" aria-label="Buang Set ${setIndex+1}">&times;</button>
      </div>`;

  const addSetRow = `
      <div style="display:flex; align-items:center; justify-content:center; min-height:44px;">
        <button class="btn btn--ghost btn--sm" data-add-set type="button" ${m.sets.length >= 5 ? 'disabled' : ''}>+ Tambah Set</button>
      </div>`;

  // "+ Tambah Set" is a standalone action for the whole match, not tied to
  // any one set row — it renders after every × in the center column
  // (below all of them, or alone if there are no sets yet), never
  // interleaved between them.
  const n = m.sets.length;
  const leftRows = [], centerRows = [], rightRows = [];
  for(let i = 0; i < n; i++){
    leftRows.push(setInputGroup('home', m.groupA, i, m.sets[i].scoreA));
    centerRows.push(removeSetRow(i));
    rightRows.push(setInputGroup('away', m.groupB, i, m.sets[i].scoreB));
  }
  centerRows.push(addSetRow);

  // zone-colored column headings — same zoneColor()/escapeHtml() used
  // everywhere else a zone name renders. Replaces the earlier standalone
  // header-row version from the previous prompt now that the columns
  // themselves carry the color; that header is gone, not duplicated.
  const heading = color => `min-height:28px; display:flex; align-items:center; border-left:3px solid ${color}; padding-left:var(--sp-2); font-weight:700; font-size:0.82rem; color:var(--ink-800);`;

  return `
  <div class="score-panel" style="flex-direction:column; align-items:stretch; gap:var(--sp-3);">
    <div class="muted" style="font-weight:700; color:var(--ink-800);">Set dimenangi: <span style="font-family:var(--font-display); font-size:1.1rem; color:var(--maroon-800);">${m.scoreA}–${m.scoreB}</span></div>
    <div class="sets-columns">
      <div class="sets-columns__team sets-columns__team--a" style="display:flex; flex-direction:column; gap:8px;">
        <div style="${heading(zoneColor(m.groupA))}">${escapeHtml(m.groupA)}</div>
        ${leftRows.join('')}
      </div>
      <div style="display:flex; flex-direction:column; gap:8px; align-items:center;">
        <div style="min-height:28px;"></div>
        ${centerRows.join('')}
      </div>
      <div class="sets-columns__team sets-columns__team--b" style="display:flex; flex-direction:column; gap:8px;">
        <div style="${heading(zoneColor(m.groupB))}">${escapeHtml(m.groupB)}</div>
        ${rightRows.join('')}
      </div>
    </div>
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
    ${m.status === 'live' ? '<div class="ribbon ribbon--live"></div>' : ''}
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
      <button class="btn btn--danger btn--sm" data-delete type="button">Padam</button>
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
// add/remove/score, throw entry, edit, delete) via event delegation on
// containerEl. Reused by every admin page that renders adminMatchHTML()
// cards. onEdit(match) fires when "Edit Butiran" is clicked — both
// admin.html and admin-sport.html now pass a callback that opens the
// shared match-form modal (see wireMatchForm() below) with that match's
// data. Delete is handled entirely inside this function (confirm + call).
function wireAdminMatchEvents(containerEl, onEdit){
  containerEl.addEventListener('click', e => {
    const card = e.target.closest('[data-id]');
    if(!card) return;
    const id = card.dataset.id;

    const statusBtn = e.target.closest('[data-status]');
    if(statusBtn){ MatchStore.setStatus(id, statusBtn.dataset.status); showToast('Status dikemas kini'); return; }

    const scoreBtn = e.target.closest('[data-score-delta]');
    if(scoreBtn){
      // magnitude comes from the button itself now (±1 or ±5 depending on
      // sport — see SPORTS[].scoreIncrements), not a hardcoded ±1.
      // MatchStore.updateScore()'s own Math.max(0, ...) clamp already
      // floors correctly for any delta size, nothing extra needed here.
      const delta = parseInt(scoreBtn.dataset.scoreDelta, 10);
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

    const setScoreDeltaBtn = e.target.closest('[data-set-score-delta]');
    if(setScoreDeltaBtn){
      const delta = parseInt(setScoreDeltaBtn.dataset.setScoreDelta, 10);
      const setIndex = parseInt(setScoreDeltaBtn.dataset.setIndex, 10);
      MatchStore.adjustSetScore(id, setIndex, setScoreDeltaBtn.dataset.team, delta);
      return;
    }

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

    const deleteBtn = e.target.closest('[data-delete]');
    if(deleteBtn){
      const match = MatchStore.getById(id);
      if(!match) return;
      const label = `${match.groupA} vs ${match.groupB} — ${sportDisplayLabel(match.sport, match.category)}`;
      if(confirm(`Padam ${label}?`)){
        MatchStore.deleteMatch(id);
        showToast('Perlawanan dipadam');
      }
      return;
    }
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

  // Enter on either a Darts throw input or a simple-sport direct-score
  // input triggers that field's own confirm button ("Tambah Lontaran" /
  // "Tetapkan") via a real .click() — reuses the exact existing handlers
  // above instead of duplicating add-throw/set-score logic a second time.
  // Both buttons stay fully functional on their own; Enter is additive.
  containerEl.addEventListener('keydown', e => {
    if(e.key !== 'Enter') return;

    const throwInput = e.target.closest('[data-throw-input]');
    if(throwInput){
      e.preventDefault(); // don't let Enter submit a surrounding form
      const card = e.target.closest('[data-id]');
      if(!card) return;
      const btn = card.querySelector(`[data-add-throw][data-team="${throwInput.dataset.team}"]`);
      if(btn) btn.click();
      return;
    }

    const setInput = e.target.closest('[data-set-input]');
    if(setInput){
      e.preventDefault();
      const card = e.target.closest('[data-id]');
      if(!card) return;
      const btn = card.querySelector(`[data-set-action][data-team="${setInput.dataset.team}"]`);
      if(btn) btn.click();
      return;
    }
  });
}

/* ================================================================
   MATCH FORM MODAL — shared between admin.html and admin-sport.html,
   same one-implementation pattern as the score panels above:
   matchFormModalHTML() returns the modal's markup (insert it once per
   page), wireMatchForm() wires everything inside it and hands back
   { openForm } for the calling page to trigger. Neither page keeps its
   own copy of the form anymore.
   ================================================================ */
function matchFormModalHTML(){
  return `
  <div class="overlay" id="formOverlay">
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal__head">
        <span class="eyebrow" id="formTitle">Perlawanan Baharu</span>
        <button class="modal__close" id="closeForm" aria-label="Close">&times;</button>
      </div>
      <div class="modal__body">
        <form id="matchForm">
          <input type="hidden" id="formId" />
          <div class="field-row">
            <div class="field">
              <label for="formSport">Sukan</label>
              <div class="select-field">
                <select class="input" id="formSport"></select>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </div>
            <div class="field">
              <label for="formVenue">Tempat</label>
              <div class="select-field">
                <select class="input" id="formVenue"></select>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </div>
          </div>
          <div class="field" id="formCategoryField" style="margin-top:16px; display:none;">
            <label for="formCategory">Kategori</label>
            <div class="select-field">
              <select class="input" id="formCategory"></select>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </div>
          <div class="field-row" style="margin-top:16px;">
            <div class="field">
              <label for="formGroupA">Kumpulan / Pasukan A</label>
              <input class="input" id="formGroupA" maxlength="60" required />
            </div>
            <div class="field">
              <label for="formGroupB">Kumpulan / Pasukan B</label>
              <input class="input" id="formGroupB" maxlength="60" required />
            </div>
          </div>
          <div class="field" style="margin-top:16px;">
            <label for="formDate">Hari</label>
            <div class="select-field">
              <select class="input" id="formDate"></select>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </div>
          <div class="field" style="margin-top:16px;">
            <label for="formTiktok">URL Siaran Langsung TikTok <span class="field-hint">— pilihan, biarkan kosong jika belum bersiaran</span></label>
            <input class="input" id="formTiktok" type="url" placeholder="https://www.tiktok.com/@..." />
          </div>
          <button class="btn btn--primary btn--block" type="submit" style="margin-top:20px;">Simpan Perlawanan</button>
        </form>
      </div>
    </div>
  </div>`;
}

// Wires a matchFormModalHTML() instance already inserted into the page.
// Returns { openForm(match, defaults) }:
// - match: pass an existing match object to edit it (pre-filled from its
//   own data), or null for a brand-new match.
// - defaults: only used when match is null — { sport, category } to
//   pre-fill a new match's sport/category (e.g. from admin-sport.html's
//   own URL params, since the admin already navigated into that specific
//   context and shouldn't have to re-pick it).
function wireMatchForm(){
  const formOverlay = document.getElementById('formOverlay');
  document.getElementById('formSport').innerHTML = SPORTS.map(s => `<option value="${s.id}">${s.icon} ${s.label}</option>`).join('');
  document.getElementById('formVenue').innerHTML = VENUES.map(v => `<option value="${v}">${v}</option>`).join('');
  document.getElementById('formDate').innerHTML = EVENT_DAYS.map((iso,i) => {
    const { short } = dayLabel(iso);
    return `<option value="${iso}">Day ${i+1} — ${short}</option>`;
  }).join('');

  // category selector only exists for sports with a categories list — hidden
  // and cleared entirely (no disabled empty dropdown left behind) otherwise
  const formCategoryField = document.getElementById('formCategoryField');
  const formCategorySelect = document.getElementById('formCategory');
  function updateCategoryField(sportId, selectedCategoryId){
    const categories = sportMeta(sportId).categories;
    if(categories && categories.length){
      formCategoryField.style.display = '';
      formCategorySelect.innerHTML = categories.map(c => `<option value="${c.id}">${c.label}</option>`).join('');
      formCategorySelect.value = categories.some(c => c.id === selectedCategoryId) ? selectedCategoryId : categories[0].id;
      formCategorySelect.required = true;
    } else {
      formCategoryField.style.display = 'none';
      formCategorySelect.innerHTML = '';
      formCategorySelect.required = false;
    }
  }
  document.getElementById('formSport').addEventListener('change', () => {
    updateCategoryField(document.getElementById('formSport').value, null);
  });

  function openForm(match, defaults){
    const isEdit = !!match;
    document.getElementById('formTitle').textContent = isEdit ? 'Edit Perlawanan' : 'Perlawanan Baharu';
    document.getElementById('formId').value = isEdit ? match.id : '';
    const sportId = isEdit ? match.sport : (defaults && defaults.sport) || SPORTS[0].id;
    document.getElementById('formSport').value = sportId;
    document.getElementById('formVenue').value = isEdit ? match.venue : VENUES[0];
    const categoryId = isEdit ? match.category : (defaults && defaults.category) || null;
    updateCategoryField(sportId, categoryId);
    document.getElementById('formGroupA').value = isEdit ? match.groupA : '';
    document.getElementById('formGroupB').value = isEdit ? match.groupB : '';
    document.getElementById('formDate').value = isEdit ? match.date : EVENT_DAYS[0];
    document.getElementById('formTiktok').value = isEdit ? (match.tiktokLiveUrl || '') : '';
    formOverlay.classList.add('is-open');
    document.getElementById('formGroupA').focus();
  }
  function closeForm(){ formOverlay.classList.remove('is-open'); }

  document.getElementById('closeForm').addEventListener('click', closeForm);
  formOverlay.addEventListener('click', e => { if(e.target === formOverlay) closeForm(); });
  document.addEventListener('keydown', e => { if(e.key === 'Escape') closeForm(); });

  document.getElementById('matchForm').addEventListener('submit', e => {
    e.preventDefault();
    const id = document.getElementById('formId').value;
    const sportId = document.getElementById('formSport').value;
    const hasCategories = !!(sportMeta(sportId).categories && sportMeta(sportId).categories.length);
    const data = {
      sport: sportId,
      category: hasCategories ? document.getElementById('formCategory').value : null,
      venue: document.getElementById('formVenue').value,
      groupA: document.getElementById('formGroupA').value.trim(),
      groupB: document.getElementById('formGroupB').value.trim(),
      date: document.getElementById('formDate').value,
      tiktokLiveUrl: document.getElementById('formTiktok').value.trim(),
    };
    if(id){
      data.id = id; // only present when editing — see mock-data.js upsertMatch
      // changing a match's sport invalidates its old sets/derived score —
      // e.g. Badminton's 3-set record means nothing once the sport becomes
      // Futsal's single running score. upsertMatch() only overwrites the
      // fields present in `data` (Object.assign onto the existing match),
      // so without this, stale sets/scoreA/scoreB would silently survive
      // the sport change even though the score panel now shown is wrong.
      const previous = MatchStore.getById(id);
      if(previous && previous.sport !== sportId){
        data.sets = [];
        data.scoreA = 0;
        data.scoreB = 0;
      }
    }
    MatchStore.upsertMatch(data);
    closeForm();
    showToast(id ? 'Perlawanan dikemas kini' : 'Perlawanan dicipta');
  });

  return { openForm };
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

// ================================================================
// TIE AGGREGATION (Phase B) — math only, not consumed by any UI yet.
// For isTieAggregated sports (Badminton, Pickleball, Ping Pong, Karom,
// Dart), every category (MS/WS/MD/WD/XD) played between the same pair
// of zones contributes toward ONE combined tie result, instead of each
// category standing alone the way computeStandings() treats every
// other sport's matches. This is separate math, not a replacement for
// computeStandings() — a later phase decides how/whether tie results
// feed into overall standings.
// ================================================================

// One pair of zones, one tie-sport. Mirrors computeStandings()'s own
// status filter exactly — only 'finished' matches ever count; 'live'
// and 'upcoming' are excluded here the same way they are there.
function computeTieResult(sportId, zoneA, zoneB, matches){
  let categoriesA = 0, categoriesB = 0, categoriesPlayed = 0;
  matches
    .filter(m => m.sport === sportId && m.status === 'finished')
    .filter(m => m.groupA !== m.groupB) // defensive: exclude a self-matched data anomaly
    .filter(m =>
      (m.groupA === zoneA && m.groupB === zoneB) ||
      (m.groupA === zoneB && m.groupB === zoneA))
    .forEach(m => {
      categoriesPlayed++;
      // scoreA/scoreB belong to groupA/groupB respectively, not to a
      // fixed "home"/"away" side — resolve to the ACTUAL zone before
      // comparing, since the same pair can appear with groupA/groupB
      // flipped across different category matches (e.g. zoneA is
      // groupA in the MS match but groupB in the WS match).
      const scoreOfA = m.groupA === zoneA ? m.scoreA : m.scoreB;
      const scoreOfB = m.groupA === zoneA ? m.scoreB : m.scoreA;
      if(scoreOfA > scoreOfB) categoriesA++;
      else if(scoreOfB > scoreOfA) categoriesB++;
      // else: a genuine draw (possible for Karom, whose 'simple' scoring
      // can legitimately end tied) — counts toward categoriesPlayed
      // above, but toward neither zone's count.
    });
  return { categoriesA, categoriesB, categoriesPlayed };
}

// 'level' (0-0, or any equal tally like 1-1/2-2 after some categories
// have been played) means this pair contributes NO result yet — same
// as an unplayed match contributes nothing to computeStandings(). The
// moment one zone leads by even a single category, that lead counts as
// the live result immediately: standings are meant to update as each
// category match finishes, not only once a sport's categories are all
// mathematically decided. A current 2-1 counts now even if a 3rd, 4th,
// or 5th category hasn't been played yet — that's intentional, not a bug.
function tieLeader(result){
  if(result.categoriesA === result.categoriesB) return 'level';
  return result.categoriesA > result.categoriesB ? 'A' : 'B';
}

// Point-differential tiebreak — only applies once every category for
// this sport has been played AND tieLeader() still says 'level' after
// all of them. A partial 'level' (fewer than the full category count
// played) is a completely different situation — "not decided yet" —
// and must fall through unchanged, same as tieLeader() alone already
// handles it. Wraps tieLeader() rather than changing its signature, so
// a caller that only wants the plain win-count leader (no tiebreak)
// still has that available unchanged.
function resolveTieLeader(sportId, zoneA, zoneB, result, matches){
  const leader = tieLeader(result);
  if(leader !== 'level') return leader; // real leader on category wins already — nothing to break the tie for

  const totalCategories = (sportMeta(sportId).categories || []).length;
  if(result.categoriesPlayed < totalCategories) return 'level'; // still mid-tie, not everything played yet

  // every category played, still level on wins — fall back to total
  // point differential across every finished category match for this
  // pair. Duplicates computeTieResult()'s own pair-matching filter
  // rather than extending that function, since touching it is off
  // limits here and it already correctly does the win-counting job.
  let margin = 0;
  matches
    .filter(m => m.sport === sportId && m.status === 'finished' && m.groupA !== m.groupB)
    .filter(m =>
      (m.groupA === zoneA && m.groupB === zoneB) ||
      (m.groupA === zoneB && m.groupB === zoneA))
    .forEach(m => {
      const scoreOfA = m.groupA === zoneA ? m.scoreA : m.scoreB;
      const scoreOfB = m.groupA === zoneA ? m.scoreB : m.scoreA;
      margin += scoreOfA - scoreOfB;
    });

  if(margin > 0) return 'A';
  if(margin < 0) return 'B';
  return 'level'; // genuinely unresolvable: equal on wins AND equal on total points
}

// Every unique zone-pair with at least one finished category match in
// this sport, discovered from the data itself — never a hardcoded zone
// combination list, since which pairs have actually played varies
// match by match.
function computeAllTiesForSport(sportId, matches){
  const pairKeys = new Set();
  const pairs = [];
  matches
    .filter(m => m.sport === sportId && m.status === 'finished' && m.groupA !== m.groupB)
    .forEach(m => {
      const [zoneA, zoneB] = [m.groupA, m.groupB].sort();
      const key = `${zoneA}__${zoneB}`;
      if(!pairKeys.has(key)){
        pairKeys.add(key);
        pairs.push([zoneA, zoneB]);
      }
    });
  return pairs.map(([zoneA, zoneB]) => ({
    zoneA, zoneB,
    result: computeTieResult(sportId, zoneA, zoneB, matches),
  }));
}

// ================================================================
// EVENT RANKING & MEDALS (Phase C) — reuses computeStandings() rather
// than writing new ranking logic; the only new work here is turning a
// tie-aggregated sport's per-category matches into the "virtual
// matches" computeStandings() already knows how to rank.
// ================================================================

// The 15 real PESAWI events, built from SPORTS rather than hardcoded —
// a tie-aggregated sport (Badminton, Pickleball, Ping Pong, Karom,
// Dart) is ONE event with no category; every other sport contributes
// one event per category.
function getAllEvents(){
  const events = [];
  SPORTS.forEach(s => {
    if(s.isTieAggregated){
      events.push({ sportId:s.id, category:null });
    } else if(s.categories && s.categories.length){
      s.categories.forEach(c => events.push({ sportId:s.id, category:c.id }));
    } else {
      events.push({ sportId:s.id, category:null });
    }
  });
  return events;
}

// Tie-aggregated sport only. For each zone pair discovered by
// computeAllTiesForSport() (reused as-is, not reimplemented), resolve
// the pair's leader and synthesize ONE virtual match representing that
// pair's combined result — then hand the whole synthesized list to the
// existing, untouched computeStandings() exactly like a real match list.
function computeTieAggregatedStandings(sportId, matches){
  const totalCategories = (sportMeta(sportId).categories || []).length;
  const virtualMatches = [];
  computeAllTiesForSport(sportId, matches).forEach(({ zoneA, zoneB, result }) => {
    const leader = resolveTieLeader(sportId, zoneA, zoneB, result, matches);
    const base = { sport:sportId, category:null, groupA:zoneA, groupB:zoneB, status:'finished' };
    if(leader === 'A'){
      virtualMatches.push({ ...base, scoreA:1, scoreB:0 }); // counts now, live — even if not every category's played yet
    } else if(leader === 'B'){
      virtualMatches.push({ ...base, scoreA:0, scoreB:1 });
    } else if(result.categoriesPlayed === totalCategories){
      virtualMatches.push({ ...base, scoreA:1, scoreB:1 }); // every category played, genuinely still level — a real draw
    }
    // else: 'level' with categoriesPlayed < totalCategories — no result
    // yet for this pair, so nothing is synthesized (same as an unplayed
    // real match contributing nothing to computeStandings()).
  });
  return computeStandings(virtualMatches);
}

// The single entry point later phases call for one event's standings.
function computeEventStandings(sportId, category, matches){
  if(sportMeta(sportId).isTieAggregated){
    return computeTieAggregatedStandings(sportId, matches);
  }
  const filtered = matches.filter(m => m.sport === sportId && m.category === category);
  return computeStandings(filtered);
}

// Takes computeStandings()'s ranked output. A position only gets a
// medal if that zone has points > 0 (a real decided win or draw) —
// computeStandings() sorts by points descending, so once one position
// has 0 points every position after it does too; checking each of
// positions 0/1/2 independently is enough to stop handing out medals
// the moment real results run out, rather than awarding one to
// whichever 0-point zone the sort's name-tiebreak happened to place there.
function assignMedals(rankedStandings){
  const medals = { gold:null, silver:null, bronze:null };
  ['gold', 'silver', 'bronze'].forEach((key, i) => {
    const entry = rankedStandings[i];
    if(entry && entry.points > 0) medals[key] = entry.name;
  });
  return medals;
}

// Zone color lookup — was duplicated identically in standings.html and
// sport.html; centralized here so both call the same function instead of
// keeping their own copies in sync by hand.
const ZONE_COLORS = {
  'KK': '#9E4747',
  'Tawau': '#8D9E47',
  'Sandakan': '#479E6A',
  'Lahad Datu': '#476A9E',
  'Keningau': '#8D479E',
};
function zoneColor(name){ return ZONE_COLORS[name] || 'var(--ink-400)'; }

/* ================================================================
   PUBLIC MATCH CARD — shared between index.html (live strip) and
   sport.html (this sport/category's live matches). Relocated out of
   index.html originally, then switched from plain sportMeta().label to
   sportDisplayLabel() so a categorized sport's card actually shows its
   category (e.g. "Futsal (Veteran)"), not just "Futsal" — this had been
   flagged as a leftover gap since the move and stayed unfixed until now.
   schedule.html has its own separate card renderer (opens a modal
   instead of linking) and was left untouched.
   ================================================================ */
function publicMatchCardHTML(m){
  const meta = sportMeta(m.sport);
  return `
  <a class="card match-card" href="schedule.html#match-${m.id}" style="text-decoration:none;">
    ${m.status === 'live' ? '<div class="ribbon ribbon--live"></div>' : ''}
    <div class="match-card__body">
      <div class="match-card__top">
        <span class="sport-tag"><span class="sport-icon">${meta.icon}</span>${sportDisplayLabel(m.sport, m.category)}</span>
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
