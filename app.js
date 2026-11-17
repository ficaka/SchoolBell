/**
 * Училищен Будилник и Аларма за Междучасия - Главен скрипт
 * Включва:
 * 1. Голям нормален часовник с динамичен фон за всеки ден от седмицата.
 * 2. Три обратни часовника: (1) До края на часа/междучасието (с рестарт); (2) До следващия изпит; (3) До следващата ваканция.
 * 3. Падащо меню с програмата за всеки ден от седмицата (Понеделник - Петък).
 * 4. Известяване за контролно (звуков сигнал и визуален бадж).
 * 5. 8 звука за звънец с възможност за бързо прослушване.
 */

if (typeof window !== 'undefined' && typeof location !== 'undefined' && location.protocol === 'file:') {
  window.addEventListener('DOMContentLoaded', () => {
    document.body.style.margin = '0';
    document.body.style.background = '#0f172a';
    document.body.style.color = '#e5e7eb';
    const main = document.createElement('main');
    main.style.maxWidth = '42rem';
    main.style.margin = '4rem auto';
    main.style.padding = '0 1.25rem';
    main.style.fontFamily = 'system-ui,sans-serif';
    main.style.lineHeight = '1.6';
    const h1 = document.createElement('h1');
    h1.style.fontSize = '1.8rem';
    h1.style.marginBottom = '1rem';
    h1.textContent = 'Училищен Будилник';
    const p1 = document.createElement('p');
    p1.textContent = 'Приложението работи през локален сървър, а не като отделен HTML файл.';
    const p2 = document.createElement('p');
    const link = document.createElement('a');
    link.style.color = '#60a5fa';
    link.href = 'http://localhost:3002/';
    link.textContent = 'http://localhost:3002/';
    p2.append('Отварям ', link, '…');
    const p3 = document.createElement('p');
    p3.style.color = '#94a3b8';
    const c1 = document.createElement('code');
    c1.textContent = 'start-local.sh';
    const c2 = document.createElement('code');
    c2.textContent = 'npm start';
    p3.append('Ако не се отвори, стартирай ', c1, ' или ', c2, ' в папката на проекта.');
    main.append(h1, p1, p2, p3);
    document.body.replaceChildren(main);
    setTimeout(() => location.replace('http://localhost:3002/'), 3000);
  });
}

const ENABLE_SUPPORT_DONATION = true;

function applySupportDonationFlag() {
  if (typeof document === 'undefined' || ENABLE_SUPPORT_DONATION) return;
  document.querySelectorAll('[data-support-block]').forEach(el => {
    el.hidden = true;
  });
}

const BG_DAYS = ['Неделя', 'Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък', 'Събота'];
const BG_MONTHS = [
  'Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни',
  'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември'
];

// 10 теми (5 с български мотиви и светини + 5 за българска природа, традиции и технологии).
const DAY_THEMES = [
  { id: 'shevitsa', name: 'Българска шевица — Елбетица', icon: '🪡', class: 'day-bg-shevitsa' },
  { id: 'gerb', name: 'Български герб — Златен лъв', icon: '🦁', class: 'day-bg-gerb' },
  { id: 'heroes', name: 'Български герои — Възраждане', icon: '⚔️', class: 'day-bg-heroes' },
  { id: 'tricolor', name: 'Родна трибагрена — Розова долина', icon: '🇧🇬', class: 'day-bg-tricolor' },
  { id: 'cyrillic', name: 'Българска кирилица — Св. Кирил и Методий', icon: '📜', class: 'day-bg-cyrillic' },
  { id: 'desert', name: 'Български технологии и космос', icon: '🚀', class: 'day-bg-desert' },
  { id: 'ocean', name: 'Български плажове и курорти', icon: '🏖️', class: 'day-bg-ocean' },
  { id: 'jungle', name: 'Български гори и долини', icon: '🌲', class: 'day-bg-jungle' },
  { id: 'volcano', name: 'Нестинари в Странджа', icon: '🔥', class: 'day-bg-volcano' },
  { id: 'snow', name: 'Рила и Пирин', icon: '🏔️', class: 'day-bg-snow' }
];
const THEME_IDS = DAY_THEMES.map(theme => theme.id);

// Цветовата тема е лична за всеки профил. Ключът включва училището,
// класа и потребителското име, за да не се смесват теми между профилите
// в един и същ браузър.
function currentThemeStorageKey() {
  const context = window.SCHOOL_BELL_CONTEXT || {};
  const owner = [context.school, context.className, context.username]
    .map(value => encodeURIComponent(String(value || '').trim().toLocaleLowerCase('bg')))
    .join(':');
  return `school_bell_theme:${owner}`;
}

function readThemeForCurrentUser() {
  let theme = '';
  try {
    theme = localStorage.getItem(currentThemeStorageKey()) || '';
    if (!theme) {
      // Еднократна миграция на старата обща тема към първия профил,
      // който влезе след обновяването.
      const legacy = localStorage.getItem('school_bell_theme') || '';
      if (THEME_IDS.includes(legacy)) {
        theme = legacy;
        localStorage.setItem(currentThemeStorageKey(), legacy);
      }
      if (legacy) localStorage.removeItem('school_bell_theme');
    }
  } catch (_) {}
  return THEME_IDS.includes(theme) ? theme : 'shevitsa';
}

function saveThemeForCurrentUser(theme) {
  try { localStorage.setItem(currentThemeStorageKey(), theme); } catch (_) {}
}

function currentThemeIntensityStorageKey(theme) {
  return `${currentThemeStorageKey()}:intensity:${theme || 'shevitsa'}`;
}

function normalizeThemeIntensity(val) {
  const num = Number(val);
  if (!Number.isFinite(num)) return 100;
  const stepped = Math.round(num / 5) * 5;
  return Math.max(20, Math.min(150, stepped));
}

function readThemeIntensityForCurrentUser(theme) {
  try {
    const raw = localStorage.getItem(currentThemeIntensityStorageKey(theme));
    if (raw !== null && raw !== '') return normalizeThemeIntensity(raw);
  } catch (_) {}
  return 100;
}

function saveThemeIntensityForCurrentUser(theme, intensity) {
  try {
    localStorage.setItem(currentThemeIntensityStorageKey(theme), String(normalizeThemeIntensity(intensity)));
  } catch (_) {}
}

// Седмична програма по подразбиране — празна, за да не се смесват класове.
// Всеки клас попълва своята програма и тя се запазва отделно за неговото училище.
const emptyWeekDay = () => Array.from({ length: 7 }, () => ({ subject: '', hasExam: false }));
const DEFAULT_WEEKLY_SCHEDULE = {
  monday: emptyWeekDay(),
  tuesday: emptyWeekDay(),
  wednesday: emptyWeekDay(),
  thursday: emptyWeekDay(),
  friday: emptyWeekDay()
};

// Резервни официални ваканции (5–6 клас), ако class-calendars.js не е зареден.
const DEFAULT_VACATIONS = [
  { id: 'autumn', name: 'Есенна ваканция', date: '2026-10-31T00:00:00', endDate: '2026-11-02' },
  { id: 'christmas', name: 'Коледна ваканция', date: '2026-12-24T00:00:00', endDate: '2027-01-03' },
  { id: 'midterm', name: 'Междусрочна ваканция', date: '2027-01-30T00:00:00', endDate: '2027-02-02' },
  { id: 'spring', name: 'Пролетна ваканция', date: '2027-04-03T00:00:00', endDate: '2027-04-11' },
  { id: 'summer', name: 'Лятна ваканция', date: '2027-06-17T00:00:00', endDate: '2027-09-14' }
];
const DEFAULT_NO_SCHOOL_DAYS = [
  { id: 'off-independence-2026', date: '2026-09-22', description: 'Ден на независимостта' },
  { id: 'off-liberation-2027', date: '2027-03-03', description: 'Ден на Освобождението' },
  { id: 'off-rest-2027-04-30', date: '2027-04-30', description: 'Официален почивен ден' },
  { id: 'off-rest-2027-05-03', date: '2027-05-03', description: 'Официален почивен ден' },
  { id: 'off-rest-2027-05-04', date: '2027-05-04', description: 'Официален почивен ден' },
  { id: 'off-easter-2027', date: '2027-05-05', endDate: '2027-05-07', description: 'Великденски и Гергьовденски празници' },
  { id: 'off-matura-2027-05-19', date: '2027-05-19', description: 'Зрелостен изпит по БЕЛ' },
  { id: 'off-matura-2027-05-21', date: '2027-05-21', description: 'Втори зрелостен изпит' },
  { id: 'off-cyril-methodius-2027', date: '2027-05-24', description: 'Ден на Св. св. Кирил и Методий' },
  { id: 'off-second-matura-2027', date: '2027-05-25', description: 'Неучебен ден' }
];

function classCalendarContext() {
  const context = window.SCHOOL_BELL_CONTEXT || {};
  return {
    school: String(context.school || ''),
    className: String(context.className || '')
  };
}

function defaultVacationsForCurrentClass() {
  const { school, className } = classCalendarContext();
  if (window.SchoolBellCalendars && typeof window.SchoolBellCalendars.vacationsForClass === 'function') {
    return window.SchoolBellCalendars.vacationsForClass(school, className);
  }
  return DEFAULT_VACATIONS.map(item => ({ ...item }));
}

function defaultNoSchoolDaysForCurrentClass() {
  const { school, className } = classCalendarContext();
  if (window.SchoolBellCalendars && typeof window.SchoolBellCalendars.noSchoolDaysForClass === 'function') {
    return window.SchoolBellCalendars.noSchoolDaysForClass(school, className);
  }
  return DEFAULT_NO_SCHOOL_DAYS.map(item => ({ ...item }));
}

function defaultSchoolYearEndForCurrentClass() {
  const { school, className } = classCalendarContext();
  if (window.SchoolBellCalendars && typeof window.SchoolBellCalendars.schoolYearEndForClass === 'function') {
    return window.SchoolBellCalendars.schoolYearEndForClass(school, className);
  }
  const match = /^(\d{1,2})/.exec(String(className || '').trim());
  const grade = match ? Math.max(1, Math.min(12, Number(match[1]))) : 5;
  if (grade === 12) return '2027-05-13';
  if (grade <= 3) return '2027-06-02';
  if (grade <= 6) return (grade >= 5 && /спорт/i.test(school)) ? '2027-07-02' : '2027-06-16';
  return '2027-07-02';
}

// Настройки на часовете и междучасията (редактор на програмата)
const DEFAULT_SCHEDULE_CONFIG = {
  startTime: '08:00',
  classMinutes: 40,
  smallBreakMinutes: 10,
  bigBreakMinutes: 20,
  bigBreakAfter: 2,
  periods: 7
};

// Настройки на големия часовник
const DEFAULT_CLOCK_CONFIG = {
  headerTitle: 'Училищен Будилник',
  headerSubtitle: '1 смяна • Таймери, програма & звънец',
  clockNote: 'Текущо астрономическо време',
  hour12: false,
  showSeconds: true,
  showDate: true,
  scale: 100
};

const SCHEDULE_CONFIG_KEY = 'school_bell_schedule_config_v1';
const CLOCK_CONFIG_KEY = 'school_bell_clock_config_v1';
const CLASS_HOMEWORK_KEY = 'school_bell_class_homework_v1';
const CUSTOM_ALARMS_KEY = 'school_bell_custom_alarms';
const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
const WEEKDAY_LABELS = {
  monday: 'Понеделник',
  tuesday: 'Вторник',
  wednesday: 'Сряда',
  thursday: 'Четвъртък',
  friday: 'Петък'
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseTimeToMinutes(time) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(time || ''));
  if (!match) return 8 * 60;
  const hours = Math.max(0, Math.min(23, parseInt(match[1], 10)));
  const minutes = Math.max(0, Math.min(59, parseInt(match[2], 10)));
  return hours * 60 + minutes;
}

function toLocalDateTimeInputValue(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function safeHttpUrl(value) {
  try {
    const parsed = new URL(String(value ?? '').trim());
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:') ? parsed.href : '';
  } catch (_) {
    return '';
  }
}

function createEl(tag, options = {}, ...children) {
  const el = document.createElement(tag);
  if (options.className) el.className = options.className;
  if (options.text !== undefined) el.textContent = String(options.text);
  if (options.title !== undefined) el.title = String(options.title);
  if (options.type !== undefined) el.type = String(options.type);
  if (options.value !== undefined) el.value = String(options.value);
  if (options.disabled !== undefined) el.disabled = Boolean(options.disabled);
  if (options.href !== undefined) el.href = String(options.href);
  if (options.target !== undefined) el.target = String(options.target);
  if (options.rel !== undefined) el.rel = String(options.rel);
  if (options.dataset) {
    for (const [k, v] of Object.entries(options.dataset)) {
      el.dataset[k] = String(v);
    }
  }
  if (options.attrs) {
    for (const [k, v] of Object.entries(options.attrs)) {
      el.setAttribute(k, String(v));
    }
  }
  for (const child of children) {
    if (child !== null && child !== undefined && child !== false) {
      el.append(child);
    }
  }
  return el;
}

function createExpandableTextEl(value, className = 'long-copy', threshold = 420) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const lines = text.split(/\r?\n/).length;
  if (text.length <= threshold && lines <= 6) {
    return createEl('p', { className, text });
  }
  const preview = Array.from(text).slice(0, threshold).join('').trimEnd();
  return createEl(
    'details',
    { className: 'expandable-copy' },
    createEl(
      'summary',
      {},
      createEl('span', { className: 'expandable-copy-preview', text: `${preview}…` }),
      createEl('span', { className: 'expandable-copy-link', text: 'Отвори целия текст' })
    ),
    createEl('p', { className, text })
  );
}

function renderExpandableText(value, className = 'long-copy', threshold = 420) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const lines = text.split(/\r?\n/).length;
  const safeText = escapeHtml(text);
  if (text.length <= threshold && lines <= 6) {
    return `<p class="${className}">${safeText}</p>`;
  }
  const preview = Array.from(text).slice(0, threshold).join('').trimEnd();
  return `<details class="expandable-copy"><summary><span class="expandable-copy-preview">${escapeHtml(preview)}…</span><span class="expandable-copy-link">Отвори целия текст</span></summary><p class="${className}">${safeText}</p></details>`;
}

document.addEventListener('click', (event) => {
  const toggle = event.target.closest?.('[data-expand-target]');
  if (!toggle) return;
  const field = document.getElementById(toggle.dataset.expandTarget);
  if (!field) return;
  const expanded = toggle.getAttribute('aria-expanded') !== 'true';
  field.rows = expanded ? 8 : 2;
  toggle.setAttribute('aria-expanded', String(expanded));
  toggle.textContent = expanded ? 'Свий полето' : 'Разгъни полето';
  if (expanded) field.focus({ preventScroll: true });
});

document.addEventListener('reset', (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  for (const toggle of form.querySelectorAll('[data-expand-target]')) {
    const field = document.getElementById(toggle.dataset.expandTarget);
    if (field) field.rows = 2;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.textContent = 'Разгъни полето';
  }
}, true);

function formatHomeworkDueDate(value) {
  const raw = String(value || '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : (raw || 'без срок');
}

function formatNoteDateTime(dateVal, timeVal) {
  const rawDate = String(dateVal || '').trim();
  const rawTime = String(timeVal || '').trim();

  let dStr = '';
  let tStr = '';

  const dMatch = /(\d{4})-(\d{2})-(\d{2})/.exec(rawDate) || /(\d{2})\.(\d{2})\.(\d{4})/.exec(rawDate);
  if (dMatch) {
    if (dMatch[1].length === 4) {
      dStr = `${dMatch[3]}.${dMatch[2]}.${dMatch[1]}`;
    } else {
      dStr = `${dMatch[1]}.${dMatch[2]}.${dMatch[3]}`;
    }
  } else if (rawDate) {
    dStr = rawDate;
  }

  const tMatch = /(\d{1,2}:\d{2}(?::\d{2})?)/.exec(rawTime) || /(\d{1,2}:\d{2}(?::\d{2})?)/.exec(rawDate);
  if (tMatch) {
    tStr = tMatch[1];
  }

  if (dStr && tStr) return `${dStr} г., ${tStr} ч.`;
  if (dStr) return `${dStr} г.`;
  if (tStr) return `${tStr} ч.`;
  return '';
}

function todayInSofia() {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Sofia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch (_) {
    return new Date().toISOString().slice(0, 10);
  }
}

const SOFIA_PARTS_FORMATTER = (() => {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Sofia', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
  } catch (_) { return null; }
})();

function sofiaParts(date = new Date()) {
  if (!SOFIA_PARTS_FORMATTER) {
    return {
      year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(),
      hour: date.getHours(), minute: date.getMinutes(), second: date.getSeconds()
    };
  }
  const parts = SOFIA_PARTS_FORMATTER.formatToParts(date);
  const value = name => Number(parts.find(part => part.type === name)?.value || 0);
  return {
    year: value('year'), month: value('month'), day: value('day'),
    hour: value('hour'), minute: value('minute'), second: value('second')
  };
}

function sofiaTimeZoneOffsetMs(instant) {
  const p = sofiaParts(instant);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUTC - instant.getTime();
}

// Превръща дата/час, записан в българско време (Europe/Sofia), в реален timestamp.
function sofiaDateTimeTimestamp(dateKey, timeText) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ''));
  const timeMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(timeText || ''));
  if (!dateMatch || !timeMatch) return NaN;
  const year = Number(dateMatch[1]), month = Number(dateMatch[2]), day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]), minute = Number(timeMatch[2]), second = Number(timeMatch[3] || 0);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return NaN;
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  let offset = sofiaTimeZoneOffsetMs(new Date(utcGuess));
  let timestamp = utcGuess - offset;
  const secondOffset = sofiaTimeZoneOffsetMs(new Date(timestamp));
  if (secondOffset !== offset) timestamp = utcGuess - secondOffset;
  return timestamp;
}

function sofiaEndOfDayTimestamp(dateKey) {
  return sofiaDateTimeTimestamp(dateKey, '23:59:59');
}

const NOTE_NOTIFICATION_PATTERN = /(?:всички известия|общи отзиви|предстоящ[оа]?\s+събитие|ново\s+събитие|нова\s+оценка|ново\s+домашно|ново\s+съобщение)/iu;
const NOTE_GENERIC_PATTERN = /^(?:забележка|забележки|похвала|похвали|отзив|отзиви|коментар|бележка|общи отзиви|всички известия|известия)$/i;
const NOTE_LEGEND_LABELS = ['обща похвала','активно участие','отлично представяне','изпълнена задача','любознание','старание','прогрес','комуникативност','бодър ум','концентрация','креативност','работа в екип','лидерство','родолюбие','толерантност','емоционална интелигентност','презентационни умения','липса на внимание','неизпълнена задача','нарушение'];

function isDisplayableNote(note) {
  if (!note || typeof note !== 'object' || !note.id) return false;
  if (note.source === 'manual') return !!(note.description || note.comment || note.badge);
  if (!note.date || !/^\d{4}-\d{2}-\d{2}$/.test(String(note.date))) return false;
  const subject = String(note.subject || '').trim();
  const badge = String(note.badge || '').trim();
  const comment = String(note.comment || '').trim();
  const description = String(note.description || '').trim();
  if (/^(?:всички известия|общи отзиви|известия|notifications?)$/i.test(subject) || /^\d+$/.test(subject)) return false;
  if (NOTE_NOTIFICATION_PATTERN.test([subject, badge, comment, description, note.url, note.externalId].filter(Boolean).join(' '))) return false;
  const joined = `${badge} ${comment} ${description}`.toLocaleLowerCase('bg');
  if (NOTE_LEGEND_LABELS.filter(label => joined.includes(label)).length >= 4) return false;
  if (/^\d{1,4}(?:[.,]\d+)?$/.test(description) || /^\d{1,4}(?:[.,]\d+)?$/.test(comment) || /^\d{1,4}(?:[.,]\d+)?$/.test(badge)) return false;
  return !!(description || badge || comment);
}

function formatMinutesToTime(totalMins) {
  const h = Math.floor(totalMins / 60) % 24;
  const m = totalMins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatDurationSeconds(sec) {
  if (sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatCountdownDHMS(msDiff) {
  if (msDiff <= 0) return { days: 0, hours: 0, mins: 0, secs: 0, text: 'Времето настъпи!' };
  const totalSecs = Math.floor(msDiff / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  return {
    days,
    hours,
    mins,
    secs,
    text: `${days} дни, ${hours} ч. ${mins} мин. ${secs} сек.`
  };
}

function normalizeDayScheduleConfig(value, fallback = DEFAULT_SCHEDULE_CONFIG) {
  const config = { ...fallback, ...(value && typeof value === 'object' ? value : {}) };
  config.startTime = /^\d{2}:\d{2}$/.test(config.startTime) ? config.startTime : fallback.startTime;
  config.classMinutes = Math.max(20, Math.min(90, Number(config.classMinutes) || fallback.classMinutes));
  config.smallBreakMinutes = Math.max(0, Math.min(30, Number(config.smallBreakMinutes) || 0));
  config.bigBreakMinutes = Math.max(0, Math.min(60, Number(config.bigBreakMinutes) || 0));
  config.periods = Math.max(1, Math.min(12, Number(config.periods) || fallback.periods));
  config.bigBreakAfter = Math.max(1, Math.min(config.periods - 1 || 1, Number(config.bigBreakAfter) || fallback.bigBreakAfter));
  return config;
}

class SchoolBellApp {
  constructor() {
    this.soundType = localStorage.getItem('school_bell_sound_type') || 'classic';
    const storedVolume = parseFloat(localStorage.getItem('school_bell_volume') || '0.85');
    this.volume = Number.isFinite(storedVolume) ? Math.max(0, Math.min(1, storedVolume)) : 0.85;
    this.autoRing = localStorage.getItem('school_bell_auto_ring') !== 'false';
    this.preBell = localStorage.getItem('school_bell_pre_bell') !== 'false';
    this.vibrationEnabled = localStorage.getItem('school_bell_vibration_enabled') !== 'false';
    this.notificationsEnabled = localStorage.getItem('school_bell_notif') === 'true';
    this.theme = readThemeForCurrentUser();
    if (!THEME_IDS.includes(this.theme)) this.theme = 'shevitsa';
    this.themeIntensity = readThemeIntensityForCurrentUser(this.theme);

    // Manual Period Timer Restart state
    this.manualPeriodRunning = false;
    this.manualPeriodSecondsLeft = 40 * 60;
    this.manualPeriodTotal = 40 * 60;

    // Simulation state
    this.simMode = null;
    this.simSecondsLeft = 0;
    this.simInterval = null;

    // Selected Day in schedule dropdown
    this.selectedDayKey = this.getInitialDayKey();

    // Weekly schedule data
    this.weeklySchedule = this.loadWeeklySchedule();

    // Periods / schedule editor settings
    this.scheduleConfig = this.loadScheduleConfig();
    this.editorSchedule = null;
    this.editorScheduleConfigs = null;
    this.editorDayKey = this.selectedDayKey;

    // Big clock customization
    this.clockConfig = this.loadClockConfig();

    // Wake Lock state
    this.wakeLock = null;
    this.wakeLockWanted = false;

    // Exam & Vacation states
    this.examConfig = this.loadExamConfig();
    this.extraExams = this.loadExtraExams();
    // Всички домашни са общи за училището и класа. Забележките остават лични.
    this.homeworkItems = this.readClassHomeworkCache();
    this.noteItems = [];
    this.shkoloExams = [];
    this.profileDataLoading = false;
    this.profileDataError = '';
    this.vacations = this.loadVacations();
    this.vacationConfig = this.loadVacationConfig();
    this.noSchoolDays = this.loadNoSchoolDays();

    // Override theme background — sync with saved theme so select and background match
    this.forcedThemeIndex = DAY_THEMES.findIndex(t => t.id === this.theme);
    if (this.forcedThemeIndex === -1) this.forcedThemeIndex = null;

    // Custom alarms are class-shared (and scoped by school/class in local storage).
    this.customAlarms = this.readCustomAlarms();

    // Trigger tracking to avoid repeating
    this.triggeredBells = new Set();
    this.triggeredPreBells = new Set();
    this.triggeredAlarms = new Set();
    this.triggeredExams = new Set();

    // Cache elements and initialize
    this.cacheElements();
    this.weekendMode = null;
    this.updateWeekendUI(this.isWeekend());
    this.applyClockConfig();
    this.applyTheme(this.theme);
    this.initAudioState();
    this.updateDailyBackground();
    this.updateScheduleLabels();
    this.renderScheduleTable();
    this.renderAlarmsList();
    this.renderVacationOptions();
    this.renderNoSchoolDays();
    this.renderHomeworkList();
    this.renderNotesList();
    this.renderShkoloExams();
    this.updateExtraExamCountdowns();
    this.initEventListeners();
    this.startClock();
    this.loadProfileData();
    this.startProfileDataPolling();

    // Re-render immediately when the tab becomes visible again (phones throttle timers)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.tick();
        if (this.wakeLockWanted && !this.wakeLock) this.requestWakeLock({ silent: true });
      }
    });
  }

  getInitialDayKey() {
    const day = new Date(`${todayInSofia()}T12:00:00Z`).getUTCDay();
    return day >= 1 && day <= 5 ? WEEKDAYS[day - 1] : 'monday';
  }

  isWeekend(date = new Date()) {
    // Учебната седмица се определя по българската дата, а не по часовата зона на устройството.
    const day = new Date(`${todayInSofia()}T12:00:00Z`).getUTCDay();
    return day === 0 || day === 6;
  }

  updateWeekendUI(enabled) {
    if (this.weekendMode === enabled) return;
    this.weekendMode = enabled;

    if (this.el.weekendBanner) this.el.weekendBanner.hidden = !enabled;
    if (this.el.weekendScheduleNotice) this.el.weekendScheduleNotice.hidden = !enabled;
    if (this.el.scheduleMainCard) this.el.scheduleMainCard.classList.toggle('weekend-mode', enabled);

    if (this.el.restartPeriodBtn) {
      this.el.restartPeriodBtn.disabled = enabled;
      this.el.restartPeriodBtn.title = enabled
        ? 'Учебните звънци са изключени в събота и неделя'
        : 'Рестартирай ръчния таймер за текущия час';
    }

    if (enabled) {
      this.manualPeriodRunning = false;
      this.manualPeriodSecondsLeft = 0;
      this.clearScheduleRowStatuses();
    }

    this.updateShiftLabel(enabled);
    this.updateDailyBackground(enabled);
  }

  clearScheduleRowStatuses() {
    if (!this.el.scheduleTableBody) return;
    this.el.scheduleTableBody.querySelectorAll('tr').forEach((row) => {
      row.classList.remove('active-row', 'passed-row');
      const pill = row.querySelector('.status-pill');
      if (pill) {
        pill.className = 'status-pill status-upcoming';
        pill.textContent = '—';
      }
    });
  }

  loadWeeklySchedule() {
    const fallback = clone(DEFAULT_WEEKLY_SCHEDULE);
    const saved = localStorage.getItem('school_bell_weekly_schedule_v2');
    if (!saved) return fallback;

    try {
      const parsed = JSON.parse(saved);
      if (!parsed || typeof parsed !== 'object') return fallback;

      const hhmmRe = /^([01]\d|2[0-3]):[0-5]\d$/;
      WEEKDAYS.forEach((day) => {
        const sourceDay = Array.isArray(parsed[day])
          ? parsed[day]
          : (Array.isArray(parsed[WEEKDAY_LABELS[day]]) ? parsed[WEEKDAY_LABELS[day]] : null);
        if (!sourceDay) {
          parsed[day] = clone(fallback[day]);
          return;
        }
        parsed[day] = sourceDay.map((item) => {
          const entry = {
            subject: String(item?.subject || '').trim(),
            hasExam: !!item?.hasExam
          };
          const start = String(item?.startTime || '').trim();
          const end = String(item?.endTime || '').trim();
          if (hhmmRe.test(start)) entry.startTime = start;
          if (hhmmRe.test(end)) entry.endTime = end;
          return entry;
        });
      });
      return parsed;
    } catch (_) {
      return fallback;
    }
  }

  saveWeeklySchedule() {
    localStorage.setItem('school_bell_weekly_schedule_v2', JSON.stringify(this.weeklySchedule));
    this.updateScheduleLabels();
    this.renderScheduleTable();
  }

  loadScheduleConfig() {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(SCHEDULE_CONFIG_KEY) || 'null');
    } catch (_) {}
    // Old installations stored one shared configuration. Copy it to each workday once.
    const legacyConfig = normalizeDayScheduleConfig(saved);
    const savedDays = saved && typeof saved === 'object'
      ? (saved.days && typeof saved.days === 'object' ? saved.days : saved)
      : null;
    return WEEKDAYS.reduce((configs, day) => {
      configs[day] = normalizeDayScheduleConfig(savedDays?.[day], legacyConfig);
      return configs;
    }, {});
  }

  saveScheduleConfig() {
    localStorage.setItem(SCHEDULE_CONFIG_KEY, JSON.stringify(this.scheduleConfig));
    this.updateScheduleLabels();
    this.updateShiftLabel();
  }

  getDayScheduleConfig(day = this.selectedDayKey) {
    return this.scheduleConfig?.[day] || normalizeDayScheduleConfig(DEFAULT_SCHEDULE_CONFIG);
  }

  loadClockConfig() {
    const config = { ...DEFAULT_CLOCK_CONFIG };
    try {
      const saved = JSON.parse(localStorage.getItem(CLOCK_CONFIG_KEY) || 'null');
      if (saved && typeof saved === 'object') Object.assign(config, saved);
    } catch (_) {}

    config.headerTitle = String(config.headerTitle || DEFAULT_CLOCK_CONFIG.headerTitle).slice(0, 40);
    config.headerSubtitle = String(config.headerSubtitle || DEFAULT_CLOCK_CONFIG.headerSubtitle).slice(0, 80);
    config.clockNote = String(config.clockNote || DEFAULT_CLOCK_CONFIG.clockNote).slice(0, 60);
    config.hour12 = !!config.hour12;
    config.showSeconds = config.showSeconds !== false;
    config.showDate = config.showDate !== false;
    config.scale = Math.max(70, Math.min(130, Number(config.scale) || 100));
    return config;
  }

  saveClockConfig() {
    localStorage.setItem(CLOCK_CONFIG_KEY, JSON.stringify(this.clockConfig));
    this.applyClockConfig();
  }

  loadExamConfig() {
    const saved = localStorage.getItem('school_bell_next_exam');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.cleared === true) return { subject: '', dateTime: '', cleared: true };
        if (parsed && typeof parsed === 'object' && typeof parsed.subject === 'string') return parsed;
      } catch (_) {}
    }
    // Нов клас започва без измислено контролно; всяко училище/клас има свои изпити.
    return { subject: '', dateTime: '', cleared: true };
  }

  saveExamConfig() {
    localStorage.setItem('school_bell_next_exam', JSON.stringify(this.examConfig));
  }
  loadExtraExams() {
    try {
      const saved = JSON.parse(localStorage.getItem('school_bell_extra_exams_v1') || '[]');
      return Array.from({ length: 4 }, (_, i) => ({ subject: String(saved[i]?.subject || ''), dateTime: String(saved[i]?.dateTime || '') }));
    } catch (_) { return Array.from({ length: 4 }, () => ({ subject: '', dateTime: '' })); }
  }
  saveExtraExams() {
    localStorage.setItem('school_bell_extra_exams_v1', JSON.stringify(this.extraExams));
  }
  readClassHomeworkCache() {
    const today = todayInSofia();
    try {
      const saved = JSON.parse(localStorage.getItem(CLASS_HOMEWORK_KEY) || '[]');
      if (!Array.isArray(saved)) return [];
      return saved
        .filter(item => item && item.id && item.description && item.dueDate && String(item.dueDate).slice(0, 10) >= today)
        .map(item => ({ ...item, source: 'manual' }));
    } catch (_) {
      return [];
    }
  }

  readCustomAlarms() {
    try {
      const savedAlarms = JSON.parse(localStorage.getItem(CUSTOM_ALARMS_KEY) || '[]');
      if (!Array.isArray(savedAlarms)) return [];
      const today = todayInSofia();
      const seenKeys = new Set();
      const result = [];
      for (let index = 0; index < savedAlarms.length; index++) {
        const alarm = savedAlarms[index];
        if (!alarm || typeof alarm.time !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(alarm.time)) continue;
        const label = typeof alarm.label === 'string' ? alarm.label.trim().slice(0, 120) : '';
        if (!label) continue;
        if (alarm.source === 'shkolo' || String(alarm.id || '').startsWith('sx-')) continue;
        const date = typeof alarm.date === 'string' ? alarm.date : '';
        if (date && date < today) continue;
        const attachmentId = typeof alarm.attachmentId === 'string' && /^att-[a-f0-9]{24}\.(?:webp|jpg|png)$/.test(alarm.attachmentId)
          ? alarm.attachmentId
          : '';
        const dedupeKey = `${date}|${alarm.time}|${label.toLocaleLowerCase('bg')}|${attachmentId}`;
        if (seenKeys.has(dedupeKey)) continue;
        seenKeys.add(dedupeKey);
        result.push({
          id: alarm.id || `al-migrated-${index}`,
          time: alarm.time,
          date,
          label,
          active: alarm.active !== false,
          ...(attachmentId ? { attachmentId } : {})
        });
      }
      return result.sort((a, b) => `${a.date || ''}${a.time}`.localeCompare(`${b.date || ''}${b.time}`));
    } catch (_) {
      return [];
    }
  }

  applyProfileData(data) {
    if (!data || typeof data !== 'object') return;
    const today = todayInSofia();
    const serverHomework = Array.isArray(data.homework)
      ? data.homework.filter(item => item && item.id && item.description && item.dueDate && String(item.dueDate).slice(0, 10) >= today)
      : [];
    const mergedHomework = new Map();
    for (const item of [...this.readClassHomeworkCache(), ...serverHomework]) {
      if (item && item.id) mergedHomework.set(item.id, item);
    }
    this.homeworkItems = [...mergedHomework.values()];
    this.noteItems = Array.isArray(data.notes) ? data.notes.filter(isDisplayableNote) : [];
    const schoolYearStart = `${Number(today.slice(5, 7)) >= 9 ? Number(today.slice(0, 4)) : Number(today.slice(0, 4)) - 1}-09-01`;
    this.shkoloExams = Array.isArray(data.exams)
      ? data.exams
        .filter(exam => exam && exam.title && exam.date && exam.time
          && String(exam.date).slice(0, 10) >= schoolYearStart
          && Number.isFinite(SchoolBellApp.shkoloExamTimestamp(exam)))
        .sort((a, b) => {
          const tsDiff = SchoolBellApp.shkoloExamTimestamp(a) - SchoolBellApp.shkoloExamTimestamp(b);
          if (tsDiff !== 0) return tsDiff;
          return String(a.title || '').localeCompare(String(b.title || ''), 'bg');
        })
      : [];
    this.profileDataError = '';
    this.examSlotSignature = null;
    this.allExamsListSignature = null;
    this.renderHomeworkList();
    this.renderNotesList();
    this.updateExamCountdown();
    this.updateExtraExamCountdowns();
    this.renderShkoloExams();
    this.renderAlarmsList();
    this.renderScheduleTable();
    if (typeof AppI18n !== 'undefined' && AppI18n.lang === 'en') {
      AppI18n.applyDynamic();
    }
  }
  async loadProfileData(options = {}) {
    if (this.profileDataLoading) return;
    this.profileDataLoading = true;
    try {
      const data = await ProfileHomework.load();
      this.applyProfileData(data);
    } catch (error) {
      this.profileDataError = error?.message || 'Домашните не могат да се заредят от сървъра.';
      this.renderHomeworkList();
      this.renderNotesList();
      if (!options.silent) this.showToast(this.profileDataError, 'error');
    } finally {
      this.profileDataLoading = false;
    }
  }
  startProfileDataPolling() {
    if (this.profileDataPollTimer) return;
    this.profileDataPollTimer = setInterval(() => {
      if (!document.hidden) this.loadProfileData({ silent: true });
    }, 30000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.loadProfileData({ silent: true });
    });
  }
  setHomeworkTab(tab) {
    const selected = ['homework', 'remarks', 'praises'].includes(tab) ? tab : 'homework';
    document.querySelectorAll('[data-homework-tab]').forEach(button => {
      const active = button.dataset.homeworkTab === selected;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });
    if (this.el.homeworkPanel) this.el.homeworkPanel.hidden = selected !== 'homework';
    if (this.el.remarksPanel) this.el.remarksPanel.hidden = selected !== 'remarks';
    if (this.el.praisesPanel) this.el.praisesPanel.hidden = selected !== 'praises';
  }
  renderHomeworkList() {
    if (!this.el?.homeworkList) return;
    const today = todayInSofia();
    const activeItems = this.homeworkItems.filter(item => item && item.description && item.dueDate && String(item.dueDate).slice(0, 10) >= today);
    if (this.el.homeworkCount) this.el.homeworkCount.textContent = String(activeItems.length);
    if (!activeItems.length) {
      this.el.homeworkList.replaceChildren(
        createEl('p', {
          className: 'empty-state',
          text: this.profileDataError || 'Няма активни домашни със срок.'
        })
      );
      return;
    }
    const sorted = activeItems.slice().sort((a, b) => (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31'));
    const nodes = sorted.map(item => {
      const source = item.source === 'shkolo'
        ? createEl('span', { className: 'homework-source badge-shkolo', title: 'Синхронизирано от Shkolo (само за четене, управлява се от дневника)', text: '🔒 Shkolo' })
        : createEl('span', { className: 'homework-source badge-class', title: 'Общо домашно за целия клас (вижда се от съучениците в твоя клас)', text: '👥 Клас' });
      const bodyDiv = createEl('div', {}, createEl('strong', { text: item.subject || '' }), ' ', source);
      if (item.teacher) {
        bodyDiv.append(' · ', createEl('span', { title: 'Преподавател', text: item.teacher }));
      }
      const descEl = createExpandableTextEl(item.description, 'homework-description');
      if (descEl) bodyDiv.append(descEl);
      bodyDiv.append(createEl('small', { className: 'homework-due-pill', text: `📅 Срок: ${formatHomeworkDueDate(item.dueDate)}` }));

      const actionsCol = createEl('div', { className: 'homework-actions-col' });
      if (item.attachmentId) {
        const photoBtn = createEl('button', {
          type: 'button',
          className: 'btn btn-outline btn-sm',
          title: 'Отвори подобрената снимка за по-лесно четене',
          text: '🖼️ Виж снимка'
        });
        photoBtn.onclick = () => this.openAttachmentViewer(item.attachmentId, item.subject || 'Домашно');
        actionsCol.append(photoBtn);
      }
      if (item.source === 'shkolo') {
        actionsCol.append(createEl('span', {
          className: 'homework-locked',
          title: 'Синхронизирано от Shkolo — редактира се от учител в дневника',
          text: '🔒 Shkolo'
        }));
      } else {
        const delBtn = createEl('button', {
          type: 'button',
          className: 'btn btn-outline btn-sm',
          title: 'Изтрий това домашно',
          text: 'Изтрий'
        });
        delBtn.onclick = async () => {
          if (delBtn.disabled) return;
          delBtn.disabled = true;
          try {
            const data = await ProfileHomework.deleteHomework(item.id);
            this.applyProfileData(data);
            this.showToast('Домашното е изтрито', 'success');
          } catch (error) {
            delBtn.disabled = false;
            this.showToast(error?.message || 'Домашното не може да бъде изтрито.', 'error');
          }
        };
        actionsCol.append(delBtn);
      }
      return createEl('article', { className: 'homework-item' }, bodyDiv, actionsCol);
    });
    this.el.homeworkList.replaceChildren(...nodes);
  }
  renderNoteCards(container, notes, emptyText) {
    if (!container) return;
    if (!notes.length) {
      container.replaceChildren(
        createEl('p', {
          className: 'empty-state',
          text: this.profileDataError || emptyText
        })
      );
      return;
    }
    const nodes = notes.map(note => {
      const praise = note.kind === 'praise';
      const kindLabel = praise ? '🌟 Похвала' : '📝 Забележка';
      const kindTitle = praise ? 'Лична похвала от учител (вижда се само в твоя личен профил)' : 'Лична забележка от учител (вижда се само в твоя личен профил)';
      const subjectText = note.subject || (praise ? 'Похвала' : 'Забележка');

      const titleWrap = createEl(
        'div',
        { className: 'note-title-wrap' },
        createEl('strong', { text: subjectText }),
        createEl('span', { className: `note-kind${praise ? ' praise' : ''}`, title: kindTitle, text: kindLabel })
      );
      const header = createEl('div', { className: 'note-header' }, titleWrap);
      if (note.teacher) {
        header.append(createEl('span', {
          className: 'note-teacher',
          title: 'Преподавател, въвел записа в Shkolo',
          text: `👨‍🏫 ${note.teacher}`
        }));
      }

      const body = createEl('div', { className: 'note-card-body' }, header);
      const badge = (note.badge || '').trim();
      if (badge) {
        body.append(createEl(
          'div',
          { className: 'note-reason' },
          createEl('span', { className: 'note-reason-tag', title: 'Причина / категория на отзива', text: badge })
        ));
      }

      let detailText = (note.comment || note.description || '').trim();
      if (badge && detailText.toLowerCase() === badge.toLowerCase()) {
        detailText = '';
      }
      const detailsEl = createExpandableTextEl(detailText, 'note-details');
      if (detailsEl) body.append(detailsEl);

      const dateTimeStr = formatNoteDateTime(note.date, note.time);
      if (dateTimeStr) {
        body.append(createEl(
          'div',
          { className: 'note-meta-row' },
          createEl('small', { className: 'note-datetime', title: 'Дата и точен час на отзива в дневника', text: `🕒 ${dateTimeStr}` })
        ));
      }

      return createEl('article', { className: `homework-item note-card${praise ? ' praise' : ''}` }, body);
    });
    container.replaceChildren(...nodes);
  }
  renderNotesList() {
    if (!this.el?.remarksList && !this.el?.praisesList) return;
    const notes = this.noteItems.slice().sort((a, b) => {
      const dtA = `${a.date || ''} ${a.time || ''} ${a.syncedAt || ''}`.trim();
      const dtB = `${b.date || ''} ${b.time || ''} ${b.syncedAt || ''}`.trim();
      return dtB.localeCompare(dtA);
    });
    const remarks = notes.filter(note => note.kind !== 'praise');
    const praises = notes.filter(note => note.kind === 'praise');
    if (this.el.remarksCount) this.el.remarksCount.textContent = String(remarks.length);
    if (this.el.praisesCount) this.el.praisesCount.textContent = String(praises.length);
    this.renderNoteCards(this.el.remarksList, remarks, 'Няма лични забележки от Shkolo.');
    this.renderNoteCards(this.el.praisesList, praises, 'Няма лични похвали от Shkolo.');
  }
  // ── Единен списък с предстоящи изпити ─────────────────────────────────
  // Главният часовник показва най-близкия изпит, а четирите допълнителни
  // часовника — следващите по ред. Изпитите от Shkolo и ръчно добавените
  // се подреждат заедно по дата; миналите изпити изчезват автоматично.
  static manualExamTimestamp(dateTime) {
    const value = String(dateTime || '');
    const match = /^(\d{4}-\d{2}-\d{2})T(\d{1,2}:\d{2})/.exec(value);
    if (match) return sofiaDateTimeTimestamp(match[1], match[2]);
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  getUpcomingExams(now = new Date()) {
    const nowMs = now.getTime();
    const todayKey = todayInSofia();
    const list = [];
    const seen = new Set();
    const push = entry => {
      if (!Number.isFinite(entry.ts)) return;
      const validEstimatedToday = Boolean(entry.exam?.timeEstimated && String(entry.exam?.date || '') >= todayKey);
      if (!validEstimatedToday && entry.ts <= nowMs) return;
      const signature = `${entry.dateTime}|${String(entry.title || '').trim().toLocaleLowerCase('bg')}`;
      if (seen.has(signature)) return;
      seen.add(signature);
      list.push(entry);
    };
    for (const exam of this.shkoloExams || []) {
      push({
        key: `shkolo:${exam.id || exam.externalId || `${exam.title}|${exam.date}|${exam.time}`}`,
        source: 'shkolo',
        title: exam.title || exam.subject || 'Изпит',
        ts: SchoolBellApp.shkoloExamTimestamp(exam),
        dateTime: `${exam.date}T${String(exam.time || '').slice(0, 5)}`,
        exam
      });
    }
    if (this.examConfig?.subject && this.examConfig?.dateTime) {
      push({ key: 'main', source: 'main', title: this.examConfig.subject, ts: SchoolBellApp.manualExamTimestamp(this.examConfig.dateTime), dateTime: this.examConfig.dateTime });
    }
    (this.extraExams || []).forEach((exam, index) => {
      if (!exam.subject || !exam.dateTime) return;
      push({ key: `extra:${index}`, source: 'extra', index, title: exam.subject, ts: SchoolBellApp.manualExamTimestamp(exam.dateTime), dateTime: exam.dateTime });
    });
    return list.sort((a, b) => a.ts - b.ts);
  }

  formatExamEntryDate(entry) {
    if (!entry) return '';
    if (entry.source === 'shkolo') return this.formatShkoloExamDate(entry.exam);
    const d = new Date(entry.ts);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getDate()} ${BG_MONTHS[d.getMonth()]} ${d.getFullYear()} в ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ч.`;
  }

  // Изтрива ръчно въведените изпити, чийто час вече е минал.
  pruneExpiredManualExams(now = new Date()) {
    const nowMs = now.getTime();
    if (this.lastExamPruneAt && nowMs - this.lastExamPruneAt < 30000) return false;
    this.lastExamPruneAt = nowMs;
    let changed = false;
    if (this.examConfig?.subject && this.examConfig?.dateTime) {
      const ts = SchoolBellApp.manualExamTimestamp(this.examConfig.dateTime);
      if (Number.isFinite(ts) && ts <= nowMs) {
        this.examConfig = { subject: '', dateTime: '', cleared: true };
        this.saveExamConfig();
        changed = true;
      }
    }
    let extraChanged = false;
    this.extraExams = (this.extraExams || []).map(exam => {
      if (!exam.subject || !exam.dateTime) return exam;
      const ts = SchoolBellApp.manualExamTimestamp(exam.dateTime);
      if (Number.isFinite(ts) && ts <= nowMs) { extraChanged = true; return { subject: '', dateTime: '' }; }
      return exam;
    });
    if (extraChanged) { this.saveExtraExams(); changed = true; }
    return changed;
  }

  removeManualExam(entry) {
    if (!entry) return false;
    if (entry.source === 'main') {
      this.examConfig = { subject: '', dateTime: '', cleared: true };
      this.saveExamConfig();
      return true;
    }
    if (entry.source === 'extra' && Number.isInteger(entry.index)) {
      this.extraExams[entry.index] = { subject: '', dateTime: '' };
      this.saveExtraExams();
      return true;
    }
    return false;
  }

  // Записва ръчен изпит: върху посочения запис или в първото свободно място.
  storeManualExam(subject, dateTime, target = null) {
    const nowMs = Date.now();
    const free = exam => !exam?.subject || !exam?.dateTime || !(SchoolBellApp.manualExamTimestamp(exam.dateTime) > nowMs);
    if (target?.source === 'main') {
      this.examConfig = { subject, dateTime };
      this.saveExamConfig();
      return true;
    }
    if (target?.source === 'extra' && Number.isInteger(target.index)) {
      this.extraExams[target.index] = { subject, dateTime };
      this.saveExtraExams();
      return true;
    }
    if (free(this.examConfig)) {
      this.examConfig = { subject, dateTime };
      this.saveExamConfig();
      return true;
    }
    const index = this.extraExams.findIndex(free);
    if (index < 0) return false;
    this.extraExams[index] = { subject, dateTime };
    this.saveExtraExams();
    return true;
  }

  renderExamSlots(upcoming = this.getUpcomingExams(), force = false) {
    const slots = upcoming.slice(1, 5);
    const signature = slots.map(entry => `${entry.key}|${entry.ts}|${entry.title}`).join('#');
    if (!force && signature === this.examSlotSignature) return this.examSlots;
    this.examSlotSignature = signature;
    this.examSlots = slots;
    for (let i = 0; i < 4; i += 1) {
      const entry = slots[i] || null;
      const isShkolo = entry?.source === 'shkolo';
      const card = document.querySelector(`[data-extra-exam="${i}"]`);
      const subject = document.getElementById(`extraExamSubject${i}`);
      const date = document.getElementById(`extraExamDate${i}`);
      if (card) {
        card.classList.toggle('from-shkolo', isShkolo);
        card.dataset.source = entry ? entry.source : 'empty';
        const title = card.querySelector('.countdown-title');
        if (title) title.textContent = isShkolo ? `Изпит ${i + 2} · 🔒 Shkolo` : `Изпит ${i + 2}`;
        card.querySelectorAll('.save-extra-exam, .clear-extra-exam').forEach(button => { button.hidden = isShkolo; });
      }
      const focused = document.activeElement === subject || document.activeElement === date;
      if (force || !focused) {
        if (subject) subject.value = entry ? entry.title : '';
        if (date) date.value = entry ? entry.dateTime : '';
      }
      [subject, date].forEach(input => {
        if (!input) return;
        input.disabled = isShkolo;
        input.title = isShkolo ? 'Изпитът идва от Shkolo и се изтрива автоматично, след като мине.' : '';
      });
    }
    return slots;
  }

  updateExtraExamCountdowns(now = new Date()) {
    if (this.pruneExpiredManualExams(now)) this.examSlotSignature = null;
    const slots = this.renderExamSlots(this.getUpcomingExams(now));
    for (let i = 0; i < 4; i += 1) {
      const entry = slots[i] || null;
      const display = document.getElementById(`extraExamCountdown${i}`);
      const info = document.getElementById(`extraExamInfo${i}`);
      if (!entry) {
        if (display) display.textContent = 'Не е зададен';
        if (info) info.textContent = 'Няма следващ изпит · добавете ръчно';
        continue;
      }
      const countdown = formatCountdownDHMS(entry.ts - now.getTime());
      if (display) display.textContent = `${countdown.days}д ${countdown.hours}ч ${countdown.mins}м ${countdown.secs}с`;
      if (info) info.textContent = `${entry.source === 'shkolo' ? 'Shkolo · ' : ''}${entry.title} · ${this.formatExamEntryDate(entry)}`;
    }
  }

  static shkoloExamTimestamp(exam) {
    if (!exam || !exam.date || !exam.time) return NaN;
    // Часът идва от Shkolo като българско време, независимо от часовата зона
    // на устройството. Не използваме new Date(...), за да няма разместване.
    return sofiaDateTimeTimestamp(exam.date, exam.time);
  }

  getNextShkoloExam(now = new Date()) {
    return this.shkoloExams
      .filter(exam => SchoolBellApp.shkoloExamTimestamp(exam) >= now.getTime())
      .sort((a, b) => SchoolBellApp.shkoloExamTimestamp(a) - SchoolBellApp.shkoloExamTimestamp(b))[0] || null;
  }

  formatShkoloExamDate(exam) {
    if (!exam || !exam.date || !exam.time) return '';
    const date = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(exam.date));
    const time = /^(\d{1,2}):(\d{2})/.exec(String(exam.time));
    if (!date || !time) return '';
    const hhmm = `${time[1].padStart(2, '0')}:${time[2]}`;
    if (exam.timeEstimated) {
      const periodNote = exam.periodNumber ? `${exam.periodNumber} час (~${hhmm} ч.)` : `~${hhmm} ч. (без час в Shkolo)`;
      return `${date[3]}.${date[2]}.${date[1]} · ${periodNote}`;
    }
    return `${date[3]}.${date[2]}.${date[1]} · ${hhmm} ч. (българско време)`;
  }

  renderShkoloExams(now = new Date()) {
    if (!this.el?.shkoloExamsList) return;
    const allUpcoming = this.getUpcomingExams(now);
    const upcomingKeys = new Set(allUpcoming.map(e => e.key));
    const nowMs = now.getTime();
    const pastExams = (this.shkoloExams || [])
      .map(exam => ({
        key: `shkolo:${exam.id || exam.externalId || `${exam.title}|${exam.date}|${exam.time}`}`,
        source: 'shkolo',
        title: exam.title || exam.subject || 'Изпит',
        ts: SchoolBellApp.shkoloExamTimestamp(exam),
        dateTime: `${exam.date}T${String(exam.time || '').slice(0, 5)}`,
        exam,
        isPast: true
      }))
      .filter(entry => Number.isFinite(entry.ts) && entry.ts <= nowMs && !upcomingKeys.has(entry.key))
      .sort((a, b) => b.ts - a.ts);
    const allDisplayed = [...allUpcoming, ...pastExams];
    const signature = allDisplayed.map(entry => `${entry.key}|${entry.ts}|${entry.title}|${entry.isPast ? 1 : 0}|${entry.exam?.timeEstimated ? 1 : 0}`).join('#');
    if (signature === this.allExamsListSignature && this.el.shkoloExamsList.dataset.rendered === '1') {
      return;
    }
    this.allExamsListSignature = signature;
    const count = allDisplayed.length;
    if (this.el.shkoloExamsCount) this.el.shkoloExamsCount.textContent = String(count);
    if (this.el.shkoloExamsCard) this.el.shkoloExamsCard.hidden = false;
    this.el.shkoloExamsList.dataset.rendered = '1';
    if (!count) {
      this.el.shkoloExamsList.replaceChildren(
        createEl('p', { className: 'empty-state', text: 'Няма синхронизирани изпити. Добавете ръчно или синхронизирайте със Shkolo.' })
      );
      return;
    }
    const nodes = allDisplayed.map((entry, index) => {
      const isShkolo = entry.source === 'shkolo';
      const isPast = Boolean(entry.isPast);
      const titleText = entry.title || entry.exam?.subject || 'Изпит';
      const titleRow = createEl(
        'div',
        { className: 'shkolo-exam-title-row' },
        createEl('span', { className: `shkolo-exam-source${isShkolo ? '' : ' is-manual'}`, text: isShkolo ? 'Shkolo' : 'Ръчен' }),
        createEl('strong', { text: titleText })
      );
      if (isShkolo && entry.exam?.subject && entry.exam.subject !== entry.title) {
        titleRow.append(createEl('span', { className: 'shkolo-exam-subject', text: entry.exam.subject }));
      }
      const copyDiv = createEl(
        'div',
        { className: 'shkolo-exam-copy' },
        titleRow,
        createEl('span', { className: 'shkolo-exam-date', text: `📅 ${this.formatExamEntryDate(entry)}` })
      );
      const safeUrl = isShkolo ? safeHttpUrl(entry.exam?.url) : '';
      if (safeUrl) {
        copyDiv.append(createEl('a', {
          className: 'shkolo-exam-link',
          href: safeUrl,
          target: '_blank',
          rel: 'noopener noreferrer',
          text: 'Отвори в Shkolo ↗'
        }));
      }

      let clockBadge;
      if (isPast) {
        clockBadge = createEl('span', {
          className: 'shkolo-exam-queue-badge is-past',
          title: 'Изпитът вече е минал през текущата учебна година',
          text: '✅ Отминал'
        });
      } else if (index < 5) {
        clockBadge = createEl('span', {
          className: 'shkolo-exam-clock-badge',
          title: `Отброява се от часовник #${index + 1} на таблото`,
          text: `⏱️ Часовник #${index + 1}`
        });
      } else {
        clockBadge = createEl('span', {
          className: 'shkolo-exam-queue-badge',
          title: 'Пореден предстоящ изпит (извън 5-те часовника)',
          text: `#${index + 1}`
        });
      }

      const metaDiv = createEl('div', { className: 'shkolo-exam-meta' }, clockBadge);
      if (!isShkolo) {
        const deleteBtn = createEl('button', {
          type: 'button',
          className: 'btn btn-outline btn-sm shkolo-exam-delete',
          title: 'Изтрий ръчния изпит',
          dataset: { manualExamIdx: String(index) },
          text: '🗑️'
        });
        deleteBtn.onclick = () => {
          this.removeManualExam(entry);
          this.allExamsListSignature = null;
          this.examSlotSignature = null;
          this.updateExamCountdown();
          this.updateExtraExamCountdowns();
          this.renderShkoloExams();
          this.showToast('Изпитът беше изтрит.', 'success');
        };
        metaDiv.append(deleteBtn);
      }

      const rowClass = isPast ? 'is-past' : (index < 5 ? 'is-on-clock' : '');
      return createEl(
        'article',
        {
          className: `shkolo-exam-item${rowClass ? ' ' + rowClass : ''}`,
          dataset: { examKey: entry.key }
        },
        copyDiv,
        metaDiv
      );
    });
    this.el.shkoloExamsList.replaceChildren(...nodes);
  }

  updateShkoloExamCountdowns(now = new Date()) {
    const allUpcoming = this.getUpcomingExams(now);
    const signature = allUpcoming.map(entry => `${entry.key}|${entry.ts}|${entry.title}|${entry.exam?.timeEstimated ? 1 : 0}`).join('#');
    if (signature !== this.allExamsListSignature) {
      this.renderShkoloExams(now);
    }
  }

  shkoloExamForSchedule(item, dateKey = todayInSofia()) {
    if (!item || item.type !== 'class') return null;
    const todayKey = dateKey || todayInSofia();
    // The schedule and the exams both use the Bulgarian school day. Deriving
    // the weekday from the Sofia date avoids an off-by-one day around midnight.
    const currentDay = new Date(`${todayKey}T12:00:00Z`).getUTCDay();
    if (currentDay < 1 || currentDay > 5) return null;
    const selectedTodayKey = WEEKDAYS[currentDay - 1];
    if (this.selectedDayKey !== selectedTodayKey) return null;
    return this.shkoloExams.find(exam => {
      if (exam.date !== todayKey) return false;
      if (exam.periodNumber && item.periodNumber && Number(exam.periodNumber) === Number(item.periodNumber)) return true;
      if (exam.timeEstimated && !exam.periodNumber && exam.subject && item.rawSubject) {
        const a = String(exam.subject).trim().toLocaleLowerCase('bg');
        const b = String(item.rawSubject).trim().toLocaleLowerCase('bg');
        if (a && b && (a === b || a.includes(b) || b.includes(a))) return true;
      }
      if (!exam.time) return false;
      const examMinutes = parseTimeToMinutes(exam.time);
      return examMinutes >= item.startMin && examMinutes < item.endMin;
    }) || null;
  }

  loadVacations() {
    let saved = [];
    try {
      const parsed = JSON.parse(localStorage.getItem('school_bell_vacations_v2') || 'null');
      if (Array.isArray(parsed)) saved = parsed.filter(v => v && v.id && v.name && v.date);
    } catch (_) {}
    const previousDefaults = { autumn: '2026-11-01T00:00:00', christmas: '2026-12-24T00:00:00', midterm: '2027-02-05T00:00:00', spring: '2027-04-03T00:00:00', summer: '2027-06-30T00:00:00' };
    const defaults = defaultVacationsForCurrentClass();
    const merged = defaults.map(defaultItem => {
      const item = saved.find(v => v.id === defaultItem.id);
      if (!item) return { ...defaultItem };
      const wasOldDefault = item.date === previousDefaults[item.id];
      return { ...defaultItem, ...item,
        date: wasOldDefault ? defaultItem.date : item.date,
        endDate: wasOldDefault || !item.endDate ? defaultItem.endDate : item.endDate };
    });
    for (const item of saved) if (!merged.some(v => v.id === item.id)) merged.push(item);
    const today = todayInSofia();
    const active = merged.filter(v => String(v.endDate || v.date || '').slice(0, 10) >= today);
    try { localStorage.setItem('school_bell_vacations_v2', JSON.stringify(active)); } catch (_) {}
    return active;
  }

  schoolYearEndDate() {
    return defaultSchoolYearEndForCurrentClass();
  }

  visibleVacations() {
    const today = todayInSofia();
    const end = this.schoolYearEndDate();
    return this.vacations.filter(v => {
      const vEnd = String(v.endDate || v.date || '').slice(0, 10);
      return vEnd >= today && String(v.date || '').slice(0, 10) <= end;
    });
  }

  loadVacationConfig() {
    const today = todayInSofia();
    const visible = this.visibleVacations();
    try {
      const saved = JSON.parse(localStorage.getItem('school_bell_vacation') || 'null');
      if (saved && saved.id) {
        const found = visible.find(v => v.id === saved.id);
        if (found) {
          const end = String(found.endDate || found.date || '').slice(0, 10);
          if (end >= today) return found;
        }
      }
    } catch (_) {}
    return visible.find(v => v.id === 'christmas') || visible[0] || { id: 'none', name: 'Няма предстоящи ваканции', date: '', endDate: '' };
  }

  saveVacationConfig() {
    localStorage.setItem('school_bell_vacations_v2', JSON.stringify(this.vacations));
    localStorage.setItem('school_bell_vacation', JSON.stringify(this.vacationConfig));
  }

  loadNoSchoolDays() {
    let saved = [];
    try {
      const parsed = JSON.parse(localStorage.getItem('school_bell_no_school_days_v1') || '[]');
      if (Array.isArray(parsed)) saved = parsed.filter(d => d && d.id && d.date && d.description);
    } catch (_) {}
    const defaults = defaultNoSchoolDaysForCurrentClass();
    const merged = defaults.map(day => {
      const savedDay = saved.find(item => item.id === day.id);
      return savedDay ? { ...day, ...savedDay } : { ...day };
    });
    for (const item of saved) if (!merged.some(day => day.id === item.id)) merged.push(item);
    const today = todayInSofia();
    const active = merged.filter(d => String(d.endDate || d.date || '').slice(0, 10) >= today);
    try { localStorage.setItem('school_bell_no_school_days_v1', JSON.stringify(active)); } catch (_) {}
    return active;
  }

  pruneExpiredVacations(now = new Date()) {
    const today = todayInSofia();
    let changed = false;
    const beforeCount = this.vacations.length;
    this.vacations = (this.vacations || []).filter(v => {
      const end = String(v.endDate || v.date || '').slice(0, 10);
      return end >= today;
    });
    if (this.vacations.length !== beforeCount) {
      localStorage.setItem('school_bell_vacations_v2', JSON.stringify(this.vacations));
      changed = true;
    }
    const beforeNoSchool = this.noSchoolDays.length;
    this.noSchoolDays = (this.noSchoolDays || []).filter(d => {
      const end = String(d.endDate || d.date || '').slice(0, 10);
      return end >= today;
    });
    if (this.noSchoolDays.length !== beforeNoSchool) {
      this.saveNoSchoolDays();
      changed = true;
    }
    const currentEnd = String(this.vacationConfig?.endDate || this.vacationConfig?.date || '').slice(0, 10);
    if (!currentEnd || currentEnd < today) {
      this.vacationConfig = this.loadVacationConfig();
      localStorage.setItem('school_bell_vacation', JSON.stringify(this.vacationConfig));
      changed = true;
    }
    if (changed) {
      this.renderVacationOptions();
      this.renderNoSchoolDays();
    }
    return changed;
  }

  saveNoSchoolDays() {
    localStorage.setItem('school_bell_no_school_days_v1', JSON.stringify(this.noSchoolDays));
    this.renderNoSchoolDays();
  }

  renderVacationOptions() {
    if (!this.el?.vacationSelect) return;
    const shortDate = value => {
      const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
      return match ? `${match[3]}.${match[2]}` : String(value || '');
    };
    const visible = this.visibleVacations();
    if (!visible.some(v => v.id === this.vacationConfig.id)) {
      this.vacationConfig = visible.find(v => v.id === 'christmas') || visible[0] || this.vacationConfig;
    }
    const endDate = this.schoolYearEndDate();
    const endDateLabel = /^\d{4}-\d{2}-\d{2}$/.test(endDate)
      ? `${endDate.slice(8, 10)}.${endDate.slice(5, 7)}.${endDate.slice(0, 4)}`
      : endDate;
    const optionNodes = visible.map(v => {
      const start = String(v.date).slice(0, 10);
      const end = String(v.endDate || v.date).slice(0, 10);
      const range = start === end ? shortDate(start) : `${shortDate(start)}–${shortDate(end)}`;
      const shortName = String(v.name).replace(/\s+ваканция$/i, '');
      const fullRange = start === end ? start : `${start} – ${end}`;
      return createEl('option', {
        value: v.id,
        title: `${v.name}: ${fullRange}`,
        text: `${shortName} (${range})`
      });
    });
    optionNodes.push(createEl('option', {
      value: '',
      disabled: true,
      title: `Край на втория учебен срок: ${endDate}`,
      text: `🎓 Край на учебната година – ${endDateLabel}`
    }));
    this.el.vacationSelect.replaceChildren(...optionNodes);
    this.el.vacationSelect.value = this.vacationConfig.id;
    if (this.el.vacationDateInput) this.el.vacationDateInput.value = String(this.vacationConfig.date).slice(0, 10);
    if (this.el.vacationEndDateInput) this.el.vacationEndDateInput.value = this.vacationConfig.endDate || String(this.vacationConfig.date).slice(0, 10);
  }

  renderNoSchoolDays() {
    if (!this.el?.noSchoolDaysList) return;
    if (!this.noSchoolDays.length) {
      this.el.noSchoolDaysList.replaceChildren(
        createEl('p', { className: 'empty-state', text: 'Няма добавени неучебни дни.' })
      );
      return;
    }
    const nodes = this.noSchoolDays.slice().sort((a, b) => a.date.localeCompare(b.date)).map(d => {
      const rangeLabel = d.endDate && d.endDate !== d.date ? `${d.date} – ${d.endDate}` : d.date;
      const span = createEl('span', {}, createEl('strong', { text: rangeLabel }), ` — ${d.description || ''}`);
      const delBtn = createEl('button', {
        type: 'button',
        className: 'btn btn-outline btn-sm',
        text: 'Изтрий'
      });
      delBtn.onclick = () => {
        this.noSchoolDays = this.noSchoolDays.filter(item => item.id !== d.id);
        this.saveNoSchoolDays();
      };
      return createEl('div', { className: 'no-school-day-item' }, span, delBtn);
    });
    this.el.noSchoolDaysList.replaceChildren(...nodes);
  }

  /**
   * Generates the 7 periods and breaks for the selected day
   */
  compileCurrentDaySchedule() {
    const config = this.getDayScheduleConfig();
    const daySubjects = this.weeklySchedule[this.selectedDayKey] || DEFAULT_WEEKLY_SCHEDULE.monday;
    const classMins = config.classMinutes;
    const smallBreakMins = config.smallBreakMinutes;
    const bigBreakMins = config.bigBreakMinutes;
    const bigBreakAfter = config.bigBreakAfter;
    const lastSubjectPeriod = Array.isArray(daySubjects)
      ? daySubjects.reduce((acc, s, idx) => (s && String(s.subject || '').trim() ? idx + 1 : acc), 0)
      : 0;
    const periods = Math.min(12, Math.max(config.periods || 7, lastSubjectPeriod));
    const hhmmRe = /^([01]\d|2[0-3]):[0-5]\d$/;
    let currentMinutes = parseTimeToMinutes(config.startTime);

    const schedule = [];
    for (let i = 1; i <= periods; i++) {
      const subjObj = daySubjects[i - 1] || { subject: '', hasExam: false };
      const slotStart = subjObj.startTime && hhmmRe.test(String(subjObj.startTime))
        ? parseTimeToMinutes(subjObj.startTime) : -1;
      const slotEnd = subjObj.endTime && hhmmRe.test(String(subjObj.endTime))
        ? parseTimeToMinutes(subjObj.endTime) : -1;
      const classStart = slotStart >= 0 ? slotStart : currentMinutes;
      const dur = (slotStart >= 0 && slotEnd > slotStart) ? (slotEnd - slotStart) : classMins;
      const classEnd = classStart + dur;
      const subject = String(subjObj.subject || '').trim() || 'Учебен час';
      const scheduleSlot = { type: 'class', periodNumber: i, rawSubject: subject, startMin: classStart, endMin: classEnd };
      const shkoloExam = this.shkoloExamForSchedule(scheduleSlot);

      schedule.push({
        id: `class-${i}`,
        type: 'class',
        periodNumber: i,
        title: `${i}. ${subject}`,
        rawSubject: subject,
        hasExam: !!subjObj.hasExam || !!shkoloExam,
        examSubject: shkoloExam?.subject || '',
        examTitle: shkoloExam?.title || '',
        startMin: classStart,
        endMin: classEnd,
        startTime: formatMinutesToTime(classStart),
        endTime: formatMinutesToTime(classEnd),
        duration: dur
      });

      currentMinutes = classEnd;

      if (i < periods) {
        const nextSubjObj = daySubjects[i] || null;
        const nextSlotStart = nextSubjObj?.startTime && hhmmRe.test(String(nextSubjObj.startTime))
          ? parseTimeToMinutes(nextSubjObj.startTime) : -1;
        const isBigBreak = (i === bigBreakAfter);
        const defaultBreak = isBigBreak ? bigBreakMins : smallBreakMins;
        const breakDuration = (nextSlotStart >= classEnd && (nextSlotStart - classEnd) <= 45)
          ? (nextSlotStart - classEnd)
          : defaultBreak;
        if (breakDuration > 0) {
          const breakStart = currentMinutes;
          const breakEnd = breakStart + breakDuration;

          schedule.push({
            id: `break-${i}`,
            type: (isBigBreak || breakDuration >= 15) ? 'big-break' : 'break',
            periodNumber: null,
            title: (isBigBreak || breakDuration >= 15) ? `Голямо междучасие (${breakDuration} мин)` : `Междучасие (${breakDuration} мин)`,
            rawSubject: '',
            hasExam: false,
            startMin: breakStart,
            endMin: breakEnd,
            startTime: formatMinutesToTime(breakStart),
            endTime: formatMinutesToTime(breakEnd),
            duration: breakDuration
          });

          currentMinutes = breakEnd;
        }
      }
    }
    return schedule;
  }

  updateShiftLabel(weekend = this.isWeekend()) {
    if (!this.el || !this.el.shiftTag) return;
    if (weekend) {
      this.el.shiftTag.textContent = '🌙 Почивен ден (събота/неделя)';
      if (this.el.footerInfo) {
        this.el.footerInfo.textContent =
          'Училищен дигитален будилник за телефон • Почивен ден • Учебните звънци са изключени • Версия 58 • 16.11.2026';
      }
      return;
    }
    const schedule = this.compileCurrentDaySchedule();
    if (!schedule.length) return;
    const first = schedule[0];
    const last = schedule[schedule.length - 1];
    this.el.shiftTag.textContent = `🌅 1 смяна (${first.startTime} - ${last.endTime})`;
    if (this.el.footerInfo) {
      this.el.footerInfo.textContent =
        `Училищен дигитален будилник за телефон • 1 смяна (${first.startTime} - ${last.endTime}) • Всички настройки се запазват автоматично • Версия 58 • 16.11.2026`;
    }
  }

  updateScheduleLabels() {
    if (this.el && this.el.dayScheduleSelect) {
      const options = Array.from(this.el.dayScheduleSelect.options);
      options.forEach((option) => {
        const day = option.value;
        const label = WEEKDAY_LABELS[day] || option.textContent;
        option.textContent = `${label} (${this.getDayScheduleConfig(day).periods} часа)`;
      });
      this.el.dayScheduleSelect.value = this.selectedDayKey;
    }

    const config = this.getDayScheduleConfig();

    if (this.el && this.el.restartPeriodBtn) {
      this.el.restartPeriodBtn.replaceChildren(
        createEl('span', { text: `🔄 Рестартирай часа (${config.classMinutes} мин)` })
      );
    }

    if (this.el && this.el.legendClass) {
      this.el.legendClass.textContent = `Учебен час (${config.classMinutes} мин)`;
    }
    if (this.el && this.el.legendBreak) {
      this.el.legendBreak.textContent = `Малко междучасие (${config.smallBreakMinutes} мин)`;
      this.el.legendBreak.style.display = config.smallBreakMinutes > 0 ? '' : 'none';
    }
    if (this.el && this.el.legendBigBreak) {
      this.el.legendBigBreak.textContent = `☕ Голямо междучасие (${config.bigBreakMinutes} мин)`;
      this.el.legendBigBreak.style.display = config.bigBreakMinutes > 0 ? '' : 'none';
    }

    this.updateShiftLabel();
  }

  cacheElements() {
    this.el = {
      // Audio Banner
      audioBanner: document.getElementById('audioBanner'),
      unlockAudioBtn: document.getElementById('unlockAudioBtn'),

      // Big Normal Clock Card
      mainClockCard: document.getElementById('mainClockCard'),
      clockDisplay: document.getElementById('currentTimeDisplay'),
      currentDateDisplay: document.getElementById('currentDateDisplay'),
      dailyThemeBadge: document.getElementById('dailyThemeBadge'),
      cycleThemeBtn: document.getElementById('cycleThemeBtn'),
      clockSettingsBtn: document.getElementById('clockSettingsBtn'),
      shiftTag: document.getElementById('shiftTag'),
      clockNote: document.getElementById('clockNote'),
      headerTitle: document.getElementById('headerTitle'),
      headerSubtitle: document.getElementById('headerSubtitle'),
      legendClass: document.getElementById('legendClass'),
      legendBreak: document.getElementById('legendBreak'),
      legendBigBreak: document.getElementById('legendBigBreak'),
      footerInfo: document.getElementById('footerInfo'),

      // Countdown Timer 1: Period / Break
      periodTimerDisplay: document.getElementById('periodTimerDisplay'),
      periodStatusLabel: document.getElementById('periodStatusLabel'),
      periodStatusTitle: document.getElementById('periodStatusTitle'),
      periodProgressBarFill: document.getElementById('periodProgressBarFill'),
      periodElapsedText: document.getElementById('periodElapsedText'),
      periodRemainingText: document.getElementById('periodRemainingText'),
      restartPeriodBtn: document.getElementById('restartPeriodBtn'),

      // Countdown Timer 2: Exam / Test
      examTimerDisplay: document.getElementById('examTimerDisplay'),
      examTitleDisplay: document.getElementById('examTitleDisplay'),
      examDateDisplay: document.getElementById('examDateDisplay'),
      editExamBtn: document.getElementById('editExamBtn'),
      clearExamBtn: document.getElementById('clearExamBtn'),
      testExamAlertBtn: document.getElementById('testExamAlertBtn'),

      // Countdown Timer 3: Vacation
      vacationTimerDisplay: document.getElementById('vacationTimerDisplay'),
      vacationTitleDisplay: document.getElementById('vacationTitleDisplay'),
      vacationSelect: document.getElementById('vacationSelect'),
      vacationDateInput: document.getElementById('vacationDateInput'),
      vacationEndDateInput: document.getElementById('vacationEndDateInput'),
      saveVacationBtn: document.getElementById('saveVacationBtn'),
      noSchoolDateInput: document.getElementById('noSchoolDateInput'),
      noSchoolDescriptionInput: document.getElementById('noSchoolDescriptionInput'),
      addNoSchoolDayBtn: document.getElementById('addNoSchoolDayBtn'),
      noSchoolDaysList: document.getElementById('noSchoolDaysList'),

      // Exam Alert Active Banner
      liveExamAlertBanner: document.getElementById('liveExamAlertBanner'),
      liveExamAlertText: document.getElementById('liveExamAlertText'),

      // Schedule dropdown for the day
      dayScheduleSelect: document.getElementById('dayScheduleSelect'),
      weekdayTabs: document.getElementById('weekdayTabs'),
      scheduleTableBody: document.getElementById('scheduleTableBody'),
      editScheduleBtn: document.getElementById('editScheduleBtn'),
      resetScheduleBtn: document.getElementById('resetScheduleBtn'),
      scheduleMainCard: document.querySelector('.schedule-main-card'),
      weekendBanner: document.getElementById('weekendBanner'),
      weekendScheduleNotice: document.getElementById('weekendScheduleNotice'),

      // Simulator Quick Buttons
      simBreakBtn: document.getElementById('simBreakBtn'),
      simWarningBtn: document.getElementById('simWarningBtn'),
      simBellBtn: document.getElementById('simBellBtn'),
      simResetBtn: document.getElementById('simResetBtn'),

      // Sound settings
      bellToneSelect: document.getElementById('bellToneSelect'),
      previewSoundBtn: document.getElementById('previewSoundBtn'),
      volumeSlider: document.getElementById('volumeSlider'),
      volumeValueLabel: document.getElementById('volumeValueLabel'),
      autoRingToggle: document.getElementById('autoRingToggle'),
      preBellToggle: document.getElementById('preBellToggle'),
      vibrationToggle: document.getElementById('vibrationToggle'),
      notificationToggle: document.getElementById('notificationToggle'),

      // Header tools
      audioInitBtn: document.getElementById('audioInitBtn'),
      wakeLockBtn: document.getElementById('wakeLockBtn'),
      fullscreenBtn: document.getElementById('fullscreenBtn'),
      themeToggleBtn: document.getElementById('themeToggleBtn'),
      themeSelect: document.getElementById('themeSelect'),
      themeIntensityRange: document.getElementById('themeIntensityRange'),
      themeIntensityValue: document.getElementById('themeIntensityValue'),
      themeIcon: document.getElementById('themeIcon'),

      // Exam Modal
      examModal: document.getElementById('examModal'),
      clearExamModalBtn: document.getElementById('clearExamModalBtn'),
      modalExamSubject: document.getElementById('modalExamSubject'),
      modalExamDateTime: document.getElementById('modalExamDateTime'),
      closeExamModalBtn: document.getElementById('closeExamModalBtn'),
      cancelExamModalBtn: document.getElementById('cancelExamModalBtn'),
      saveExamModalBtn: document.getElementById('saveExamModalBtn'),

      // Schedule editor modal
      scheduleEditorModal: document.getElementById('scheduleEditorModal'),
      scheduleStartTime: document.getElementById('scheduleStartTime'),
      scheduleClassMinutes: document.getElementById('scheduleClassMinutes'),
      scheduleSmallBreak: document.getElementById('scheduleSmallBreak'),
      scheduleBigBreak: document.getElementById('scheduleBigBreak'),
      scheduleBigBreakAfter: document.getElementById('scheduleBigBreakAfter'),
      schedulePeriods: document.getElementById('schedulePeriods'),
      scheduleEditorDay: document.getElementById('scheduleEditorDay'),
      schedulePeriodsList: document.getElementById('schedulePeriodsList'),
      scheduleEditorSummary: document.getElementById('scheduleEditorSummary'),
      closeScheduleEditorBtn: document.getElementById('closeScheduleEditorBtn'),
      cancelScheduleEditorBtn: document.getElementById('cancelScheduleEditorBtn'),
      saveScheduleEditorBtn: document.getElementById('saveScheduleEditorBtn'),
      resetScheduleEditorBtn: document.getElementById('resetScheduleEditorBtn'),

      // Big clock settings modal
      clockSettingsModal: document.getElementById('clockSettingsModal'),
      clockTitleInput: document.getElementById('clockTitleInput'),
      clockSubtitleInput: document.getElementById('clockSubtitleInput'),
      clockNoteInput: document.getElementById('clockNoteInput'),
      clockHour12: document.getElementById('clockHour12'),
      clockShowSeconds: document.getElementById('clockShowSeconds'),
      clockShowDate: document.getElementById('clockShowDate'),
      clockScale: document.getElementById('clockScale'),
      clockScaleLabel: document.getElementById('clockScaleLabel'),
      closeClockSettingsBtn: document.getElementById('closeClockSettingsBtn'),
      cancelClockSettingsBtn: document.getElementById('cancelClockSettingsBtn'),
      saveClockSettingsBtn: document.getElementById('saveClockSettingsBtn'),
      resetClockSettingsBtn: document.getElementById('resetClockSettingsBtn'),

      // Custom Alarms
      addAlarmForm: document.getElementById('addAlarmForm'),
      alarmTime: document.getElementById('alarmTime'),
      alarmDate: document.getElementById('alarmDate'),
      alarmLabel: document.getElementById('alarmLabel'),
      alarmsList: document.getElementById('alarmsList'),
      addHomeworkForm: document.getElementById('addHomeworkForm'),
      homeworkTeacher: document.getElementById('homeworkTeacher'),
      homeworkSubject: document.getElementById('homeworkSubject'),
      homeworkDueDate: document.getElementById('homeworkDueDate'),
      homeworkDescription: document.getElementById('homeworkDescription'),
      homeworkList: document.getElementById('homeworkList'),
      homeworkPanel: document.getElementById('homeworkPanel'),
      remarksPanel: document.getElementById('remarksPanel'),
      praisesPanel: document.getElementById('praisesPanel'),
      homeworkCount: document.getElementById('homeworkCount'),
      remarksCount: document.getElementById('remarksCount'),
      praisesCount: document.getElementById('praisesCount'),
      remarksList: document.getElementById('remarksList'),
      praisesList: document.getElementById('praisesList'),
      shkoloExamsCard: document.getElementById('shkoloExamsCard'),
      shkoloExamsCount: document.getElementById('shkoloExamsCount'),
      shkoloExamsList: document.getElementById('shkoloExamsList'),

      toastContainer: document.getElementById('toastContainer')
    };

    if (this.el.dayScheduleSelect) {
      this.el.dayScheduleSelect.value = this.selectedDayKey;
    }
    if (this.el.bellToneSelect) {
      this.el.bellToneSelect.value = this.soundType;
    }
    this.extraExams.forEach((exam, i) => {
      const subject = document.getElementById(`extraExamSubject${i}`);
      const date = document.getElementById(`extraExamDate${i}`);
      if (subject) subject.value = exam.subject;
      if (date) date.value = exam.dateTime;
    });
    if (this.el.volumeSlider) {
      this.el.volumeSlider.value = Math.round(this.volume * 100);
      if (this.el.volumeValueLabel) this.el.volumeValueLabel.textContent = `${Math.round(this.volume * 100)}%`;
    }
    if (this.el.autoRingToggle) this.el.autoRingToggle.checked = this.autoRing;
    if (this.el.preBellToggle) this.el.preBellToggle.checked = this.preBell;
    if (this.el.vibrationToggle) this.el.vibrationToggle.checked = this.vibrationEnabled;
    if (this.el.notificationToggle) this.el.notificationToggle.checked = this.notificationsEnabled;
  }

  initAudioState() {
    if (!window.bellAudio) return;
    if (typeof window.bellAudio.setVolume === 'function') window.bellAudio.setVolume(this.volume);
    if (typeof window.bellAudio.setVibrationEnabled === 'function') window.bellAudio.setVibrationEnabled(this.vibrationEnabled);
    this.updateAudioButton(!!window.bellAudio.isMuted);
  }

  updateAudioButton(isMuted) {
    if (!this.el || !this.el.audioInitBtn) return;
    const icon = this.el.audioInitBtn.querySelector('.icon');
    const txt = this.el.audioInitBtn.querySelector('.btn-text');
    if (icon) icon.textContent = isMuted ? '🔇' : '🔊';
    if (txt) txt.textContent = isMuted ? 'Звук: Изкл' : 'Звук: Вкл';
    this.el.audioInitBtn.classList.toggle('muted', isMuted);
  }

  applyClockConfig() {
    const config = this.clockConfig || DEFAULT_CLOCK_CONFIG;
    if (this.el) {
      if (this.el.headerTitle) this.el.headerTitle.textContent = config.headerTitle;
      if (this.el.headerSubtitle) this.el.headerSubtitle.textContent = config.headerSubtitle;
      if (this.el.clockNote) this.el.clockNote.textContent = config.clockNote;
      if (this.el.currentDateDisplay) this.el.currentDateDisplay.style.display = config.showDate ? '' : 'none';
      if (this.el.mainClockCard) {
        this.el.mainClockCard.style.setProperty('--clock-scale', String(config.scale / 100));
      }
    }
    document.title = config.headerTitle || DEFAULT_CLOCK_CONFIG.headerTitle;
  }

  /**
   * Updates daily changing background behind the main clock card
   */
  updateDailyBackground(weekend = this.isWeekend()) {
    if (!this.el.mainClockCard) return;
    const weekday = new Date().getDay();
    const weekdayThemeIndex = weekday >= 1 && weekday <= 5 ? weekday - 1 : 0;
    const activeIndex = this.forcedThemeIndex !== null ? this.forcedThemeIndex : weekdayThemeIndex;
    const theme = DAY_THEMES[activeIndex] || DAY_THEMES[0];
    DAY_THEMES.forEach((item) => this.el.mainClockCard.classList.remove(item.class));
    this.el.mainClockCard.classList.add(theme.class);
    if (this.el.dailyThemeBadge) {
      this.el.dailyThemeBadge.replaceChildren(
        `${theme.icon} `,
        createEl('span', { text: theme.name })
      );
      if (typeof AppI18n !== 'undefined' && AppI18n.lang === 'en') {
        AppI18n.applyDynamic();
      }
    }
  }
  cycleDailyTheme() {
    const weekday = new Date().getDay();
    const start = weekday >= 1 && weekday <= 5 ? weekday - 1 : 0;
    const current = this.forcedThemeIndex !== null ? this.forcedThemeIndex : start;
    this.forcedThemeIndex = (current + 1) % DAY_THEMES.length;
    this.theme = DAY_THEMES[this.forcedThemeIndex].id;
    this.applyTheme(this.theme);
    saveThemeForCurrentUser(this.theme);
    if (this.el.themeSelect) this.el.themeSelect.value = this.theme;
    this.updateDailyBackground();
    const rawName = DAY_THEMES[this.forcedThemeIndex].name;
    const isEn = typeof AppI18n !== 'undefined' && AppI18n.lang === 'en';
    const displayName = isEn ? AppI18n.translateDynamicString(rawName) : rawName;
    this.showToast(isEn ? `🎨 Theme: ${displayName}` : `🎨 Тема: ${displayName}`, 'info');
  }
  initEventListeners() {
    // Unlock Audio Banner
    if (this.el.unlockAudioBtn) {
      this.el.unlockAudioBtn.onclick = async () => {
        await window.bellAudio.initContext();
        await window.bellAudio.playPreWarning();
        if (this.el.audioBanner) this.el.audioBanner.style.display = 'none';
        this.showToast('🔊 Звукът и звънецът са включени успешно!', 'success');
      };
    }

    // Audio Init / Mute button
    if (this.el.audioInitBtn) {
      this.el.audioInitBtn.onclick = async () => {
        await window.bellAudio.initContext();
        const isMuted = window.bellAudio.toggleMute();
        this.updateAudioButton(isMuted);
        if (this.el.audioBanner) this.el.audioBanner.style.display = 'none';
        this.showToast(isMuted ? 'Звукът е заглушен' : 'Звукът е включен', isMuted ? 'warning' : 'success');
      };
    }

    // Wake Lock (keep the phone screen on)
    if (this.el.wakeLockBtn) {
      this.el.wakeLockBtn.onclick = () => this.toggleWakeLock();
    }

    // Big clock settings
    if (this.el.clockSettingsBtn) {
      this.el.clockSettingsBtn.onclick = () => this.openClockSettings();
    }
    if (this.el.closeClockSettingsBtn) {
      this.el.closeClockSettingsBtn.onclick = () => this.closeClockSettings();
    }
    if (this.el.cancelClockSettingsBtn) {
      this.el.cancelClockSettingsBtn.onclick = () => this.closeClockSettings();
    }
    if (this.el.saveClockSettingsBtn) {
      this.el.saveClockSettingsBtn.onclick = () => this.saveClockSettings();
    }
    if (this.el.resetClockSettingsBtn) {
      this.el.resetClockSettingsBtn.onclick = () => {
        this.populateClockSettings(clone(DEFAULT_CLOCK_CONFIG));
        this.showToast('Върнати са стандартните настройки на часовника', 'info');
      };
    }
    if (this.el.clockScale) {
      this.el.clockScale.oninput = () => {
        if (this.el.clockScaleLabel) this.el.clockScaleLabel.textContent = `${this.el.clockScale.value}%`;
      };
    }

    // Schedule editor
    if (this.el.editScheduleBtn) {
      this.el.editScheduleBtn.onclick = () => this.openScheduleEditor();
    }
    if (this.el.closeScheduleEditorBtn) {
      this.el.closeScheduleEditorBtn.onclick = () => this.closeScheduleEditor();
    }
    if (this.el.cancelScheduleEditorBtn) {
      this.el.cancelScheduleEditorBtn.onclick = () => this.closeScheduleEditor();
    }
    if (this.el.saveScheduleEditorBtn) {
      this.el.saveScheduleEditorBtn.onclick = () => this.saveScheduleEditor();
    }
    if (this.el.resetScheduleEditorBtn) {
      this.el.resetScheduleEditorBtn.onclick = () => this.resetScheduleEditor();
    }
    if (this.el.scheduleEditorDay) {
      this.el.scheduleEditorDay.onchange = (e) => {
        this.collectEditorPeriods();
        this.collectEditorSettings();
        this.editorDayKey = e.target.value;
        this.populateScheduleEditorSettings(this.getEditorDayConfig());
        this.renderScheduleEditor();
      };
    }
    const scheduleSettingsInputs = [
      this.el.scheduleStartTime,
      this.el.scheduleClassMinutes,
      this.el.scheduleSmallBreak,
      this.el.scheduleBigBreak,
      this.el.scheduleBigBreakAfter,
      this.el.schedulePeriods
    ].filter(Boolean);
    scheduleSettingsInputs.forEach((input) => {
      input.addEventListener('change', () => {
        this.collectEditorPeriods();
        this.collectEditorSettings();
        this.renderScheduleEditor();
      });
    });

    if (this.el.cycleThemeBtn) {
      this.el.cycleThemeBtn.onclick = () => this.cycleDailyTheme();
    }

    // Dropdown for day schedule
    if (this.el.dayScheduleSelect) {
      this.el.dayScheduleSelect.onchange = (e) => {
        this.selectedDayKey = e.target.value;
        this.updateScheduleLabels();
        this.renderScheduleTable();
        if (!this.simMode && !this.manualPeriodRunning) this.updateLivePeriodTimer();
        this.showToast(`Заредена програма за: ${e.target.options[e.target.selectedIndex].text}`, 'info');
      };
    }

    if (this.el.weekdayTabs) {
      const activateDay = (day, silent = false) => {
        if (!WEEKDAYS.includes(day)) return;
        this.selectedDayKey = day;
        if (this.el.dayScheduleSelect) this.el.dayScheduleSelect.value = day;
        this.el.weekdayTabs.querySelectorAll('[data-day]').forEach(tab => {
          const active = tab.dataset.day === day;
          tab.classList.toggle('active', active);
          tab.setAttribute('aria-selected', String(active));
          tab.tabIndex = active ? 0 : -1;
        });
        this.updateScheduleLabels();
        this.renderScheduleTable();
        if (!this.simMode && !this.manualPeriodRunning) this.updateLivePeriodTimer();
        if (!silent) this.showToast(`Заредена програма за: ${WEEKDAY_LABELS[day]}`, 'info');
      };
      this.el.weekdayTabs.querySelectorAll('[data-day]').forEach(tab => tab.onclick = () => activateDay(tab.dataset.day));
      activateDay(this.selectedDayKey, true);
    }
    // Restart current period timer
    if (this.el.restartPeriodBtn) {
      this.el.restartPeriodBtn.onclick = () => {
        this.restartCurrentPeriod();
      };
    }

    // Quick Simulator Buttons
    if (this.el.simBreakBtn) {
      this.el.simBreakBtn.onclick = () => this.startBreakSimulation(60);
    }
    if (this.el.simWarningBtn) {
      this.el.simWarningBtn.onclick = async () => {
        this.showToast('🔔 Проба на предупредителния звън...', 'info');
        await window.bellAudio.playBell(this.soundType, 2.2);
      };
    }
    if (this.el.simBellBtn) {
      this.el.simBellBtn.onclick = async () => {
        this.showToast('🔔 Проба на звънеца...', 'warning');
        await window.bellAudio.playBell(this.soundType, 3.2);
      };
    }
    if (this.el.simResetBtn) {
      this.el.simResetBtn.onclick = () => this.stopSimulation();
    }

    // Sound Selector & Preview
    if (this.el.bellToneSelect) {
      this.el.bellToneSelect.onchange = (e) => {
        this.soundType = e.target.value;
        localStorage.setItem('school_bell_sound_type', this.soundType);
        window.bellAudio.playBell(this.soundType, 2.2);
        this.showToast(`Избран тон: ${this.el.bellToneSelect.options[this.el.bellToneSelect.selectedIndex].text}`, 'info');
      };
    }
    if (this.el.previewSoundBtn) {
      this.el.previewSoundBtn.onclick = () => {
        window.bellAudio.playBell(this.soundType, 2.5);
      };
    }

    // Volume Slider
    if (this.el.volumeSlider) {
      this.el.volumeSlider.oninput = (e) => {
        const val = parseInt(e.target.value, 10);
        this.volume = val / 100;
        if (this.el.volumeValueLabel) this.el.volumeValueLabel.textContent = `${val}%`;
        localStorage.setItem('school_bell_volume', this.volume.toString());
        window.bellAudio.setVolume(this.volume);
      };
    }

    // Settings Toggles
    if (this.el.autoRingToggle) {
      this.el.autoRingToggle.onchange = (e) => {
        this.autoRing = e.target.checked;
        localStorage.setItem('school_bell_auto_ring', this.autoRing);
      };
    }
    if (this.el.preBellToggle) {
      this.el.preBellToggle.onchange = (e) => {
        this.preBell = e.target.checked;
        localStorage.setItem('school_bell_pre_bell', this.preBell);
      };
    }
    if (this.el.vibrationToggle) {
      this.el.vibrationToggle.onchange = (e) => {
        this.vibrationEnabled = e.target.checked;
        localStorage.setItem('school_bell_vibration_enabled', this.vibrationEnabled);
        window.bellAudio.setVibrationEnabled(this.vibrationEnabled);
        if (this.vibrationEnabled) window.bellAudio.vibrate([100, 100, 100]);
      };
    }
    if (this.el.notificationToggle) {
      this.el.notificationToggle.onchange = async (e) => {
        if (!('Notification' in window)) {
          e.target.checked = false;
          this.notificationsEnabled = false;
          localStorage.setItem('school_bell_notif', 'false');
          this.showToast('Браузърът не поддържа системни известия', 'warning');
          return;
        }

        if (e.target.checked) {
          const perm = Notification.permission === 'granted'
            ? 'granted'
            : await Notification.requestPermission();
          if (perm === 'granted') {
            this.notificationsEnabled = true;
            localStorage.setItem('school_bell_notif', 'true');
            this.showToast('Известията са разрешени!', 'success');
          } else {
            e.target.checked = false;
            this.notificationsEnabled = false;
            localStorage.setItem('school_bell_notif', 'false');
            this.showToast('Известията са блокирани от браузъра', 'warning');
          }
        } else {
          this.notificationsEnabled = false;
          localStorage.setItem('school_bell_notif', 'false');
          this.showToast('Системните известия са изключени', 'info');
        }
      };
    }

    // Exam Modal & Buttons
    if (this.el.editExamBtn) {
      this.el.editExamBtn.onclick = () => this.openExamModal();
    }
    const clearMainExam = () => {
      const upcoming = this.getUpcomingExams();
      const first = upcoming[0] || null;
      if (first && first.source === 'shkolo') {
        this.showToast('Изпитът е от Shkolo и се изтрива автоматично, след като мине.', 'info');
        this.closeExamModal();
        return;
      }
      this.removeManualExam(first || { source: 'main' });
      this.allExamsListSignature = null;
      this.examSlotSignature = null;
      this.updateExamCountdown();
      this.updateExtraExamCountdowns();
      this.renderShkoloExams();
      this.closeExamModal();
      this.showToast('Следващият изпит е изтрит', 'success');
    };
    if (this.el.clearExamBtn) this.el.clearExamBtn.onclick = clearMainExam;
    if (this.el.clearExamModalBtn) this.el.clearExamModalBtn.onclick = clearMainExam;
    if (this.el.closeExamModalBtn) {
      this.el.closeExamModalBtn.onclick = () => this.closeExamModal();
    }
    if (this.el.cancelExamModalBtn) {
      this.el.cancelExamModalBtn.onclick = () => this.closeExamModal();
    }
    if (this.el.saveExamModalBtn) {
      this.el.saveExamModalBtn.onclick = () => this.saveExamModal();
    }
    if (this.el.testExamAlertBtn) {
      this.el.testExamAlertBtn.onclick = async () => {
        const upcoming = this.getUpcomingExams();
        const main = upcoming[0];
        const subj = main ? main.title : (this.examConfig.subject || 'Контролно');
        this.showToast(`⚠️ Внимание! Контролно по ${subj}!`, 'warning');
        await window.bellAudio.playBell(this.soundType, 3.2);
        await new Promise((resolve) => setTimeout(resolve, 900));
      };
    }

    document.querySelectorAll('.save-extra-exam').forEach(button => button.onclick = () => {
      const i = Number(button.dataset.examIndex);
      const subject = document.getElementById(`extraExamSubject${i}`)?.value.trim() || '';
      const dateTime = document.getElementById(`extraExamDate${i}`)?.value || '';
      if (!subject || !dateTime || Number.isNaN(new Date(dateTime).getTime())) {
        this.showToast('Попълнете описание и дата/час на изпита', 'warning'); return;
      }
      const target = this.examSlots?.[i];
      if (target?.source === 'shkolo') {
        this.showToast('Изпитът е от Shkolo и не се редактира ръчно', 'warning');
        return;
      }
      this.storeManualExam(subject, dateTime, target || { source: 'extra', index: i });
      this.allExamsListSignature = null;
      this.examSlotSignature = null;
      this.updateExamCountdown();
      this.updateExtraExamCountdowns();
      this.renderShkoloExams();
      this.showToast(`Настройката за изпит ${i + 2} е запазена`, 'success');
    });
    document.querySelectorAll('.clear-extra-exam').forEach(button => button.onclick = () => {
      const i = Number(button.dataset.examIndex);
      const target = this.examSlots?.[i];
      if (target?.source === 'shkolo') {
        this.showToast('Изпитът е от Shkolo и се изтрива автоматично, след като мине', 'info');
        return;
      }
      this.removeManualExam(target || { source: 'extra', index: i });
      const subject = document.getElementById(`extraExamSubject${i}`);
      const dateTime = document.getElementById(`extraExamDate${i}`);
      if (subject) subject.value = '';
      if (dateTime) dateTime.value = '';
      this.allExamsListSignature = null;
      this.examSlotSignature = null;
      this.updateExamCountdown();
      this.updateExtraExamCountdowns();
      this.renderShkoloExams();
      this.showToast(`Изпит ${i + 2} е изтрит`, 'success');
    });
    document.querySelectorAll('[data-homework-tab]').forEach(button => {
      button.onclick = () => this.setHomeworkTab(button.dataset.homeworkTab);
    });
    if (this.el.homeworkDueDate) this.el.homeworkDueDate.min = todayInSofia();
    if (this.el.addHomeworkForm) this.el.addHomeworkForm.onsubmit = async (event) => {
      event.preventDefault();
      const dueDate = this.el.homeworkDueDate.value;
      if (!dueDate) {
        this.showToast('Посочете срок за домашното.', 'error');
        return;
      }
      if (dueDate < todayInSofia()) {
        this.showToast('Срокът не може да е в миналото.', 'error');
        return;
      }
      const submit = event.target.querySelector('button[type="submit"]');
      if (submit) submit.disabled = true;
      try {
        const data = await ProfileHomework.addHomework({
          teacher: this.el.homeworkTeacher.value.trim(),
          subject: this.el.homeworkSubject.value.trim(),
          dueDate,
          description: this.el.homeworkDescription.value.trim()
        });
        this.applyProfileData(data);
        this.el.addHomeworkForm.reset();
        if (this.el.homeworkDueDate) this.el.homeworkDueDate.min = todayInSofia();
        this.showToast('Домашното е добавено', 'success');
      } catch (error) {
        this.showToast(error?.message || 'Домашното не може да бъде добавено.', 'error');
      } finally {
        if (submit) submit.disabled = false;
      }
    };
    // Vacation Selector
    if (this.el.vacationSelect) {
      this.el.vacationSelect.onchange = (e) => {
        const found = this.vacations.find(v => v.id === e.target.value);
        if (found) {
          this.vacationConfig = found;
          this.saveVacationConfig();
          this.updateVacationCountdown();
          this.showToast(`Избрана ваканция: ${found.name}`, 'info');
        }
      };
    }

    if (this.el.saveVacationBtn) this.el.saveVacationBtn.onclick = () => {
      const date = this.el.vacationDateInput?.value;
      const endDate = this.el.vacationEndDateInput?.value || date;
      if (!date || !endDate || Number.isNaN(new Date(`${date}T00:00:00`).getTime()) || endDate < date) {
        this.showToast('Изберете валидни начална и крайна дата за ваканцията', 'warning'); return;
      }
      const item = this.vacations.find(v => v.id === this.vacationConfig.id);
      if (!item) return;
      item.date = `${date}T00:00:00`;
      item.endDate = endDate;
      this.vacationConfig = item;
      this.saveVacationConfig(); this.renderVacationOptions(); this.updateVacationCountdown();
      this.showToast('Периодът на ваканцията е запазен', 'success');
    };
    if (this.el.addNoSchoolDayBtn) this.el.addNoSchoolDayBtn.onclick = () => {
      const date = this.el.noSchoolDateInput?.value;
      const description = this.el.noSchoolDescriptionInput?.value.trim();
      if (!date || !description) { this.showToast('Изберете дата и въведете описание', 'warning'); return; }
      this.noSchoolDays.push({ id: `off-${Date.now()}`, date, description });
      this.saveNoSchoolDays();
      this.el.noSchoolDateInput.value = ''; this.el.noSchoolDescriptionInput.value = '';
      this.showToast('Неучебният ден е добавен', 'success');
    };
    // Fullscreen and Theme
    if (this.el.fullscreenBtn) {
      this.el.fullscreenBtn.onclick = () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      };
    }
    if (this.el.themeSelect) {
      this.el.themeSelect.value = this.theme;
      this.el.themeSelect.onchange = (e) => {
        this.theme = e.target.value;
        this.forcedThemeIndex = DAY_THEMES.findIndex(t => t.id === this.theme);
        this.applyTheme(this.theme);
        this.updateDailyBackground();
        saveThemeForCurrentUser(this.theme);
      };
    }
    if (this.el.themeIntensityRange) {
      this.el.themeIntensityRange.value = String(this.themeIntensity || 100);
      if (this.el.themeIntensityValue) {
        this.el.themeIntensityValue.textContent = `${this.themeIntensity || 100}%`;
      }
      const onIntensityChange = (e) => {
        const val = normalizeThemeIntensity(e.target.value);
        this.applyThemeIntensity(val);
        saveThemeIntensityForCurrentUser(this.theme, val);
      };
      this.el.themeIntensityRange.oninput = onIntensityChange;
      this.el.themeIntensityRange.onchange = onIntensityChange;
    }
    window.addEventListener('storage', (event) => {
      if (event.key !== currentThemeStorageKey() || !event.newValue) return;
      if (!THEME_IDS.includes(event.newValue)) return;
      this.theme = event.newValue;
      this.applyTheme(this.theme);
      if (this.el.themeSelect) this.el.themeSelect.value = this.theme;
    });
    if (this.el.themeToggleBtn) {
      this.el.themeToggleBtn.onclick = () => {
        this.theme = this.theme === 'dark' ? 'light' : 'dark';
        saveThemeForCurrentUser(this.theme);
        this.applyTheme(this.theme);
      };
    }

    // Alarms form
    if (this.el.addAlarmForm) {
      this.el.addAlarmForm.onsubmit = (e) => {
        e.preventDefault();
        const time = this.el.alarmTime.value;
        const date = this.el.alarmDate.value;
        const label = this.el.alarmLabel.value.trim();
        if (!time || !date || !label) return;
        if (date < todayInSofia()) {
          this.showToast('Датата на алармата не може да е в миналото.', 'warning');
          return;
        }

        const exists = this.customAlarms.some(a =>
          (a.date || '') === date && a.time === time && a.label.trim().toLocaleLowerCase('bg') === label.toLocaleLowerCase('bg')
        );
        if (exists) {
          this.showToast('Вече има такава класна аларма за този ден и час.', 'warning');
          return;
        }
        this.customAlarms.push({ id: 'al-' + Date.now(), time, date, label, active: true });
        this.customAlarms.sort((a, b) => `${a.date || ''}${a.time}`.localeCompare(`${b.date || ''}${b.time}`));
        localStorage.setItem(CUSTOM_ALARMS_KEY, JSON.stringify(this.customAlarms));
        this.renderAlarmsList();
        this.el.addAlarmForm.reset();
        this.showToast(`Добавена класна аларма за ${date} в ${time}`, 'success');
      };
    }

    // Reset schedule button (subjects only; times are changed in the editor)
    if (this.el.resetScheduleBtn) {
      this.el.resetScheduleBtn.onclick = () => {
        if (confirm('Възстановяване на стандартната седмична програма? Часовете и междучасията ще останат непроменени.')) {
          localStorage.removeItem('school_bell_weekly_schedule_v2');
          this.weeklySchedule = clone(DEFAULT_WEEKLY_SCHEDULE);
          this.saveWeeklySchedule();
          this.tick();
          this.showToast('Седмичната програма беше възстановена!', 'success');
        }
      };
    }

    // Close modals with Escape
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (this.el.scheduleEditorModal?.classList.contains('active')) this.closeScheduleEditor();
      if (this.el.clockSettingsModal?.classList.contains('active')) this.closeClockSettings();
      if (this.el.examModal?.classList.contains('active')) this.closeExamModal();
      if (document.getElementById('photoScanModal')?.classList.contains('active')) this.closePhotoScanModal();
      if (document.getElementById('attachmentViewerModal')?.classList.contains('active')) this.closeAttachmentViewer();
    });

    this.initPhotoScanner();
    this.initCollapsiblePanels();
  }

  loadCollapsedPanels() {
    try {
      const raw = localStorage.getItem('school_bell_collapsed_panels_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (_) {}
    return {
      extraExam0: true,
      extraExam1: true,
      extraExam2: true,
      extraExam3: true
    };
  }

  saveCollapsedPanels() {
    try {
      localStorage.setItem('school_bell_collapsed_panels_v1', JSON.stringify(this.collapsedPanels || {}));
    } catch (_) {}
  }

  initCollapsiblePanels() {
    this.collapsedPanels = this.loadCollapsedPanels();
    const buttons = document.querySelectorAll('.card-collapse-btn[data-collapse-target]');
    buttons.forEach((btn) => {
      btn.onclick = () => {
        const key = btn.getAttribute('data-collapse-target');
        if (!key) return;
        this.collapsedPanels[key] = !this.collapsedPanels[key];
        this.saveCollapsedPanels();
        this.applyCollapsiblePanels();
      };
    });
    this.applyCollapsiblePanels();
  }

  applyCollapsiblePanels() {
    const state = this.collapsedPanels || {};
    const panels = document.querySelectorAll('[data-collapsible-panel]');
    let collapsedMajorCount = 0;
    panels.forEach((panel) => {
      const key = panel.getAttribute('data-collapsible-panel');
      const isCollapsed = !!state[key];
      panel.classList.toggle('is-collapsed', isCollapsed);
      if (isCollapsed && (key === 'mainExam' || key === 'vacation' || key === 'extraExamsSection' || key === 'allExams')) {
        collapsedMajorCount++;
      }
      const btn = panel.querySelector(`.card-collapse-btn[data-collapse-target="${key}"]`);
      if (btn) {
        btn.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
        const labelSpan = btn.querySelector('.collapse-btn-label') || btn;
        const isAll = key === 'extraExamsSection';
        const bgText = isCollapsed
          ? (isAll ? '▶️ Разгъни всички' : '▶️ Разгъни')
          : (isAll ? '🔽 Свий всички' : '🔽 Свий');
        labelSpan.dataset.i18nBg = bgText;
        if (typeof AppI18n !== 'undefined' && AppI18n.lang === 'en') {
          labelSpan.textContent = AppI18n.EXACT_TEXT_MAP[bgText] || bgText;
        } else {
          labelSpan.textContent = bgText;
        }
      }
    });
    document.body.setAttribute('data-scenic-reveal', collapsedMajorCount > 0 ? 'true' : 'false');
  }

  restartCurrentPeriod() {
    if (this.isWeekend()) {
      this.showToast('🌙 Днес е почивен ден — учебният часовник и звънците са изключени.', 'info');
      return;
    }
    const minutes = this.getDayScheduleConfig().classMinutes || 40;
    this.manualPeriodRunning = true;
    this.manualPeriodTotal = minutes * 60;
    this.manualPeriodSecondsLeft = minutes * 60;
    if (this.el.simResetBtn) this.el.simResetBtn.style.display = 'inline-flex';
    this.showToast(`🔄 Часът беше рестартиран на ${minutes}:00 минути!`, 'success');
    window.bellAudio.playBell(this.soundType, 2.5);

    this.tick();
  }

  startBreakSimulation(totalSec = 60) {
    if (this.isWeekend()) {
      this.showToast('🌙 Днес е почивен ден — училищната симулация е изключена.', 'info');
      return;
    }
    if (this.simInterval) clearInterval(this.simInterval);
    this.simMode = 'break';
    this.simSecondsLeft = totalSec;
    if (this.el.simResetBtn) this.el.simResetBtn.style.display = 'inline-flex';

    window.bellAudio.initContext();
    this.showToast('🚀 Стартира симулация на междучасие за 60 секунди!', 'warning');

    const updateSim = async () => {
      if (this.simSecondsLeft <= 0) {
        clearInterval(this.simInterval);
        this.simInterval = null;
        this.simMode = null;
        if (this.el.periodTimerDisplay) this.el.periodTimerDisplay.textContent = '00:00';
        if (this.el.periodProgressBarFill) this.el.periodProgressBarFill.style.width = '100%';
        this.showToast('🔔 ЗВЪНЕЦ ЗА ЧАС! Започва учебният час.', 'warning');
        await window.bellAudio.playBell(this.soundType, 3.2);

        if (this.el.simResetBtn) this.el.simResetBtn.style.display = 'none';
        return;
      }

      if (this.el.periodTimerDisplay) {
        this.el.periodTimerDisplay.textContent = formatDurationSeconds(this.simSecondsLeft);
      }
      const elapsed = totalSec - this.simSecondsLeft;
      const pct = (elapsed / totalSec) * 100;
      if (this.el.periodProgressBarFill) this.el.periodProgressBarFill.style.width = `${pct.toFixed(1)}%`;
      if (this.el.periodElapsedText) this.el.periodElapsedText.textContent = `Изминало: ${formatDurationSeconds(elapsed)}`;
      if (this.el.periodRemainingText) this.el.periodRemainingText.textContent = `Остава: ${formatDurationSeconds(this.simSecondsLeft)}`;

      if (this.el.periodStatusLabel) this.el.periodStatusLabel.textContent = '☕ СИМУЛАЦИЯ: ГОЛЯМО МЕЖДУЧАСИЕ';
      if (this.el.periodStatusTitle) this.el.periodStatusTitle.textContent = 'Време за почивка (60 сек тест)';

      if (this.simSecondsLeft === 30) {
        this.showToast('⚠️ Остават 30 секунди до края на междучасието!', 'warning');

      }

      this.simSecondsLeft--;
    };

    updateSim();
    this.simInterval = setInterval(updateSim, 1000);
  }

  stopSimulation() {
    if (this.simInterval) clearInterval(this.simInterval);
    this.simInterval = null;
    this.simMode = null;
    this.manualPeriodRunning = false;
    this.manualPeriodSecondsLeft = 0;
    if (this.el.simResetBtn) this.el.simResetBtn.style.display = 'none';
    this.showToast('Върнахте реалното време', 'info');
    this.tick();
  }

  applyTheme(theme) {
    const themes = [...THEME_IDS, 'slate', 'nord', 'sand', 'pearl', 'forest', 'aurora', 'dark', 'light', 'blue', 'green', 'purple', 'orange'];
    document.body.classList.remove(...themes.map((name) => `theme-${name}`));
    const chosen = THEME_IDS.includes(theme) ? theme : 'shevitsa';
    document.body.classList.add(`theme-${chosen}`);
    if (this.el.themeIcon) this.el.themeIcon.textContent = chosen === 'snow' ? '☀️' : '🌙';
    this.themeIntensity = readThemeIntensityForCurrentUser(chosen);
    this.applyThemeIntensity(this.themeIntensity);
  }

  applyThemeIntensity(intensity) {
    const normalized = normalizeThemeIntensity(intensity);
    this.themeIntensity = normalized;
    document.body.setAttribute('data-theme-intensity', String(normalized));
    if (this.el && this.el.themeIntensityRange) {
      this.el.themeIntensityRange.value = String(normalized);
    }
    if (this.el && this.el.themeIntensityValue) {
      this.el.themeIntensityValue.textContent = `${normalized}%`;
    }
  }
  startClock() {
    this.tick();
    setInterval(() => this.tick(), 1000);
  }

  refreshFromSharedStorage() {
    this.weeklySchedule = this.loadWeeklySchedule();
    this.scheduleConfig = this.loadScheduleConfig();
    this.clockConfig = this.loadClockConfig();
    this.examConfig = this.loadExamConfig();
    this.extraExams = this.loadExtraExams();
    this.vacations = this.loadVacations();
    this.vacationConfig = this.loadVacationConfig();
    this.noSchoolDays = this.loadNoSchoolDays();
    this.customAlarms = this.readCustomAlarms();

    this.extraExams.forEach((exam, i) => {
      const subject = document.getElementById(`extraExamSubject${i}`);
      const date = document.getElementById(`extraExamDate${i}`);
      if (subject) subject.value = exam.subject;
      if (date) date.value = exam.dateTime;
    });

    this.updateScheduleLabels();
    this.renderScheduleTable();
    this.renderVacationOptions();
    this.renderNoSchoolDays();
    this.renderAlarmsList();
    this.renderHomeworkList();
    this.allExamsListSignature = null;
    this.examSlotSignature = null;
    this.updateExtraExamCountdowns();
    this.updateExamCountdown();
    this.renderShkoloExams();
    this.updateVacationCountdown();
    this.applyClockConfig();
    this.tick();
    // Всички домашни и изпити са общи за класа и се презареждат от сървъра
    // при промяна от друг профил. Забележките остават лични.
    this.loadProfileData({ silent: true });
  }

  tick() {
    const now = new Date();
    this.updateWeekendUI(this.isWeekend(now));
    const dateKey = now.toDateString();
    if (this.lastThemeDate !== dateKey) {
      this.lastThemeDate = dateKey;
      if (this.forcedThemeIndex === null) this.updateDailyBackground();
    }
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    // 1. Normal Big Clock Display
    let displayHours = hours;
    let suffix = '';
    if (this.clockConfig.hour12) {
      displayHours = hours % 12 || 12;
      suffix = hours < 12 ? ' AM' : ' PM';
    }
    const showSeconds = this.clockConfig.showSeconds !== false;
    const hh = String(displayHours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    const timeFormatted = showSeconds ? `${hh}:${mm}:${ss}${suffix}` : `${hh}:${mm}${suffix}`;
    if (this.el.clockDisplay) this.el.clockDisplay.textContent = timeFormatted;

    if (this.clockConfig.showDate !== false) {
      const dayName = BG_DAYS[now.getDay()];
      const dateFormatted = `${dayName}, ${now.getDate()} ${BG_MONTHS[now.getMonth()]} ${now.getFullYear()} г.`;
      if (this.el.currentDateDisplay) this.el.currentDateDisplay.textContent = dateFormatted;
    }

    // 2. Countdown 1: Period / Break Timer
    if (!this.simMode) {
      if (this.manualPeriodRunning) {
        this.tickManualPeriod();
      } else {
        this.updateLivePeriodTimer(now, hours, minutes, seconds);
      }
    }

    // 3. Countdown 2: Next Exam
    this.updateExamCountdown(now);
    this.updateExtraExamCountdowns(now);
    this.updateShkoloExamCountdowns(now);

    // 3. Countdown 3: Next Vacation
    this.updateVacationCountdown(now);

    const sofiaToday = todayInSofia();
    if (this.lastHomeworkUiDate !== sofiaToday) {
      this.lastHomeworkUiDate = sofiaToday;
      this.renderHomeworkList();
      this.renderAlarmsList();
    }

    // 5. Custom Alarms check
    this.checkCustomAlarms(hours, minutes, seconds);
    if (typeof AppI18n !== 'undefined' && AppI18n.lang === 'en') {
      AppI18n.applyDynamic();
    }
  }

  tickManualPeriod() {
    if (this.manualPeriodSecondsLeft <= 0) {
      this.manualPeriodRunning = false;
      if (this.el.simResetBtn) this.el.simResetBtn.style.display = 'none';
      this.showToast(`🔔 Край на часа (${this.getDayScheduleConfig().classMinutes} мин изтекоха)!`, 'warning');
      window.bellAudio.playBell(this.soundType, 3.2);

      this.updateLivePeriodTimer();
      return;
    }

    if (this.el.periodTimerDisplay) {
      this.el.periodTimerDisplay.textContent = formatDurationSeconds(this.manualPeriodSecondsLeft);
    }
    const elapsed = this.manualPeriodTotal - this.manualPeriodSecondsLeft;
    const pct = (elapsed / this.manualPeriodTotal) * 100;
    if (this.el.periodProgressBarFill) this.el.periodProgressBarFill.style.width = `${pct.toFixed(1)}%`;
    if (this.el.periodElapsedText) this.el.periodElapsedText.textContent = `Изминало: ${formatDurationSeconds(elapsed)}`;
    if (this.el.periodRemainingText) this.el.periodRemainingText.textContent = `Остава: ${formatDurationSeconds(this.manualPeriodSecondsLeft)}`;

    if (this.el.periodStatusLabel) this.el.periodStatusLabel.textContent = '🔄 РЪЧНО РЕСТАРТИРАН ЧАС';
    if (this.el.periodStatusTitle) this.el.periodStatusTitle.textContent = `Учебен час (${this.getDayScheduleConfig().classMinutes} мин брояч)`;

    this.manualPeriodSecondsLeft--;
  }

  updateLivePeriodTimer(now = new Date(), hours = now.getHours(), minutes = now.getMinutes(), seconds = now.getSeconds()) {
    this.updateWeekendUI(this.isWeekend(now));
    if (this.isWeekend(now)) {
      if (this.el.periodStatusLabel) this.el.periodStatusLabel.textContent = 'Почивен ден';
      if (this.el.periodStatusTitle) this.el.periodStatusTitle.textContent = 'Събота и неделя няма учебни часове';
      if (this.el.periodTimerDisplay) this.el.periodTimerDisplay.textContent = 'Почивен ден';
      if (this.el.periodProgressBarFill) this.el.periodProgressBarFill.style.width = '0%';
      if (this.el.periodElapsedText) this.el.periodElapsedText.textContent = 'Учебните звънци са спрени';
      if (this.el.periodRemainingText) this.el.periodRemainingText.textContent = 'Следващ учебен ден: понеделник';
      if (this.el.liveExamAlertBanner) this.el.liveExamAlertBanner.style.display = 'none';
      this.clearScheduleRowStatuses();
      return;
    }
    const localDateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const activeVacation = this.vacations.find(vacation => {
      const start = String(vacation.date || '').slice(0, 10);
      const end = String(vacation.endDate || vacation.date || '').slice(0, 10);
      return start && end && start <= localDateKey && localDateKey <= end;
    });
    if (activeVacation) {
      if (this.el.periodStatusLabel) this.el.periodStatusLabel.textContent = 'Ваканция';
      if (this.el.periodStatusTitle) this.el.periodStatusTitle.textContent = activeVacation.name;
      if (this.el.periodTimerDisplay) this.el.periodTimerDisplay.textContent = 'Почивен ден';
      if (this.el.periodProgressBarFill) this.el.periodProgressBarFill.style.width = '0%';
      if (this.el.periodElapsedText) this.el.periodElapsedText.textContent = 'Учебните звънци са спрени';
      if (this.el.periodRemainingText) this.el.periodRemainingText.textContent = `До ${String(activeVacation.endDate || activeVacation.date).slice(0, 10)}`;
      if (this.el.liveExamAlertBanner) this.el.liveExamAlertBanner.style.display = 'none';
      this.clearScheduleRowStatuses();
      return;
    }
    const dayOff = this.noSchoolDays.find(day => day.date <= localDateKey && (day.endDate || day.date) >= localDateKey);
    if (dayOff) {
      if (this.el.periodStatusLabel) this.el.periodStatusLabel.textContent = 'Неучебен ден';
      if (this.el.periodStatusTitle) this.el.periodStatusTitle.textContent = dayOff.description;
      if (this.el.periodTimerDisplay) this.el.periodTimerDisplay.textContent = 'Почивен ден';
      if (this.el.periodProgressBarFill) this.el.periodProgressBarFill.style.width = '0%';
      if (this.el.periodElapsedText) this.el.periodElapsedText.textContent = 'Учебните звънци са спрени';
      if (this.el.periodRemainingText) this.el.periodRemainingText.textContent = dayOff.date;
      if (this.el.liveExamAlertBanner) this.el.liveExamAlertBanner.style.display = 'none';
      this.clearScheduleRowStatuses();
      return;
    }
    const currentTotalSecs = hours * 3600 + minutes * 60 + seconds;
    const schedule = this.compileCurrentDaySchedule();
    const firstItem = schedule[0];
    const lastItem = schedule[schedule.length - 1];

    if (!firstItem || !lastItem) return;

    const schoolDayStartSec = firstItem.startMin * 60;
    const schoolDayEndSec = lastItem.endMin * 60;

    let activeItem = null;
    let nextItem = null;

    for (let i = 0; i < schedule.length; i++) {
      const item = schedule[i];
      const startSec = item.startMin * 60;
      const endSec = item.endMin * 60;

      if (currentTotalSecs >= startSec && currentTotalSecs < endSec) {
        activeItem = item;
        nextItem = schedule[i + 1] || null;
        break;
      } else if (currentTotalSecs < startSec && !nextItem) {
        nextItem = item;
      }
    }

    if (currentTotalSecs < schoolDayStartSec) {
      // Before 08:00
      const remainingSecs = schoolDayStartSec - currentTotalSecs;
      if (this.el.periodStatusLabel) this.el.periodStatusLabel.textContent = 'Предстои учебен ден';
      if (this.el.periodStatusTitle) this.el.periodStatusTitle.textContent = `Започва в ${firstItem.startTime} с: ${firstItem.title}`;
      if (this.el.periodTimerDisplay) this.el.periodTimerDisplay.textContent = formatDurationSeconds(remainingSecs);
      if (this.el.periodProgressBarFill) this.el.periodProgressBarFill.style.width = '0%';
      if (this.el.periodElapsedText) this.el.periodElapsedText.textContent = `До началото: ${formatDurationSeconds(remainingSecs)}`;
      if (this.el.periodRemainingText) this.el.periodRemainingText.textContent = `Начало: ${firstItem.startTime}`;
      if (this.el.liveExamAlertBanner) this.el.liveExamAlertBanner.style.display = 'none';
    } else if (currentTotalSecs >= schoolDayEndSec) {
      // After 13:50
      if (this.el.periodStatusLabel) this.el.periodStatusLabel.textContent = 'Край на учебния ден (1-ва смяна)';
      if (this.el.periodStatusTitle) this.el.periodStatusTitle.textContent = 'Учебните часове за днес приключиха 🎉';
      if (this.el.periodTimerDisplay) this.el.periodTimerDisplay.textContent = '00:00';
      if (this.el.periodProgressBarFill) this.el.periodProgressBarFill.style.width = '100%';
      if (this.el.periodElapsedText) this.el.periodElapsedText.textContent = 'Часовете свършиха';
      if (this.el.periodRemainingText) this.el.periodRemainingText.textContent = `${lastItem.endTime} ч.`;
      if (this.el.liveExamAlertBanner) this.el.liveExamAlertBanner.style.display = 'none';
    } else if (activeItem) {
      // Active period
      const startSec = activeItem.startMin * 60;
      const endSec = activeItem.endMin * 60;
      const durationSec = endSec - startSec;
      const elapsedSec = currentTotalSecs - startSec;
      const remainingSec = endSec - currentTotalSecs;
      const pct = Math.min(100, Math.max(0, (elapsedSec / durationSec) * 100));

      if (this.el.periodTimerDisplay) this.el.periodTimerDisplay.textContent = formatDurationSeconds(remainingSec);
      if (this.el.periodProgressBarFill) this.el.periodProgressBarFill.style.width = `${pct.toFixed(1)}%`;
      if (this.el.periodElapsedText) this.el.periodElapsedText.textContent = `Изминало: ${formatDurationSeconds(elapsedSec)}`;
      if (this.el.periodRemainingText) this.el.periodRemainingText.textContent = `Остава: ${formatDurationSeconds(remainingSec)}`;

      if (activeItem.type === 'class') {
        if (this.el.periodStatusLabel) this.el.periodStatusLabel.textContent = 'В момента тече учебен час';
        if (this.el.periodStatusTitle) this.el.periodStatusTitle.textContent = `${activeItem.title}`;

        // Check if this class has an EXAM
        if (activeItem.hasExam) {
          if (this.el.liveExamAlertBanner) {
            this.el.liveExamAlertBanner.style.display = 'flex';
            if (this.el.liveExamAlertText) {
              this.el.liveExamAlertText.textContent = `⚠️ ВНИМАНИЕ: В този час има КОНТРОЛНО по ${activeItem.examSubject || activeItem.rawSubject}!`;
            }
          }
        } else {
          if (this.el.liveExamAlertBanner) this.el.liveExamAlertBanner.style.display = 'none';
        }
      } else {
        const isBig = activeItem.type === 'big-break';
        if (this.el.periodStatusLabel) this.el.periodStatusLabel.textContent = isBig ? '☕ ГОЛЯМО МЕЖДУЧАСИЕ' : '🔔 МЕЖДУЧАСИЕ';
        if (this.el.periodStatusTitle) this.el.periodStatusTitle.textContent = isBig
          ? `Време за почивка и закуска (${activeItem.duration} мин)`
          : `Време за отдих (${activeItem.duration} мин)`;
        if (this.el.liveExamAlertBanner) this.el.liveExamAlertBanner.style.display = 'none';
      }

      this.checkBellTrigger(activeItem, startSec, endSec, currentTotalSecs, remainingSec, nextItem);
    }

    this.updateScheduleTableRowHighlights(activeItem, currentTotalSecs, schedule);
  }

  checkBellTrigger(activeItem, startSec, endSec, currentTotalSecs, remainingSec, nextItem) {
    if (!this.autoRing) return;
    const todayStr = new Date().toDateString();
    const startKey = `s-${activeItem.id}-${todayStr}`;
    const endKey = `e-${activeItem.id}-${todayStr}`;
    const preKey = `p-${activeItem.id}-${todayStr}`;
    const examKey = `ex-${activeItem.id}-${todayStr}`;

    // Period Start (15-second window so a throttled tab does not miss the bell)
    if (currentTotalSecs >= startSec && currentTotalSecs <= startSec + 15 && !this.triggeredBells.has(startKey)) {
      this.triggeredBells.add(startKey);
      if (activeItem.type === 'class') {
        window.bellAudio.playBell(this.soundType, 3.2);
        this.showToast(`🔔 Начало на ${activeItem.title}!`, 'warning');
        this.notify('🔔 Начало на час', activeItem.title);

        // If exam in this class, announce it!
        if (activeItem.hasExam && !this.triggeredExams.has(examKey)) {
          this.triggeredExams.add(examKey);
          setTimeout(() => {

            this.notify('📝 Контролно', `В този час има контролно по ${activeItem.examSubject || activeItem.rawSubject}`);
          }, 3500);
        }
      } else {
        const isBig = activeItem.type === 'big-break';
        window.bellAudio.playBell(this.soundType, 3.2);
        this.showToast(isBig ? '☕ Започва голямото междучасие!' : '🔔 Започва междучасието!', 'warning');
        this.notify(isBig ? '☕ Голямо междучасие' : '🔔 Междучасие', 'Време за почивка');

      }
    }

    // Period End
    if (remainingSec <= 1 && !this.triggeredBells.has(endKey)) {
      this.triggeredBells.add(endKey);
      window.bellAudio.playBell(this.soundType, 3.2);
      this.showToast(activeItem.type === 'class' ? `🔔 Край на часа (${activeItem.title})!` : '🔔 Край на междучасието!', 'warning');
      this.notify('🔔 Край на час', activeItem.type === 'class' ? `Приключи ${activeItem.title}` : 'Междучасието приключи');
    }

    // Pre-warning 2 min before break ends
    if (this.preBell && activeItem.type.includes('break') && activeItem.duration >= 5) {
      if (remainingSec <= 120 && remainingSec > 0 && !this.triggeredPreBells.has(preKey)) {
        this.triggeredPreBells.add(preKey);
        window.bellAudio.playBell(this.soundType, 2.2);

        this.showToast('⚠️ Остават 2 минути до края на междучасието!', 'warning');
        this.notify('⏰ Предупреждение', 'Остават 2 минути до края на междучасието');
      }
    }
  }

  updateExamCountdown(now = new Date()) {
    if (!this.el.examTimerDisplay) return;
    if (this.pruneExpiredManualExams(now)) this.examSlotSignature = null;
    const upcoming = this.getUpcomingExams(now);
    const mainExam = upcoming[0] || null;

    if (!mainExam) {
      this.el.examTimerDisplay.textContent = 'Няма зададен изпит';
      if (this.el.examTitleDisplay) this.el.examTitleDisplay.textContent = 'Няма зададен изпит';
      if (this.el.examDateDisplay) this.el.examDateDisplay.textContent = 'Добавете предмет и дата чрез „Настрой изпит“';
      return;
    }

    const diff = mainExam.ts - now.getTime();
    const cd = formatCountdownDHMS(diff);

    if (diff <= 0) {
      this.el.examTimerDisplay.textContent = 'Днес е изпитът!';
    } else {
      this.el.examTimerDisplay.textContent = `${cd.days}д ${cd.hours}ч ${cd.mins}м ${cd.secs}с`;
    }

    if (this.el.examTitleDisplay) {
      this.el.examTitleDisplay.textContent = mainExam.source === 'shkolo'
        ? `📅 ${mainExam.title} (Shkolo)`
        : mainExam.title;
    }
    if (this.el.examDateDisplay) {
      this.el.examDateDisplay.textContent = this.formatExamEntryDate(mainExam);
    }
  }

  updateVacationCountdown(now = new Date()) {
    if (!this.el.vacationTimerDisplay) return;
    this.pruneExpiredVacations(now);
    if (!this.vacationConfig || !this.vacationConfig.date || this.vacationConfig.id === 'none') {
      this.el.vacationTimerDisplay.textContent = 'Няма предстоящи ваканции';
      if (this.el.vacationTitleDisplay) this.el.vacationTitleDisplay.textContent = 'Ваканции';
      return;
    }
    const startKey = String(this.vacationConfig.date).slice(0, 10);
    const endKey = String(this.vacationConfig.endDate || startKey).slice(0, 10);
    const endDate = new Date(`${endKey}T23:59:59`);
    const todayKey = todayInSofia();
    const active = todayKey >= startKey && todayKey <= endKey;
    const diff = new Date(`${startKey}T00:00:00`).getTime() - now.getTime();
    const cd = formatCountdownDHMS(diff);

    if (active) {
      const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / 86400000));
      this.el.vacationTimerDisplay.textContent = `Ваканция! Остават ${daysLeft} дни 🎉`;
    } else if (todayKey > endKey) {
      this.vacationConfig = this.loadVacationConfig();
      this.renderVacationOptions();
      return;
    } else if (diff <= 0) {
      this.el.vacationTimerDisplay.textContent = 'Ваканцията настъпи! 🎉';
    } else {
      this.el.vacationTimerDisplay.textContent = `${cd.days}д ${cd.hours}ч ${cd.mins}м ${cd.secs}с`;
    }

    if (this.el.vacationTitleDisplay) this.el.vacationTitleDisplay.textContent = this.vacationConfig.name;
    if (this.el.vacationSelect) this.el.vacationSelect.value = this.vacationConfig.id;
    if (this.el.vacationDateInput && document.activeElement !== this.el.vacationDateInput) this.el.vacationDateInput.value = startKey;
    if (this.el.vacationEndDateInput && document.activeElement !== this.el.vacationEndDateInput) this.el.vacationEndDateInput.value = endKey;
  }

  renderScheduleTable() {
    if (!this.el.scheduleTableBody) return;
    this.el.scheduleTableBody.replaceChildren();
    const schedule = this.compileCurrentDaySchedule();
    const weekend = this.isWeekend();

    schedule.forEach(item => {
      const tr = document.createElement('tr');
      tr.id = `row-${item.id}`;

      const badge = item.type === 'class'
        ? createEl('span', { className: 'table-badge badge-class', text: 'Учебен час' })
        : item.type === 'big-break'
          ? createEl('span', { className: 'table-badge badge-big-break', text: '☕ ГОЛЯМО' })
          : createEl('span', { className: 'table-badge badge-break', text: 'Междучасие' });

      const titleTd = createEl('td', { className: 'font-medium' }, item.title || '');
      if (item.hasExam) {
        titleTd.append(' ', createEl('span', {
          className: 'exam-mini-badge',
          title: 'В този час има контролно!',
          text: '📝 КОНТРОЛНО'
        }));
      }

      tr.append(
        createEl('td', { className: 'font-mono text-center', text: item.periodNumber ? String(item.periodNumber) : '—' }),
        createEl('td', {}, badge),
        titleTd,
        createEl('td', { className: 'font-mono', text: item.startTime || '' }),
        createEl('td', { className: 'font-mono', text: item.endTime || '' }),
        createEl('td', { className: 'text-muted', text: `${item.duration} мин` }),
        createEl('td', { className: 'row-status-cell' }, createEl('span', { className: 'status-pill status-upcoming', text: weekend ? '—' : 'Предстои' }))
      );

      this.el.scheduleTableBody.appendChild(tr);
    });
  }

  updateScheduleTableRowHighlights(activeItem, currentTotalSecs, schedule) {
    schedule.forEach(item => {
      const row = document.getElementById(`row-${item.id}`);
      if (!row) return;

      const endSec = item.endMin * 60;
      const pill = row.querySelector('.status-pill');
      row.classList.remove('active-row', 'passed-row');

      if (currentTotalSecs >= endSec) {
        row.classList.add('passed-row');
        if (pill) {
          pill.className = 'status-pill status-passed';
          pill.textContent = 'Приключил';
        }
      } else if (activeItem && activeItem.id === item.id) {
        row.classList.add('active-row');
        if (pill) {
          pill.className = 'status-pill status-active';
          pill.textContent = 'В момента';
        }
      } else {
        if (pill) {
          pill.className = 'status-pill status-upcoming';
          pill.textContent = 'Предстои';
        }
      }
    });
  }

  openExamModal() {
    if (!this.el.examModal) return;
    const upcoming = this.getUpcomingExams();
    const first = upcoming[0] || null;
    if (first && first.source === 'shkolo') {
      if (this.el.modalExamSubject) this.el.modalExamSubject.value = first.title;
      if (this.el.modalExamDateTime) this.el.modalExamDateTime.value = first.dateTime;
    } else {
      if (this.el.modalExamSubject) this.el.modalExamSubject.value = this.examConfig.subject || '';
      if (this.el.modalExamDateTime) this.el.modalExamDateTime.value = this.examConfig.dateTime || '';
    }
    this.el.examModal.classList.add('active');
  }

  closeExamModal() {
    if (this.el.examModal) this.el.examModal.classList.remove('active');
  }

  saveExamModal() {
    const subj = this.el.modalExamSubject ? this.el.modalExamSubject.value.trim() : '';
    const dt = this.el.modalExamDateTime ? this.el.modalExamDateTime.value : '';
    if (!subj || !dt) {
      this.showToast('Въведете предмет и дата на изпита', 'warning');
      return;
    }
    if (Number.isNaN(new Date(dt).getTime())) {
      this.showToast('Невалидна дата или час', 'danger');
      return;
    }

    this.storeManualExam(subj, dt, { source: 'main' });
    this.closeExamModal();
    this.allExamsListSignature = null;
    this.examSlotSignature = null;
    this.updateExamCountdown();
    this.updateExtraExamCountdowns();
    this.renderShkoloExams();
    this.showToast('Датата на изпита беше запазена!', 'success');
  }

  renderAlarmsList() {
    if (!this.el.alarmsList) return;
    this.el.alarmsList.replaceChildren();
    const today = todayInSofia();
    const visibleAlarms = this.customAlarms.filter(alarm => !alarm.date || alarm.date >= today);
    if (visibleAlarms.length === 0) {
      this.el.alarmsList.replaceChildren(
        createEl('div', { className: 'empty-state', text: 'Няма активни класни аларми и събития. Добавете по-горе.' })
      );
      return;
    }

    visibleAlarms.forEach((alarm) => {
      const item = document.createElement('div');
      item.className = 'alarm-item';

      const left = document.createElement('div');
      left.className = 'alarm-item-left';

      const time = document.createElement('span');
      time.className = 'alarm-item-time font-mono';
      time.textContent = alarm.date ? `${alarm.date} · ${alarm.time}` : `${alarm.time} · Всеки ден`;

      const label = document.createElement('span');
      label.className = 'alarm-item-label';
      label.textContent = alarm.label;

      left.appendChild(time);
      left.appendChild(label);

      const actions = document.createElement('div');
      actions.className = 'alarm-item-actions';

      if (alarm.attachmentId) {
        const photoBtn = document.createElement('button');
        photoBtn.className = 'btn btn-outline btn-sm';
        photoBtn.type = 'button';
        photoBtn.title = 'Виж подобрената снимка на събитието';
        photoBtn.textContent = '🖼️ Снимка';
        photoBtn.onclick = () => this.openAttachmentViewer(alarm.attachmentId, alarm.label);
        actions.appendChild(photoBtn);
      }

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-icon btn-sm delete-alarm-btn';
      deleteBtn.title = 'Изтрий алармата';
      deleteBtn.type = 'button';
      deleteBtn.textContent = '🗑️';
      deleteBtn.onclick = () => {
        this.customAlarms = this.customAlarms.filter(a => a.id !== alarm.id);
        localStorage.setItem(CUSTOM_ALARMS_KEY, JSON.stringify(this.customAlarms));
        this.renderAlarmsList();
        this.showToast('Класната аларма беше изтрита', 'info');
      };

      actions.appendChild(deleteBtn);
      item.appendChild(left);
      item.appendChild(actions);
      this.el.alarmsList.appendChild(item);
    });
  }

  checkCustomAlarms(_hours, _minutes, _seconds) {
    // Алармите и датите са училищни (България), а не според часовата зона на устройството.
    const sofia = sofiaParts(new Date());
    const timeStr = `${String(sofia.hour).padStart(2, '0')}:${String(sofia.minute).padStart(2, '0')}`;
    const todayKey = todayInSofia();
    const todayStr = todayKey;

    this.customAlarms.forEach(alarm => {
      if (!alarm.active || (alarm.date && alarm.date !== todayKey)) return;
      const alarmTime = String(alarm.time || '').padStart(5, '0');
      const key = `al-${alarm.id}-${timeStr}-${todayStr}`;
      // No seconds check: a throttled/background tab may skip the exact second.
      if (alarmTime === timeStr && !this.triggeredAlarms.has(key)) {
        this.triggeredAlarms.add(key);
        window.bellAudio.playBell(this.soundType, 3.0);
        this.notify('⏰ Лична аларма', alarm.label);
        this.showToast(`⏰ АЛАРМА: ${alarm.label}`, 'warning');
      }
    });

    const nowMs = Date.now();
    const todayIso = this.sofiaTodayIso ? this.sofiaTodayIso() : new Date().toISOString().slice(0, 10);
    const orderedExams = [...(this.shkoloExams || [])]
      .filter(exam => exam && exam.title && exam.date && exam.time
        && ((exam.timeEstimated && String(exam.date).slice(0, 10) >= todayIso)
          || SchoolBellApp.shkoloExamTimestamp(exam) > nowMs))
      .sort((a, b) => {
        const tsDiff = SchoolBellApp.shkoloExamTimestamp(a) - SchoolBellApp.shkoloExamTimestamp(b);
        if (tsDiff !== 0) return tsDiff;
        return String(a.title || '').localeCompare(String(b.title || ''), 'bg');
      });

    orderedExams.forEach(exam => {
      if (!exam || exam.date !== todayKey || String(exam.time || '').slice(0, 5) !== timeStr) return;
      const key = `sx-${exam.id || exam.externalId || exam.title}-${todayKey}-${timeStr}`;
      if (this.triggeredAlarms.has(key)) return;
      this.triggeredAlarms.add(key);
      window.bellAudio.playBell(this.soundType, 3.0);
      this.notify('📝 Изпит от Shkolo', exam.title || exam.subject || 'Предстои изпит');
      this.showToast(`📝 ИЗПИТ: ${exam.title || exam.subject || 'Shkolo'}`, 'warning');
    });
  }

  async notify(title, body) {
    if (!this.notificationsEnabled) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const options = {
      body,
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: 'school-bell',
      lang: 'bg'
    };

    try {
      const registration = navigator.serviceWorker ? await navigator.serviceWorker.getRegistration() : null;
      if (registration) {
        await registration.showNotification(title, options);
      } else {
        const notification = new Notification(title, options);
        setTimeout(() => notification.close(), 8000);
      }
    } catch (_) {
      // Some mobile browsers do not allow notifications without a service worker.
    }
  }

  async toggleWakeLock() {
    if (this.wakeLock) {
      this.wakeLockWanted = false;
      await this.releaseWakeLock();
      return;
    }
    this.wakeLockWanted = true;
    await this.requestWakeLock();
  }

  async requestWakeLock({ silent = false } = {}) {
    if (!('wakeLock' in navigator)) {
      this.wakeLockWanted = false;
      this.updateWakeLockButton();
      if (!silent) this.showToast('Браузърът не поддържа задържане на екрана включен', 'warning');
      return;
    }

    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
      this.wakeLock.addEventListener('release', () => {
        this.wakeLock = null;
        this.updateWakeLockButton();
      });
      this.updateWakeLockButton();
      if (!silent) this.showToast('💡 Екранът ще остане включен', 'success');
    } catch (err) {
      this.wakeLock = null;
      this.updateWakeLockButton();
      if (!silent) this.showToast('Неуспешно задържане на екрана включен', 'warning');
    }
  }

  async releaseWakeLock() {
    if (!this.wakeLock) return;
    try {
      await this.wakeLock.release();
    } catch (_) {}
    this.wakeLock = null;
    this.updateWakeLockButton();
    this.showToast('Екранът отново може да се изключва', 'info');
  }

  updateWakeLockButton() {
    if (!this.el || !this.el.wakeLockBtn) return;
    const active = !!this.wakeLock;
    this.el.wakeLockBtn.classList.toggle('active', active);
    this.el.wakeLockBtn.title = active
      ? 'Екранът е заключен включен – натисни за изключване'
      : 'Дръж екрана на телефона винаги включен';
    this.el.wakeLockBtn.querySelector('span').textContent = active ? '🔆' : '💡';
  }

  // ---------- Big clock settings ----------

  populateClockSettings(config) {
    if (!this.el) return;
    if (this.el.clockTitleInput) this.el.clockTitleInput.value = config.headerTitle;
    if (this.el.clockSubtitleInput) this.el.clockSubtitleInput.value = config.headerSubtitle;
    if (this.el.clockNoteInput) this.el.clockNoteInput.value = config.clockNote;
    if (this.el.clockHour12) this.el.clockHour12.checked = !!config.hour12;
    if (this.el.clockShowSeconds) this.el.clockShowSeconds.checked = config.showSeconds !== false;
    if (this.el.clockShowDate) this.el.clockShowDate.checked = config.showDate !== false;
    if (this.el.clockScale) this.el.clockScale.value = String(config.scale);
    if (this.el.clockScaleLabel) this.el.clockScaleLabel.textContent = `${config.scale}%`;
  }

  openClockSettings() {
    if (!this.el || !this.el.clockSettingsModal) return;
    this.populateClockSettings(this.clockConfig);
    this.el.clockSettingsModal.classList.add('active');
  }

  closeClockSettings() {
    if (this.el && this.el.clockSettingsModal) this.el.clockSettingsModal.classList.remove('active');
  }

  saveClockSettings() {
    const title = this.el.clockTitleInput ? this.el.clockTitleInput.value.trim() : '';
    if (!title) {
      this.showToast('Заглавието не може да е празно', 'warning');
      return;
    }

    this.clockConfig = {
      headerTitle: title.slice(0, 40),
      headerSubtitle: (this.el.clockSubtitleInput?.value || '').trim().slice(0, 80) || DEFAULT_CLOCK_CONFIG.headerSubtitle,
      clockNote: (this.el.clockNoteInput?.value || '').trim().slice(0, 60) || DEFAULT_CLOCK_CONFIG.clockNote,
      hour12: !!this.el.clockHour12?.checked,
      showSeconds: !!this.el.clockShowSeconds?.checked,
      showDate: !!this.el.clockShowDate?.checked,
      scale: Number(this.el.clockScale?.value) || 100
    };

    this.saveClockConfig();
    this.closeClockSettings();
    this.tick();
    this.showToast('Настройките на часовника са запазени!', 'success');
  }

  // ---------- Schedule / period editor ----------

  getEditorDayConfig() {
    return this.editorScheduleConfigs?.[this.editorDayKey] || this.getDayScheduleConfig(this.editorDayKey);
  }

  populateScheduleEditorSettings(config) {
    if (!this.el) return;
    this.el.scheduleStartTime.value = config.startTime;
    this.el.scheduleClassMinutes.value = String(config.classMinutes);
    this.el.scheduleSmallBreak.value = String(config.smallBreakMinutes);
    this.el.scheduleBigBreak.value = String(config.bigBreakMinutes);
    this.el.scheduleBigBreakAfter.value = String(config.bigBreakAfter);
    this.el.schedulePeriods.value = String(config.periods);
  }

  readEditorSettings() {
    const clamp = (value, min, max, fallback) => {
      const number = Number(value);
      if (!Number.isFinite(number)) return fallback;
      return Math.max(min, Math.min(max, Math.round(number)));
    };

    const fallback = this.getEditorDayConfig();
    const periods = clamp(this.el.schedulePeriods?.value, 1, 12, fallback.periods);
    const maxBigBreakAfter = Math.max(1, periods - 1);
    const settings = {
      startTime: this.el.scheduleStartTime?.value || fallback.startTime,
      classMinutes: clamp(this.el.scheduleClassMinutes?.value, 20, 90, fallback.classMinutes),
      smallBreakMinutes: clamp(this.el.scheduleSmallBreak?.value, 0, 30, fallback.smallBreakMinutes),
      bigBreakMinutes: clamp(this.el.scheduleBigBreak?.value, 0, 60, fallback.bigBreakMinutes),
      periods,
      bigBreakAfter: clamp(this.el.scheduleBigBreakAfter?.value, 1, maxBigBreakAfter, fallback.bigBreakAfter)
    };

    if (this.el.schedulePeriods) this.el.schedulePeriods.value = String(settings.periods);
    if (this.el.scheduleBigBreakAfter) {
      this.el.scheduleBigBreakAfter.max = String(maxBigBreakAfter);
      this.el.scheduleBigBreakAfter.value = String(settings.bigBreakAfter);
    }
    return settings;
  }

  collectEditorSettings() {
    if (!this.editorScheduleConfigs) return;
    this.editorScheduleConfigs[this.editorDayKey] = this.readEditorSettings();
  }

  openScheduleEditor() {
    if (!this.el || !this.el.scheduleEditorModal) return;
    this.editorSchedule = clone(this.weeklySchedule);
    this.editorScheduleConfigs = clone(this.scheduleConfig);
    this.editorDayKey = this.selectedDayKey;
    this.populateScheduleEditorSettings(this.getEditorDayConfig());
    this.el.scheduleEditorDay.value = this.editorDayKey;
    this.el.scheduleEditorModal.classList.add('active');
    this.renderScheduleEditor();
  }

  closeScheduleEditor() {
    if (this.el && this.el.scheduleEditorModal) this.el.scheduleEditorModal.classList.remove('active');
    this.editorSchedule = null;
    this.editorScheduleConfigs = null;
  }

  collectEditorPeriods() {
    if (!this.editorSchedule || !this.el || !this.el.schedulePeriodsList) return;
    const rows = this.el.schedulePeriodsList.querySelectorAll('.period-edit-row');
    const periods = [];
    rows.forEach((row) => {
      const subject = row.querySelector('.period-subject')?.value.trim() || '';
      const hasExam = !!row.querySelector('.period-exam')?.checked;
      periods.push({ subject, hasExam });
    });
    this.editorSchedule[this.editorDayKey] = periods;
  }

  renderScheduleEditor() {
    if (!this.editorSchedule || !this.el) return;

    const settings = this.readEditorSettings();
    const day = this.editorDayKey;
    const source = this.editorSchedule[day] || [];
    this.el.scheduleEditorDay.value = day;
    this.el.schedulePeriodsList.replaceChildren();

    let currentMinutes = parseTimeToMinutes(settings.startTime);

    for (let i = 1; i <= settings.periods; i++) {
      const classStart = currentMinutes;
      const classEnd = classStart + settings.classMinutes;
      const existing = source[i - 1] || { subject: '', hasExam: false };

      const row = document.createElement('div');
      row.className = 'period-edit-row';

      const number = document.createElement('span');
      number.className = 'period-number';
      number.textContent = `${i}. час`;

      const subject = document.createElement('input');
      subject.type = 'text';
      subject.className = 'period-subject';
      subject.maxLength = 60;
      subject.placeholder = `Предмет за ${i}. час`;
      subject.value = existing.subject || '';

      const time = document.createElement('span');
      time.className = 'period-time';
      time.textContent = `${formatMinutesToTime(classStart)}–${formatMinutesToTime(classEnd)}`;

      const examLabel = document.createElement('label');
      examLabel.className = 'period-exam-label';
      examLabel.title = 'Маркирай часа като контролно';
      const exam = document.createElement('input');
      exam.type = 'checkbox';
      exam.className = 'period-exam';
      exam.checked = !!existing.hasExam;
      const examText = document.createElement('span');
      examText.textContent = '📝 Контролно';
      examLabel.appendChild(exam);
      examLabel.appendChild(examText);

      row.appendChild(number);
      row.appendChild(subject);
      row.appendChild(time);
      row.appendChild(examLabel);
      this.el.schedulePeriodsList.appendChild(row);

      currentMinutes = classEnd;
      if (i < settings.periods) {
        currentMinutes += i === settings.bigBreakAfter
          ? settings.bigBreakMinutes
          : settings.smallBreakMinutes;
      }
    }

    const breaks = settings.periods - 1;
    const summary = [
      `🕒 ${settings.startTime} – ${formatMinutesToTime(currentMinutes)}`,
      `📚 ${settings.periods} часа по ${settings.classMinutes} мин`,
      `☕ ${breaks} междучасия`
    ];
    if (this.el.scheduleEditorSummary) {
      this.el.scheduleEditorSummary.textContent = `${summary.join('  •  ')}  (${WEEKDAY_LABELS[day] || day})`;
    }
    if (typeof AppI18n !== 'undefined' && AppI18n.lang === 'en') {
      this.el.schedulePeriodsList.querySelectorAll('.period-number').forEach((el) => {
        el.textContent = (el.textContent || '').replace(/^(\d+)\.\s*час$/, 'Period $1');
      });
      this.el.schedulePeriodsList.querySelectorAll('.period-subject').forEach((el) => {
        el.placeholder = (el.placeholder || '').replace(/^Предмет за (\d+)\.\s*час$/, 'Subject for period $1');
      });
      this.el.schedulePeriodsList.querySelectorAll('.period-exam-label span').forEach((el) => {
        el.textContent = '📝 Exam / Quiz';
      });
      if (this.el.scheduleEditorSummary) {
        this.el.scheduleEditorSummary.textContent = (this.el.scheduleEditorSummary.textContent || '')
          .replace(/(\d+) часа по (\d+) мин/, '$1 periods × $2 min')
          .replace(/(\d+) междучасия/, '$1 breaks')
          .replace(/\((Понеделник|Вторник|Сряда|Четвъртък|Петък)\)/, (_, d) => `(${AppI18n.EN_DAYS[d] || d})`);
      }
    }
  }

  saveScheduleEditor() {
    if (!this.editorSchedule) return;
    this.collectEditorPeriods();
    this.collectEditorSettings();

    WEEKDAYS.forEach((day) => {
      const settings = normalizeDayScheduleConfig(this.editorScheduleConfigs?.[day]);
      const source = this.editorSchedule[day] || [];
      const normalized = [];
      for (let i = 0; i < settings.periods; i++) {
        const item = source[i] || { subject: '', hasExam: false };
        normalized.push({
          subject: String(item.subject || '').trim(),
          hasExam: !!item.hasExam
        });
      }
      this.editorSchedule[day] = normalized;
      this.editorScheduleConfigs[day] = settings;
    });

    this.scheduleConfig = this.editorScheduleConfigs;
    this.weeklySchedule = this.editorSchedule;
    this.editorSchedule = null;
    this.editorScheduleConfigs = null;

    this.saveScheduleConfig();
    this.saveWeeklySchedule();
    this.closeScheduleEditor();
    this.renderScheduleTable();
    this.tick();
    this.showToast('Програмата и часовете са запазени!', 'success');
  }

  resetScheduleEditor() {
    if (!confirm('Да върна ли стандартните часове и предмети? Промените още не са запазени.')) return;
    this.editorSchedule = clone(DEFAULT_WEEKLY_SCHEDULE);
    this.editorScheduleConfigs = WEEKDAYS.reduce((configs, day) => {
      configs[day] = { ...DEFAULT_SCHEDULE_CONFIG };
      return configs;
    }, {});
    this.populateScheduleEditorSettings(this.getEditorDayConfig());
    this.renderScheduleEditor();
    this.showToast('Върнати са стандартните стойности (още не са запазени)', 'info');
  }

  showToast(message, type = 'info') {
    if (!this.el.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    let icon = '🔔';
    if (type === 'success') icon = '✅';
    if (type === 'warning') icon = '⚠️';
    if (type === 'danger') icon = '❌';

    const iconEl = document.createElement('span');
    iconEl.textContent = icon;
    const messageEl = document.createElement('span');
    messageEl.textContent = message;
    toast.appendChild(iconEl);
    toast.appendChild(messageEl);
    this.el.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3800);
  }

  // ── Камера, снимки на домашни/събития и подобряване на четимостта ──
  initPhotoScanner() {
    this.photoScanState = {
      target: 'homework',
      sourceImage: null,
      rotation: 0,
      preset: 'document',
      contrast: 135,
      brightness: 108,
      sharpness: 70,
      compareOriginal: false,
      zoomed: false
    };

    const modal = document.getElementById('photoScanModal');
    const cameraInput = document.getElementById('photoCameraInput');
    const fileInput = document.getElementById('photoFileInput');
    const viewerModal = document.getElementById('attachmentViewerModal');
    if (!modal) return;

    const openWithTarget = (target, triggerInput = null) => {
      this.setPhotoScanTarget(target);
      this.openPhotoScanModal();
      if (triggerInput) {
        triggerInput.value = '';
        triggerInput.click();
      }
    };

    document.getElementById('homeworkCameraBtn')?.addEventListener('click', () => openWithTarget('homework', cameraInput));
    document.getElementById('homeworkPhotoBtn')?.addEventListener('click', () => openWithTarget('homework', fileInput));
    document.getElementById('eventCameraBtn')?.addEventListener('click', () => openWithTarget('event', cameraInput));
    document.getElementById('eventPhotoBtn')?.addEventListener('click', () => openWithTarget('event', fileInput));

    document.getElementById('modalCameraTriggerBtn')?.addEventListener('click', () => {
      if (cameraInput) { cameraInput.value = ''; cameraInput.click(); }
    });
    document.getElementById('modalFileTriggerBtn')?.addEventListener('click', () => {
      if (fileInput) { fileInput.value = ''; fileInput.click(); }
    });

    const handleFilePicked = (file) => {
      if (!file) return;
      if (!/^image\//i.test(file.type || '') && !/\.(png|jpe?g|webp|gif|bmp|heic|heif)$/i.test(file.name || '')) {
        this.showToast('Моля, изберете файл със снимка (JPG, PNG, WebP).', 'warning');
        return;
      }
      this.loadPhotoFileForScan(file);
    };
    cameraInput?.addEventListener('change', (e) => handleFilePicked(e.target.files?.[0]));
    fileInput?.addEventListener('change', (e) => handleFilePicked(e.target.files?.[0]));

    const dropzone = document.getElementById('photoDropzone');
    if (dropzone) {
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('is-dragover');
      });
      dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-dragover'));
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('is-dragover');
        handleFilePicked(e.dataTransfer?.files?.[0]);
      });
    }

    document.addEventListener('paste', (e) => {
      if (!modal.classList.contains('active')) return;
      const items = e.clipboardData?.items || [];
      for (const item of items) {
        if (item.type && item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            e.preventDefault();
            handleFilePicked(blob);
            break;
          }
        }
      }
    });

    modal.querySelectorAll('[data-photo-target]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.setPhotoScanTarget(btn.dataset.photoTarget);
      });
    });

    modal.querySelectorAll('[data-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.photoScanState.preset = btn.dataset.preset;
        this.photoScanState.compareOriginal = false;
        this.updatePhotoPresetButtons();
        this.renderEnhancedPhoto();
      });
    });

    document.getElementById('photoRotateLeftBtn')?.addEventListener('click', () => {
      this.photoScanState.rotation = (this.photoScanState.rotation + 270) % 360;
      this.renderEnhancedPhoto();
    });
    document.getElementById('photoRotateRightBtn')?.addEventListener('click', () => {
      this.photoScanState.rotation = (this.photoScanState.rotation + 90) % 360;
      this.renderEnhancedPhoto();
    });
    document.getElementById('photoCompareBtn')?.addEventListener('click', () => {
      this.photoScanState.compareOriginal = !this.photoScanState.compareOriginal;
      this.updatePhotoPresetButtons();
      this.renderEnhancedPhoto();
    });
    document.getElementById('photoZoomBtn')?.addEventListener('click', () => {
      this.photoScanState.zoomed = !this.photoScanState.zoomed;
      const frame = document.getElementById('photoPreviewFrame');
      const btn = document.getElementById('photoZoomBtn');
      frame?.classList.toggle('is-zoomed', this.photoScanState.zoomed);
      if (btn) btn.textContent = this.photoScanState.zoomed ? '🔎 Помести' : '🔍 Увеличи';
    });

    const bindSlider = (id, key, labelId, suffix = '%') => {
      const el = document.getElementById(id);
      const lbl = document.getElementById(labelId);
      if (!el) return;
      el.addEventListener('input', () => {
        this.photoScanState[key] = Number(el.value);
        this.photoScanState.compareOriginal = false;
        if (lbl) lbl.textContent = `${el.value}${suffix}`;
        this.renderEnhancedPhoto();
      });
    };
    bindSlider('photoContrastSlider', 'contrast', 'photoContrastVal');
    bindSlider('photoBrightnessSlider', 'brightness', 'photoBrightnessVal');
    bindSlider('photoSharpnessSlider', 'sharpness', 'photoSharpnessVal');

    document.getElementById('photoResetAdjustBtn')?.addEventListener('click', () => {
      this.photoScanState.preset = 'document';
      this.photoScanState.contrast = 135;
      this.photoScanState.brightness = 108;
      this.photoScanState.sharpness = 70;
      this.photoScanState.compareOriginal = false;
      this.syncPhotoAdjustmentInputs();
      this.renderEnhancedPhoto();
    });

    document.getElementById('savePhotoScanBtn')?.addEventListener('click', () => this.savePhotoScanEntry());
    document.getElementById('closePhotoScanModalBtn')?.addEventListener('click', () => this.closePhotoScanModal());
    document.getElementById('cancelPhotoScanModalBtn')?.addEventListener('click', () => this.closePhotoScanModal());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.closePhotoScanModal();
    });

    document.getElementById('closeAttachmentViewerBtn')?.addEventListener('click', () => this.closeAttachmentViewer());
    document.getElementById('attachmentZoomToggleBtn')?.addEventListener('click', () => {
      const stage = document.getElementById('attachmentViewerStage');
      stage?.classList.toggle('is-zoomed');
    });
    viewerModal?.addEventListener('click', (e) => {
      if (e.target === viewerModal) this.closeAttachmentViewer();
    });
  }

  openPhotoScanModal() {
    const modal = document.getElementById('photoScanModal');
    if (!modal) return;
    const dateInput = document.getElementById('photoDateInput');
    if (dateInput) {
      dateInput.min = todayInSofia();
      if (!dateInput.value) {
        dateInput.value = this.photoScanState.target === 'homework' ? this.shiftSofiaDate(1) : todayInSofia();
      }
    }
    this.syncPhotoAdjustmentInputs();
    modal.classList.add('active');
  }

  closePhotoScanModal() {
    document.getElementById('photoScanModal')?.classList.remove('active');
  }

  resetPhotoScanState() {
    if (this.photoScanState?.sourceImage && typeof this.photoScanState.sourceImage.close === 'function') {
      try { this.photoScanState.sourceImage.close(); } catch (_) {}
    }
    if (this.photoScanState) {
      this.photoScanState.sourceImage = null;
      this.photoScanState.rotation = 0;
      this.photoScanState.compareOriginal = false;
    }
    const workspace = document.getElementById('photoEditorWorkspace');
    if (workspace) workspace.hidden = true;
    const subj = document.getElementById('photoSubjectInput');
    const teacher = document.getElementById('photoTeacherInput');
    const date = document.getElementById('photoDateInput');
    const desc = document.getElementById('photoDescriptionInput');
    if (subj) subj.value = '';
    if (teacher) teacher.value = '';
    if (date) date.value = '';
    if (desc) desc.value = '';
  }

  openAttachmentViewer(attachmentId, title = 'Снимка') {
    const modal = document.getElementById('attachmentViewerModal');
    const img = document.getElementById('attachmentViewerImg');
    const titleEl = document.getElementById('attachmentViewerTitle');
    const link = document.getElementById('attachmentDownloadLink');
    const stage = document.getElementById('attachmentViewerStage');
    if (!modal || !img || !attachmentId) return;
    const url = (attachmentId.startsWith('./') || attachmentId.startsWith('/'))
      ? attachmentId
      : `./api/attachments/${encodeURIComponent(attachmentId)}`;
    stage?.classList.remove('is-zoomed');
    if (titleEl) titleEl.textContent = `🖼️ ${title}`;
    img.src = url;
    if (link) {
      link.href = url;
      link.download = attachmentId.split('/').pop() || 'snimka.webp';
    }
    modal.classList.add('active');
    if (typeof AppI18n !== 'undefined' && AppI18n.lang === 'en') AppI18n.apply();
  }

  closeAttachmentViewer() {
    const modal = document.getElementById('attachmentViewerModal');
    const img = document.getElementById('attachmentViewerImg');
    if (modal) modal.classList.remove('active');
    if (img) img.removeAttribute('src');
  }

  shiftSofiaDate(days) {
    const base = todayInSofia();
    const parts = base.split('-').map(Number);
    const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + Number(days || 0)));
    return dt.toISOString().slice(0, 10);
  }

  setPhotoScanTarget(target) {
    const valid = target === 'event' ? 'event' : 'homework';
    this.photoScanState.target = valid;
    const modal = document.getElementById('photoScanModal');
    modal?.querySelectorAll('[data-photo-target]').forEach((btn) => {
      const active = btn.dataset.photoTarget === valid;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });

    const subjectLbl = document.getElementById('photoSubjectLabel');
    const subjectInp = document.getElementById('photoSubjectInput');
    const teacherGroup = document.getElementById('photoTeacherGroup');
    const dateLbl = document.getElementById('photoDateLabel');
    const dateInp = document.getElementById('photoDateInput');
    const timeGroup = document.getElementById('photoTimeGroup');
    const descGroup = document.getElementById('photoDescriptionGroup');
    const descLbl = document.getElementById('photoDescriptionLabel');
    const descInp = document.getElementById('photoDescriptionInput');
    const attachWrap = document.getElementById('photoAttachOptionWrap');

    if (valid === 'homework') {
      if (subjectLbl) subjectLbl.textContent = 'Предмет (по избор)';
      if (subjectInp) {
        subjectInp.required = false;
        subjectInp.placeholder = 'напр. Математика, БЕЛ, История';
      }
      if (teacherGroup) teacherGroup.hidden = false;
      if (dateLbl) dateLbl.textContent = 'Срок / Дата';
      if (dateInp) dateInp.value = dateInp.value || this.shiftSofiaDate(1);
      if (timeGroup) timeGroup.hidden = true;
      if (descGroup) descGroup.hidden = false;
      if (descLbl) descLbl.textContent = 'Бележка / Описание (по избор)';
      if (descInp) {
        descInp.required = false;
        descInp.placeholder = 'По желание: кратка бележка към снимката…';
      }
      if (attachWrap) attachWrap.hidden = false;
    } else {
      if (subjectLbl) subjectLbl.textContent = 'Събитие / Напомняне (по избор)';
      if (subjectInp) {
        subjectInp.required = false;
        subjectInp.placeholder = 'напр. Родителска среща, Екскурзия, Празник';
      }
      if (teacherGroup) teacherGroup.hidden = true;
      if (dateLbl) dateLbl.textContent = 'Дата на събитието';
      if (dateInp) dateInp.value = dateInp.value || todayInSofia();
      if (timeGroup) timeGroup.hidden = false;
      if (descGroup) descGroup.hidden = false;
      if (descLbl) descLbl.textContent = 'Допълнително описание (по избор)';
      if (descInp) {
        descInp.required = false;
        descInp.placeholder = 'По желание: кратка бележка към снимката…';
      }
      if (attachWrap) attachWrap.hidden = false;
    }
    if (typeof AppI18n !== 'undefined' && AppI18n.lang === 'en') AppI18n.apply();
  }

  syncPhotoAdjustmentInputs() {
    const s = this.photoScanState;
    const set = (id, val, lblId) => {
      const el = document.getElementById(id);
      const lbl = document.getElementById(lblId);
      if (el) el.value = String(val);
      if (lbl) lbl.textContent = `${val}%`;
    };
    set('photoContrastSlider', s.contrast, 'photoContrastVal');
    set('photoBrightnessSlider', s.brightness, 'photoBrightnessVal');
    set('photoSharpnessSlider', s.sharpness, 'photoSharpnessVal');
    this.updatePhotoPresetButtons();
  }

  updatePhotoPresetButtons() {
    const s = this.photoScanState;
    document.querySelectorAll('.photo-preset-btn').forEach((btn) => {
      btn.classList.toggle('active', !s.compareOriginal && btn.dataset.preset === s.preset);
    });
    const cmp = document.getElementById('photoCompareBtn');
    if (cmp) {
      cmp.setAttribute('aria-pressed', String(s.compareOriginal));
      cmp.textContent = s.compareOriginal ? '✨ Покажи подобрената' : '👁️ Оригинал';
    }
    if (typeof AppI18n !== 'undefined' && AppI18n.lang === 'en') AppI18n.apply();
  }

  async loadPhotoFileForScan(file) {
    const workspace = document.getElementById('photoEditorWorkspace');
    try {
      let sourceImage;
      if (typeof createImageBitmap === 'function') {
        sourceImage = await createImageBitmap(file);
      } else {
        sourceImage = await new Promise((resolve, reject) => {
          const url = URL.createObjectURL(file);
          const img = new Image();
          img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
          img.onerror = (err) => { URL.revokeObjectURL(url); reject(err); };
          img.src = url;
        });
      }
      this.photoScanState.sourceImage = sourceImage;
      this.photoScanState.rotation = 0;
      this.photoScanState.compareOriginal = false;
      this.photoScanState.preset = 'document';
      this.photoScanState.contrast = 135;
      this.photoScanState.brightness = 108;
      this.photoScanState.sharpness = 70;
      if (workspace) workspace.hidden = false;
      this.syncPhotoAdjustmentInputs();
      this.renderEnhancedPhoto();
    } catch (err) {
      this.showToast(err?.message || 'Снимката не можа да бъде прочетена. Опитайте с друг формат (JPG/PNG).', 'warning');
    }
  }

  renderEnhancedPhoto() {
    const canvas = document.getElementById('photoEnhancedCanvas');
    const img = this.photoScanState.sourceImage;
    if (!canvas || !img) return;

    const rawW = img.width || img.naturalWidth || 1;
    const rawH = img.height || img.naturalHeight || 1;
    const maxDim = 1700;
    const scale = Math.min(1.6, maxDim / Math.max(rawW, rawH));
    const baseW = Math.max(1, Math.round(rawW * scale));
    const baseH = Math.max(1, Math.round(rawH * scale));
    const rot = ((this.photoScanState.rotation % 360) + 360) % 360;
    const outW = (rot === 90 || rot === 270) ? baseH : baseW;
    const outH = (rot === 90 || rot === 270) ? baseW : baseH;

    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.save();
    ctx.translate(outW / 2, outH / 2);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, -baseW / 2, -baseH / 2, baseW, baseH);
    ctx.restore();

    const s = this.photoScanState;
    if (s.compareOriginal || s.preset === 'original') return;

    const imgData = ctx.getImageData(0, 0, outW, outH);
    const data = imgData.data;
    const total = outW * outH;

    // 1. Luminance array + downsampled local background illumination estimate
    const lum = new Float32Array(total);
    for (let i = 0, p = 0; i < total; i++, p += 4) {
      lum[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
    }

    const ds = Math.max(8, Math.round(Math.min(outW, outH) / 60));
    const sw = Math.max(4, Math.ceil(outW / ds));
    const sh = Math.max(4, Math.ceil(outH / ds));
    const small = new Float32Array(sw * sh);
    for (let sy = 0; sy < sh; sy++) {
      const y0 = sy * ds;
      const y1 = Math.min(outH, y0 + ds);
      for (let sx = 0; sx < sw; sx++) {
        const x0 = sx * ds;
        const x1 = Math.min(outW, x0 + ds);
        let maxVal = 0;
        let sumVal = 0;
        let cnt = 0;
        for (let y = y0; y < y1; y += 2) {
          const row = y * outW;
          for (let x = x0; x < x1; x += 2) {
            const v = lum[row + x];
            if (v > maxVal) maxVal = v;
            sumVal += v;
            cnt++;
          }
        }
        // Blend local average and upper-percentile paper brightness to remove shadows
        small[sy * sw + sx] = cnt ? (0.45 * (sumVal / cnt) + 0.55 * maxVal) : 200;
      }
    }

    // Separable 2-pass box blur on small background map
    const blurRadius = 4;
    const tmpSmall = new Float32Array(sw * sh);
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        let sum = 0, cnt = 0;
        for (let dx = -blurRadius; dx <= blurRadius; dx++) {
          const nx = Math.max(0, Math.min(sw - 1, x + dx));
          sum += small[y * sw + nx];
          cnt++;
        }
        tmpSmall[y * sw + x] = sum / cnt;
      }
    }
    const bgSmall = new Float32Array(sw * sh);
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        let sum = 0, cnt = 0;
        for (let dy = -blurRadius; dy <= blurRadius; dy++) {
          const ny = Math.max(0, Math.min(sh - 1, y + dy));
          sum += tmpSmall[ny * sw + x];
          cnt++;
        }
        bgSmall[y * sw + x] = Math.max(40, sum / cnt);
      }
    }

    const contrastFactor = s.contrast / 100;
    const brightnessBias = (s.brightness - 100) * 1.4;
    const enhancedLum = new Float32Array(total);

    for (let y = 0; y < outH; y++) {
      const fy = Math.min(sh - 1.001, (y + 0.5) / ds);
      const y0 = Math.floor(fy), y1 = Math.min(sh - 1, y0 + 1), wy = fy - y0;
      const row = y * outW;
      for (let x = 0; x < outW; x++) {
        const fx = Math.min(sw - 1.001, (x + 0.5) / ds);
        const x0 = Math.floor(fx), x1 = Math.min(sw - 1, x0 + 1), wx = fx - x0;
        const b00 = bgSmall[y0 * sw + x0], b10 = bgSmall[y0 * sw + x1];
        const b01 = bgSmall[y1 * sw + x0], b11 = bgSmall[y1 * sw + x1];
        const localBg = (b00 * (1 - wx) + b10 * wx) * (1 - wy) + (b01 * (1 - wx) + b11 * wx) * wy;

        const idx = row + x;
        const p = idx * 4;
        const origL = lum[idx];
        const normL = Math.min(255, (origL * 238) / localBg);

        if (s.preset === 'crisp') {
          let v = (normL - 145) * (contrastFactor * 1.45) + 145 + brightnessBias;
          // Soft adaptive binarization for razor-sharp black-on-white reading
          const softBin = normL < 168 ? Math.max(0, (normL - 70) * 0.55) : Math.min(255, 225 + (normL - 168) * 0.4);
          v = 0.45 * v + 0.55 * softBin;
          v = Math.max(0, Math.min(255, v));
          enhancedLum[idx] = v;
          data[p] = v;
          data[p + 1] = v;
          data[p + 2] = v;
        } else if (s.preset === 'document') {
          let v = (normL - 150) * contrastFactor + 155 + brightnessBias;
          if (v > 205) v = 205 + (v - 205) * 1.25;
          v = Math.max(0, Math.min(255, v));
          enhancedLum[idx] = v;
          const ratio = origL > 4 ? v / origL : 1;
          const r = data[p] * ratio;
          const g = data[p + 1] * ratio;
          const b = data[p + 2] * ratio;
          // Desaturate paper background lightly while keeping dark ink crisp
          const inkMix = v > 195 ? 0.8 : 0.35;
          data[p] = Math.max(0, Math.min(255, r * (1 - inkMix) + v * inkMix));
          data[p + 1] = Math.max(0, Math.min(255, g * (1 - inkMix) + v * inkMix));
          data[p + 2] = Math.max(0, Math.min(255, b * (1 - inkMix) + v * inkMix));
        } else {
          // 'color' preset: lift shadows & sharpen while keeping ink colors vivid
          let v = (0.55 * normL + 0.45 * origL - 128) * contrastFactor + 128 + brightnessBias;
          v = Math.max(0, Math.min(255, v));
          enhancedLum[idx] = v;
          const ratio = origL > 4 ? v / origL : 1;
          data[p] = Math.max(0, Math.min(255, data[p] * ratio));
          data[p + 1] = Math.max(0, Math.min(255, data[p + 1] * ratio));
          data[p + 2] = Math.max(0, Math.min(255, data[p + 2] * ratio));
        }
      }
    }

    // 2. Unsharp mask sharpening on luminance channel for crisp text edges
    const sharpAmount = (s.sharpness / 100) * 1.15;
    if (sharpAmount > 0.02 && outW > 2 && outH > 2) {
      for (let y = 1; y < outH - 1; y++) {
        const row = y * outW;
        for (let x = 1; x < outW - 1; x++) {
          const idx = row + x;
          const center = enhancedLum[idx];
          const avg = (
            enhancedLum[idx - 1] + enhancedLum[idx + 1] +
            enhancedLum[idx - outW] + enhancedLum[idx + outW]
          ) * 0.25;
          const delta = (center - avg) * sharpAmount;
          const p = idx * 4;
          data[p] = Math.max(0, Math.min(255, data[p] + delta));
          data[p + 1] = Math.max(0, Math.min(255, data[p + 1] + delta));
          data[p + 2] = Math.max(0, Math.min(255, data[p + 2] + delta));
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }

  exportCanvasImage(maxSide = 1600, maxBytes = 2400000, preferWebp = true) {
    const srcCanvas = document.getElementById('photoEnhancedCanvas');
    if (!srcCanvas || !srcCanvas.width || !srcCanvas.height) return '';
    const scale = Math.min(1, maxSide / Math.max(srcCanvas.width, srcCanvas.height));
    let work = srcCanvas;
    if (scale < 0.99) {
      work = document.createElement('canvas');
      work.width = Math.max(1, Math.round(srcCanvas.width * scale));
      work.height = Math.max(1, Math.round(srcCanvas.height * scale));
      const ctx = work.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(srcCanvas, 0, 0, work.width, work.height);
    }

    const mime = preferWebp ? 'image/webp' : 'image/jpeg';
    let quality = 0.88;
    let dataUrl = work.toDataURL(mime, quality);
    if (preferWebp && !dataUrl.startsWith('data:image/webp')) {
      dataUrl = work.toDataURL('image/jpeg', quality);
    }
    const activeMime = dataUrl.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
    while (dataUrl.length * 0.75 > maxBytes && quality > 0.42) {
      quality -= 0.1;
      dataUrl = work.toDataURL(activeMime, quality);
    }
    return dataUrl;
  }

  async uploadEnhancedPhotoAttachment() {
    const attachChecked = document.getElementById('photoAttachCheckbox')?.checked;
    if (!attachChecked || !this.photoScanState.sourceImage) return '';
    const imageData = this.exportCanvasImage(1400, 380000, true);
    if (!imageData) return '';
    const context = window.SCHOOL_BELL_CONTEXT || {};
    const identity = `${String(context.school || '').trim().toLocaleLowerCase('bg')}\u0000${String(context.className || '').trim().toLocaleLowerCase('bg')}`;
    const resp = await fetch('./api/attachments', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity, imageData })
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || 'Снимката не можа да се качи.');
    return data.attachmentId || '';
  }

  async persistPhotoEntry({ kind, subject, teacher, date, time, description, attachmentId }) {
    const today = todayInSofia();
    if (!date || date < today) {
      throw new Error('Датата не може да е в миналото.');
    }
    if (kind === 'homework') {
      const cleanDesc = (description || '').trim();
      const cleanSubj = (subject || '').trim();
      const text = cleanDesc || (attachmentId ? '📷 Прикачена снимка' : cleanSubj);
      if (!text) throw new Error('Прикачете снимка или опишете домашното.');
      const data = await ProfileHomework.addHomework({
        teacher: (teacher || '').trim(),
        subject: cleanSubj || 'Домашно',
        dueDate: date,
        description: text,
        ...(attachmentId ? { attachmentId } : {})
      });
      this.applyProfileData(data);
      return;
    }
    if (kind === 'event') {
      const descPart = (description || '').trim();
      const baseTitle = (subject || '').trim();
      let label = baseTitle;
      if (descPart && !descPart.toLocaleLowerCase('bg').includes(baseTitle.toLocaleLowerCase('bg'))) {
        label = baseTitle ? `${baseTitle}: ${descPart}` : descPart;
      } else if (descPart) {
        label = descPart;
      }
      label = label.replace(/\s+/g, ' ').trim().slice(0, 120);
      if (!label && attachmentId) label = '📷 Прикачена снимка';
      if (!label) throw new Error('Прикачете снимка или въведете описание за събитието.');
      const t = /^\d{2}:\d{2}$/.test(time || '') ? time : '09:00';
      this.customAlarms.push({
        id: 'al-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        time: t,
        date,
        label,
        active: true,
        ...(attachmentId ? { attachmentId } : {})
      });
      this.customAlarms.sort((a, b) => `${a.date || ''}${a.time}`.localeCompare(`${b.date || ''}${b.time}`));
      localStorage.setItem(CUSTOM_ALARMS_KEY, JSON.stringify(this.customAlarms));
      this.renderAlarmsList();
    }
  }

  async savePhotoScanEntry() {
    const saveBtn = document.getElementById('savePhotoScanBtn');
    const kind = this.photoScanState.target === 'event' ? 'event' : 'homework';
    const subject = document.getElementById('photoSubjectInput')?.value.trim() || '';
    const teacher = document.getElementById('photoTeacherInput')?.value.trim() || '';
    const date = document.getElementById('photoDateInput')?.value || '';
    const time = document.getElementById('photoTimeInput')?.value || '09:00';
    const description = document.getElementById('photoDescriptionInput')?.value.trim() || '';

    if (!this.photoScanState.sourceImage && !subject && !description) {
      this.showToast('Моля, снимайте или качете снимка.', 'warning');
      return;
    }

    if (saveBtn) saveBtn.disabled = true;
    try {
      const attachmentId = await this.uploadEnhancedPhotoAttachment();
      await this.persistPhotoEntry({ kind, subject, teacher, date, time, description, attachmentId });
      this.resetPhotoScanState();
      this.closePhotoScanModal();
      const labels = {
        homework: 'Снимката на домашното е добавена за класа!',
        event: 'Снимката на събитието е добавена за класа!'
      };
      this.showToast(labels[kind] || 'Снимката е добавена!', 'success');
    } catch (err) {
      this.showToast(err?.message || 'Записът не можа да бъде запазен.', 'warning');
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }
}

// Shared classroom data is synchronized by the companion Node server.
const SHARED_DATA_KEYS = [
  'school_bell_weekly_schedule_v2',
  'school_bell_schedule_config_v1',
  'school_bell_clock_config_v1',
  'school_bell_next_exam',
  'school_bell_extra_exams_v1',
  'school_bell_vacations_v2',
  'school_bell_vacation',
  'school_bell_no_school_days_v1',
  CLASS_HOMEWORK_KEY,
  CUSTOM_ALARMS_KEY
];
const SharedClassData = (() => {
  const sharedKeys = new Set(SHARED_DATA_KEYS);
  let enabled = false;
  let clientId = '';
  let pendingPatch = {};
  let flushTimer = null;
  let pendingRemoteState = null;
  let applyingRemote = false;
  let roomLabel = '';
  let roomIdentity = '';
  let storagePrefix = '';
  const nativeGetItem = Storage.prototype.getItem;
  const nativeSetItem = Storage.prototype.setItem;
  const nativeRemoveItem = Storage.prototype.removeItem;
  const api = (path) => new URL(`./api/${path}`, location.href).toString();
  function withIdentity(path, extra = {}) {
    const url = new URL(api(path));
    if (roomIdentity) url.searchParams.set('identity', roomIdentity);
    for (const [key, value] of Object.entries(extra)) url.searchParams.set(key, value);
    return url.toString();
  }

  function scopeKey(key) {
    return sharedKeys.has(String(key)) ? storagePrefix + String(key) : String(key);
  }
  function installScopedStorage() {
    // Общите данни се пазят под ключ за конкретното училище и клас. Така дори
    // два профила/два класа в един браузър не могат да си наследят кеша.
    Storage.prototype.getItem = function(key) {
      return nativeGetItem.call(this, this === localStorage ? scopeKey(key) : key);
    };
    Storage.prototype.setItem = function(key, value) {
      const logicalKey = String(key);
      const actualKey = this === localStorage ? scopeKey(logicalKey) : logicalKey;
      nativeSetItem.call(this, actualKey, value);
      if (this === localStorage && enabled && !applyingRemote && sharedKeys.has(logicalKey)) {
        queueChange(logicalKey, String(value));
      }
    };
    Storage.prototype.removeItem = function(key) {
      const logicalKey = String(key);
      const actualKey = this === localStorage ? scopeKey(logicalKey) : logicalKey;
      nativeRemoveItem.call(this, actualKey);
      if (this === localStorage && enabled && !applyingRemote && sharedKeys.has(logicalKey)) {
        queueChange(logicalKey, null);
      }
    };
    if (!storagePrefix) {
      // Без вход няма клас — не пипаме общите ключове.
      Storage.prototype.getItem = nativeGetItem;
      Storage.prototype.setItem = nativeSetItem;
      Storage.prototype.removeItem = nativeRemoveItem;
    }
  }
  function clearSharedKeys() {
    applyingRemote = true;
    for (const key of sharedKeys) nativeRemoveItem.call(localStorage, scopeKey(key));
    applyingRemote = false;
  }
  function migrateLegacySharedKeys(previousRoom) {
    const legacyBelongsToThisRoom = !!(roomIdentity && previousRoom === roomIdentity);
    const migrated = {};
    applyingRemote = true;
    for (const key of sharedKeys) {
      const value = nativeGetItem.call(localStorage, key);
      if (value !== null) {
        if (legacyBelongsToThisRoom) {
          nativeSetItem.call(localStorage, scopeKey(key), value);
          migrated[key] = value;
        }
        nativeRemoveItem.call(localStorage, key);
      }
    }
    applyingRemote = false;
    return migrated;
  }
  async function postPatch(data) {
    const response = await fetch(api('shared-data'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, clientId, identity: roomIdentity })
    });
    if (!response.ok) throw new Error(`Shared store returned ${response.status}`);
    return response.json();
  }
  function setStatus(text, connected) {
    const element = document.getElementById('sharedSyncStatus');
    if (!element) return;
    element.textContent = (typeof AppI18n !== 'undefined' && AppI18n.lang === 'en')
      ? AppI18n.translateDynamicString(text)
      : text;
    element.classList.toggle('connected', !!connected);
    element.classList.toggle('disconnected', !connected);
  }
  function roomSuffix() {
    return roomLabel ? ` за ${roomLabel}` : '';
  }
  function flush() {
    flushTimer = null;
    const patch = pendingPatch;
    pendingPatch = {};
    if (!Object.keys(patch).length || !enabled) return;
    postPatch(patch).then(() => setStatus(`Промените са запазени${roomSuffix()}`, true)).catch(() => {
      pendingPatch = { ...patch, ...pendingPatch };
      setStatus(`Няма връзка със сървъра — промените${roomSuffix()} чакат синхронизация`, false);
    });
  }
  function queueChange(key, value) {
    pendingPatch[key] = value;
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, 180);
  }
  function applyRemoteState(state) {
    if (!state || typeof state !== 'object') return;
    // Сървърът изпраща лек сигнал, когато личните Shkolo данни (забележки или
    // връзка) са се променили, без да разкрива самите данни в SSE съобщението.
    if (state.profileRefresh && window.app && typeof window.app.loadProfileData === 'function') {
      window.app.loadProfileData({ silent: true });
    }
    if (!state.data || typeof state.data !== 'object') return;
    applyingRemote = true;
    for (const key of sharedKeys) {
      if (Object.prototype.hasOwnProperty.call(state.data, key) && typeof state.data[key] === 'string') {
        nativeSetItem.call(localStorage, scopeKey(key), state.data[key]);
      } else {
        nativeRemoveItem.call(localStorage, scopeKey(key));
      }
    }
    applyingRemote = false;
    if (window.app && typeof window.app.refreshFromSharedStorage === 'function') {
      // Обновяваме интерфейса, без да връщаме същите данни обратно към сървъра.
      applyingRemote = true;
      try { window.app.refreshFromSharedStorage(); }
      catch (error) { console.warn('Could not refresh shared data in the UI.', error); }
      finally { applyingRemote = false; }
    }
    setStatus(`Заредени са промени от друг профил${roomSuffix()}`, true);
  }
  function hasActiveEditor() {
    const active = document.activeElement;
    return !!active && (active.matches('input, textarea, select, [contenteditable="true"]'));
  }
  async function initialize(user) {
    roomLabel = user && user.school && user.className ? `${user.school} · ${user.className}` : '';
    roomIdentity = user && user.school && user.className
      ? `${String(user.school).trim().toLocaleLowerCase('bg')}\u0000${String(user.className).trim().toLocaleLowerCase('bg')}`
      : '';
    storagePrefix = roomIdentity ? `school_bell_class:${encodeURIComponent(roomIdentity)}:` : '';
    installScopedStorage();
    try {
      clientId = crypto.randomUUID ? crypto.randomUUID() : `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const previousRoom = nativeGetItem.call(localStorage, 'school_bell_room_identity') || '';
      if (roomIdentity) nativeSetItem.call(localStorage, 'school_bell_room_identity', roomIdentity);
      const migratedLegacy = migrateLegacySharedKeys(previousRoom);
      const response = await fetch(withIdentity('shared-data'), { cache: 'no-store' });
      if (!response.ok) throw new Error('Shared data API unavailable');
      const state = await response.json();
      const remoteData = state && state.data && typeof state.data === 'object' ? state.data : {};
      const remoteHasData = Object.keys(remoteData).length > 0;
      if (remoteHasData) {
        applyingRemote = true;
        for (const key of sharedKeys) {
          if (Object.prototype.hasOwnProperty.call(remoteData, key) && typeof remoteData[key] === 'string') {
            nativeSetItem.call(localStorage, scopeKey(key), remoteData[key]);
          } else {
            nativeRemoveItem.call(localStorage, scopeKey(key));
          }
        }
        applyingRemote = false;
      } else {
        // Нов или празен клас не наследява кешираните данни на предишен клас.
        clearSharedKeys();
      }
      enabled = true;
      // Старите аларми в браузъра са били общи за всички профили. Ако предишният
      // клас в този браузър е същият, запазваме ги като класни и ги качваме.
      if (migratedLegacy[CUSTOM_ALARMS_KEY] && !remoteData[CUSTOM_ALARMS_KEY]) {
        localStorage.setItem(CUSTOM_ALARMS_KEY, migratedLegacy[CUSTOM_ALARMS_KEY]);
      }
      setStatus(remoteHasData
        ? `Общите данни са само${roomSuffix()}`
        : `Нов клас${roomSuffix()} — няма запазени общи данни`, true);
      let sseOpenCount = 0;
      const source = new EventSource(withIdentity('events', { clientId }));
      source.onmessage = (event) => {
        let update;
        try { update = JSON.parse(event.data); } catch (_) { return; }
        if (!update || update.clientId === clientId) return;
        pendingRemoteState = update;
        if (!hasActiveEditor()) {
          if (Object.keys(pendingPatch).length) {
            if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
            flush();
            setTimeout(() => {
              if (pendingRemoteState) { const next = pendingRemoteState; pendingRemoteState = null; applyRemoteState(next); }
            }, 450);
          } else {
            const next = pendingRemoteState; pendingRemoteState = null; applyRemoteState(next);
          }
        } else {
          setStatus(`Друг профил${roomSuffix()} промени данни — обновяването ще стане след приключване на редакцията`, true);
        }
      };
      document.addEventListener('focusout', () => {
        if (pendingRemoteState) setTimeout(() => {
          if (pendingRemoteState && !hasActiveEditor()) {
            const next = pendingRemoteState; pendingRemoteState = null; applyRemoteState(next);
          }
        }, 400);
      }, true);
      source.onerror = () => setStatus('Повторно свързване със споделения сървър…', false);
      source.onopen = async () => {
        sseOpenCount += 1;
        setStatus(`Общите данни са само${roomSuffix()}`, true);
        if (sseOpenCount > 1) {
          try {
            const reloadResp = await fetch(withIdentity('shared-data'), { cache: 'no-store' });
            if (reloadResp.ok) {
              const latest = await reloadResp.json();
              if (latest && latest.data && !hasActiveEditor()) {
                applyRemoteState(latest);
              }
            }
          } catch (_) {}
        }
      };
      return true;
    } catch (error) {
      enabled = false;
      setStatus(`Локален режим${roomSuffix()} — стартирайте проекта със споделения сървър, за да виждат промените всички`, false);
      console.warn('Shared data sync unavailable; local browser storage remains active.', error);
      return false;
    }
  }
  return { initialize };
})();

const Auth = (() => {
  const api = path => new URL('./api/auth/' + path, location.href).toString();
  const showError = message => { const el = document.querySelector('#authError'); if (el) el.textContent = message || ''; };
  let currentUser = null;

  const revealApp = user => {
    currentUser = user;
    window.SCHOOL_BELL_CONTEXT = { school: user.school, className: user.className, username: user.username };
    document.querySelector('#authGate').hidden = true;
    document.querySelector('#application').hidden = false;
    const identity = document.querySelector('#classroomIdentity');
    if (identity) {
      identity.textContent = user.school + ' · ' + user.className + ' · ' + user.username;
      identity.title = `${user.school}, ${user.className} — профил: ${user.username}`;
    }
    const setContext = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value || '—';
    };
    setContext('activeContextUser', user.username);
    setContext('activeContextSchool', user.school);
    setContext('activeContextClass', user.className);
    if (user.school && user.className) {
      document.title = `${user.className} · ${user.school} — Училищен Будилник`;
    }
  };

  async function send(path, payload) {
    const response = await fetch(api(path), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Неуспешна заявка.');
    return data;
  }

  function setupRegistrationPickers() {
    const schoolSelect = document.querySelector('#registerSchool');
    const otherLabel = document.querySelector('#registerOtherSchoolLabel');
    const otherInput = document.querySelector('#registerOtherSchool');
    const gradeSelect = document.querySelector('#registerGrade');
    const letterSelect = document.querySelector('#registerClassLetter');
    if (!schoolSelect || !gradeSelect || !letterSelect) return;

    const schools = Array.isArray(window.VARNA_SCHOOLS) ? window.VARNA_SCHOOLS : [];
    const letters = Array.isArray(window.VARNA_CLASS_LETTERS) && window.VARNA_CLASS_LETTERS.length
      ? window.VARNA_CLASS_LETTERS
      : ['а', 'б', 'в', 'г', 'д', 'е', 'ж', 'з', 'и', 'к'];

    schoolSelect.replaceChildren();
    const placeholder = new Option('Изберете училище…', '');
    placeholder.disabled = true;
    schoolSelect.appendChild(placeholder);

    const grouped = new Map();
    schools.forEach((school) => {
      if (!school || !school.name) return;
      const type = school.type || 'Училища';
      if (!grouped.has(type)) grouped.set(type, []);
      grouped.get(type).push(school.name);
    });
    grouped.forEach((names, type) => {
      const group = document.createElement('optgroup');
      group.label = type;
      names.forEach((name) => group.appendChild(new Option(name, name)));
      schoolSelect.appendChild(group);
    });
    schoolSelect.appendChild(new Option('➕ Друго училище (ръчно въвеждане)', '__other__'));

    gradeSelect.replaceChildren();
    gradeSelect.appendChild(new Option('Изберете', ''));
    for (let grade = 1; grade <= 12; grade += 1) {
      gradeSelect.appendChild(new Option(`${grade} клас`, String(grade)));
    }

    letterSelect.replaceChildren();
    letterSelect.appendChild(new Option('Изберете', ''));
    letters.forEach((letter) => letterSelect.appendChild(new Option(letter, letter)));

    const syncOtherSchool = () => {
      const isOther = schoolSelect.value === '__other__';
      if (otherLabel) otherLabel.hidden = !isOther;
      if (otherInput) {
        otherInput.required = isOther;
        if (!isOther) otherInput.value = '';
      }
    };
    schoolSelect.addEventListener('change', syncOtherSchool);
    syncOtherSchool();
  }

  function openProfileModal() {
    const modal = document.querySelector('#profileModal');
    const identity = document.querySelector('#profileIdentity');
    const message = document.querySelector('#passwordChangeMessage');
    const form = document.querySelector('#changePasswordForm');
    if (form) form.reset();
    if (message) { message.textContent = ''; message.classList.remove('success'); }
    if (identity) {
      identity.replaceChildren();
      if (currentUser) {
        const isEn = typeof AppI18n !== 'undefined' && AppI18n.lang === 'en';
        [
          [isEn ? 'Profile' : 'Профил', currentUser.username],
          [isEn ? 'School' : 'Училище', currentUser.school],
          [isEn ? 'Class / Section' : 'Клас / паралелка', currentUser.className]
        ].forEach(([label, value]) => {
          const row = document.createElement('div');
          const strong = document.createElement('strong');
          strong.textContent = `${label}: `;
          const text = document.createElement('span');
          text.textContent = value;
          row.append(strong, text);
          identity.appendChild(row);
        });
      }
    }
    if (modal) modal.classList.add('active');
  }

  function closeProfileModal() {
    const modal = document.querySelector('#profileModal');
    if (modal) modal.classList.remove('active');
  }

  function switchAboutTab(tabKey) {
    const modal = document.querySelector('#aboutModal');
    if (!modal) return;
    const tabBtns = modal.querySelectorAll('[data-about-tab]');
    const panels = modal.querySelectorAll('.about-panel');
    tabBtns.forEach(btn => {
      const active = btn.dataset.aboutTab === tabKey;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    panels.forEach(panel => {
      panel.hidden = true;
    });
    if (tabKey === 'guide') {
      const p = modal.querySelector('#aboutPanelGuide');
      if (p) p.hidden = false;
    } else if (tabKey === 'video') {
      const p = modal.querySelector('#aboutPanelVideo');
      if (p) p.hidden = false;
    } else if (tabKey === 'overview') {
      const p = modal.querySelector('#aboutPanelOverview');
      if (p) p.hidden = false;
    } else if (tabKey === 'support') {
      const p = modal.querySelector('#aboutPanelSupport');
      if (p) p.hidden = false;
    }
    if (window.I18N && window.I18N.lang === 'en') {
      window.I18N.apply();
    }
  }

  function switchGuideStage(stageKey) {
    const modal = document.querySelector('#aboutModal');
    if (!modal) return;
    const stageBtns = modal.querySelectorAll('[data-guide-stage]');
    const panels = modal.querySelectorAll('.guide-stage-panel');
    stageBtns.forEach(btn => {
      const active = btn.dataset.guideStage === stageKey;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    panels.forEach(p => { p.hidden = true; });
    if (stageKey === 'stage-nosync') {
      const p = modal.querySelector('#guideStageNoSync');
      if (p) p.hidden = false;
    } else if (stageKey === 'stage-agreement') {
      const p = modal.querySelector('#guideStageAgreement');
      if (p) p.hidden = false;
    } else if (stageKey === 'stage-sync') {
      const p = modal.querySelector('#guideStageSync');
      if (p) p.hidden = false;
    }
    if (window.I18N && window.I18N.lang === 'en') {
      window.I18N.apply();
    }
  }

  function openAboutModal(initialTab = null, initialStage = null) {
    const modal = document.querySelector('#aboutModal');
    if (modal) {
      if (initialTab) switchAboutTab(initialTab);
      if (initialStage) switchGuideStage(initialStage);
      modal.classList.add('active');
      if (window.I18N && window.I18N.lang === 'en') {
        window.I18N.apply();
      }
    }
  }

  function closeAboutModal() {
    const modal = document.querySelector('#aboutModal');
    if (modal) modal.classList.remove('active');
  }

  function setupAboutModal() {
    const aboutBtn = document.querySelector('#aboutAppBtn');
    const authAboutBtn = document.querySelector('#authAboutBtn');
    const headerGuideBtn = document.querySelector('#headerGuideBtn');
    const authGuideBtn = document.querySelector('#authGuideBtn');
    const shkoloGuideBtn = document.querySelector('#shkoloHelpGuideBtn');
    const closeBtn = document.querySelector('#closeAboutModalBtn');
    const footerCloseBtn = document.querySelector('#closeAboutModalFooterBtn');
    const modal = document.querySelector('#aboutModal');

    if (aboutBtn) aboutBtn.onclick = () => openAboutModal('overview');
    if (authAboutBtn) authAboutBtn.onclick = () => openAboutModal('overview');
    if (headerGuideBtn) headerGuideBtn.onclick = () => openAboutModal('guide', 'stage-nosync');
    if (authGuideBtn) authGuideBtn.onclick = () => openAboutModal('guide', 'stage-nosync');
    if (shkoloGuideBtn) shkoloGuideBtn.onclick = () => openAboutModal('guide', 'stage-agreement');
    if (closeBtn) closeBtn.onclick = closeAboutModal;
    if (footerCloseBtn) footerCloseBtn.onclick = closeAboutModal;

    if (modal) {
      // Main about tabs
      modal.querySelectorAll('[data-about-tab]').forEach(btn => {
        btn.addEventListener('click', () => switchAboutTab(btn.dataset.aboutTab));
      });
      // Guide stages
      modal.querySelectorAll('[data-guide-stage]').forEach(btn => {
        btn.addEventListener('click', () => switchGuideStage(btn.dataset.guideStage));
      });
      // Click on guide images to view enlarged
      modal.querySelectorAll('.guide-step-img-wrap').forEach(wrap => {
        wrap.addEventListener('click', () => {
          const src = wrap.dataset.zoomImg;
          const card = wrap.closest('.guide-step-card');
          const title = card?.querySelector('.guide-step-title')?.textContent || 'Ръководство';
          if (src && window.app && typeof window.app.openAttachmentViewer === 'function') {
            window.app.openAttachmentViewer(src, title);
          }
        });
      });
      modal.addEventListener('click', (event) => {
        if (event.target === modal) closeAboutModal();
      });
    }
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal?.classList.contains('active')) closeAboutModal();
    });
  }

  function openFeedbackModal() {
    const modal = document.querySelector('#feedbackModal');
    const status = document.querySelector('#feedbackStatusMsg');
    if (status) { status.textContent = ''; status.classList.remove('success'); }
    if (modal) modal.classList.add('active');
  }

  function closeFeedbackModal() {
    const modal = document.querySelector('#feedbackModal');
    if (modal) modal.classList.remove('active');
  }

  function setupFeedbackModal() {
    const triggers = [
      document.querySelector('#authFeedbackBtn'),
      document.querySelector('#headerFeedbackBtn'),
      document.querySelector('#footerFeedbackBtn'),
      document.querySelector('#aboutOpenFeedbackBtn')
    ];
    triggers.forEach((btn) => {
      if (!btn) return;
      btn.onclick = () => {
        closeAboutModal();
        openFeedbackModal();
      };
    });
    const closeBtn = document.querySelector('#closeFeedbackModalBtn');
    const cancelBtn = document.querySelector('#cancelFeedbackModalBtn');
    const modal = document.querySelector('#feedbackModal');
    if (closeBtn) closeBtn.onclick = closeFeedbackModal;
    if (cancelBtn) cancelBtn.onclick = closeFeedbackModal;
    if (modal) {
      modal.addEventListener('click', (event) => {
        if (event.target === modal) closeFeedbackModal();
      });
    }
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal?.classList.contains('active')) closeFeedbackModal();
    });

    const form = document.querySelector('#feedbackForm');
    if (!form) return;
    form.onsubmit = async (event) => {
      event.preventDefault();
      const status = document.querySelector('#feedbackStatusMsg');
      const submitBtn = document.querySelector('#submitFeedbackBtn');
      const type = document.querySelector('#feedbackType')?.value || 'bug';
      const message = (document.querySelector('#feedbackMessage')?.value || '').trim();
      if (status) { status.textContent = ''; status.classList.remove('success'); }
      if (message.length < 5) {
        if (status) status.textContent = 'Моля, въведете поне 5 символа за описание.';
        return;
      }
      if (submitBtn) submitBtn.disabled = true;
      try {
        const response = await fetch(new URL('./api/feedback', location.href).toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, message })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Неуспешно изпращане на обратна връзка.');
        form.reset();
        if (status) {
          status.textContent = 'Благодарим! Съобщението е изпратено успешно.';
          status.classList.add('success');
        }
      } catch (error) {
        if (status) status.textContent = error.message || 'Грешка при изпращане.';
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    };
  }

  function setupProfile() {
    const profileBtn = document.querySelector('#profileBtn');
    const modal = document.querySelector('#profileModal');
    const closeBtn = document.querySelector('#closeProfileModalBtn');
    if (profileBtn) profileBtn.onclick = openProfileModal;
    if (closeBtn) closeBtn.onclick = closeProfileModal;
    if (modal) modal.addEventListener('click', (event) => { if (event.target === modal) closeProfileModal(); });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal?.classList.contains('active')) closeProfileModal();
    });

    const form = document.querySelector('#changePasswordForm');
    if (!form) return;
    form.onsubmit = async (event) => {
      event.preventDefault();
      const message = document.querySelector('#passwordChangeMessage');
      const current = document.querySelector('#currentPassword')?.value || '';
      const next = document.querySelector('#newPassword')?.value || '';
      const confirm = document.querySelector('#confirmNewPassword')?.value || '';
      if (message) { message.textContent = ''; message.classList.remove('success'); }
      if (next.length < 10) {
        if (message) message.textContent = 'Новата парола трябва да е поне 10 символа.';
        return;
      }
      if (next !== confirm) {
        if (message) message.textContent = 'Двете нови пароли не съвпадат.';
        return;
      }
      try {
        await send('password', { currentPassword: current, newPassword: next });
        form.reset();
        if (message) {
          message.textContent = 'Паролата е сменена успешно.';
          message.classList.add('success');
        }
      } catch (error) {
        if (message) message.textContent = error.message;
      }
    };

    const deleteForm = document.querySelector('#deleteAccountForm');
    if (deleteForm) {
      deleteForm.onsubmit = async (event) => {
        event.preventDefault();
        const msgEl = document.querySelector('#deleteAccountMessage');
        const passwordInput = document.querySelector('#deleteAccountPassword');
        const pwd = passwordInput?.value || '';
        if (msgEl) { msgEl.textContent = ''; msgEl.classList.remove('success'); }
        if (!pwd) { if (msgEl) msgEl.textContent = 'Въведи паролата за потвърждение.'; return; }
        if (!confirm('Сигурен ли си? Профилът ще бъде изтрит завинаги и не може да бъде възстановен.')) return;
        try {
          const response = await fetch(new URL('./api/auth/delete-account', location.href).toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pwd })
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Грешка при изтриване.');
          location.reload();
        } catch (error) {
          if (msgEl) msgEl.textContent = error.message;
        }
      };
    }
  }

  function runInitStep(name, fn) {
    try {
      fn();
    } catch (error) {
      console.error(`Auth init step failed (${name}):`, error);
    }
  }

  async function initialize() {
    // Модалите за информация и обратна връзка работят и без вход,
    // затова се регистрират първи и изолирано от формата за вход/профил.
    runInitStep('aboutModal', setupAboutModal);
    runInitStep('feedbackModal', setupFeedbackModal);
    runInitStep('registrationPickers', setupRegistrationPickers);
    runInitStep('profileModal', setupProfile);

    const login = document.querySelector('#loginForm'), register = document.querySelector('#registerForm');
    const mode = document.querySelector('#authModeBtn');
    let registration = false;
    if (mode && login && register) {
      mode.onclick = () => {
        registration = !registration; showError('');
        login.hidden = registration; register.hidden = !registration;
        const authIntro = document.querySelector('#authIntro');
        if (authIntro) {
          authIntro.textContent = registration
            ? 'Създай индивидуален профил и избери училище и клас.'
            : 'Влез с личния си профил.';
        }
        mode.textContent = registration ? 'Имаш профил? Вход' : 'Нямаш профил? Регистрация';
        if (typeof AppI18n !== 'undefined' && (AppI18n.lang === 'en' || AppI18n.hasSwitched)) {
          AppI18n.applyAuthMode(registration);
        }
      };
    }
    if (login) {
      login.onsubmit = async event => {
        event.preventDefault(); showError('');
        try { await send('login', { username: document.querySelector('#loginUsername').value, password: document.querySelector('#loginPassword').value }); location.reload(); return null; }
        catch (error) { showError(error.message); return null; }
      };
    }
    if (register) {
      register.onsubmit = async event => {
        event.preventDefault(); showError('');
        try {
          const password = document.querySelector('#registerPassword').value;
          const confirmation = document.querySelector('#registerPasswordConfirm').value;
          if (password !== confirmation) throw new Error('Двете пароли не съвпадат.');
          const schoolSelect = document.querySelector('#registerSchool');
          const school = schoolSelect.value === '__other__'
            ? document.querySelector('#registerOtherSchool').value.trim()
            : schoolSelect.value.trim();
          if (!school) throw new Error('Изберете училище или въведете неговото име.');
          const grade = document.querySelector('#registerGrade').value;
          const letter = document.querySelector('#registerClassLetter').value;
          if (!grade || !letter) throw new Error('Изберете клас и паралелка.');
          await send('register', {
            username: document.querySelector('#registerUsername').value,
            password,
            school,
            className: `${grade}${letter}`
          });
          location.reload();
          return null;
        }
        catch (error) { showError(error.message); return null; }
      };
    }
    const logoutBtn = document.querySelector('#logoutBtn');
    if (logoutBtn) logoutBtn.onclick = async () => { await send('logout', {}); location.reload(); };
    try {
      const response = await fetch(api('session'), { cache: 'no-store' });
      const data = await response.json();
      if (data.authenticated && data.user) { revealApp(data.user); return data.user; }
    } catch (_) { showError('Сървърът не е достъпен. Стартирайте приложението чрез node server.js.'); }
    return null;
  }
  return { initialize };
})();

const ShkoloIntegration = (() => {
  const api = path => new URL('./api/shkolo/' + path, location.href).toString();
  const $ = id => document.getElementById(id);
  let currentCode = '';
  let busy = false;

  function baseUrl() {
    return new URL('./', location.href).href.replace(/\/$/, '');
  }
  function encodeCode(token) {
    const bytes = new TextEncoder().encode(JSON.stringify({ u: baseUrl(), t: token }));
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return 'SB1.' + btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }
  function setMessage(message, type = '') {
    // Горният бутон е далеч от картата със съобщенията — показваме и тост.
    try {
      if (message && window.app && typeof window.app.showToast === 'function') {
        window.app.showToast(message, type === 'success' ? 'success' : (type === 'error' ? 'error' : (type === 'warning' ? 'warning' : 'info')));
      }
    } catch (_) {}
    const element = $('shkoloMessage');
    if (!element) return;
    element.textContent = message || '';
    element.classList.toggle('success', type === 'success');
    element.classList.toggle('error', type === 'error');
  }
  function setStatus(connected, data = {}) {
    const badge = $('shkoloStatusBadge');
    const boundClass = String(data.boundClassName || data.className || '').trim();
    if (badge) {
      badge.textContent = connected
        ? (data.bound || boundClass ? `Свързано${boundClass ? ` · ${boundClass}` : ''}` : 'Свързано · чака клас')
        : 'Не е свързано';
      badge.classList.toggle('connected', connected);
    }
    if ($('shkoloDisconnected')) $('shkoloDisconnected').hidden = connected;
    if ($('shkoloConnected')) $('shkoloConnected').hidden = !connected;
    if ($('shkoloCodeBox')) $('shkoloCodeBox').hidden = !currentCode;
    if (currentCode && $('shkoloCode')) $('shkoloCode').textContent = currentCode;
    const lastSync = $('shkoloLastSync');
    if (lastSync) {
      if (data.lastSyncAt) {
        const date = new Date(data.lastSyncAt);
        const forClass = boundClass ? ` за ${boundClass}` : '';
        lastSync.textContent = Number.isNaN(date.getTime())
          ? `Има синхронизирани домашни от Shkolo${forClass}.`
          : `Последно синхронизиране${forClass}: ${date.toLocaleString('bg-BG')}`;
      } else {
        lastSync.textContent = connected
          ? (boundClass ? `Свързан профил за ${boundClass}. Очаква първото синхронизиране.` : 'Очаква първото синхронизиране и потвърждение на класа от разширението.')
          : '';
      }
    }
    if (typeof AppI18n !== 'undefined' && AppI18n.lang === 'en') {
      AppI18n.applyDynamic();
    }
  }
  async function request(path, options = {}) {
    const response = await fetch(api(path), {
      cache: 'no-store',
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Сървърът върна грешка ${response.status}.`);
    return data;
  }
  async function refresh() {
    if (!$('shkoloCard')) return;
    try {
      const data = await request('status');
      setStatus(!!data.connected, data);
    } catch (error) {
      setMessage(error.message, 'error');
    }
  }
  async function connect() {
    if (busy) return;
    busy = true;
    setMessage('Създаване на код за връзка…');
    try {
      const data = await request('token', { method: 'POST', body: '{}' });
      currentCode = encodeCode(data.token);
      setStatus(true, { createdAt: data.createdAt });
      setMessage('Кодът е създаден. Копирай го и го постави в разширението.', 'success');
      if ($('shkoloCodeBox')) $('shkoloCodeBox').hidden = false;
      if ($('shkoloCode')) $('shkoloCode').textContent = currentCode;
    } catch (error) {
      setMessage(error.message, 'error');
    } finally {
      busy = false;
    }
  }
  async function copyCode() {
    if (!currentCode) return;
    try {
      await navigator.clipboard.writeText(currentCode);
      setMessage('Кодът е копиран. Постави го в разширението.', 'success');
    } catch (_) {
      const element = $('shkoloCode');
      if (element) {
        const range = document.createRange();
        range.selectNodeContents(element);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      }
      setMessage('Копирай кода ръчно (маркиран е).', 'error');
    }
  }
  async function revoke() {
    if (!window.confirm('Да изключа ли връзката с Shkolo? Разширението ще спре да изпраща домашни, забележки, похвали и изпити. Ако друг профил от класа е свързан, общите данни остават.')) return;
    try {
      await request('token', { method: 'DELETE' });
      currentCode = '';
      setStatus(false);
      setMessage('Връзката с Shkolo е премахната.', 'success');
    } catch (error) {
      setMessage(error.message, 'error');
    }
  }
  function init() {
    if (!$('shkoloCard')) return;
    if ($('connectShkoloBtn')) $('connectShkoloBtn').onclick = connect;
    if ($('newShkoloTokenBtn')) $('newShkoloTokenBtn').onclick = connect;
    if ($('copyShkoloCodeBtn')) $('copyShkoloCodeBtn').onclick = copyCode;
    if ($('revokeShkoloTokenBtn')) $('revokeShkoloTokenBtn').onclick = revoke;
    const syncButtons = [$('syncShkoloNowBtn'), $('headerSyncShkoloBtn')].filter(Boolean);
    syncButtons.forEach(btn => {
      btn.onclick = () => triggerSync(btn);
    });
    refresh();
    setInterval(() => { if (!document.hidden) refresh(); }, 60000);
    // Автоматична синхронизация при отваряне на приложението (разширението
    // само пропуска, ако е синхронизирало през последните ~25 минути).
    setTimeout(() => { if (bridgeActive()) triggerSync(null, { auto: true }); }, 4000);
    setInterval(() => { if (!document.hidden && bridgeActive()) triggerSync(null, { auto: true }); }, 30 * 60 * 1000);
  }

  function bridgeActive() {
    return document.documentElement.getAttribute('data-shkolo-bridge-active') === 'true' || window.__schoolBellBridgeActive === true;
  }

  let syncInFlight = null;
  function requestBridgeSync(auto) {
    if (syncInFlight) return syncInFlight;
    syncInFlight = new Promise(resolve => {
      const requestId = `sync-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      let timer = null;
      const onMsg = (event) => {
        if (event.source !== window || event.data?.type !== 'school-bell-sync-result') return;
        if (event.data.requestId && event.data.requestId !== requestId) return;
        window.removeEventListener('message', onMsg);
        clearTimeout(timer);
        resolve(event.data.response || { ok: false, error: 'Няма отговор от разширението.' });
      };
      window.addEventListener('message', onMsg);
      timer = setTimeout(() => {
        window.removeEventListener('message', onMsg);
        resolve({ ok: false, error: 'Синхронизацията с Shkolo продължи твърде дълго. Опитай отново след малко.' });
      }, 170000);
      window.postMessage({ type: 'school-bell-sync-shkolo', requestId, auto: !!auto }, '*');
    }).finally(() => { syncInFlight = null; });
    return syncInFlight;
  }

  async function triggerSync(btn, options = {}) {
    const auto = options.auto === true;
    const buttons = btn ? [btn] : [];
    const originals = buttons.map(button => button.textContent);
    const reset = (text, delay = 2500) => {
      buttons.forEach((button, index) => {
        button.textContent = text;
        setTimeout(() => {
          button.textContent = originals[index];
          button.disabled = false;
        }, delay);
      });
    };
    if (!bridgeActive()) {
      if (auto) return;
      setMessage('Разширението „Shkolo → Училищен Будилник“ не е активно в този браузър. Инсталирай го веднъж (инструкциите са по-долу) и постави кода за връзка — след това синхронизацията става само с този бутон.', 'error');
      if (btn) reset('⚠️ Няма разширение', 3500);
      if ($('shkoloCard')) $('shkoloCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    buttons.forEach(button => { button.disabled = true; button.textContent = '⏳ Синхронизиране…'; });
    if (!auto) setMessage('Синхронизиране с Shkolo във фонов режим… (не е нужно да отваряш Shkolo)');
    try {
      const response = await requestBridgeSync(auto);
      if (response?.skipped) {
        if (btn) reset(originals[0], 0);
        return;
      }
      if (response?.ok) {
        const parts = [];
        if (response.added) parts.push(`${response.added} нови домашни`);
        if (response.examsAdded) parts.push(`${response.examsAdded} нови изпита`);
        if (response.notesAdded) parts.push(`${response.notesAdded} нови забележки/похвали`);
        if (response.scheduleUpdated) parts.push('обновена учебна програма');
        if (parts.length) {
          setMessage(`Синхронизирано с Shkolo: ${parts.join(', ')}.`, 'success');
        } else if (response.total > 0 || response.notesTotal > 0 || response.examsTotal > 0 || response.scheduleSubjects > 0) {
          setMessage('Синхронизирано с Shkolo. Всички данни са актуални.', 'success');
        } else if (response.empty) {
          setMessage(response.message || 'В Shkolo няма нови домашни, забележки, изпити или програма.', 'success');
        } else {
          setMessage('Shkolo върна 0 записа. Увери се, че си влязъл в Shkolo на app.shkolo.bg с родителски или ученически профил.', 'warning');
        }
        if (btn) reset('✅ Готово!');
      } else {
        if (!auto || response?.needsLogin) setMessage(response?.error || 'Грешка при синхронизация.', 'error');
        if (btn) reset('❌ Грешка');
      }
    } catch (e) {
      if (!auto) setMessage(e.message, 'error');
      if (btn) reset('❌ Грешка');
    } finally {
      if (window.app && typeof window.app.loadProfileData === 'function') {
        window.app.loadProfileData({ silent: true });
      }
      refresh();
    }
  }
  return { init, refresh };
})();

// Shkolo домашните/изпитите са общи за класа, а забележките и кодът за връзка са лични за профила.
// Ръчно добавените домашни се пазят в общите данни на класа (roomKey), а не
// в профила, за да ги виждат само учениците от същото училище и клас.
const ProfileHomework = (() => {
  let legacyCleared = false;
  function clearLegacyHomework() {
    if (legacyCleared) return;
    legacyCleared = true;
    try { localStorage.removeItem('school_bell_homework_v1'); } catch (_) {}
  }
  function currentIdentity() {
    const context = window.SCHOOL_BELL_CONTEXT || {};
    return `${String(context.school || '').trim().toLocaleLowerCase('bg')}\u0000${String(context.className || '').trim().toLocaleLowerCase('bg')}`;
  }
  async function request(options = {}) {
    clearLegacyHomework();
    const url = new URL('./api/homework', location.href);
    const identity = currentIdentity();
    if (identity) url.searchParams.set('identity', identity);
    const response = await fetch(url.toString(), {
      cache: 'no-store',
      credentials: 'same-origin',
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Сървърът върна грешка ${response.status}.`);
    return data;
  }
  const post = payload => request({ method: 'POST', body: JSON.stringify({ ...payload, identity: currentIdentity() }) });
  return {
    load: () => request(),
    addHomework: item => post({ action: 'add-homework', item }),
    deleteHomework: id => post({ action: 'delete-homework', id })
  };
})();

const AppI18n = {
  STORAGE_KEY: 'school_bell_ui_lang',
  lang: 'bg',
  hasSwitched: false,

  PLACEHOLDER_BY_ID: {
    registerOtherSchool: 'e.g. Geo Milev High School',
    noSchoolDescriptionInput: 'Description, e.g. Staff meeting',
    extraExamSubject0: 'e.g. Literature Test',
    extraExamSubject1: 'e.g. History Quiz',
    extraExamSubject2: 'e.g. Math Exam',
    extraExamSubject3: 'e.g. English Test',
    alarmLabel: 'e.g. Parent meeting, Field trip, Check notebook...',
    homeworkTeacher: 'Teacher’s name',
    homeworkSubject: 'Subject',
    homeworkDescription: 'Write the tasks or project assigned by the teacher…',
    modalExamSubject: 'e.g. Literature Exam, Math Test',
    clockTitleInput: 'School Bell',
    clockSubtitleInput: 'Shift 1 • Timers, Schedule & Bell',
    clockNoteInput: 'Current astronomical time',
    deleteAccountPassword: 'Enter your password to confirm',
    photoSubjectInput: 'e.g. Mathematics, Literature, History',
    photoTeacherInput: 'Teacher’s name',
    photoDescriptionInput: 'Optional: short note for the photo…',
    feedbackMessage: 'Describe the issue you noticed or your suggestion…'
  },

  PLACEHOLDER_TEXT_MAP: {
    'напр. СУ "Гео Милев"': 'e.g. Geo Milev High School',
    'напр. СУ „Гео Милев“': 'e.g. Geo Milev High School',
    'Описание, напр. Педагогически съвет': 'Description, e.g. Staff meeting',
    'напр. Контролно по БЕЛ': 'e.g. Literature Test',
    'напр. Тест по История': 'e.g. History Quiz',
    'напр. Тест по история': 'e.g. History Quiz',
    'напр. Класно по Математика': 'e.g. Math Exam',
    'напр. Изпит по математика': 'e.g. Math Exam',
    'напр. Изпитване по Английски': 'e.g. English Test',
    'напр. Контролно по английски': 'e.g. English Test',
    'Напр. Родителска среща, Екскурзия, Провери тетрадка...': 'e.g. Parent meeting, Field trip, Check notebook...',
    'пр. Родителска среща, Екскурзия, Провери бележника...': 'e.g. Parent meeting, Field trip, Check notebook...',
    'Име на учител': 'Teacher’s name',
    'Име на учителя': 'Teacher’s name',
    'Предмет': 'Subject',
    'Напиши задачите или проекта, зададени от учителя…': 'Write the tasks or project assigned by the teacher…',
    'Запишете задачите или проекта, дадени от учителя…': 'Write the tasks or project assigned by the teacher…',
    'напр. Класно по БЕЛ, Контролно по Математика': 'e.g. Literature Exam, Math Test',
    'пр. Класно по БЕЛ, Контролно по Математика': 'e.g. Literature Exam, Math Test',
    'Училищен Будилник': 'School Bell',
    '1 смяна • Таймери, програма & звънец': 'Shift 1 • Timers, Schedule & Bell',
    'Текущо астрономическо време': 'Current astronomical time',
    'Въведи паролата си за потвърждение': 'Enter your password to confirm',
    'Въведете паролата за потвърждение': 'Enter your password to confirm',
    'напр. Математика, БЕЛ, История': 'e.g. Mathematics, Literature, History',
    'напр. Родителска среща, Екскурзия, Празник': 'e.g. Parent meeting, Field trip, Holiday',
    'По желание: кратка бележка към снимката…': 'Optional: short note for the photo…',
    'Опиши проблема, който си забелязал, или твоето предложение…': 'Describe the issue you noticed or your suggestion…',
    'Опишете забелязаната грешка или вашето предложение…': 'Describe the issue you noticed or your suggestion…'
  },

  TITLE_BY_ID: {
    aboutAppBtn: 'What this app is and how to use it',
    headerFeedbackBtn: 'Feedback / Report a bug',
    headerSyncShkoloBtn: 'One-click sync with Shkolo',
    profileBtn: 'My profile and password change',
    logoutBtn: 'Sign out of profile',
    audioInitBtn: 'Enable / Mute sound',
    wakeLockBtn: 'Keep phone screen always on',
    fullscreenBtn: 'Fullscreen',
    themeSelect: 'Choose color theme',
    themeIntensityControl: 'Theme color intensity',
    themeIntensityRange: 'Drag to adjust theme color intensity',
    clockSettingsBtn: 'Configure title, format, and size of the main clock',
    cycleThemeBtn: 'Change clock background theme',
    testExamAlertBtn: 'Preview how the exam alert sounds',
    editScheduleBtn: 'Period times and weekly schedule editor',
    eventCameraBtn: 'Take a photo of an event, note, or announcement',
    eventPhotoBtn: 'Upload a photo from your device for an event',
    homeworkCameraBtn: 'Open camera and take a photo of homework from board or notebook',
    homeworkPhotoBtn: 'Choose a photo or screenshot of homework',
    previewSoundBtn: 'Preview selected bell melody',
    photoRotateLeftBtn: 'Rotate left 90°',
    photoRotateRightBtn: 'Rotate right 90°',
    photoCompareBtn: 'Toggle between enhanced and original photo',
    photoZoomBtn: 'Zoom photo for easier reading'
  },

  ATTR_TEXT_MAP: {
    'Видео демонстрация на Училищен Будилник': 'School Bell Video Walkthrough',
    'Визуално ръководство със снимки стъпка по стъпка': 'Step-by-Step Visual Photo Guide',
    'Раздели на помощта': 'Help sections',
    'Етапи от ръководството': 'Guide stages',
    'Кликни за преглед': 'Click to enlarge',
    'Кликни за преглед в пълен размер': 'Click to view full size',
    'Преглед на ръководството със снимки': 'View Step-by-Step Photo Guide',
    'Екран за вход в Училищен Будилник': 'School Bell Sign-in Screen',
    'Избор на училище и клас': 'School and Class Selection',
    'Задаване на потребителско име и парола': 'Username and Password Setup',
    'Голям училищен часовник': 'Main School Clock',
    'Таймери за изпити и ваканции': 'Timers for Exams and Vacations',
    'Официални неучебни дни и празници': 'Official Non-School Days and Holidays',
    'Аларми и таймери за 4 изпита': 'Alarms and Countdown Timers for 4 Exams',
    'Седмична програма по дни': 'Weekly Timetable by Day',
    'Класни аларми и събития': 'Class Alarms and Events',
    'Добавяне на домашно и снимка с OCR': 'Add Homework and Photo with OCR',
    'Свързване с Shkolo от уеб приложението': 'Connect with Shkolo from Web App',
    'Сваляне и зареждане на разширението': 'Download and Load Extension',
    'Екран за съгласие в разширението': 'Consent Gate Screen in Extension',
    'Подробности за поверителността': 'Privacy Disclosures and Options',
    'Свързано разширение със Shkolo': 'Extension Connected with Shkolo',
    'Синхронизиран часовник и изпит': 'Synced Clock and Exam',
    'Броячи за 5-те най-близки контролни': 'Countdowns for 5 Nearest Exams',
    'Синхронизирано дневно разписание': 'Synced Daily Timetable',
    'Класни събития и легенда': 'Class Events and Legend',
    'Синхронизирани домашни от Shkolo': 'Synced Homework from Shkolo',
    'Смяна на езика (BG / EN)': 'Switch language (BG / EN)',
    'Switch language / Смени езика': 'Switch language',
    'Какво е това приложение и как се ползва': 'What this app is and how to use it',
    'Какво представлява приложението и как се използва': 'What this app is and how to use it',
    'Обратна връзка / Съобщи за грешка': 'Feedback / Report a bug',
    'Синхронизирай със Shkolo с един клик': 'One-click sync with Shkolo',
    'Синхронизирай с Shkolo с един клик': 'One-click sync with Shkolo',
    'Моят профил и смяна на парола': 'My profile and password change',
    'Изход от профила': 'Sign out of profile',
    'Включи / Заглуши звука': 'Enable / Mute sound',
    'Активиране / Заглушаване на звука': 'Enable / Mute sound',
    'Дръж екрана на телефона винаги включен': 'Keep phone screen always on',
    'Цял екран': 'Fullscreen',
    'Избери цветова тема': 'Choose color theme',
    'Избор на цветова тема': 'Choose color theme',
    'Настрой заглавие, формат и размер на големия часовник': 'Configure title, format, and size of the main clock',
    'Смени фоновата тема на часовника': 'Change clock background theme',
    'Прослушай как звучи алармата за изпит': 'Preview how the exam alert sounds',
    'Чуй как звучи предупреждението за контролно': 'Preview how the exam alert sounds',
    'Редактор на часовете и програмата': 'Period times and weekly schedule editor',
    'Редактор на часовете и седмичната програма': 'Period times and weekly schedule editor',
    'Снимай събитие, бележка или съобщение': 'Take a photo of an event, note, or announcement',
    'Снимай събитие, бележка или съобщение с камерата': 'Take a photo of an event, note, or announcement',
    'Качи снимка от устройството за събитие': 'Upload a photo from your device for an event',
    'Отвори камерата и снимай домашното от дъската или тетрадката': 'Open camera and take a photo of homework from board or notebook',
    'Отвори камерата и снимай домашно от тетрадка, дъска или лист': 'Open camera and take a photo of homework from board or notebook',
    'Отвори камерата и снимай домашно, събитие или бележка': 'Open camera and take a photo of homework, event, or note',
    'Избери снимка или екранна снимка на домашното': 'Choose a photo or screenshot of homework',
    'Избери снимка или екранна снимка с домашно': 'Choose a photo or screenshot of homework',
    'Избери снимка или файл с домашно или събитие': 'Choose a photo or file of homework or event',
    'Затвори': 'Close',
    'Прослушай избраната мелодия': 'Preview selected bell melody',
    'Чуй избрания звънец': 'Preview selected bell melody',
    'Предназначение на снимката': 'Photo target',
    'Тип запис за снимката': 'Photo entry type',
    'Режим за четимост': 'Readability mode',
    'Завърти наляво 90°': 'Rotate left 90°',
    'Завърти надясно 90°': 'Rotate right 90°',
    'Превключи между подобрена и оригинална снимка': 'Toggle between enhanced and original photo',
    'Превключи между подобрената и оригиналната снимка': 'Toggle between enhanced and original photo',
    'Увеличи снимката за по-лесно четене': 'Zoom photo for easier reading',
    'Увеличена снимка': 'Zoomed photo',
    'Подобрена снимка на домашно или събитие': 'Enhanced photo of homework or event',
    'Брояч за учебен час и междучасие': 'Period and break countdown',
    'Показва колко минути остават до звънеца за края на часа или междучасието': 'Shows how many minutes remain until the bell for the end of the period or break',
    'Брояч за предстоящ изпит / контролно': 'Upcoming exam / quiz countdown',
    'Показва оставащото време до най-непосредствения предстоящ изпит': 'Shows remaining time until the nearest upcoming exam',
    'Брояч за учебни ваканции': 'School vacation countdown',
    'Показва оставащите дни до началото на следващата ваканция': 'Shows remaining days until the next vacation starts',
    'Начало на ваканцията': 'Vacation start',
    'Край на ваканцията': 'Vacation end',
    'Дата на неучебния ден': 'Non-school day date',
    'Допълнителни изпити': 'Additional exams',
    'Допълнителен предстоящ изпит по ред на провеждане': 'Additional upcoming exam in chronological order',
    'Алармите и събитията са общи само за профилите в твоето училище и клас.': 'Alarms and events are shared only with profiles in your school and class.',
    'Всички домашни, включително от Shkolo, са общи за класа. Забележките и похвалите са лични за профила.': 'Manually added homework is shared with your class; Shkolo homework is private by default. Remarks and praises are always personal.',
    'Домашно, синхронизирано директно от дневника Shkolo': 'Homework synced directly from the Shkolo diary',
    'Общо домашно за целия клас': 'Shared homework for the whole class',
    'Лична похвала от учител': 'Personal praise from a teacher',
    'Лична забележка от учител': 'Personal remark from a teacher',
    'Часовник за учебния час и междучасията': 'Period and break clock',
    'Часовник за предстоящи изпити и контролни': 'Upcoming exams and quizzes clock',
    'Часовник за ваканция': 'Vacation clock',
    'Бутон за автоматично синхронизиране с Shkolo': 'One-click Shkolo sync button',
    'Потребителски профил': 'User profile',
    'Домашни, забележки и похвали': 'Homework, remarks, and praises',
    'Програма по дни': 'Daily schedule',
    'Теми': 'Themes',
    'Български мотиви и светини': 'Bulgarian Motifs & Sacred Heritage',
    'Българска природа, традиции и технологии': 'Bulgarian Nature, Traditions & Technology',
    'Български мотиви и неутрални': 'Bulgarian Motifs & Neutral',
    'Интензитет на цвета на темата': 'Theme color intensity',
    'Плъзни за регулиране на интензитета на цвета на темата': 'Drag to adjust theme color intensity',
    'Свий или разгъни прозореца за изпита': 'Collapse or expand exam panel',
    'Свий или разгъни прозореца за ваканциите': 'Collapse or expand vacation panel',
    'Свий или разгъни всички допълнителни изпити': 'Collapse or expand all additional exams',
    'Свий или разгъни Изпит 1': 'Collapse or expand Exam 1',
    'Свий или разгъни Изпит 2': 'Collapse or expand Exam 2',
    'Свий или разгъни Изпит 3': 'Collapse or expand Exam 3',
    'Свий или разгъни Изпит 4': 'Collapse or expand Exam 4',
    'Свий или разгъни списъка с всички изпити': 'Collapse or expand all school year exams',
    'Природни теми': 'Nature Themes',
    'Неутрални теми': 'Neutral Themes',
    'Природни и атмосферни теми': 'Nature & Atmospheric Themes',
    'София': 'Sofia',
    'Пловдив': 'Plovdiv',
    'Варна': 'Varna',
    'Бургас': 'Burgas',
    'Русе': 'Ruse',
    'Стара Загора': 'Stara Zagora',
    'Плевен': 'Pleven',
    'Велико Търново': 'Veliko Tarnovo',
    'Благоевград': 'Blagoevgrad',
    'Други градове': 'Other Cities',
    'Всички училища': 'All Schools'
  },

  EXACT_TEXT_MAP: {
    'Училищен Будилник & Аларма за Междучасия': 'School Bell & Break Alarm',
    'Звънец': 'School Bell',
    'Училищен Будилник': 'School Bell',
    'Влез с личния си профил.': 'Sign in with your personal profile.',
    'Създай индивидуален профил и избери училище и клас.': 'Create a personal profile and select your school and class.',
    'Потребителско име': 'Username',
    'Парола': 'Password',
    'Парола (минимум 10 символа)': 'Password (min. 10 characters)',
    'Повтори паролата': 'Confirm Password',
    'Училище': 'School',
    'Друго училище': 'Other School',
    'Клас': 'Class',
    'Паралелка': 'Section',
    'Текуща парола': 'Current Password',
    'Нова парола (минимум 10 символа)': 'New Password (min. 10 characters)',
    'Повтори новата парола': 'Confirm New Password',
    'Потвърди с паролата си:': 'Confirm with your password:',
    '📚 Домашни': '📚 Homework',
    '📝 Забележки': '📝 Remarks',
    '🌟 Похвали': '🌟 Praises',
    'Контраст:': 'Contrast:',
    'Яркост:': 'Brightness:',
    'Острота на буквите:': 'Text Sharpness:',
    'Вход': 'Sign In',
    'Създай профил': 'Create Account',
    'Зареждане на училищата…': 'Loading schools…',
    'Изберете училище…': 'Select a school…',
    '➕ Друго училище (ръчно въвеждане)': '➕ Other school (manual entry)',
    'Изберете': 'Select',
    'Всеки ученик има собствена парола. Програмата, изпитите, ръчно добавените домашни, алармите и ваканциите са общи само за профилите в същото училище и клас. Синхронизираните от Shkolo домашни и изпити се виждат от целия клас, а забележките и похвалите остават лични за профила.': 'Each student has their own password. The schedule, exams, manually added homework, alarms, and vacations are shared only with profiles in the same school and class. Shkolo-synced homework and exams are private by default (unless class sharing is enabled in the extension), and remarks and praises always remain personal.',
    'Нямаш профил? Регистрация': 'No account yet? Register',
    'Имаш профил? Вход': 'Already have an account? Sign In',
    'ℹ️ За приложението': 'ℹ️ About',
    '✉️ Обратна връзка': '✉️ Feedback',
    'Политика за поверителност': 'Privacy Policy',
    'Условия за ползване': 'Terms of Service',
    'Контакт: schoolbell@abv.bg': 'Contact: schoolbell@abv.bg',
    '☕ Подкрепи проекта / Изпрати благодарност (': '☕ Support the project / Send thanks (',
    'Жестът на благодарност към': 'Sending thanks to',
    'е доброволен, не е плащане за услуга и не дава предимства.': 'is voluntary, not a payment for service, and grants no special perks.',
    ') е изцяло доброволен, не е плащане за услуга и не дава предимства. Приложението е безплатно и с нестопанска цел за всеки, който иска да го ползва.': ') is completely voluntary, not a payment for service, and grants no special perks. This application is free and non-profit for everyone.',
    'Версия 57 · обновено 15.11.2026 · Безплатно нестопанско приложение': 'Version 57 · updated 15.11.2026 · Free non-profit application',
    'Версия 58 · обновено 16.11.2026 · Безплатно нестопанско приложение': 'Version 58 · updated 16.11.2026 · Free non-profit application',
    'Активен профил': 'Active Profile',
    'Активирайте звука на телефона за училищния звънец:': 'Enable phone sound for the school bell:',
    '▶️ Активирай Звук и Звънец': '▶️ Enable Sound & Bell',
    '1 смяна • Таймери, програма & звънец': 'Shift 1 • Timers, Schedule & Bell',
    '🌅 1 Смяна (08:00 - 13:50)': '🌅 Shift 1 (08:00 - 13:50)',
    'Изход': 'Log Out',
    'Звук': 'Sound',
    'Звук: Вкл': 'Sound: On',
    'Звук: Изкл': 'Sound: Off',
    '🪡 Българска шевица — Елбетица': '🪡 Bulgarian Embroidery — Elbetitsa',
    '🦁 Български герб — Златен лъв': '🦁 Bulgarian Coat of Arms — Golden Lion',
    '⚔️ Български герои — Възраждане': '⚔️ Bulgarian Heroes — National Revival',
    '🇧🇬 Родна трибагрена — Розова долина': '🇧🇬 Bulgarian Tricolor — Rose Valley',
    '📜 Българска кирилица — Св. Кирил и Методий': '📜 Bulgarian Cyrillic — Sts. Cyril & Methodius',
    '🚀 Графитено черна — Български технологии и космос': '🚀 Graphite Black — Bulgarian Tech & Space',
    '🏖️ Морско синя — Български плажове и курорти': '🏖️ Sea Blue — Bulgarian Beaches & Resorts',
    '🌲 Зелена — Български гори и долини': '🌲 Green — Bulgarian Forests & Valleys',
    '🔥 Червена — Нестинари в Странджа': '🔥 Fiery Red — Strandzha Fire Dancers (Nestinari)',
    '🏔️ Алпийска — Рила и Пирин': '🏔️ Alpine — Rila & Pirin Mountains',
    '🪨 Неутрална тъмна — Графит': '🪨 Neutral Dark — Graphite',
    '🪨 Неутрална тъмна — графит': '🪨 Neutral Dark — Graphite',
    '🏜️ Жълто-оранжева — пустиня': '🏜️ Amber — Desert',
    '🌊 Морско синя — океан': '🌊 Sea Blue — Ocean',
    '🌿 Зелена — джунгла': '🌿 Green — Jungle',
    '🌋 Червена — вулкан': '🌋 Red — Volcano',
    '🏔️ Черна — заснежен връх': '🏔️ Dark — Snowy Peak',
    'Жълто-оранжева — пустиня': 'Amber — Desert',
    'Морско синя — океан': 'Sea Blue — Ocean',
    'Зелена — джунгла': 'Green — Jungle',
    'Червена — вулкан': 'Red — Volcano',
    'Черна — заснежен връх': 'Dark — Snowy Peak',
    'Българска шевица — Елбетица': 'Bulgarian Embroidery — Elbetitsa',
    'Български герб — Златен лъв': 'Bulgarian Coat of Arms — Golden Lion',
    'Български герои — Възраждане': 'Bulgarian Heroes — National Revival',
    'Родна трибагрена — Розова долина': 'Bulgarian Tricolor — Rose Valley',
    'Българска кирилица — Св. Кирил и Методий': 'Bulgarian Cyrillic — Sts. Cyril & Methodius',
    'Графитено черна — Български технологии и космос': 'Graphite Black — Bulgarian Tech & Space',
    'Морско синя — Български плажове и курорти': 'Sea Blue — Bulgarian Beaches & Resorts',
    'Зелена — Български гори и долини': 'Green — Bulgarian Forests & Valleys',
    'Червена — Нестинари в Странджа': 'Fiery Red — Strandzha Fire Dancers (Nestinari)',
    'Алпийска — Рила и Пирин': 'Alpine — Rila & Pirin Mountains',
    'Български технологии и космос': 'Bulgarian Tech & Space',
    'Български плажове и курорти': 'Bulgarian Beaches & Resorts',
    'Български гори и долини': 'Bulgarian Forests & Valleys',
    'Нестинари в Странджа': 'Strandzha Fire Dancers (Nestinari)',
    'Рила и Пирин': 'Rila & Pirin Mountains',
    '📷 Снимай': '📷 Take Photo',
    '🖼️ Качи файл': '🖼️ Upload File',
    'Снимайте или качете снимка за домашно или събитие (изчиства сенките и подобрява четимостта).': 'Take or upload a photo for homework or an event (removes shadows and improves readability).',
    'Неутрална тъмна — Графит': 'Neutral Dark — Graphite',
    'Пустиня': 'Desert',
    'Океан': 'Ocean',
    'Джунгла': 'Jungle',
    'Вулкан': 'Volcano',
    'Заснежен връх': 'Snowy Peak',
    'Свързване със споделените данни…': 'Connecting to shared class data…',
    'Почивен ден — събота и неделя': 'Weekend — Saturday & Sunday',
    'Училищният часовник и автоматичните звънци са изключени. Следващ учебен ден: понеделник.': 'The school clock and automatic bells are off. Next school day: Monday.',
    '⚠️ ВНИМАНИЕ: В този час има КОНТРОЛНО!': '⚠️ ATTENTION: There is an EXAM during this period!',
    '🌌 Звездна космическа нощ': '🌌 Starry Cosmic Night',
    '✏️ Настрой часовника': '✏️ Clock Settings',
    '🎨 Смени фона': '🎨 Change Theme',
    '📝 Допълнителни изпити и контролни (Изпит 1 – 4)': '📝 Additional Exams & Quizzes (Exam 1 – 4)',
    '🔽 Свий': '🔽 Collapse',
    '▶️ Разгъни': '▶️ Expand',
    '🔽 Свий всички': '🔽 Collapse All',
    '▶️ Разгъни всички': '▶️ Expand All',
    'Зареждане на дата...': 'Loading date...',
    'Текущо астрономическо време': 'Current astronomical time',
    'До края на часа': 'Until End of Period',
    'Текущ час / междучасие': 'Current period / break',
    '⏱️ До звънеца': '⏱️ Until Bell',
    'Изчисляване...': 'Calculating...',
    'Следващ изпит': 'Next Exam',
    'Контролно по Математика': 'Mathematics Test',
    '--д --ч --м': '--d --h --m',
    'Дата на изпита: зарежда се...': 'Exam date: loading...',
    '📝 Главен изпит': '📝 Main Exam',
    '✏️ Настрой изпит': '✏️ Set Exam',
    '🗑️ Изтрий изпит': '🗑️ Clear Exam',
    '📢 Тест аларма': '📢 Test Alert',
    'До ваканцията': 'Until Vacation',
    '🏖️ Ваканция': '🏖️ Vacation',
    'Избери ваканция:': 'Select vacation:',
    '🎄 Коледна ваканция (24 Декември)': '🎄 Christmas Vacation (Dec 24)',
    '❄️ Междусрочна ваканция (5 Февруари)': '❄️ Midterm Vacation (Feb 5)',
    '🌸 Пролетна ваканция (3 Април)': '🌸 Spring Vacation (Apr 3)',
    '☀️ Лятна ваканция (30 Юни)': '☀️ Summer Vacation (Jun 30)',
    'Начало и край на ваканцията:': 'Vacation start and end:',
    'Запази датата': 'Save Dates',
    '📅 Допълнителни неучебни дни': '📅 Additional Non-School Days',
    'Добави': 'Add',
    'Изпит 1': 'Exam 1',
    'Изпит 2': 'Exam 2',
    'Изпит 3': 'Exam 3',
    'Изпит 4': 'Exam 4',
    '📝 Следващ изпит': '📝 Upcoming Exam',
    'Не е зададен': 'Not set',
    'Добавете предмет и дата': 'Add subject and date',
    'Предмет / описание': 'Subject / description',
    'Дата и час': 'Date & time',
    'Запази': 'Save',
    'Изтрий': 'Delete',
    '📅 Всички изпити за учебната година': '📅 All Exams for the School Year',
    'Тук се показват всички синхронизирани изпити за текущата учебна година (от Shkolo и добавени ръчно). 5-те часовника по-горе отброяват само първите 5 най-близки предстоящи изпита.': 'All synced and manually added exams for the current school year are shown here. The 5 countdown clocks above track the 5 nearest upcoming exams.',
    '📅 Програма по дни:': '📅 Daily Schedule:',
    'Понеделник': 'Monday',
    'Вторник': 'Tuesday',
    'Сряда': 'Wednesday',
    'Четвъртък': 'Thursday',
    'Петък': 'Friday',
    'Събота · почивен': 'Saturday · off',
    'Неделя · почивен': 'Sunday · off',
    'Понеделник (БЕЛ, Математика 📝, Английски, ИТ...)': 'Monday (Literature, Math 📝, English, IT...)',
    'Вторник (Математика, БЕЛ, Физика 📝, Химия...)': 'Tuesday (Math, Literature, Physics 📝, Chemistry...)',
    'Сряда (Английски, БЕЛ, Математика, История 📝...)': 'Wednesday (English, Literature, Math, History 📝...)',
    'Четвъртък (БЕЛ, Математика, Информатика, Биология 📝...)': 'Thursday (Literature, Math, CS, Biology 📝...)',
    'Петък (Математика, БЕЛ 📝, Английски, Химия...)': 'Friday (Math, Literature 📝, English, Chemistry...)',
    'Днес е почивен ден.': 'Today is a day off.',
    'Показана е програмата за следващия учебен ден — понеделник. Учебните звънци няма да звънят.': 'Showing the schedule for the next school day — Monday. Automatic school bells will not ring.',
    '✏️ Редактор на програмата': '✏️ Schedule Editor',
    '📝 Контролно': '📝 Exam / Quiz',
    '№': '#',
    'Вид': 'Type',
    'Предмет / Описание': 'Subject / Description',
    'Начало': 'Start',
    'Край': 'End',
    'Време': 'Duration',
    'Статус': 'Status',
    '⏰ Класни аларми и събития': '⏰ Class Alarms & Events',
    '👥 За класа': '👥 For Class',
    'Ръчно добавените аларми и събития се виждат от всички профили в твоя клас (без домашните и изпитите, които имат свои отделни секции). Забележките остават лични. Не въвеждай лична информация, която не трябва да виждат съучениците ти.': 'Manually added alarms and events are visible to all profiles in your class. Remarks remain private. Do not enter personal information you do not want classmates to see.',
    '📷 Снимай събитие': '📷 Take Event Photo',
    '🖼️ Качи снимка за събитие': '🖼️ Upload Event Photo',
    'Снимайте или качете снимка към събитието (с подобряване на четимостта).': 'Take or upload a photo for the event (with readability enhancement).',
    'Дата:': 'Date:',
    'Час:': 'Time:',
    'Бележка:': 'Note:',
    '➕ Добави': '➕ Add',
    '📚 Домашни, забележки и похвали': '📚 Homework, Remarks & Praises',
    '👥 Класни + лични': '👥 Class + Personal',
    '💡 Обяснение на картинките и значките в приложението:': '💡 Guide to Icons & Badges in the App:',
    '🔒 Shkolo': '🔒 Shkolo',
    'Синхронизирано от Shkolo (само за четене, управлява се от учител)': 'Synced from Shkolo (read-only, managed by teacher)',
    '👥 Клас': '👥 Class',
    'Общо за класа (вижда се от всички съученици в твоя клас)': 'Shared with the class (visible to classmates in your class)',
    '🌟 Похвала': '🌟 Praise',
    'Лична похвала (вижда се само в твоя личен профил)': 'Personal praise (visible only in your own profile)',
    '📝 Забележка': '📝 Remark',
    'Лична забележка (вижда се само в твоя личен профил)': 'Personal remark (visible only in your own profile)',
    'Брояч за учебния час и междучасията (до звънеца)': 'Countdown for the current period and breaks (until the bell)',
    'Брояч за най-непосредствения предстоящ изпит': 'Countdown for the nearest upcoming exam',
    'Брояч за следващата учебна ваканция': 'Countdown for the next school vacation',
    'Фонова синхронизация с дневника (без отваряне на браузър)': 'Background sync with Shkolo diary',
    '👤 Профил': '👤 Profile',
    'Моят профил, смяна на парола и настройки': 'My profile, password change, and settings',
    '📷 Снимай домашно': '📷 Scan Homework',
    '🖼️ Качи снимка': '🖼️ Upload Photo',
    'Снимайте или качете снимка на домашното (изчиства сенките и подобрява четимостта).': 'Take or upload a photo of the homework (removes shadows and improves readability).',
    'Учител': 'Teacher',
    'Предмет': 'Subject',
    'Срок / дата': 'Due Date',
    'Домашна работа / указания (до 5000 знака)': 'Homework / Instructions (up to 5000 chars)',
    'Разгъни полето': 'Expand field',
    'Свий полето': 'Collapse field',
    'Отвори целия текст': 'Read full text',
    'Ръчно добавените тук домашни и синхронизираните от Shkolo домашни се виждат от всички профили в твоя клас.': 'Manually added homework here is visible to your class; Shkolo-synced homework is private by default unless class sharing is enabled in the extension.',
    'Добави домашно': 'Add Homework',
    'Забележките от Shkolo се показват само в твоя профил. Те не се смесват с домашните и похвалите.': 'Remarks from Shkolo are shown only in your profile. They are never shared with classmates.',
    'Похвалите от Shkolo се показват само в твоя профил. Те не се смесват с домашните и забележките.': 'Praises from Shkolo are shown only in your profile. They are never shared with classmates.',
    '🔄 Домашни, изпити, забележки и похвали от Shkolo': '🔄 Homework, Exams, Remarks & Praises from Shkolo',
    'Не е свързано': 'Not connected',
    'Свържи своя Shkolo профил веднъж. Новите домашни и предстоящи изпити ще се появяват автоматично за целия клас, а забележките и похвалите — само в твоя профил. Всеки профил може да се свърже само със своя Shkolo акаунт и не вижда данни за друг клас.': 'Connect your Shkolo profile once. Homework, exams, and schedule sync automatically to your profile (and can optionally be shared with your class from the extension), while remarks and praises always stay private to your profile.',
    'Свържи Shkolo': 'Connect Shkolo',
    'Ще получиш еднократен код за връзка. Кодът е личен — пази го като парола.': 'You will receive a one-time connection code. Keep it private like a password.',
    'Кодът за връзка се показва само веднъж. Ако го загубиш, генерирай нов и го постави отново в разширението.': 'The connection code is shown only once. If you lose it, generate a new one and paste it into the extension.',
    'Код за връзка': 'Connection Code',
    'Копирай': 'Copy',
    '🔄 Синхронизирай сега': '🔄 Sync Now',
    'Нов код': 'New Code',
    'Изключи': 'Disconnect',
    'Как да свържа Shkolo?': 'How do I connect Shkolo?',
    'Изтегли': 'Download',
    'разширението Училищен Будилник Bridge (версия 1.5.13)': 'the School Bell Bridge extension (version 1.5.13)',
    'и го разархивирай.': 'and extract it.',
    'В Chrome или Edge отвори': 'In Chrome or Edge, open',
    ', включи „Developer mode“ и натисни „Load unpacked“.': ', enable “Developer mode”, and click “Load unpacked”.',
    'Избери папката': 'Select the folder',
    'Влез в': 'Sign in to',
    'с твоя профил (с отметка „Запомни ме“).': 'with your account (with “Remember me” checked).',
    'Копирай кода отгоре, постави го в разширението и натисни „Запази“.': 'Copy the code above, paste it into the extension, and click “Save”.',
    'Разширението използва само твоята вече отворена Shkolo сесия. Паролата ти за Shkolo не се изпраща към този сървър. По подразбиране синхронизираните домашни, учебна програма и изпити се пазят само за твоя профил (можеш да включиш споделянето с класа от разширението), а забележките и похвалите — винаги само за твоя профил. Нужна е версия 1.5.13 или по-нова.': 'The extension only uses your already-open Shkolo session. Your Shkolo password is never sent to this server. By default, synced homework, weekly schedule, and exams are kept only for your profile (you can enable class sharing in the extension), while remarks and praises are always private to your profile. Requires version 1.5.13 or newer.',
    'Училищен дигитален будилник за телефон • 1 смяна (08:00 - 13:50) • Всички настройки се запазват автоматично • Версия 57 · 15.11.2026': 'Digital School Bell • Shift 1 (08:00 - 13:50) • All settings saved automatically • Version 57 · 15.11.2026',
    'Училищен дигитален будилник за телефон • 1 смяна (08:00 - 13:50) • Всички настройки се запазват автоматично • Версия 58 · 16.11.2026': 'Digital School Bell • Shift 1 (08:00 - 13:50) • All settings saved automatically • Version 58 · 16.11.2026',
    '📝 Настройка на следващ изпит / контролно': '📝 Set Next Exam / Quiz',
    'Въведете предмета и точната дата и час на контролното, за да може таймерът да отброява времето до него.': 'Enter the subject and exact date and time of the exam so the countdown timer can track it.',
    'Предмет / Описание на изпита:': 'Exam Subject / Description:',
    'Дата и начален час на изпита:': 'Exam Date & Start Time:',
    '🗑️ Изтрий изпита': '🗑️ Delete Exam',
    'Отказ': 'Cancel',
    '💾 Запази изпита': '💾 Save Exam',
    '✏️ Редактор на часове и програма': '✏️ Period Times & Schedule Editor',
    'Избери ден, после промени началото, дължините на часовете и междучасията, броя часове и предметите само за този ден. Събота и неделя са почивни и нямат учебни звънци.': 'Select a day, then customize the start time, period and break durations, number of periods, and subjects for that day. Saturday and Sunday are off.',
    'Начало на деня': 'Day Start',
    'Час (мин)': 'Period (min)',
    'Малко междучасие': 'Short Break',
    'Голямо междучасие': 'Long Break',
    'Голямо след час №': 'Long Break After #',
    'Брой часове': 'Number of Periods',
    'Ден от седмицата': 'Day of Week',
    '↩️ Стандартни стойности': '↩️ Reset Defaults',
    '💾 Запази програмата': '💾 Save Schedule',
    '🕒 Настройки на големия часовник': '🕒 Main Clock Settings',
    'Промени текстовете, формата и размера на часовника.': 'Customize the clock titles, time format, and display size.',
    'Заглавие в менюто': 'Header Title',
    'Подзаглавие': 'Subtitle',
    'Бележка под големия часовник': 'Note Below Main Clock',
    '🕛 12-часов формат (AM/PM)': '🕛 12-hour format (AM/PM)',
    '⏱️ Показвай секундите': '⏱️ Show seconds',
    '📅 Показвай датата': '📅 Show date',
    'Размер на часовника': 'Clock Size',
    '↩️ Възстанови': '↩️ Reset',
    '💾 Запази': '💾 Save',
    '👤 Моят профил': '👤 My Profile',
    'Паролата е лична. Ако я смените, използвайте новата парола при следващия вход.': 'Your password is personal. If you change it, use your new password next time you sign in.',
    '🔐 Смени паролата': '🔐 Change Password',
    'Изтриване на акаунта': 'Delete Account',
    'Внимание: Това действие ще изтрие вашия профил и всички ваши лични данни (забележки, похвали) завинаги.': 'Warning: This action will permanently delete your account and all your personal data (remarks, praises, synced Shkolo data).',
    '🗑️ Изтрий моя профил завинаги': '🗑️ Permanently Delete My Account',
    '🔊 Избор на мелодия на звънеца (включително MP3)': '🔊 Bell Melody Selection (including MP3)',
    'Мелодия на звънеца:': 'Bell Melody:',
    '1. 🔔 Класически звънец': '1. 🔔 Classic Bell',
    '2. 🏛️ Вестминстърски гонг': '2. 🏛️ Westminster Chime',
    '3. 📱 Модерен тон': '3. 📱 Modern Tone',
    '4. ⚙️ Ретро механичен звънец': '4. ⚙️ Retro Mechanical Bell',
    '5. ✨ Двоен кристален звън': '5. ✨ Double Crystal Chime',
    '6. ⚓ Корабна камбана': '6. ⚓ Ship’s Bell',
    '7. 🎵 Весел джингъл': '7. 🎵 Cheerful Jingle',
    '8. 🎶 Магически арпежио': '8. 🎶 Magic Arpeggio',
    '🎧 MP3 — Soundspace': '🎧 MP3 — Soundspace',
    '▶️ Прослушай': '▶️ Preview',
    'Сила на звука:': 'Volume:',
    '🔔 Автоматичен училищен звънец (начало/край)': '🔔 Automatic school bell (start/end of period)',
    '🛎️ Предупредителен тон преди края на междучасието': '🛎️ Pre-bell warning tone before break ends',
    '📳 Вибрация на телефона при звънец': '📳 Phone vibration on bell',
    '📲 Системни известия на телефона (Notifications)': '📲 System notifications',
    '✉️ Обратна връзка / Съобщи за грешка': '✉️ Feedback / Report a Bug',
    '📷 Качване на снимка (Домашни и Събития)': '📷 Upload Photo (Homework & Events)',
    '📚 Домашно': '📚 Homework',
    '📅 Събитие / Аларма': '📅 Event / Alarm',
    '📷 Снимай': '📷 Take Photo',
    'Можете да пуснете снимка тук или да поставите директно с': 'You can drop a photo here or paste directly with',
    '📄 Документ (Макс. четимост)': '📄 Document (Max Readability)',
    '⬛ Контрастен скан (Ч/Б)': '⬛ High-Contrast Scan (B/W)',
    '🎨 Подобрен цвят': '🎨 Enhanced Color',
    '🖼️ Оригинал': '🖼️ Original',
    '👁️ Оригинал': '👁️ Original',
    '✨ Покажи подобрената': '✨ Show Enhanced',
    '🔍 Увеличи': '🔍 Zoom In',
    '🔎 Помести': '🔎 Fit',
    '↩️ Авто': '↩️ Auto',
    'Предмет (по избор)': 'Subject (optional)',
    'Събитие / Напомняне (по избор)': 'Event / Reminder (optional)',
    'Учител (по избор)': 'Teacher (optional)',
    'Срок / Дата': 'Due Date / Date',
    'Дата на събитието': 'Event Date',
    'Час': 'Time',
    'Бележка / Описание (по избор)': 'Note / Description (optional)',
    'Допълнително описание (по избор)': 'Additional Description (optional)',
    '📎 Прикачи снимката към записа (вижда се от целия клас)': '📎 Attach photo to entry (shared with your class)',
    '✅ Запази снимката': '✅ Save Photo',
    '🖼️ Преглед на снимка (подобрена четимост)': '🖼️ Photo Viewer (Enhanced Readability)',
    '🔍 Увеличи / Помести': '🔍 Zoom / Fit',
    '⬇️ Изтегли': '⬇️ Download',
    'ℹ️ Информация / Какво е „Училищен Будилник“': 'ℹ️ About “School Bell”',
    ') е': ') is a',
    'безплатно училищно приложение с нестопанска цел': 'free, non-profit school application',
    'за ученици, родители и училищни класове. Приложението съчетава училищен звънец в реално време, седмична учебна програма, обратно броене до изпити и ваканции, класни аларми, прикачване на снимки с локален OCR и опционална фонова синхронизация с електронния дневник': 'for students, parents, and school classrooms. The application combines a real-time school bell, weekly schedule, exam and vacation countdowns, class alarms, photo attachments with local OCR, and optional background sync with the electronic gradebook',
    'за ученици, родители и паралелки. Приложението съчетава училищен звънец в реално време, седмична програма, обратно броене до изпити и ваканции, класни аларми и опционална фонова синхронизация с електронния дневник': 'for students, parents, and classes. It combines a real-time school bell, weekly schedule, exam and vacation countdowns, class alarms, and optional background sync with the electronic diary',
    '🎯 За кого е и как се използва накратко?': '🎯 Who is it for and how does it work?',
    '🆓 Безплатно и достъпно за всеки': '🆓 Free and Accessible to Everyone',
    'Проектът е некомерсиален, без реклами и без платени функции. Всяко училище и паралелка имат своя изолирана стая за общо разписание, а информацията за проекта е достъпна веднага без регистрация.': 'This project is non-commercial, ad-free, and has no paid features. Each school and class has its own isolated room for shared schedules, and project info is available without registration.',
    '⏰ Училищен звънец и таймери': '⏰ School Bell & Timers',
    'Показва текущия час или междучасие и отброява на живо оставащото време до следващия звънец. Звукът на звънеца може да се пуска или заглушава с бутона за аудио.': 'Shows the current period or break and counts down live to the next bell. Bell sound can be enabled or muted anytime.',
    '📅 Седмична учебна програма и изпити': '📅 Weekly Schedule & Exams',
    'Интерактивна програма по дни (понеделник – петък) с вграден': 'Interactive daily schedule (Monday – Friday) with a built-in',
    'Редактор на програмата': 'Schedule Editor',
    'и табло с точно обратно броене до предстоящи контролни, тестове и ваканции.': 'and live countdowns to upcoming exams, quizzes, and vacations.',
    'Следене на предстоящите домашни работи (общи за паралелката), както и лични похвали и забележки от учителите (видими единствено в индивидуалния профил).': 'Track upcoming homework as well as personal praises and remarks from teachers (visible only in your personal profile).',
    '🔄 Как работи връзката със Shkolo (по желание)?': '🔄 How does the optional Shkolo integration work?',
    'Към приложението има безплатно браузърно разширение': 'The app includes a free browser extension',
    '„Училищен Будилник Bridge“': '“School Bell Bridge”',
    '(за Chrome, Edge и Brave), което синхронизира във фонов режим:': '(for Chrome, Edge, and Brave) that synchronizes in the background:',
    'Без парола за Shkolo:': 'No Shkolo password required:',
    'Разширението не чете и не копира бисквитките ви и не ги изпраща към Училищен Будилник. Заявките към Shkolo се изпращат от вашия браузър с вашата сесия, както когато сами отваряте Shkolo, и бисквитките отиват само към Shkolo. Паролата ви за Shkolo не се чете и не се съхранява.': 'The extension does not read or copy your cookies and does not send them to School Bell. Requests to Shkolo are sent by your browser using your session, just as when you open Shkolo yourself, and cookies go only to Shkolo. Your Shkolo password is never read or stored.',
    'Какво се синхронизира:': 'What is synchronized:',
    'Само предстоящи домашни работи, предстоящи контролни/изпити и забележки/похвали. Оценки, отсъствия и лични съобщения не се събират.': 'Only upcoming homework, upcoming exams/quizzes, weekly schedule, and remarks/praises. Grades, absences, and private messages are never collected.',
    'Неофициален инструмент:': 'Unofficial tool:',
    'Проектът е независим и не е свързан със или одобрен от Shkolo (Школо ООД) или конкретно училище.': 'This project is independent and is not affiliated with or endorsed by Shkolo (Shkolo Ltd.) or any school.',
    '☕ Подкрепа, обратна връзка и правни документи': '☕ Support, Feedback & Legal Documents',
    '☕ Подкрепи проекта / Изпрати благодарност': '☕ Support the Project / Send Thanks',
    'Ако приложението ви е полезно, можете да изпратите доброволен жест на благодарност в Revolut към': 'If you find this app helpful, you can send a voluntary gesture of thanks on Revolut to',
    '☕ Изпрати благодарност (@cryptohris)': '☕ Send Thanks (@cryptohris)',
    'Жестът на благодарност е изцяло доброволен, не е плащане за услуга, не подлежи на връщане и не дава никакви предимства или специални функции.': 'Any gesture of thanks is completely voluntary, not a payment for service, non-refundable, and grants no special perks or features.',
    '✉️ Контакт, бъгове и поверителност': '✉️ Contact, Bugs & Privacy',
    'За въпроси, предложения, съобняване за грешки или упражняване на права по GDPR:': 'For questions, suggestions, bug reports, or exercising GDPR rights:',
    'Имейл:': 'Email:',
    '✉️ Отвори формата за обратна връзка': '✉️ Open Feedback Form',
    'Разбрах': 'Got it',
    'Изпратете съобщение директно през формата по-долу или ни пишете на': 'Send a message directly using the form below or email us at',
    ', ако желаете отговор по имейл.': 'if you would like a reply by email.',
    'Тип съобщение': 'Message Type',
    '🐞 Съобщение за грешка (бъг)': '🐞 Bug Report',
    '💡 Предложение за подобрение': '💡 Feature Suggestion',
    '❓ Въпрос': '❓ Question',
    '📝 Друго': '📝 Other',
    'Съобщение (поне 5 символа)': 'Message (at least 5 characters)',
    'Изпрати': 'Send',
    'Всеки ден': 'Every day',
    'Забележка': 'Remark',
    'Похвала': 'Praise',
    'Контролно / Изпит': 'Test / Exam',
    '📸 Ръководство': '📸 Guide',
    '📸 Отвори ръководството със снимки стъпка по стъпка': '📸 Open Step-by-Step Photo Guide',
    '📸 Ръководство със снимки': '📸 Photo Guide',
    'ℹ️ За проекта и функциите': 'ℹ️ About & Features',
    '☕ Подкрепа и контакт': '☕ Support & Contact',
    '📸 Пълно визуално ръководство стъпка по стъпка': '📸 Complete Step-by-Step Visual Guide',
    'Разгледайте как работи приложението: от първоначалния вход и самостоятелните функции без Shkolo до опционалното свързване с електронния дневник и автоматичното извличане на учебната програма, контролните и домашните. Кликнете върху всяка снимка за преглед в пълен размер.': 'Explore how the application works: from initial sign-in and standalone features without Shkolo to optional diary synchronization for timetable, exams, and homework. Click any photo to view in full size.',
    '📱 1. Регистрация и функции без Shkolo (стъпки 1–10)': '📱 1. Setup & Features Without Shkolo (Steps 1–10)',
    '🔑 2. Свързване с Shkolo (стъпки 11–15)': '🔑 2. Connect With Shkolo (Steps 11–15)',
    '🌟 3. Синхронизирани данни от дневника (стъпки 16–20)': '🌟 3. Synced Diary Records (Steps 16–20)',
    'Всички функции на „Училищен Будилник“ работят напълно самостоятелно и БЕЗ Shkolo!': 'All features of “School Bell” work completely standalone and WITHOUT Shkolo!',
    'Училищният звънец, седмичната учебна програма, таймерите за изпити, официалните неучебни дни, класните аларми и домашните работи със снимки и OCR могат да се въвеждат и управляват изцяло ръчно и се споделят с целия клас в общата класна стая. От Shkolo се извлича лична информация ЕДИНСТВЕНО за забележки и похвали, които остават строго поверителни само за вашия личен профил.': 'The school bell, weekly schedule, exam countdowns, official vacations, class alarms, and homework with photos and OCR can be managed entirely manually and shared with classmates in the shared room. From Shkolo, personal data is collected ONLY for student remarks and praises, which remain strictly private to your own profile.',
    'Свързване с Shkolo (изцяло по желание / опционално)': 'Connect With Shkolo (Entirely Optional)',
    'Ако използвате електронния дневник Shkolo, разширението за браузър „Училищен Будилник Bridge“ може автоматично да попълва седмичната програма, контролните и домашните работи. От Shkolo се извлича лична информация ЕДИНСТВЕНО за забележки и похвали (които остават строго поверителни само във вашия личен профил и никога не се показват на другите). Всичко останало може да се въвежда и ръчно!': 'If you use the Shkolo electronic diary, the “School Bell Bridge” extension can automatically populate the weekly timetable, exams, and homework. From Shkolo, personal data is collected ONLY for remarks and praises (which remain strictly private to your account and are never shown to others). All other features can be filled in manually!',
    '🌟 Синхронизирани учебни данни за класа и лични отзиви': '🌟 Synced Class Academic Data and Personal Feedback',
    'Максимално удобство: новите контролни, домашни и седмична програма от Shkolo спестяват време на целия клас. Личната информация (забележки и похвали от учителите) остава видима САМО във вашия личен профил.': 'Maximum convenience: new exams, homework, and weekly timetable from Shkolo save time for the entire class. Personal feedback (remarks and praises from teachers) remains visible ONLY in your personal profile.',
    'Вход с личен потребителски профил': 'Sign in with Personal Profile',
    'Начален екран за вход в „Училищен Будилник“. Всеки ученик или родител въвежда своето потребителско име и парола. Защитата на профила използва сигурно scrypt криптографско хеширане. Ако все още нямате профил, изберете бутона „Нямаш профил? Регистрация“.': 'Start screen for signing in to School Bell. Each student or parent enters their username and password. Account security uses secure scrypt cryptographic hashing. If you do not have an account yet, choose “No account yet? Register”.',
    'Избор на град, училище и паралелка': 'Select City, School and Class',
    'При регистрация избирате населено място, училище (от вградения списък с училища или чрез ръчно въвеждане) и съответната паралелка (например 9д клас). Всяка паралелка образува изолирана класна стая, в която съучениците споделят обща учебна програма, график на звънците, домашни и контролни.': 'During registration, select your location, school (from the built-in school directory or custom entry), and class section (e.g., Grade 9d). Each class forms an isolated room where classmates share an overarching timetable, bell schedule, homework, and tests.',
    'Задаване на потребителско име и парола': 'Set Username and Password',
    'Въвеждат се индивидуално потребителско име и надеждна парола (с минимална дължина от 10 символа). Всеки ученик има своя собствена парола. След потвърждаване профилът се създава мигновено и системата ви вписва в класната стая.': 'Enter an individual username and secure password (minimum 10 characters). Each student has their own password. Upon confirmation, your profile is created immediately and logs you into the class room.',
    'Голям училищен часовник, звънци и теми': 'Main School Clock, Bells and Themes',
    'Главният екран показва голям училищен часовник с точно астрономическо време, текущата учебна смяна (например 1 Смяна 08:00 – 13:50), статус „В момента тече учебен час / междучасие“ и брояч „До края на часа“. Чрез бутоните горе можете да избирате аудио звънци, мелодии и цветни фонове.': 'The main screen features a large school clock with precise time, current shift (e.g., Shift 1 08:00 – 13:50), status “Period / break in progress”, and countdown “Until end of period”. Buttons at the top allow selecting bell melodies and themes.',
    'Таймери за край на часа, ваканция и следващ изпит': 'Timers for Period End, Vacation and Next Exam',
    'Таймери за обратно броене в реално време: показват точно колко минути и секунди остават до училищния звънец, брояч на оставащите дни до най-близката официална ваканция (напр. Коледна, Пролетна) и бърза настройка за дата и предмет на предстоящ изпит.': 'Real-time countdown timers: showing minutes and seconds until the school bell, days remaining until the nearest official vacation (e.g., Christmas, Spring), and quick configuration for upcoming exam dates and subjects.',
    'Официални неучебни дни, празници и ваканции': 'Official Non-School Days, Holidays and Vacations',
    'Списък с официалните неучебни дни и празници за учебната година – държавни зрелостни изпити, национално външно оценяване (НВО), неучебни дни и ваканции. Позволява на класа да въвежда и следи важните дати, за да знаят всички ученици кога училището почива.': 'List of official non-school days and holidays for the school year – state matriculation exams, national assessments, non-attendance days, and vacations. Allows the class to track key dates so everyone knows when school is off.',
    'Аларми и таймери за следващите 4 изпита': 'Alarms and Countdown Timers for the Next 4 Exams',
    'Секция за проследяване на контролни и класни работи с индивидуални таймери и аларми за следващите 4 предстоящи изпита. Всеки ученик може да добави ръчно дата, час и предмет на контролното, което веднага става видимо за целия клас, а под тях е достъпен пълен списък на всички насрочени изпити за учебната година.': 'Section for tracking tests and exams with individual countdown timers and alarms for the 4 nearest upcoming exams. Any student can manually add exam dates, times, and subjects for the class, with a complete list of exams below.',
    'Седмична учебна програма по дни и часове': 'Weekly Timetable by Day and Period',
    'Пълна седмична учебна програма по дни (от понеделник до петък) с часове, продължителност и междучасия (малко и голямо). Включва вграден редактор на програмата, с който всяка паралелка може лесно да въведе и настрои часовете на звънеца за деня.': 'Complete weekly class schedule by day (Monday to Friday) with periods, durations, and breaks (short and long). Includes a built-in schedule editor so classes can easily customize daily bell times.',
    'Класни аларми и събития за целия клас': 'Class Alarms and Events for the Entire Class',
    'Споделени класни аларми и напомняния за общи събития – родителски срещи, класни събрания, спортни събития или екскурзии. Всички въведени тук събития са общи и се виждат в реално време от всички съученици в паралелката.': 'Shared class alarms and reminders for common events – parent meetings, class gatherings, sports events, or field trips. All events entered here are shared in real time with classmates in the room.',
    'Добавяне на домашни работи и снимки с OCR': 'Add Homework and Photos with OCR',
    'Удобна форма за ръчно добавяне на домашни работи за класа – попълват се предмет, учител, краен срок и подробни указания (до 5000 знака). Включва бутон за прикачване на снимка от учебник или тетрадка с автоматично изчистване на сенките и подобряване на четимостта чрез вграден локален OCR. Всички добавени тук домашни се виждат веднага от целия клас.': 'Convenient form for manually adding class homework – enter subject, teacher, due date, and instructions (up to 5000 characters). Includes photo upload from textbooks/notebooks with shadow removal and local OCR. All homework added here is immediately visible to the class.',
    'Свързване с Shkolo – генериране на код в приложението': 'Connect With Shkolo – Generate Code in Web App',
    'В картата „Домашни, изпити, забележки и похвали от Shkolo“ в уеб приложението натиснете бутона „Свържи Shkolo“. Генерира се личен еднократен код за връзка (токен) и се предоставя директен линк за сваляне на разширението за браузър. Ясно се посочва, че новите домашни и изпити могат да се споделят с класа, докато личните забележки и похвали остават видими единствено за вашия профил.': 'In the “Homework, Exams, Remarks & Praises from Shkolo” card in the web app, click “Connect Shkolo”. A personal one-time connection token is generated along with a direct link to download the extension. Homework and exams can be shared with class, while remarks and praises stay strictly private.',
    'Сваляне и зареждане на разширението в браузъра (Windows, Mac, Linux)': 'Download and Load Extension in Browser (Windows, Mac, Linux)',
    'Сваляне и зареждане на разширението в браузъра': 'Download and Load Extension in Browser',
    'Изтеглете архива shkolo-bridge.zip от бутона в картата за Shkolo. Инсталирането под Windows, Chrome или Edge се прави в 4 бързи стъпки:': 'Download the shkolo-bridge.zip archive from the Shkolo card. Installing on Windows, Chrome, or Edge takes 4 quick steps:',
    'Разархивираш shkolo-bridge.zip в папка на компютъра (напр. на работния плот).': 'Unzip shkolo-bridge.zip into a folder on your computer (e.g. on Desktop).',
    'В Chrome или Edge отваряш chrome://extensions.': 'In Chrome or Edge open chrome://extensions.',
    'Включваш превключвателя „Режим за програмисти“ (Developer mode) горе вдясно.': 'Enable the “Developer mode” toggle in the top right corner.',
    'Натискаш бутона „Зареждане на разархивирано“ (Load unpacked) и посочваш папката shkolo-bridge.': 'Click the “Load unpacked” button and select the shkolo-bridge folder.',
    'Изтеглете архива shkolo-bridge.zip от бутона в приложението и го разархивирайте. В Google Chrome или съвместим Chromium браузър отворете адрес chrome://extensions, включете превключвателя „Режим за разработчици“ (Developer mode) в горния десен ъгъл и изберете „Зареждане на разархивирано“ (Load unpacked).': 'Download shkolo-bridge.zip from the app button and extract it. In Google Chrome or Chromium browser, navigate to chrome://extensions, enable “Developer mode” in the top-right corner, and click “Load unpacked”.',
    'Екран за съгласие (Consent Gate) в разширението': 'Consent Gate Screen in the Extension',
    'При първо кликване върху иконата на разширението се отваря екран за информирано съгласие. Докато потребителят не натисне изрично „Съгласен съм и продължавам“, разширението не прави никакви мрежови заявки, не записва в хранилището и не чете страници от дневника.': 'Clicking the extension icon opens an informed consent disclosure. Until the user explicitly clicks “I agree and continue”, the extension makes zero network requests, writes no storage, and remains completely inert.',
    'Гаранции за поверителност и бутони за избор': 'Privacy Disclosures and Choice Buttons',
    'Подробно разяснение: пароли за Shkolo не се четат и не се предават, оценки, отсъствия, медицински бележки и лични чатове не се събират. Бутонът „Отказвам“ оставя разширението заключено. Бутонът „Съгласен съм и продължавам“ отключва полето за код за връзка.': 'Detailed disclosure: Shkolo passwords are never read or transmitted; grades, absences, medical notes, and private chats are never collected. The “Decline” button keeps controls locked. “I agree and continue” unlocks token configuration.',
    'Поставяне на кода за връзка и свързване': 'Paste Connection Code and Connect',
    'Поставете генерирания код от уеб приложението и натиснете „Запази“. Разширението се свързва към https://schoolbell.duckdns.org през защитена HTTPS връзка, използвайки вашата вече отворена сесия в app.shkolo.bg. По подразбиране данните остават само за вашия профил, освен ако изрично не включите отметката „Споделяй с класа“.': 'Paste the generated code from the web app and click “Save”. The extension connects to https://schoolbell.duckdns.org over HTTPS using your active session in app.shkolo.bg. Synced items remain private by default unless class sharing is enabled.',
    'Синхронизиран часовник и следващо контролно': 'Synced Clock and Upcoming Exam',
    'След синхронизация насрочените контролни и класни работи от дневника се появяват автоматично с предмет, дата и точен начален час. Таймерът на главния часовник започва незабавно да отброява времето до контролното.': 'After synchronization, scheduled exams and tests from the diary appear automatically with subject, date, and exact start time. The main clock timer immediately starts counting down to the test.',
    'Петте най-близки контролни и пълен график': 'Top 5 Nearest Exams and Full Schedule',
    'Приложението извежда 5 отделни часовника с обратно броене за първите 5 най-близки предстоящи изпита за класа. Под тях е наличен пълен списък с всички контролни работи за учебната година, подредени хронологично.': 'The app displays 5 individual countdown clocks for the top 5 nearest upcoming exams for the class. A collapsible full list of all exams for the school year is available below, ordered chronologically.',
    'Синхронизирана дневна учебна програма': 'Synced Daily Timetable',
    'Седмичната учебна програма от дневника автоматично попълва предметите по часове (БЕЛ, Математика, География, ИИ и др.), заедно с часовете и междучасията. Системата автоматично отбелязва кой час е приключил и кой тече в момента.': 'The weekly schedule from the electronic diary automatically fills period subjects (Literature, Math, Geography, IT, etc.) along with lesson times and breaks, dynamically marking which period is in progress.',
    'Класни събития и разяснение на значките (легенда)': 'Class Events and Badge Legend Explanation',
    'Показва класните аларми и събития заедно с пълна визуална легенда за значките: кои записи са синхронизирани от Shkolo, кои са общи за класа и кои са лични забележки и похвали (видими само за вас).': 'Displays class alarms and events alongside a visual legend for app badges: items synced from Shkolo, shared class items, and private remarks/praises (visible only to you).',
    'Синхронизирани домашни работи от учителите': 'Synced Homework from Teachers',
    'Актуалните домашни работи, въведени от учителите в дневника, се визуализират в таб „Домашни“ с предмет, срок за предаване и точни указания. Изтеклите домашни се архивират и изчистват автоматично.': 'Current homework assignments entered by teachers in the diary are displayed in the “Homework” tab with subject, due date, and instructions. Expired homework is automatically cleaned up.',
    'Важно за самостоятелната работа:': 'Important Standalone Operation Note:',
    'Всички функции на „Училищен Будилник“ работят напълно самостоятелно и БЕЗ Shkolo! Седмичната учебна програма, звънците за часовете, контролните и изпитите, официалните неучебни дни, класните аларми и домашните работи могат да се попълват изцяло ръчно и се споделят с целия клас в общата класна стая.': 'All features of “School Bell” work completely standalone and WITHOUT Shkolo! The weekly schedule, lesson bells, exams and tests, official vacations, class alarms, and homework can be filled in entirely manually and shared with the entire class in the shared room.',
    'Връзката със Shkolo е изцяло по желание (опционална): от дневника се извлича лична информация ЕДИНСТВЕНО за забележки и похвали (които остават строго поверителни само във вашия личен профил и не се споделят с класа).': 'Connecting with Shkolo is entirely optional: from the diary, personal information is collected ONLY for remarks and praises (which remain strictly private to your account and are never shared with the class).',
    '📷 Снимки и локален OCR': '📷 Photos & Local OCR',
    'Възможност за прикачване на снимки към домашни и напомняния. Снимките се съхраняват в изолирана папка с права 0600 на сървъра, а текстът се разчита напълно локално с tesseract без изпращане на трети страни.': 'Option to attach photos to homework and reminders. Photos are stored in an isolated folder with mode 0600 on the server, and text is recognized entirely locally with tesseract without third parties.',
    'Само предстоящи домашни работи, предстоящи контролни/изпити, седмична учебна програма и забележки/похвали. Оценки, отсъствия, медицински бележки и лични чатове не се събират.': 'Only upcoming homework, upcoming exams, weekly timetable, and remarks/praises. Grades, absences, medical notes, and private chats are never collected.',
    'Строг контрол и поверителност:': 'Strict Control & Privacy:',
    'По подразбиране (shareWithClass = false) данните се запазват само за вашия личен профил. Само при изрично включване домашните, изпитите и седмичната програма се споделят с класа. Забележките и похвалите винаги остават строго лични.': 'By default (shareWithClass = false), data is kept private to your personal profile. Only when explicitly enabled are homework, exams, and timetable shared with the class. Remarks and praises always remain strictly private.',
    'Информационна легенда за малките картинки и значки': 'Information Legend for Icons and Badges',
    'и табло с точно обратно броене до 5-те най-близки предстоящи контролни, тестове и ваканции.': 'and a board with live countdowns to the 5 nearest upcoming exams, tests, and vacations.',
    '„Училищен Будилник Bridge“ (v1.5.13)': '“School Bell Bridge” (v1.5.13)',
    '🎬 Видео демонстрация': '🎬 Video Walkthrough',
    '🎬 Пълно видео ръководство (2:47 мин)': '🎬 Full Video Walkthrough (2:47 min)',
    'Изгледайте кратката видео демонстрация на всички основни функции на „Училищен Будилник“: от създаването на профил за училище и клас до автоматичното синхронизиране с Shkolo.': 'Watch the quick video demonstration of all key features of “School Bell”: from creating a school and class profile to automatic synchronization with Shkolo.',
    '▶️ Отвори в YouTube': '▶️ Open in YouTube',
    '⬇️ Изтегли видео файла (MP4)': '⬇️ Download Video File (MP4)',
    '🎬 Гледай видео демонстрацията (2:47 мин)': '🎬 Watch Video Walkthrough (2:47 min)',
    'Какво се показва във видеото стъпка по стъпка:': 'What is shown in the video step by step:',
    '0:00 – 0:35': '0:00 – 0:35',
    '1. Регистрация и избор на училище и клас': '1. Registration & School/Class Selection',
    'Избират се училище (напр. ПТГ), клас (9) и паралелка (г). Всички ученици от една и съща паралелка споделят обща стая за програмата, без да се смесват с други класове.': 'Select school (e.g. PTG), grade (9), and class section (g). All classmates from the same section share an isolated room for their schedule without mixing with other classes.',
    '0:36 – 1:05': '0:36 – 1:05',
    '2. Училищен часовник и брояч за учебните часове': '2. School Clock & Period Countdown Timer',
    'Показва се големият цифров училищен часовник с отброяване в реално време на текущия час (40 мин.), малките и големите междучасия и бутонът за рестартиране на часа.': 'Demonstrates the main digital school clock with real-time countdown for the active 40-minute period, short and long breaks, and the manual period restart button.',
    '1:06 – 1:35': '1:06 – 1:35',
    '3. Обратно броене до ваканции и официални неучебни дни': '3. Vacations Countdown & Non-School Days',
    'Табло за обратно броене до следващата ваканция (напр. Междусрочна), пълен календар на официалните неучебни дни в България и възможност за добавяне на извънредни почивни дни за класа.': 'Countdown board to the upcoming school vacation (e.g. Mid-term), official national non-school calendar for Bulgaria, and adding custom day-offs for the classroom.',
    '1:36 – 2:05': '1:36 – 2:05',
    '4. Седмична програма, класни аларми и изпити': '4. Weekly Schedule, Class Alarms & Exams',
    'Седмичното разписание по часове (1–7 час) с автоматичен индикатор за текущия час и аларми с обратно броене за следващите контролни и изпити.': 'Weekly schedule by periods (1–7) with live active period indicator and countdown alarms for upcoming quizzes and exams.',
    '2:06 – 2:47': '2:06 – 2:47',
    '5. Свързване с електронния дневник Shkolo': '5. Connecting with Shkolo Electronic Diary',
    'Генериране на еднократен токен за връзка в уеб приложението, зареждане на разширението „Училищен Будилник Bridge“ в браузъра и защитено синхронизиране на програмата и домашните.': 'Generating a one-time connection token in the web app, loading the “School Bell Bridge” extension in the browser, and securely syncing schedule and homework.',
  },

  EN_DAYS: {
    'Неделя': 'Sunday',
    'Понеделник': 'Monday',
    'Вторник': 'Tuesday',
    'Сряда': 'Wednesday',
    'Четвъртък': 'Thursday',
    'Петък': 'Friday',
    'Събота': 'Saturday'
  },

  EN_MONTHS: {
    'Януари': 'January',
    'Февруари': 'February',
    'Март': 'March',
    'Април': 'April',
    'Май': 'May',
    'Юни': 'June',
    'Юли': 'July',
    'Август': 'August',
    'Септември': 'September',
    'Октомври': 'October',
    'Ноември': 'November',
    'Декември': 'December'
  },

  SUBJECT_WORD_MAP: {
    'Български език и литература': 'Bulgarian Language & Literature',
    'БЕЛ': 'Bulgarian & Literature',
    'Математика': 'Mathematics',
    'Английски език': 'English Language',
    'Английски': 'English',
    'Немски език': 'German Language',
    'Немски': 'German',
    'Френски език': 'French Language',
    'Испански език': 'Spanish Language',
    'Руски език': 'Russian Language',
    'История и цивилизации': 'History & Civilizations',
    'История': 'History',
    'География и икономика': 'Geography & Economics',
    'География': 'Geography',
    'Биология и здравно образование': 'Biology & Health Education',
    'Биология': 'Biology',
    'Физика и астрономия': 'Physics & Astronomy',
    'Физика': 'Physics',
    'Химия и опазване на околната среда': 'Chemistry & Environmental Protection',
    'Химия': 'Chemistry',
    'Информационни технологии': 'Information Technology',
    'Информатика': 'Computer Science',
    'Компютърно моделиране и ИТ': 'Computer Modeling & IT',
    'Компютърно моделиране': 'Computer Modeling',
    'ИТ': 'IT',
    'Философия': 'Philosophy',
    'Гражданско образование': 'Civic Education',
    'Музика': 'Music',
    'Изобразително изкуство': 'Fine Arts',
    'Физическо възпитание и спорт': 'Physical Education & Sports',
    'ФВС': 'PE & Sports',
    'Технологии и предприемачество': 'Technology & Entrepreneurship',
    'Час на класа': 'Homeroom Period',
    'ЧК': 'Homeroom',
    'Човекът и природата': 'Man & Nature',
    'Човекът и обществото': 'Man & Society'
  },

  init() {
    try {
      localStorage.removeItem('school_bell_lang');
    } catch (_) {}
    const params = new URLSearchParams(window.location.search);
    const urlLang = (params.get('lang') || '').toLowerCase();
    const hashLang = window.location.hash === '#en' ? 'en' : (window.location.hash === '#bg' ? 'bg' : '');
    let saved = 'bg';
    try {
      saved = localStorage.getItem(this.STORAGE_KEY) || 'bg';
    } catch (_) {}
    if (urlLang === 'en' || urlLang === 'bg') {
      this.lang = urlLang;
    } else if (hashLang === 'en' || hashLang === 'bg') {
      this.lang = hashLang;
    } else {
      this.lang = saved === 'en' ? 'en' : 'bg';
    }
    try {
      localStorage.setItem(this.STORAGE_KEY, this.lang);
    } catch (_) {}

    const bindBtn = (id) => {
      const btn = document.getElementById(id);
      if (!btn || btn.__i18nBound) return;
      btn.__i18nBound = true;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.setLanguage(this.lang === 'en' ? 'bg' : 'en');
      });
    };
    bindBtn('authLangBtn');
    bindBtn('headerLangBtn');

    document.querySelectorAll('[data-set-lang]').forEach((link) => {
      if (link.__i18nBound) return;
      link.__i18nBound = true;
      link.addEventListener('click', (e) => {
        const targetLang = link.getAttribute('data-set-lang') === 'en' ? 'en' : 'bg';
        this.setLanguage(targetLang);
      });
    });

    window.addEventListener('hashchange', () => {
      if (window.location.hash === '#en' && this.lang !== 'en') {
        this.setLanguage('en');
      } else if (window.location.hash === '#bg' && this.lang !== 'bg') {
        this.setLanguage('bg');
      }
    });

    if (this.lang === 'en') {
      this.hasSwitched = true;
      this.apply();
    } else {
      this.updateToggleButtons();
    }
  },

  updateToggleButtons() {
    const isEn = this.lang === 'en';
    document.documentElement.lang = isEn ? 'en' : 'bg';
    const path = window.location.pathname || '';
    if (path.includes('privacy')) {
      document.title = isEn
        ? 'Privacy Policy — School Bell & School Bell Bridge'
        : 'Политика за поверителност — Училищен Будилник & Училищен Будилник Bridge';
    } else if (path.includes('terms')) {
      document.title = isEn
        ? 'Terms of Service — School Bell'
        : 'Условия за ползване — Училищен Будилник';
    } else {
      document.title = isEn
        ? 'School Bell & Break Alarm'
        : 'Училищен Будилник & Аларма за Междучасия';
    }
    const authLangBtn = document.getElementById('authLangBtn');
    if (authLangBtn) {
      authLangBtn.textContent = isEn ? '🌐 Български' : '🌐 English';
    }
    const headerLangBtn = document.getElementById('headerLangBtn');
    if (headerLangBtn) {
      const span = headerLangBtn.querySelector('span');
      if (span) span.textContent = isEn ? '🌐 BG' : '🌐 EN';
      else headerLangBtn.textContent = isEn ? '🌐 BG' : '🌐 EN';
    }
  },

  setLanguage(nextLang) {
    this.lang = nextLang === 'en' ? 'en' : 'bg';
    this.hasSwitched = true;
    try {
      localStorage.setItem(this.STORAGE_KEY, this.lang);
    } catch (_) {}
    this.apply();
    if (window.app) {
      try {
        window.app.updateScheduleLabels();
        window.app.renderScheduleTable();
        window.app.renderVacationOptions();
        window.app.renderNoSchoolDays();
        window.app.renderAlarmsList();
        window.app.renderHomeworkList();
        window.app.renderNotesList();
        window.app.allExamsListSignature = null;
        window.app.examSlotSignature = null;
        window.app.renderShkoloExams();
        window.app.updateDailyBackground();
        window.app.updateAudioButton(!!window.bellAudio?.isMuted);
        window.app.tick();
      } catch (_) {}
      this.apply();
    }
  },

  applyAuthMode(registration) {
    const isEn = this.lang === 'en';
    const authIntro = document.getElementById('authIntro');
    if (authIntro) {
      authIntro.textContent = isEn
        ? (registration ? 'Create a personal profile and select your school and class.' : 'Sign in with your personal profile.')
        : (registration ? 'Създай индивидуален профил и избери училище и клас.' : 'Влез с личния си профил.');
    }
    const mode = document.getElementById('authModeBtn');
    if (mode) {
      mode.textContent = isEn
        ? (registration ? 'Already have an account? Sign In' : 'No account yet? Register')
        : (registration ? 'Имаш профил? Вход' : 'Нямаш профил? Регистрация');
    }
  },

  translateDynamicString(raw) {
    if (!raw || typeof raw !== 'string') return raw;
    let s = raw.replace(/\s+/g, ' ').trim();
    if (this.EXACT_TEXT_MAP[s]) return this.EXACT_TEXT_MAP[s];
    if (this.SUBJECT_WORD_MAP[s]) return this.SUBJECT_WORD_MAP[s];

    // Date display: "Неделя, 15 Ноември 2026 г."
    s = s.replace(/^(Неделя|Понеделник|Вторник|Сряда|Четвъртък|Петък|Събота),\s*(\d{1,2})\s+(Януари|Февруари|Март|Април|Май|Юни|Юли|Август|Септември|Октомври|Ноември|Декември)\s+(\d{4})\s*г\.$/,
      (_, d, num, m, y) => `${this.EN_DAYS[d] || d}, ${num} ${this.EN_MONTHS[m] || m} ${y}`);

    // Exam date strings: "20 Ноември 2026 в 09:00 ч. · 1 час (~08:00 ч.) (българско време)"
    s = s.replace(/(\d{1,2})\s+(Януари|Февруари|Март|Април|Май|Юни|Юли|Август|Септември|Октомври|Ноември|Декември)\s+(\d{4})\s+в\s+(\d{2}:\d{2})\s*ч\./g,
      (_, num, m, y, t) => `${num} ${this.EN_MONTHS[m] || m} ${y} at ${t}`);
    s = s.replace(/(\d{1,2})\s+час\s+\(~(\d{2}:\d{2})\s*ч\.\)/g, 'Period $1 (~$2)');
    s = s.replace(/\(българско време\)/g, '(BG time)');
    s = s.replace(/(\d{2}\.\d{2}\.\d{4})\s*г\.,\s*(\d{2}:\d{2})\s*ч\./g, '$1, $2');
    s = s.replace(/(\d{2}\.\d{2}\.\d{4})\s*г\./g, '$1');

    // DHMS countdown: "12д 5ч 30м 10с" or "--д --ч --м"
    s = s.replace(/(\d+)д\s+(\d+)ч\s+(\d+)м\s+(\d+)с/g, '$1d $2h $3m $4s');
    s = s.replace(/--д\s+--ч\s+--м/g, '--d --h --m');

    // Grade options: "5 клас" -> "Grade 5"
    s = s.replace(/^(\d{1,2})\s+клас$/, 'Grade $1');

    // Guide step badge: "Стъпка 1" -> "Step 1"
    s = s.replace(/^Стъпка (\d+)$/, 'Step $1');

    // Vacation select options: "Коледна (24.12–03.01)"
    s = s
      .replace(/^Коледна\s*\((.+)\)$/, 'Christmas ($1)')
      .replace(/^Междусрочна\s*\((.+)\)$/, 'Midterm ($1)')
      .replace(/^Пролетна\s*\((.+)\)$/, 'Spring ($1)')
      .replace(/^Лятна\s*\((.+)\)$/, 'Summer ($1)')
      .replace(/^Есенна\s*\((.+)\)$/, 'Autumn ($1)');

    // Period & break strings
    s = s
      .replace(/^🔄 Рестартирай часа \((\d+) мин\)$/, '🔄 Restart Period ($1 min)')
      .replace(/^Учебен час \((\d+) мин\)$/, 'Period ($1 min)')
      .replace(/^Малко междучасие \((\d+) мин\)$/, 'Short break ($1 min)')
      .replace(/^☕ Голямо междучасие \((\d+) мин\)$/, '☕ Long break ($1 min)')
      .replace(/^Голямо междучасие \((\d+) мин\)$/, 'Long break ($1 min)')
      .replace(/^Междучасие \((\d+) мин\)$/, 'Break ($1 min)')
      .replace(/^(\d+)\. Учебен час$/, '$1. School Period')
      .replace(/^Час (\d+)$/, 'Period $1')
      .replace(/^(\d+) мин$/, '$1 min')
      .replace(/^🌅 1 [сС]мяна \((.+)\)$/, '🌅 Shift 1 ($1)')
      .replace(/^🌙 Почивен ден \(събота\/неделя\)$/, '🌙 Weekend (Saturday/Sunday)')
      .replace(/^Почивен ден — без учебни звънци$/, 'Weekend — school bells off')
      .replace(/^Изминало:\s*(.+)$/, 'Elapsed: $1')
      .replace(/^Остава:\s*(.+)$/, 'Remaining: $1')
      .replace(/^До началото:\s*(.+)$/, 'Until start: $1')
      .replace(/^Начало:\s*(.+)$/, 'Start: $1')
      .replace(/^Започва в (.+) с:\s*(.+)$/, (_, t, subj) => `Starts at ${t} with: ${this.SUBJECT_WORD_MAP[subj.trim()] || subj}`)
      .replace(/^Време за почивка и закуска \((\d+) мин\)$/, 'Break & snack time ($1 min)')
      .replace(/^Време за отдих \((\d+) мин\)$/, 'Break time ($1 min)')
      .replace(/^Учебен час \((\d+) мин брояч\)$/, 'Period ($1 min timer)')
      .replace(/^🔄 РЪЧНО РЕСТАРТИРАН ЧАС$/, '🔄 MANUALLY RESTARTED PERIOD')
      .replace(/^Почивен ден$/, 'Day Off')
      .replace(/^Събота и неделя няма учебни часове$/, 'No school periods on Saturday & Sunday')
      .replace(/^Учебните звънци са спрени$/, 'School bells are turned off')
      .replace(/^Следващ учебен ден: понеделник$/, 'Next school day: Monday')
      .replace(/^Предстои учебен ден$/, 'Upcoming School Day')
      .replace(/^Край на учебния ден \(1-ва смяна\)$/, 'End of School Day (Shift 1)')
      .replace(/^Учебните часове за днес приключиха 🎉$/, 'Today’s school periods have ended 🎉')
      .replace(/^Часовете свършиха$/, 'Periods ended')
      .replace(/^В момента тече учебен час$/, 'Period in Progress')
      .replace(/^☕ ГОЛЯМО МЕЖДУЧАСИЕ$/, '☕ LONG BREAK')
      .replace(/^🔔 МЕЖДУЧАСИЕ$/, '🔔 BREAK')
      .replace(/^Учебен час$/, 'Period')
      .replace(/^☕ ГОЛЯМО$/, '☕ LONG BREAK')
      .replace(/^Междучасие$/, 'Break')
      .replace(/^📝 КОНТРОЛНО$/, '📝 EXAM')
      .replace(/^Предстои$/, 'Upcoming')
      .replace(/^В момента$/, 'Now')
      .replace(/^Приключил$/, 'Ended')
      .replace(/^Няма зададен изпит$/, 'No exam set')
      .replace(/^Добавете предмет и дата чрез „Настрой изпит“$/, 'Add a subject and date via “Set Exam”')
      .replace(/^Днес е изпитът!$/, 'Exam is today!')
      .replace(/^Няма следващ изпит · добавете ръчно$/, 'No upcoming exam · add manually')
      .replace(/^Изпит (\d+) · 🔒 Shkolo$/, 'Exam $1 · 🔒 Shkolo')
      .replace(/^Изпит (\d+)$/, 'Exam $1')
      .replace(/^Контролно по (.+)$/, (_, subj) => `${this.SUBJECT_WORD_MAP[subj.trim()] || subj} Test`)
      .replace(/^Тест по (.+)$/, (_, subj) => `${this.SUBJECT_WORD_MAP[subj.trim()] || subj} Quiz`)
      .replace(/^Класно по (.+)$/, (_, subj) => `${this.SUBJECT_WORD_MAP[subj.trim()] || subj} Exam`)
      .replace(/^Изпит по (.+)$/, (_, subj) => `${this.SUBJECT_WORD_MAP[subj.trim()] || subj} Exam`)
      .replace(/^Няма предстоящи ваканции$/, 'No upcoming vacations')
      .replace(/^Ваканции$/, 'Vacations')
      .replace(/^Ваканция! Остават (\d+) дни 🎉$/, 'Vacation! $1 days left 🎉')
      .replace(/^Ваканцията настъпи! 🎉$/, 'Vacation has started! 🎉')
      .replace(/^Коледна ваканция$/, 'Christmas Vacation')
      .replace(/^Междусрочна ваканция$/, 'Midterm Vacation')
      .replace(/^Пролетна ваканция$/, 'Spring Vacation')
      .replace(/^Лятна ваканция$/, 'Summer Vacation')
      .replace(/^Есенна ваканция$/, 'Autumn Vacation')
      .replace(/^🎓 Край на учебната година – (.+)$/, '🎓 End of School Year – $1')
      .replace(/^Няма добавени неучебни дни\.$/, 'No additional non-school days added.')
      .replace(/^Няма синхронизирани изпити\. Добавете ръчно или синхронизирайте със Shkolo\.$/, 'No synced exams yet. Add manually or sync with Shkolo.')
      .replace(/^Ръчен$/, 'Manual')
      .replace(/^✅ Отминал$/, '✅ Passed')
      .replace(/^⏱️ Часовник #(\d+)$/, '⏱️ Clock #$1')
      .replace(/^Отвори в Shkolo ↗$/, 'Open in Shkolo ↗')
      .replace(/^Няма активни класни аларми и събития\. Добавете по-горе\.$/, 'No active class alarms or events. Add one above.')
      .replace(/^Няма активни домашни със срок\.$/, 'No active homework with a due date.')
      .replace(/^Няма лични забележки от Shkolo\.$/, 'No personal remarks from Shkolo.')
      .replace(/^Няма лични похвали от Shkolo\.$/, 'No personal praises from Shkolo.')
      .replace(/^📅 Срок:\s*(.+)$/, '📅 Due: $1')
      .replace(/^🖼️ Виж снимка$/, '🖼️ View Photo')
      .replace(/^🖼️ Снимка$/, '🖼️ Photo')
      .replace(/^🖼️ (.+) \(подобрена четимост\)$/, '🖼️ $1 (Enhanced Readability)')
      .replace(/^Свързано · чака клас$/, 'Connected · awaiting class')
      .replace(/^Свързано(.*)$/, 'Connected$1')
      .replace(/^Последно синхронизиране(.*):\s*(.+)$/, 'Last synced$1: $2')
      .replace(/^Общите данни са само за (.+)$/, 'Shared class data for $1')
      .replace(/^Нов клас за (.+) — няма запазени общи данни$/, 'New class for $1 — no saved shared data yet')
      .replace(/^Промените са запазени за (.+)$/, 'Changes saved for $1')
      .replace(/^Заредени са промени от друг профил за (.+)$/, 'Changes loaded from another profile for $1')
      .replace(/^Повторно свързване със споделения сървър…$/, 'Reconnecting to shared server…')
      .replace(/^Училищен дигитален будилник за телефон • (.+) • Всички настройки се запазват автоматично • Версия (\d+) • (.+)$/, 'Digital School Bell • $1 • All settings saved automatically • Version $2 • $3')
      .replace(/^Училищен дигитален будилник за телефон • Почивен ден • Учебните звънци са изключени • Версия (\d+) • (.+)$/, 'Digital School Bell • Weekend • School bells are off • Version $1 • $2')
      .replace(/1 смяна/g, 'Shift 1')
      .replace(/^Пустиня$/, 'Desert')
      .replace(/^Океан$/, 'Ocean')
      .replace(/^Джунгла$/, 'Jungle')
      .replace(/^Вулкан$/, 'Volcano')
      .replace(/^Заснежен връх$/, 'Snowy Peak');

    return s;
  },

  walkTextNodes(isEn) {
    if (!document.body) return;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent) continue;
      const tag = parent.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE') continue;
      if (parent.closest('#authLangBtn, #headerLangBtn, [data-set-lang], .lang-pane')) continue;

      const currentVal = node.nodeValue || '';
      const normalized = currentVal.replace(/\s+/g, ' ').trim();
      if (!normalized) continue;

      if (isEn) {
        if (/[А-Яа-яЁё]/.test(normalized)) {
          node.__bgValue = currentVal;
        }
        const sourceText = node.__bgValue !== undefined
          ? node.__bgValue.replace(/\s+/g, ' ').trim()
          : normalized;
        const translated = this.EXACT_TEXT_MAP[sourceText] || this.translateDynamicString(sourceText);
        if (translated && translated !== sourceText) {
          const base = node.__bgValue !== undefined ? node.__bgValue : currentVal;
          const leading = (base.match(/^\s*/) || [''])[0];
          const trailing = (base.match(/\s*$/) || [''])[0];
          const nextVal = leading + translated + trailing;
          if (node.nodeValue !== nextVal) {
            node.nodeValue = nextVal;
          }
        }
      } else if (node.__bgValue !== undefined) {
        if (node.nodeValue !== node.__bgValue) {
          node.nodeValue = node.__bgValue;
        }
      }
    }
  },

  applyDynamic() {
    if (this.lang !== 'en') return;
    this.walkTextNodes(true);
  },

  apply() {
    this.updateToggleButtons();
    if (!this.hasSwitched && this.lang === 'bg') return;

    const isEn = this.lang === 'en';

    // 1. Walk all Text nodes in document.body
    this.walkTextNodes(isEn);

    // 2. Placeholders by ID and by text
    Object.entries(this.PLACEHOLDER_BY_ID).forEach(([id, enPlaceholder]) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (isEn) {
        const cur = el.getAttribute('placeholder') || '';
        if (/[А-Яа-яЁё]/.test(cur) || el.__bgPlaceholder === undefined) {
          el.__bgPlaceholder = cur;
        }
        const mapped = this.PLACEHOLDER_TEXT_MAP[el.__bgPlaceholder] || enPlaceholder;
        el.setAttribute('placeholder', mapped);
      } else if (el.__bgPlaceholder !== undefined) {
        el.setAttribute('placeholder', el.__bgPlaceholder);
      }
    });

    document.querySelectorAll('[placeholder]').forEach((el) => {
      const cur = el.getAttribute('placeholder') || '';
      if (isEn) {
        if (/[А-Яа-яЁё]/.test(cur)) el.__bgPlaceholder = cur;
        const src = el.__bgPlaceholder !== undefined ? el.__bgPlaceholder : cur;
        const mapped = this.PLACEHOLDER_TEXT_MAP[src];
        if (mapped) el.setAttribute('placeholder', mapped);
      } else if (el.__bgPlaceholder !== undefined) {
        el.setAttribute('placeholder', el.__bgPlaceholder);
      }
    });

    // 3. Titles by ID and attributes (title, aria-label, alt, optgroup label)
    Object.entries(this.TITLE_BY_ID).forEach(([id, enTitle]) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (isEn) {
        if (el.__bgTitle === undefined) el.__bgTitle = el.getAttribute('title') || '';
        el.setAttribute('title', enTitle);
      } else if (el.__bgTitle !== undefined) {
        el.setAttribute('title', el.__bgTitle);
      }
    });

    ['title', 'aria-label', 'alt', 'label'].forEach((attr) => {
      document.querySelectorAll(`[${attr}]`).forEach((el) => {
        if (el.closest('.lang-pane')) return;
        const cur = el.getAttribute(attr) || '';
        if (isEn) {
          if (/[А-Яа-яЁё]/.test(cur)) {
            el[`__bgAttr_${attr}`] = cur;
          }
          const src = el[`__bgAttr_${attr}`] !== undefined ? el[`__bgAttr_${attr}`] : cur;
          const mapped = this.ATTR_TEXT_MAP[src] || this.EXACT_TEXT_MAP[src];
          if (mapped) el.setAttribute(attr, mapped);
        } else if (el[`__bgAttr_${attr}`] !== undefined) {
          el.setAttribute(attr, el[`__bgAttr_${attr}`]);
        }
      });
    });

    // 4. Legal links (/privacy <-> /privacy#en, /terms <-> /terms#en)
    document.querySelectorAll('a[href]').forEach((a) => {
      if (a.closest('.lang-pane')) return;
      const href = a.getAttribute('href') || '';
      if (href === '/privacy' || href === '/privacy#en' || href === '/privacy#bg') {
        a.setAttribute('href', isEn ? '/privacy#en' : '/privacy');
      } else if (href === '/terms' || href === '/terms#en' || href === '/terms#bg') {
        a.setAttribute('href', isEn ? '/terms#en' : '/terms');
      }
    });
  }
};

window.addEventListener('DOMContentLoaded', async () => {
  applySupportDonationFlag();
  AppI18n.init();
  if (!document.getElementById('authGate')) return;
  const user = await Auth.initialize();
  if (AppI18n.lang === 'en') AppI18n.apply();
  if (!user) return;
  await SharedClassData.initialize(user);
  window.app = new SchoolBellApp();
  ShkoloIntegration.init();
  if (AppI18n.lang === 'en') AppI18n.apply();
});

// Register the service worker so the app can be installed and work offline.
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js?v=58').then((reg) => {
      if (reg && typeof reg.update === 'function') reg.update().catch(() => {});
    }).catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}
