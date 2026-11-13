'use strict';

const STORAGE_KEY = 'brahot:v1';

const DEFAULT_PRESETS = [
  { label: 'Birkat Hamazone', count: 4 },
  { label: 'Amida', count: 19 },
  { label: 'Asher Yatsar', count: 1 },
  { label: 'Hamotsi', count: 1 },
  { label: 'Mezonot', count: 1 },
  { label: 'Haets', count: 1 },
  { label: 'Haadama', count: 1 },
  { label: 'Chéhakol', count: 1 },
  { label: 'Boré néfachot', count: 1 },
  { label: 'Al hamihya', count: 1 },
];

/* ---------- Utils ---------- */

const $ = (sel) => document.querySelector(sel);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sum = (entries) => entries.reduce((n, e) => n + e.count, 0);
const clampInt = (v, min, max, fallback) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const fmtTime = (ts) => new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const fmtDay = (ts) => {
  const s = new Date(ts).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const vibrate = (ms = 12) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (_) {} };

/* ---------- Date hébraïque ---------- */

// Nombre -> lettres hébraïques (guématria), ex. 787 -> תשפ״ז, 15 -> ט״ו
function gematria(num) {
  const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
  const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
  const hundreds = ['', 'ק', 'ר', 'ש', 'ת'];
  let n = num % 1000;
  let s = '';
  while (n >= 400) { s += 'ת'; n -= 400; }
  if (n >= 100) { s += hundreds[Math.floor(n / 100)]; n %= 100; }
  if (n === 15) s += 'טו';
  else if (n === 16) s += 'טז';
  else { s += tens[Math.floor(n / 10)] + ones[n % 10]; }
  return s.length === 1 ? s + '׳' : s.slice(0, -1) + '״' + s.slice(-1);
}

const HEB_MONTHS = {
  Tishri: 'תשרי', Heshvan: 'חשון', Kislev: 'כסלו', Tevet: 'טבת', Shevat: 'שבט',
  'Adar I': 'אדר א׳', Adar: 'אדר', 'Adar II': 'אדר ב׳', Nisan: 'ניסן', Iyar: 'אייר',
  Sivan: 'סיון', Tamuz: 'תמוז', Av: 'אב', Elul: 'אלול',
};

let hebFormatter = null;
function fmtHebrew(ts) {
  try {
    hebFormatter = hebFormatter || new Intl.DateTimeFormat('en-u-ca-hebrew', { day: 'numeric', month: 'long', year: 'numeric' });
    const parts = Object.fromEntries(hebFormatter.formatToParts(new Date(ts)).map((p) => [p.type, p.value]));
    const month = HEB_MONTHS[parts.month];
    const day = parseInt(parts.day, 10);
    const year = parseInt(parts.year, 10);
    if (!month || !day || !year) throw new Error('hebrew');
    return `${gematria(day)} ${month} ${gematria(year)}`;
  } catch (_) {
    try {
      return new Date(ts).toLocaleDateString('he-u-ca-hebrew', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (__) {
      return '';
    }
  }
}

/* ---------- Zmanim : coucher du soleil & tzeit hakokhavim ---------- */

const CITIES = [
  { id: 'jerusalem', label: 'Jérusalem', lat: 31.778, lon: 35.235 },
  { id: 'telaviv', label: 'Tel Aviv', lat: 32.085, lon: 34.781 },
  { id: 'haifa', label: 'Haïfa', lat: 32.794, lon: 34.989 },
  { id: 'netanya', label: 'Netanya', lat: 32.329, lon: 34.857 },
  { id: 'ashdod', label: 'Ashdod', lat: 31.804, lon: 34.655 },
  { id: 'beersheva', label: 'Beer-Sheva', lat: 31.252, lon: 34.791 },
  { id: 'eilat', label: 'Eilat', lat: 29.557, lon: 34.952 },
  { id: 'paris', label: 'Paris', lat: 48.857, lon: 2.352 },
  { id: 'lyon', label: 'Lyon', lat: 45.764, lon: 4.836 },
  { id: 'marseille', label: 'Marseille', lat: 43.297, lon: 5.381 },
  { id: 'nice', label: 'Nice', lat: 43.71, lon: 7.262 },
  { id: 'strasbourg', label: 'Strasbourg', lat: 48.573, lon: 7.752 },
  { id: 'bruxelles', label: 'Bruxelles', lat: 50.85, lon: 4.352 },
  { id: 'geneve', label: 'Genève', lat: 46.204, lon: 6.143 },
  { id: 'londres', label: 'Londres', lat: 51.507, lon: -0.128 },
  { id: 'montreal', label: 'Montréal', lat: 45.502, lon: -73.567 },
  { id: 'newyork', label: 'New York', lat: 40.713, lon: -74.006 },
  { id: 'miami', label: 'Miami', lat: 25.762, lon: -80.192 },
];

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const norm = (x, m) => ((x % m) + m) % m;

// Moment (timestamp) où le soleil descend à `depression` degrés sous l'horizon,
// le soir de la date civile locale y/m/d. Algorithme « Almanac for Computers »
// (précision ~1-2 min). depression 0.833 = coucher du soleil visible.
function sunBelowHorizon(y, m, d, lat, lon, depression) {
  const N = Math.round((Date.UTC(y, m, d) - Date.UTC(y, 0, 0)) / 86400000);
  const lngHour = lon / 15;
  const t = N + (18 - lngHour) / 24;
  const M = 0.9856 * t - 3.289;
  const L = norm(M + 1.916 * Math.sin(rad(M)) + 0.02 * Math.sin(rad(2 * M)) + 282.634, 360);
  let RA = norm(deg(Math.atan(0.91764 * Math.tan(rad(L)))), 360);
  RA = (RA + Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90) / 15;
  const sinDec = 0.39782 * Math.sin(rad(L));
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH = (Math.cos(rad(90 + depression)) - sinDec * Math.sin(rad(lat))) / (cosDec * Math.cos(rad(lat)));
  if (cosH < -1 || cosH > 1) return null; // pas de nuit (latitudes extrêmes)
  const H = deg(Math.acos(cosH)) / 15;
  const UT = norm(H + RA - 0.06571 * t - 6.622 - lngHour, 24);
  // UT est modulo 24h : on choisit le jour qui tombe le plus près de
  // « midi solaire du lieu + H », pour rester sur le bon soir quel que soit le fuseau.
  const approx = Date.UTC(y, m, d) + (12 - lngHour + H) * 3600000;
  const ts = Date.UTC(y, m, d) + UT * 3600000;
  return ts + Math.round((approx - ts) / 86400000) * 86400000;
}

function getLocation() {
  return (state && state.location) || CITIES[0];
}

function zmanim(ts) {
  const dt = new Date(ts);
  const { lat, lon } = getLocation();
  const [y, m, d] = [dt.getFullYear(), dt.getMonth(), dt.getDate()];
  return {
    sunset: sunBelowHorizon(y, m, d, lat, lon, 0.833),
    tzeit: sunBelowHorizon(y, m, d, lat, lon, state.tzeitDeg),
  };
}

// Jour « halakhique » : après tzeit hakokhavim, on est déjà le lendemain.
// Renvoie un Date à midi du jour concerné.
function halachicDate(ts) {
  const dt = new Date(ts);
  const day = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 12);
  const { tzeit } = zmanim(ts);
  if (tzeit && ts >= tzeit) day.setDate(day.getDate() + 1);
  return day;
}

const dayKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/* ---------- State ---------- */

const TZEIT_OPTIONS = [8.5, 7.083];

function defaultState() {
  return {
    version: 1,
    goal: 100,
    presets: DEFAULT_PRESETS.map((p) => ({ id: uid(), ...p })),
    current: { startedAt: Date.now(), entries: [] },
    history: [],
    autoNextDay: true,
    location: { ...CITIES[0] },
    tzeitDeg: 8.5,
  };
}

function sanitizeLocation(loc) {
  if (loc && Number.isFinite(Number(loc.lat)) && Number.isFinite(Number(loc.lon))) {
    const lat = Number(loc.lat);
    const lon = Number(loc.lon);
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      return { id: String(loc.id || 'custom').slice(0, 30), label: String(loc.label || 'Lieu').slice(0, 60), lat, lon };
    }
  }
  return { ...CITIES[0] };
}

function sanitizeEntries(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((e) => e && typeof e.label === 'string')
    .map((e) => ({
      id: e.id || uid(),
      label: e.label.slice(0, 80),
      count: clampInt(e.count, 1, 999, 1),
      ts: Number(e.ts) || Date.now(),
    }));
}

function sanitizeState(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== 'object') return base;
  return {
    version: 1,
    goal: clampInt(raw.goal, 1, 1000, base.goal),
    presets: Array.isArray(raw.presets)
      ? raw.presets
          .filter((p) => p && typeof p.label === 'string')
          .map((p) => ({ id: p.id || uid(), label: p.label.slice(0, 80), count: clampInt(p.count, 1, 999, 1) }))
      : base.presets,
    current: {
      startedAt: Number(raw.current && raw.current.startedAt) || Date.now(),
      entries: sanitizeEntries(raw.current && raw.current.entries),
    },
    history: Array.isArray(raw.history)
      ? raw.history
          .filter((d) => d && Array.isArray(d.entries))
          .map((d) => ({
            id: d.id || uid(),
            startedAt: Number(d.startedAt) || Date.now(),
            endedAt: Number(d.endedAt) || Number(d.startedAt) || Date.now(),
            goal: clampInt(d.goal, 1, 1000, base.goal),
            entries: sanitizeEntries(d.entries),
          }))
      : [],
    autoNextDay: raw.autoNextDay !== false,
    location: sanitizeLocation(raw.location),
    tzeitDeg: TZEIT_OPTIONS.includes(Number(raw.tzeitDeg)) ? Number(raw.tzeitDeg) : 8.5,
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizeState(JSON.parse(raw)) : defaultState();
  } catch (_) {
    return defaultState();
  }
}

let state = loadState();

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_) {
    showToast('Impossible de sauvegarder sur cet appareil');
  }
}

/* ---------- Toast & confirm ---------- */

let toastTimer = null;
let toastUndo = null;

function showToast(text, undo) {
  const el = $('#toast');
  $('#toast-text').textContent = text;
  toastUndo = undo || null;
  $('#toast-undo').hidden = !undo;
  el.hidden = false;
  // relance l'animation
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 3500);
}

function hideToast() {
  $('#toast').hidden = true;
  toastUndo = null;
}

$('#toast-undo').addEventListener('click', () => {
  if (toastUndo) toastUndo();
  hideToast();
});

function confirmDialog({ title, text, ok = 'OK', danger = false }) {
  const dlg = $('#confirm');
  $('#confirm-title').textContent = title;
  $('#confirm-text').textContent = text;
  const okBtn = $('#confirm-ok');
  okBtn.textContent = ok;
  okBtn.classList.toggle('danger', danger);
  return new Promise((resolve) => {
    const onClose = () => {
      dlg.removeEventListener('close', onClose);
      resolve(dlg.returnValue === 'ok');
    };
    dlg.returnValue = '';
    dlg.addEventListener('close', onClose);
    dlg.showModal();
  });
}

/* ---------- Actions ---------- */

function addEntry(label, count) {
  checkNightfall();
  const entry = { id: uid(), label: label.trim() || 'Braha', count, ts: Date.now() };
  const before = sum(state.current.entries);
  state.current.entries.push(entry);
  save();
  vibrate();
  renderToday(true);
  const after = before + count;
  if (before < state.goal && after >= state.goal) {
    vibrate([30, 60, 30]);
    showToast(`Objectif de ${state.goal} atteint !`, () => removeEntry(entry.id));
  } else {
    showToast(`+${count} · ${entry.label}`, () => removeEntry(entry.id));
  }
}

function removeEntry(id) {
  const idx = state.current.entries.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  const [removed] = state.current.entries.splice(idx, 1);
  save();
  renderToday();
  return { removed, idx };
}

// Archive la journée en cours (si elle contient des brahot) et repart de zéro.
function startNewDay(now) {
  const prev = state.current;
  let archived = null;
  if (prev.entries.length) {
    archived = { id: uid(), startedAt: prev.startedAt, endedAt: now, goal: state.goal, entries: prev.entries };
    state.history.unshift(archived);
  }
  state.current = { startedAt: now, entries: [] };
  return { prev, archived };
}

// Passage automatique au jour suivant à tzeit hakokhavim.
function checkNightfall() {
  if (!state.autoNextDay) return false;
  const now = Date.now();
  const startKey = dayKey(halachicDate(state.current.startedAt));
  const nowKey = dayKey(halachicDate(now));
  if (nowKey <= startKey) return false;
  const total = sum(state.current.entries);
  startNewDay(now);
  save();
  renderAll();
  showToast(total ? `Tzeit hakokhavim · nouveau jour (${total} archivées)` : 'Tzeit hakokhavim · nouveau jour');
  return true;
}

async function nextDay() {
  checkNightfall();
  const total = sum(state.current.entries);
  const autoNote = state.autoNextDay ? ' (Le passage se fait aussi automatiquement à tzeit hakokhavim.)' : '';
  const ok = await confirmDialog({
    title: 'Passer au jour suivant ?',
    text: (total
      ? `La journée sera archivée dans l'historique avec ${total} braha${total > 1 ? 'ot' : ''}, puis le compteur repartira de zéro.`
      : 'Aucune braha aujourd\'hui. Le compteur repartira simplement de zéro.') + autoNote,
    ok: 'Jour suivant',
  });
  if (!ok) return;
  const { prev: prevCurrent, archived } = startNewDay(Date.now());
  save();
  renderAll();
  showToast('Nouveau jour commencé', () => {
    if (archived) state.history = state.history.filter((d) => d.id !== archived.id);
    state.current = prevCurrent;
    save();
    renderAll();
  });
}

/* ---------- Render: today ---------- */

const RING_LEN = 2 * Math.PI * 52;

function renderToday(bump = false) {
  const total = sum(state.current.entries);
  const goal = state.goal;
  const pct = Math.min(1, total / goal);

  const countEl = $('#count');
  countEl.textContent = total;
  if (bump) {
    countEl.classList.remove('bump');
    void countEl.offsetWidth;
    countEl.classList.add('bump');
  }
  $('#goal-label').textContent = `/ ${goal}`;
  const ring = $('#ring-fill');
  ring.style.strokeDasharray = RING_LEN;
  ring.style.strokeDashoffset = RING_LEN * (1 - pct);

  const msg = $('#goal-msg');
  if (total >= goal) {
    msg.textContent = total > goal ? `Objectif atteint · +${total - goal} en bonus` : 'Objectif atteint, kol hakavod !';
    msg.classList.add('done');
  } else {
    const left = goal - total;
    msg.textContent = `Encore ${left} pour atteindre ${goal}`;
    msg.classList.remove('done');
  }

  const hDay = halachicDate(state.current.startedAt);
  const { tzeit } = zmanim(hDay.getTime());
  $('#day-label').textContent = fmtDay(hDay) + (tzeit ? ` · tzeit ${fmtTime(tzeit)}` : '');
  $('#heb-date').textContent = fmtHebrew(hDay);

  // Raccourcis
  $('#presets').innerHTML = state.presets.length
    ? state.presets
        .map(
          (p) => `<button class="preset" data-preset="${esc(p.id)}">
            <span class="preset-label">${esc(p.label)}</span>
            <span class="preset-count">+${p.count}</span>
          </button>`
        )
        .join('')
    : '<p class="empty" style="grid-column:1/-1">Aucun raccourci. Ajoute-en dans les Réglages.</p>';

  // Liste du jour (plus récent en haut)
  const entries = [...state.current.entries].reverse();
  $('#entries').innerHTML = entries
    .map(
      (e) => `<li class="entry">
        <span class="entry-time">${fmtTime(e.ts)}</span>
        <span class="entry-label">${esc(e.label)}</span>
        <span class="entry-count">+${e.count}</span>
        <button class="icon-btn" data-remove="${esc(e.id)}" aria-label="Supprimer">✕</button>
      </li>`
    )
    .join('');
  $('#entries-count').textContent = entries.length ? `${entries.length} ajout${entries.length > 1 ? 's' : ''}` : 'Rien pour l\'instant';

  renderSuggestions();
}

function renderSuggestions() {
  const labels = new Set();
  state.presets.forEach((p) => labels.add(p.label));
  state.current.entries.forEach((e) => labels.add(e.label));
  state.history.forEach((d) => d.entries.forEach((e) => labels.add(e.label)));
  $('#label-suggestions').innerHTML = [...labels].map((l) => `<option value="${esc(l)}"></option>`).join('');
}

/* ---------- Render: history ---------- */

function renderHistory() {
  const days = state.history;
  const totals = days.map((d) => sum(d.entries));
  const avg = totals.length ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) : 0;
  const best = totals.length ? Math.max(...totals) : 0;
  const reached = days.filter((d, i) => totals[i] >= d.goal).length;

  $('#stats').innerHTML = `
    <div class="stat"><div class="stat-value">${avg}</div><div class="stat-label">Moyenne / jour</div></div>
    <div class="stat"><div class="stat-value">${best}</div><div class="stat-label">Record</div></div>
    <div class="stat"><div class="stat-value">${reached}/${days.length}</div><div class="stat-label">Objectifs atteints</div></div>`;

  if (!days.length) {
    $('#history').innerHTML = '<p class="empty">L\'historique est vide. Appuie sur « Jour suivant » pour archiver une journée.</p>';
    return;
  }

  $('#history').innerHTML = days
    .map((d, i) => {
      const total = totals[i];
      const grouped = new Map();
      d.entries.forEach((e) => grouped.set(e.label, (grouped.get(e.label) || 0) + e.count));
      const rows = [...grouped.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([label, n]) => `<li><span>${esc(label)}</span><b>${n}</b></li>`)
        .join('');
      const pct = Math.min(100, Math.round((total / d.goal) * 100));
      return `<details class="day">
        <summary>
          <div class="day-date">
            <strong>${esc(fmtDay(halachicDate(d.startedAt)))}</strong>
            <span><span class="heb-inline" dir="rtl" lang="he">${esc(fmtHebrew(halachicDate(d.startedAt)))}</span> · ${d.entries.length} ajout${d.entries.length > 1 ? 's' : ''}</span>
          </div>
          <div class="day-total ${total >= d.goal ? 'reached' : ''}">${total}</div>
        </summary>
        <div class="day-body">
          <ul>${rows}</ul>
          <button class="link-danger" data-delete-day="${esc(d.id)}">Supprimer ce jour</button>
        </div>
        <div class="day-bar"><div style="width:${pct}%"></div></div>
      </details>`;
    })
    .join('');
}

/* ---------- Render: settings ---------- */

function renderSettings() {
  $('#goal-input').value = state.goal;
  $('#preset-editor').innerHTML = state.presets
    .map(
      (p, i) => `<li class="pe-row" data-id="${esc(p.id)}">
        <input class="pe-label" type="text" value="${esc(p.label)}" placeholder="Libellé" data-field="label" aria-label="Libellé">
        <input class="pe-count" type="number" inputmode="numeric" min="1" max="999" value="${p.count}" data-field="count" aria-label="Nombre">
        <button class="icon-btn" data-move="-1" ${i === 0 ? 'disabled' : ''} aria-label="Monter">↑</button>
        <button class="icon-btn" data-move="1" ${i === state.presets.length - 1 ? 'disabled' : ''} aria-label="Descendre">↓</button>
        <button class="icon-btn" data-delete-preset aria-label="Supprimer">✕</button>
      </li>`
    )
    .join('');

  // Tombée de la nuit
  $('#auto-next').checked = state.autoNextDay;
  const loc = getLocation();
  const cityOptions = CITIES.map((c) => `<option value="${c.id}">${esc(c.label)}</option>`);
  if (!CITIES.some((c) => c.id === loc.id)) {
    cityOptions.unshift(`<option value="${esc(loc.id)}">${esc(loc.label)}</option>`);
  }
  $('#city-select').innerHTML = cityOptions.join('');
  $('#city-select').value = loc.id;
  $('#tzeit-deg').value = String(state.tzeitDeg);
  const z = zmanim(Date.now());
  $('#zmanim-info').textContent = z.sunset && z.tzeit
    ? `Aujourd'hui à ${loc.label} : coucher du soleil ${fmtTime(z.sunset)} · tzeit hakokhavim ${fmtTime(z.tzeit)}`
    : `Pas de tombée de la nuit calculable aujourd'hui à ${loc.label} : le jour change à minuit.`;
}

function renderAll() {
  renderToday();
  renderHistory();
  renderSettings();
}

/* ---------- Events ---------- */

// Onglets
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    const name = tab.dataset.tab;
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
    document.querySelectorAll('.view').forEach((v) => (v.hidden = v.dataset.view !== name));
    if (name === 'history') renderHistory();
    if (name === 'settings') renderSettings();
    window.scrollTo(0, 0);
  });
});

// Ajout manuel +1
$('#add-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const input = $('#add-label');
  const label = input.value.trim();
  if (!label) {
    const form = $('#add-form');
    form.classList.remove('shake');
    void form.offsetWidth;
    form.classList.add('shake');
    input.focus();
    return;
  }
  addEntry(label, 1);
  input.value = '';
  input.blur();
});

// Raccourcis
$('#presets').addEventListener('click', (ev) => {
  const btn = ev.target.closest('[data-preset]');
  if (!btn) return;
  const preset = state.presets.find((p) => p.id === btn.dataset.preset);
  if (preset) addEntry(preset.label, preset.count);
});

// Supprimer une entrée du jour
$('#entries').addEventListener('click', (ev) => {
  const btn = ev.target.closest('[data-remove]');
  if (!btn) return;
  const res = removeEntry(btn.dataset.remove);
  if (res) {
    showToast(`Supprimé · ${res.removed.label}`, () => {
      state.current.entries.splice(res.idx, 0, res.removed);
      save();
      renderToday();
    });
  }
});

$('#next-day').addEventListener('click', nextDay);

// Historique : supprimer un jour
$('#history').addEventListener('click', async (ev) => {
  const btn = ev.target.closest('[data-delete-day]');
  if (!btn) return;
  const day = state.history.find((d) => d.id === btn.dataset.deleteDay);
  if (!day) return;
  const ok = await confirmDialog({
    title: 'Supprimer ce jour ?',
    text: `${fmtDay(halachicDate(day.startedAt))} · ${sum(day.entries)} brahot. Cette action est définitive.`,
    ok: 'Supprimer',
    danger: true,
  });
  if (!ok) return;
  state.history = state.history.filter((d) => d.id !== day.id);
  save();
  renderHistory();
});

// Réglages : objectif
$('#goal-input').addEventListener('change', (ev) => {
  state.goal = clampInt(ev.target.value, 1, 1000, state.goal);
  ev.target.value = state.goal;
  save();
  renderToday();
});

// Réglages : édition des raccourcis
$('#preset-editor').addEventListener('change', (ev) => {
  const row = ev.target.closest('.pe-row');
  if (!row) return;
  const preset = state.presets.find((p) => p.id === row.dataset.id);
  if (!preset) return;
  if (ev.target.dataset.field === 'label') {
    preset.label = ev.target.value.trim().slice(0, 80) || preset.label;
    ev.target.value = preset.label;
  } else if (ev.target.dataset.field === 'count') {
    preset.count = clampInt(ev.target.value, 1, 999, preset.count);
    ev.target.value = preset.count;
  }
  save();
  renderToday();
});

$('#preset-editor').addEventListener('click', (ev) => {
  const row = ev.target.closest('.pe-row');
  if (!row) return;
  const idx = state.presets.findIndex((p) => p.id === row.dataset.id);
  if (idx === -1) return;
  const moveBtn = ev.target.closest('[data-move]');
  if (moveBtn) {
    const to = idx + Number(moveBtn.dataset.move);
    if (to < 0 || to >= state.presets.length) return;
    const [p] = state.presets.splice(idx, 1);
    state.presets.splice(to, 0, p);
  } else if (ev.target.closest('[data-delete-preset]')) {
    const [removed] = state.presets.splice(idx, 1);
    showToast(`Raccourci supprimé · ${removed.label}`, () => {
      state.presets.splice(idx, 0, removed);
      save();
      renderSettings();
      renderToday();
    });
  } else {
    return;
  }
  save();
  renderSettings();
  renderToday();
});

$('#add-preset').addEventListener('click', () => {
  state.presets.push({ id: uid(), label: 'Nouvelle braha', count: 1 });
  save();
  renderSettings();
  renderToday();
  const inputs = document.querySelectorAll('#preset-editor .pe-label');
  const last = inputs[inputs.length - 1];
  if (last) { last.focus(); last.select(); }
});

// Sauvegarde : export
$('#export').addEventListener('click', async () => {
  const json = JSON.stringify(state, null, 2);
  const name = `brahot-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([json], name, { type: 'application/json' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Sauvegarde Brahot' });
      return;
    }
  } catch (err) {
    if (err && err.name === 'AbortError') return;
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

// Sauvegarde : import
$('#import').addEventListener('change', async (ev) => {
  const file = ev.target.files && ev.target.files[0];
  ev.target.value = '';
  if (!file) return;
  let data;
  try {
    data = JSON.parse(await file.text());
    if (!data || !data.current || !Array.isArray(data.history)) throw new Error('format');
  } catch (_) {
    showToast('Fichier de sauvegarde invalide');
    return;
  }
  const ok = await confirmDialog({
    title: 'Importer cette sauvegarde ?',
    text: `Elle contient ${data.history.length} jour(s) d'historique. Les données actuelles seront remplacées.`,
    ok: 'Importer',
  });
  if (!ok) return;
  state = sanitizeState(data);
  save();
  renderAll();
  showToast('Sauvegarde importée');
});

// Tout effacer
$('#reset-all').addEventListener('click', async () => {
  const ok = await confirmDialog({
    title: 'Tout effacer ?',
    text: 'Le compteur, l\'historique et les raccourcis seront réinitialisés. Pense à exporter une sauvegarde avant.',
    ok: 'Tout effacer',
    danger: true,
  });
  if (!ok) return;
  state = defaultState();
  save();
  renderAll();
  showToast('Données réinitialisées');
});

// Réglages : tombée de la nuit
$('#auto-next').addEventListener('change', (ev) => {
  state.autoNextDay = ev.target.checked;
  save();
  checkNightfall();
});

$('#city-select').addEventListener('change', (ev) => {
  const city = CITIES.find((c) => c.id === ev.target.value);
  if (!city) return;
  state.location = { ...city };
  save();
  renderAll();
});

$('#tzeit-deg').addEventListener('change', (ev) => {
  const v = Number(ev.target.value);
  if (TZEIT_OPTIONS.includes(v)) state.tzeitDeg = v;
  save();
  renderAll();
});

$('#use-gps').addEventListener('click', () => {
  if (!navigator.geolocation) {
    showToast('Géolocalisation non disponible');
    return;
  }
  showToast('Recherche de ta position…');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      state.location = {
        id: 'gps',
        label: 'Ma position',
        lat: Math.round(pos.coords.latitude * 1000) / 1000,
        lon: Math.round(pos.coords.longitude * 1000) / 1000,
      };
      save();
      renderAll();
      showToast('Position enregistrée');
    },
    () => showToast('Position refusée ou indisponible'),
    { enableHighAccuracy: false, timeout: 15000, maximumAge: 3600000 }
  );
});

// Vérifie la tombée de la nuit régulièrement et au retour sur l'app
setInterval(checkNightfall, 30000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !checkNightfall()) renderToday();
});

// Synchronise si l'app est ouverte dans plusieurs onglets
window.addEventListener('storage', (ev) => {
  if (ev.key === STORAGE_KEY) {
    state = loadState();
    renderAll();
  }
});

/* ---------- Init ---------- */

if (!checkNightfall()) renderAll();

if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
