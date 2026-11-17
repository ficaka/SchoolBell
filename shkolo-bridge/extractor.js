/*
 * Best-effort extraction of homework and remarks from Shkolo pages and AJAX responses.
 * The extension never sends a full page or credentials to the school-bell
 * server - only the normalized homework and remarks returned by this file.
 */
(() => {
  if (window.ShkoloExtractor) return;

  const BG_MONTHS = {
    януари: 1, ян: 1, февруари: 2, фев: 2, февр: 2, март: 3, мар: 3,
    април: 4, апр: 4, май: 5, юни: 6, юли: 7, август: 8, авг: 8,
    септември: 9, сеп: 9, септ: 9, октомври: 10, окт: 10, ноември: 11, ное: 11, ноем: 11,
    декември: 12, дек: 12
  };
  const EN_MONTHS = {
    january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
    jul: 7, july: 7, aug: 8, august: 8, sep: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12
  };

  function todayInSofia() {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Sofia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    } catch (_) {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function currentSchoolYearStartInSofia() {
    const today = todayInSofia();
    const year = Number(today.slice(0, 4));
    const month = Number(today.slice(5, 7));
    return `${month >= 9 ? year : year - 1}-09-01`;
  }

  function shiftDateKey(key, days) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ''));
    if (!match) return '';
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + Number(days || 0)));
    return date.toISOString().slice(0, 10);
  }

  function weekdayOfDateKey(key) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ''));
    if (!match) return -1;
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay();
  }

  function sanitizeHtmlForParser(raw) {
    if (typeof raw !== 'string' || !raw) return '';
    return raw
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<([a-zA-Z0-9_-]+)([^>]*?)>/g, (match, tag, attrs) => {
        if (!attrs) return match;
        const cleanAttrs = attrs
          .replace(/\s+(on[a-zA-Z0-9_-]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, ' data-attr-$1=$2')
          .replace(/\s+(href|src|action)\s*=\s*("[^"]*javascript:[^"]*"|'[^']*javascript:[^']*'|[^\s>]*javascript:[^\s>]*)/gi, ' data-attr-$1=$2 $1="about:blank#js-blocked"');
        return `<${tag}${cleanAttrs}>`;
      });
  }

  function parseHtmlDocument(raw) {
    return new DOMParser().parseFromString(sanitizeHtmlForParser(raw), 'text/html');
  }

  function space(value) {
    return String(value ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function stripNamedPart(value, part) {
    const raw = String(value || '');
    const token = space(part);
    if (!raw || token.length < 2) return raw;
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return raw.replace(new RegExp(`(?:^|\\s)${escaped}(?=\\s|$|[.,;:!?])`, 'giu'), ' ');
  }

  function lineText(node) {
    if (!node) return '';
    try {
      const inner = node.innerText;
      if (inner) return String(inner).replace(/\u00a0/g, ' ').replace(/\r\n?/g, '\n').split('\n').map(space).filter(Boolean).join('\n');
    } catch (_) {}
    try {
      const clone = node.cloneNode(true);
      const owner = clone.ownerDocument;
      for (const element of clone.querySelectorAll('br')) element.replaceWith(owner.createTextNode('\n'));
      for (const element of clone.querySelectorAll('div, p, li, tr, td, th, section, article, header, footer, h1, h2, h3, h4, h5, h6')) {
        element.insertBefore(owner.createTextNode('\n'), element.firstChild);
        element.appendChild(owner.createTextNode('\n'));
      }
      return String(clone.textContent || '').replace(/\u00a0/g, ' ').replace(/\r\n?/g, '\n').split('\n').map(space).filter(Boolean).join('\n');
    } catch (_) {
      return space(node.textContent);
    }
  }

  function relativeDate(value) {
    let raw = space(value).toLocaleLowerCase('bg');
    if (!raw) return '';
    raw = raw.replace(/^(?:срок|до|deadline|due)\s*[:\-–]?\s*/iu, '').trim();
    if (!raw || raw.length > 80) return '';
    const tail = String.raw`(?:\s*(?:[,.;!?)]|$|(?:в|до|около|след|от)\s*\d{1,2}[:.]\d{2}|\d{1,2}[:.]\d{2}))`;
    const today = todayInSofia();
    if (new RegExp(`^днес${tail}`, 'iu').test(raw)) return today;
    if (new RegExp(`^утре${tail}`, 'iu').test(raw)) return shiftDateKey(today, 1);
    if (new RegExp(`^вдругиден${tail}`, 'iu').test(raw)) return shiftDateKey(today, 2);
    let match = new RegExp(`^след\\s+(\\d{1,2})\\s+(?:ден|дни|day|days)${tail}`, 'iu').exec(raw);
    if (match) return shiftDateKey(today, Number(match[1]));
    const weekdays = {
      'понеделник': 1, 'вторник': 2, 'сряда': 3, 'четвъртък': 4, 'петък': 5, 'събота': 6, 'неделя': 0,
      'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6, 'sunday': 0
    };
    for (const [name, day] of Object.entries(weekdays)) {
      if (!new RegExp(`^${name}${tail}`, 'iu').test(raw)) continue;
      const current = weekdayOfDateKey(today);
      if (current < 0) return '';
      return shiftDateKey(today, (day - current + 7) % 7);
    }
    return '';
  }

  function dueDateFromText(value) {
    const text = space(value);
    if (!text) return '';
    const patterns = [
      /(?:^|[^а-яa-z])(?:срок|deadline|due)[ \t]*[:\-–][ \t]*([^\n]{1,70})/iu,
      /(?:^|[^а-яa-z])до[ \t]+([^\n]{1,70})/iu,
      /(?:^|[^а-яa-z])(?:срок|deadline|due)[ \t]+([^\n]{1,70})/iu
    ];
    for (const pattern of patterns) {
      const match = pattern.exec(text);
      if (!match) continue;
      const parsed = parseDate(match[1]);
      if (parsed) return parsed;
    }
    return '';
  }

  function readableText(node) {
    if (!node) return '';
    try {
      const inner = node.innerText;
      if (inner && /[\r\n\t]/.test(inner)) return space(inner);
    } catch (_) {}
    try {
      const clone = node.cloneNode(true);
      const owner = clone.ownerDocument;
      for (const element of clone.querySelectorAll('br, div, p, li, tr, td, th, section, article, header, footer, h1, h2, h3, h4, h5, h6')) {
        if (element.tagName === 'BR') element.replaceWith(owner.createTextNode(' '));
        else {
          element.insertBefore(owner.createTextNode(' '), element.firstChild);
          element.appendChild(owner.createTextNode(' '));
        }
      }
      return space(clone.textContent);
    } catch (_) {
      return space(node.textContent);
    }
  }

  function stripHtml(value) {
    const raw = String(value ?? '');
    if (!/[<&]/.test(raw)) return space(raw);
    try {
      const doc = parseHtmlDocument(raw);
      return readableText(doc.body);
    } catch (_) {
      return space(raw.replace(/<[^>]*>/g, ' '));
    }
  }

  const HOMEWORK_NOISE = /(?:домашно\s+за\s+занятие|всички\s+известия|общи\s+отзиви|предстоящ[оа]?\s+събитие|ново\s+събитие|нов[оа]\s+съобщение|нов[оа]\s+известие|нов[ао]\s+домашн[ао]?\s+работа|ново\s+домашно|класна\s+стая)/iu;
  const HOMEWORK_NAV = /^(?:назад|напред|начало|табло|dashboard|известия|всички известия|общи отзиви|notifications?|home|back|next)$/iu;
  const HOMEWORK_WORD = /(домашн|задач|упражн|задани|текст|прочет|напиш|реши|изпълн|подготов|преговор|конспект|homework|task|assignment|read|write|solve|prepare|exercise)/iu;
  const SUBJECT_HINT = /(език|математик|мат\b|литератур|бел\b|истори|физик|хими|биолог|географ|информатик|кмит|музик|изобразител|технологи|техн\b|предпр|спорт|фвс\b|чов|човекът|прир|общ|околн|родин|комп|модел|чк\b|ит\b|ии\b|английск|българск|немск|френск|руск|испанск|италианск|предмет|дисциплин|mathematic|english|language|history|physics|chemistry|biology|geography|science|art|music|sport)/iu;

  function isHomeworkNoise(value) {
    const text = space(value);
    if (!text) return false;
    return HOMEWORK_NOISE.test(text) || HOMEWORK_NAV.test(text);
  }

  function isPersonWord(word, allowInitial = false) {
    if (!word) return false;
    if (allowInitial && /^[А-ЯA-Z]\.$/u.test(word)) return true;
    return /^[А-ЯA-Z][а-яa-z'’]+(?:-[А-ЯA-Z][а-яa-z'’]+)*$/u.test(word);
  }

  function looksLikePersonName(value) {
    const text = space(value).replace(/^[\s,;:–—-]+|[\s,;:–—-]+$/g, '');
    if (text.length < 5 || text.length > 80) return false;
    if (HOMEWORK_WORD.test(text) || SUBJECT_HINT.test(text) || /\d/.test(text)) return false;
    const words = text.split(/\s+/);
    if (words.length < 2 || words.length > 4) return false;
    if (words.some((w, idx) => idx === 0 && /^[А-ЯA-Z]\.$/u.test(w))) return false;
    return words.every((word, idx) => isPersonWord(word, idx > 0 && idx < words.length - 1));
  }

  function stripTrailingPersonName(value) {
    let text = space(String(value || ''));
    if (!text) return '';
    const dashMatch = text.match(/^(.*?)\s*[-–—]\s*([^–—-]+)$/u);
    if (dashMatch && dashMatch[1].trim().length >= 2 && looksLikePersonName(dashMatch[2])) {
      text = space(dashMatch[1]);
    }
    const words = text.split(/\s+/);
    for (const take of [3, 2]) {
      if (words.length <= take) continue;
      const prefix = words.slice(0, words.length - take).join(' ');
      const suffix = words.slice(words.length - take).join(' ');
      if (prefix.length >= 2 && !/(?:^|\s)(?:по|при|с|на|от|до)$/iu.test(prefix) && looksLikePersonName(suffix)) {
        return space(prefix);
      }
    }
    return text;
  }

  function isControlTestUrl(value) {
    try {
      const url = new URL(String(value || ''), typeof location !== 'undefined' ? location.href : 'https://app.shkolo.bg/');
      if (/\/(?:logout|login|profile|settings|notifications|messages)\b/i.test(url.pathname)) return false;
      if (/\/(?:teacher|user)\//i.test(url.pathname)) return false;
      if (/\/pupil\/\d+(?:\/profile)?\/?$/i.test(url.pathname)) return false;
      return /\/diary\/(?:pupil\/\d+\/)?(?:control[-_]?tests?|shi\/(?:control[-_]?test|test))(?:\/|$)|\/control[-_]?tests?(?:\/|$)|\/ajax\/diary\/getControlTests?(?:ForPupil|ByCourse)?(?:\/|$)/i.test(url.pathname);
    } catch (_) { return false; }
  }

  const CONTROL_TEST_EVIDENCE = /(?:контролн|класн[ао](?!\s+(?:стая|среща|събрание|ръководство|мероприятие|екскурзия|време|обучение))(?:\s+работа)?|изпит(?:ване)?|самостоятелна\s+работа|входно\s+ниво|изходно\s+ниво|тематична\s+проверка|практическо\s+изпитване|control\s*test|\bexam\b)/iu;
  const NON_EXAM_EVENT_EVIDENCE = /(?:ваканц|неучеб|почивн|празник|родителска\s+среща|класн[ао]\s+(?:стая|среща|събрание|ръководство|мероприятие|екскурзия|време|обучение)|екскурзия|зелено\s+училище|тържеств|патронен|олимпиада)/iu;
  const WEAK_TEST_EVIDENCE = /(?:^|[^\p{L}])тест(?:[^\p{L}]|$)|\b(?:test|quiz|проверка)\b/iu;

  function hasControlTestEvidence(value, trusted = false) {
    const text = space(value);
    if (!text) return false;
    return CONTROL_TEST_EVIDENCE.test(text) || (trusted && WEAK_TEST_EVIDENCE.test(text));
  }

  function parseTime(val) {
    const raw = space(val);
    const m = /(?:^|[^\d])([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?/.exec(raw);
    return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
  }

  function yearlessDate(day, month) {
    if (!(month >= 1 && month <= 12) || !(day >= 1 && day <= 31)) return '';
    const today = todayInSofia();
    let year = Number(today.slice(0, 4));
    let result = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const curMonth = Number(today.slice(5, 7));
    // A date from the previous school year is much more likely to mean the
    // upcoming year. Example: on 13.11 or 20.12 a date "08.01" is next January.
    if (result < today && (curMonth - month) >= 5) {
      year += 1;
      result = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return result;
  }

  function extractDateCandidates(value) {
    const raw = space(value);
    if (!raw) return [];
    const results = [];
    const push = (iso, idx = 0) => {
      if (iso && !results.some(r => r.date === iso && r.idx === idx)) results.push({ date: iso, idx });
    };
    const isoRe = /(\d{4})-(\d{2})-(\d{2})/g;
    for (let m; (m = isoRe.exec(raw));) push(`${m[1]}-${m[2]}-${m[3]}`, m.index);

    const fullRe = /(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/g;
    for (let m; (m = fullRe.exec(raw));) {
      let year = Number(m[3]);
      if (year < 100) year += 2000;
      const day = Number(m[1]), month = Number(m[2]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        push(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, m.index);
      }
    }

    const bgMonthRe = /(\d{1,2})\s+([\p{Script=Cyrillic}]+)\.?(?:\s+(\d{4}))?/gu;
    for (let m; (m = bgMonthRe.exec(raw));) {
      const monthKey = m[2].toLocaleLowerCase('bg').replace(/\.$/, '');
      const month = BG_MONTHS[monthKey];
      const day = Number(m[1]);
      const year = m[3] ? Number(m[3]) : 0;
      if (month && day >= 1 && day <= 31) {
        push(year ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : yearlessDate(day, month), m.index);
      }
    }

    const enMonthRe = /(\d{1,2})\s+([A-Za-z]+)\.?(?:\s+(\d{4}))?/g;
    for (let m; (m = enMonthRe.exec(raw));) {
      const month = EN_MONTHS[m[2].toLowerCase().replace(/\.$/, '')];
      const day = Number(m[1]);
      const year = m[3] ? Number(m[3]) : 0;
      if (month && day >= 1 && day <= 31) {
        push(year ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : yearlessDate(day, month), m.index);
      }
    }

    if (!results.length) {
      const yearlessRe = /(?:^|[^\d.])(\d{1,2})[.\/-](\d{1,2})(?![.\/-]?\d)(?:\.)?(?=$|[^\d])/g;
      for (let m; (m = yearlessRe.exec(raw));) {
        const prefix = raw.slice(Math.max(0, m.index - 24), m.index);
        if (/(?:раздел|глава|тема|урок|упр\.?|зад\.?|задача|стр\.?|№)\s*$/iu.test(prefix)) continue;
        const offset = m[0].search(/\d/);
        const day = Number(m[1]), month = Number(m[2]);
        const iso = yearlessDate(day, month);
        if (iso) push(iso, m.index + Math.max(0, offset));
      }
    }

    results.sort((a, b) => a.idx - b.idx);
    if (!results.length) {
      const rel = relativeDate(raw);
      if (rel) results.push({ date: rel, idx: 0 });
    }
    return results.map(r => r.date);
  }

  function parseDate(value) {
    return extractDateCandidates(value)[0] || '';
  }

  function parseTargetDate(value, minDate = todayInSofia()) {
    const candidates = extractDateCandidates(value);
    if (!candidates.length) return '';
    return candidates.find(d => d >= minDate) || candidates[0];
  }

  function parseDateTime(val, fallbackTime = '') {
    const raw = space(val);
    if (!raw) return { date: '', time: parseTime(fallbackTime) };
    const date = parseDate(raw);
    let time = parseTime(raw) || parseTime(fallbackTime);
    return { date, time };
  }

  function valueOf(object, keys) {
    if (!object || typeof object !== 'object') return '';
    for (const key of keys) {
      const value = object[key];
      if (value !== undefined && value !== null && value !== '') return value;
    }
    const lower = new Map(Object.keys(object).map(key => [key.toLowerCase(), key]));
    for (const key of keys) {
      const actual = lower.get(key.toLowerCase());
      if (actual && object[actual] !== undefined && object[actual] !== null && object[actual] !== '') return object[actual];
    }
    return '';
  }

  function nameOf(value) {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string' || typeof value === 'number') return stripHtml(value);
    if (typeof value === 'object') return space(valueOf(value, ['name', 'title', 'subject', 'courseName', 'displayName', 'fullName']));
    return '';
  }

  function dateOf(object) {
    const direct = parseDate(valueOf(object, ['dueDate', 'due_date', 'deadline', 'dateEnd', 'endDate', 'forDate', 'scheduledFor', 'due', 'date']));
    if (direct) return direct;
    const description = stripHtml(valueOf(object, ['description', 'content', 'text', 'body', 'homework', 'homeworkText', 'homework_text', 'task', 'taskText', 'assignment', 'assignmentText']));
    if (!description) return '';
    // Never guess a deadline from unlabelled prose. "Днес учихме..." is not
    // a due date, and homework without an explicit deadline must not sync.
    return dueDateFromText(description);
  }

  function urlOf(value) {
    const raw = space(value);
    if (!raw) return '';
    try {
      const base = (typeof location !== 'undefined' && /^https?:$/i.test(location.protocol || ''))
        ? location.href
        : 'https://app.shkolo.bg/';
      const parsed = new URL(raw, base);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.href.slice(0, 500);
    } catch (_) {}
    return '';
  }

  function hasKey(object, pattern) {
    return Object.keys(object).some(key => pattern.test(key));
  }

  function isRemarkPath(path) {
    return /(feedback|remark|review|comment|note|otziv|забележ|похвал|отзив|бележ|badge)/i.test(String(path || ''));
  }

  function isRemarkFieldPath(path) {
    const leaf = String(path || '').split('.').pop() || '';
    return /^(id|feedbackId|feedback_id|remarkId|remark_id|subject|subjectName|course|teacher|teacherName|date|createdAt|created_at|type|kind|category|feedbackType|feedback_type|status|feedback|comment|text|description|body|note|message|title|name|badge|badge_name|reason|reason_name|time|hour|created_time|url|link|href)$/i.test(leaf);
  }

  function looksLikeHomework(object, pathHint) {
    if (!object || typeof object !== 'object' || Array.isArray(object)) return false;
    const keys = Object.keys(object);
    if (!keys.length) return false;
    const homeworkSignal = pathHint || hasKey(object, /homework|homeworkText|domash|task|assignment/i);
    const remarkSignal = hasKey(object, /feedback|remark|review|otziv|забележ|похвал|отзив|badge/i);
    if (remarkSignal && !homeworkSignal) return false;
    // Homework MUST have a due date and it must be >= today
    const due = dateOf(object);
    if (!due || due < todayInSofia()) return false;
    const strongDescription = hasKey(object, /^(description|content|text|homework|homeworkText|homework_text|task|taskText|assignment|assignmentText)$/i);
    const weakDescription = hasKey(object, /^(title|name|body)$/i);
    const subjectKey = hasKey(object, /^(subject|subjectName|course|courseName|discipline)$/i);
    if (hasKey(object, /^(grade|mark|assessment|absence|excuse|message|sender|recipient)$/i) && !homeworkSignal) return false;
    if (homeworkSignal) return strongDescription || weakDescription || hasKey(object, /homework|task|assignment/i);
    return strongDescription && subjectKey;
  }

  function normalize(object, pathHint = false) {
    if (!object || typeof object !== 'object') return null;
    let description = stripHtml(valueOf(object, ['description', 'content', 'text', 'body', 'homework', 'homeworkText', 'homework_text', 'task', 'taskText', 'assignment', 'assignmentText', 'title', 'name']));
    if (!description || description.length < 3) return null;

    // Discard remarks, dashboard notices, navigation and teacher-name-only rows.
    const descriptionWithoutMetadata = space(description
      .replace(/\b\d{4}-\d{2}-\d{2}\b/gu, ' ')
      .replace(/\b\d{1,2}[.\/-]\d{1,2}(?:[.\/-]\d{2,4})?\b/gu, ' ')
      .replace(/\b\d{1,2}\s+(?:януари|ян|февруари|фев|февр|март|мар|април|апр|май|юни|юли|август|авг|септември|сеп|септ|октомври|окт|ноември|ное|ноем|декември|дек)(?:\s+\d{4})?\b/giu, ' ')
      .replace(/(?:срок|deadline|due)\s*[:\-–]?\s*/giu, ' '));
    const remarkLike = pathHint
      ? /^(?:забележк[аи]?|похвал[аи]?|отзив[и]?|feedback|remark|review)\s*[:\-–]/i.test(description)
      : /(?:забележ|похвал|отзив)/i.test(description);
    if (/(?:без|липса на|няма|не носи|не е написал|ненаписан[ао]?)\s+домашн/i.test(description)
      || remarkLike
      || isHomeworkNoise(description)
      || !descriptionWithoutMetadata
      || looksLikePersonName(description)
      || looksLikePersonName(descriptionWithoutMetadata)) {
      return null;
    }

    // Homework MUST have a valid due date that has not arrived yet (dueDate >= todayInSofia)
    const dueDate = dateOf(object);
    if (!dueDate || dueDate < todayInSofia()) return null;

    let subject = nameOf(valueOf(object, ['subject', 'subjectName', 'subject_name', 'course', 'courseName', 'discipline']));
    const teacher = nameOf(valueOf(object, ['teacher', 'teacherName', 'teacher_name', 'userName', 'createdBy', 'author', 'lecturer']));
    const externalId = space(valueOf(object, ['externalId', 'external_id', 'id', 'homeworkId', 'homework_id', 'uuid', 'code', 'key']));
    const url = urlOf(valueOf(object, ['url', 'link', 'href']));
    if (!subject) {
      const match = /(?:домашн[ао]?(?:\s+работа)?|задача|homework|assignment)\s*(?:по|for|:|-|–)?\s*([^.,;:\n]{2,70}?)(?=\s+(?:учител|преподавател|teacher|срок|до|deadline|дата|клас|предмет)\s*[:\-–]|\s+(?:задача|упражнение|задание|текст)|$)/i.exec(description);
      if (match) subject = space(match[1]).replace(/\s+(?:за|до|срок|на)\s+.*$/i, '');
    }
    if (!subject && pathHint) subject = 'Домашно';
    if (!subject) return null;
    const namedOnly = teacher ? stripNamedPart(descriptionWithoutMetadata, teacher) : descriptionWithoutMetadata;
    const withoutNames = space(stripNamedPart(namedOnly, subject))
      .replace(/^[\s,;:–—.\-]+|[\s,;:–—.\-]+$/g, '');
    if (!withoutNames) return null;
    return {
      subject: subject.slice(0, 120),
      teacher: teacher.slice(0, 120),
      dueDate,
      description: description.slice(0, 5000),
      externalId: externalId.slice(0, 220),
      url
    };
  }

  function hash(value) {
    let result = 2166136261;
    const input = String(value);
    for (let i = 0; i < input.length; i += 1) {
      result ^= input.charCodeAt(i);
      result = Math.imul(result, 16777619);
    }
    return (result >>> 0).toString(36);
  }

  function dedupe(items) {
    const map = new Map();
    for (const item of items) {
      if (!item || !item.description || !item.dueDate) continue;
      if (item.dueDate < todayInSofia()) continue;
      const key = item.externalId
        ? `id:${item.externalId}`
        : `content:${hash(`${item.subject}|${item.teacher}|${item.dueDate}|${item.description}`)}`;
      const previous = map.get(key);
      if (!previous) {
        map.set(key, { ...item });
        continue;
      }
      map.set(key, {
        ...previous,
        subject: previous.subject || item.subject,
        teacher: previous.teacher || item.teacher,
        dueDate: previous.dueDate || item.dueDate,
        description: item.description.length > previous.description.length ? item.description : previous.description,
        externalId: previous.externalId || item.externalId,
        url: previous.url || item.url
      });
    }
    return Array.from(map.values()).slice(0, 200);
  }

  function cellValue(cells, index) {
    return index >= 0 && index < cells.length ? cells[index] : '';
  }

  function cleanCourseSubject(value) {
    return space(value)
      .replace(/\s*\((?:ООП|ОБУЧЕНИЕ\s+ПО\s+ООП)[^)]*\)\s*$/iu, '')
      .trim();
  }

  function selectedCourseFromDocument(root) {
    if (!root || typeof root.querySelector !== 'function') return { subject: '', teacher: '' };
    const selected = root.querySelector('.selected-course, .coursesNav.active, a[data-cyc_group_id].active, li.active [data-cyc_group_id], li.active');
    if (selected) {
      const subjectNode = selected.querySelector('.bold, .diary-course-title, .course-title, strong, b, h3, h4');
      let subject = cleanCourseSubject(readableText(subjectNode));
      if (!subject && selected.classList?.contains?.('selected-course')) {
        const cloneText = readableText(selected);
        subject = cleanCourseSubject(cloneText.split(/\s*[(\n|]\s*/)[0]);
      }
      const teacher = readableText(selected.querySelector('strong a, a[href^="/user/"]'));
      if (subject || teacher) return { subject, teacher };
    }
    const option = root.querySelector('select[name*="cyc"] option:checked, select[name*="course"] option:checked, select[name*="cyc"] option[selected], select[name*="course"] option[selected]');
    if (option) {
      const subject = cleanCourseSubject(readableText(option));
      if (subject && !/^(?:всички|избери|предмет)/iu.test(subject)) return { subject, teacher: '' };
    }
    return { subject: '', teacher: '' };
  }

  function extractCoursesFromDocument(root) {
    if (!root || typeof root.querySelectorAll !== 'function') return [];
    const courses = new Map();
    const addCourse = (idRaw, subjectRaw, titleRaw = '') => {
      const id = String(idRaw || '').trim();
      if (!/^\d{4,20}$/.test(id)) return;
      const subject = cleanCourseSubject(space(subjectRaw).replace(/\s*\([^()]{2,120}\)\s*$/, ''));
      const teacherMatch = /\(([^()]{2,120})\)\s*$/.exec(String(titleRaw || ''));
      const teacher = teacherMatch ? space(teacherMatch[1]) : '';
      if (!courses.has(id)) {
        courses.set(id, { id, subject, teacher });
      } else if (!courses.get(id).subject && subject) {
        courses.set(id, { id, subject, teacher: courses.get(id).teacher || teacher });
      }
    };
    const links = root.querySelectorAll('.coursesNav[data-cyc_group_id], [data-cyc_group_id], [data-cyc-group-id], [data-course_id], [data-course-id], a[href*="cyc_group_id="]');
    for (const link of Array.from(links)) {
      let id = link.getAttribute('data-cyc_group_id')
        || link.getAttribute('data-cyc-group-id')
        || link.getAttribute('data-course_id')
        || link.getAttribute('data-course-id')
        || '';
      if (!id) {
        const href = String(link.getAttribute('href') || '');
        const m = /[?&]cyc_group_id=(\d{4,20})/.exec(href);
        if (m) id = m[1];
      }
      const title = String(link.getAttribute('title') || '');
      const subject = link.querySelector?.('.diary-course-title, .course-title, .bold')?.textContent || link.textContent || title;
      addCourse(id, subject, title);
    }
    for (const option of Array.from(root.querySelectorAll('select[name*="cyc"] option, select[name*="course"] option, #cyc_group_id option'))) {
      addCourse(option.value ?? option.getAttribute?.('value'), option.textContent || '');
    }
    return Array.from(courses.values());
  }

  function extractPaginationPages(raw, doc, maxPage = 15) {
    const pageNums = new Set();
    const record = (n) => {
      const num = Number(n);
      if (Number.isInteger(num) && num >= 2 && num <= maxPage) pageNums.add(num);
    };
    if (typeof raw === 'string' && /^\s*[\[{]/.test(raw)) {
      try {
        const obj = JSON.parse(raw);
        const last = Number(obj?.last_page ?? obj?.totalPages ?? obj?.total_pages ?? 0);
        if (Number.isInteger(last) && last >= 2) {
          for (let p = 2; p <= Math.min(last, maxPage); p += 1) record(p);
        }
        const nextUrl = String(obj?.next_page_url || obj?.nextPageUrl || '');
        const nextMatch = /[?&]page=(\d+)/i.exec(nextUrl);
        if (nextMatch) record(nextMatch[1]);
      } catch (_) {}
    }
    if (doc && typeof doc.querySelectorAll === 'function') {
      for (const el of Array.from(doc.querySelectorAll('a[href*="page="], [data-attr-href*="page="], [data-page], [data-lp], [data-dt-idx], [data-page-number], [data-ci-pagination-page], [onclick], [data-attr-onclick], .pagination a, .pagination button, .pager a, .pager button'))) {
        for (const attr of ['href', 'data-attr-href', 'onclick', 'data-attr-onclick']) {
          const val = String(el.getAttribute?.(attr) || '');
          const m = /[?&]page=(\d+)/i.exec(val) || /(?:getControlTests|getHomeworks|getFeedbacks|loadPage|goToPage|changePage|page)\w*\([^)]*?\b(\d{1,2})\b[^)]*\)/i.exec(val);
          if (m) record(m[1]);
        }
        for (const attr of ['data-page', 'data-lp', 'data-dt-idx', 'data-page-number', 'data-ci-pagination-page']) {
          const val = String(el.getAttribute?.(attr) || '').trim();
          if (/^\d{1,2}$/.test(val)) record(val);
        }
        if (el.closest?.('.pagination') || el.closest?.('.pager')) {
          const label = space(el.textContent || '');
          if (/^\d{1,2}$/.test(label)) record(label);
        }
      }
    }
    return Array.from(pageNums).sort((a, b) => a - b);
  }

  // В таблицата на Shkolo няма колона „Предмет“: предметът и учителят са
  // извън нея, в заглавната лента на избрания курс. Затова ги взимаме от
  // най-близкия .selected-course, когато извикващият не е подал контекст.
  function courseContextForTable(table) {
    let scope = table;
    for (let depth = 0; scope && depth < 8; depth += 1, scope = scope.parentElement) {
      const selected = selectedCourseFromDocument(scope);
      if (selected.subject || selected.teacher) return selected;
    }
    return { subject: '', teacher: '' };
  }

  function cellDateCandidate(cell, minDate = todayInSofia()) {
    if (!cell) return '';
    const textDate = parseTargetDate(readableText(cell), minDate);
    if (textDate && textDate >= minDate) return textDate;
    const attrNode = cell.querySelector?.('time[datetime], [data-date], [title]') || cell;
    for (const attr of ['datetime', 'data-date', 'data-due-date', 'title', 'data-original-title']) {
      const val = attrNode?.getAttribute?.(attr);
      if (!val) continue;
      const d = parseTargetDate(val, minDate);
      if (d) return d;
    }
    return textDate;
  }

  function extractTable(table, options = {}) {
    const tableText = space(table.textContent).toLocaleLowerCase('bg');
    if (/(забележ|похвал|отзив|feedback|remark|review)/.test(tableText)
      && !/(домашн|homework|задач|assignment)/.test(tableText)) return [];
    const rows = Array.from(table.querySelectorAll('tr'));
    if (rows.length < 2) return [];
    const headerKeywordRe = /предмет|дисциплина|subject|course|домашн|задач|описание|тема|задание|съдържание|homework|assignment|task|срок|дата|deadline|due|date|учител|преподавател|teacher/iu;
    let headerRow = null;
    let bestScore = -1;
    for (const candidate of rows.slice(0, 4)) {
      const cells = Array.from(candidate.querySelectorAll('th, td'));
      if (cells.length < 2) continue;
      const hasTh = candidate.querySelector('th') ? 2 : 0;
      const hits = cells.filter(cell => headerKeywordRe.test(readableText(cell))).length;
      const score = hits * 3 + hasTh;
      if (hits >= 1 && score > bestScore) {
        bestScore = score;
        headerRow = candidate;
      }
    }
    if (!headerRow) headerRow = rows.find(row => row.querySelectorAll('th').length >= 2) || rows.find(row => row.querySelector('th')) || rows[0];
    const headers = Array.from(headerRow.querySelectorAll('th, td')).map(cell => readableText(cell).toLocaleLowerCase('bg'));
    if (headers.some(text => /забележ|похвал|отзив|feedback|remark|review/.test(text))) return [];
    const inferred = courseContextForTable(table);
    const subject = cleanCourseSubject(options.subject || inferred.subject);
    const teacher = space(options.teacher || inferred.teacher);
    const subjectIndex = headers.findIndex(text => /предмет|дисциплина|subject|course/.test(text));
    const teacherIndex = headers.findIndex(text => /учител|преподавател|teacher/.test(text));
    // В Shkolo има отделни колони „Дата“ / „Зададена на“ / „Поставена на“ и „Срок“.
    // Приоритизираме изричния „Срок“ пред дата на възлагане, за да не отпаднат активни домашни.
    const createdHeaderRe = /(?:добавен|въведен|създаден|актуализиран|поставена\s+на|зададена\s+на)/i;
    let dueIndex = headers.findIndex(text => /(?:краен\s*)?срок|deadline|due|предаване\s+до|за\s+дата/.test(text) && !createdHeaderRe.test(text));
    if (dueIndex === -1) dueIndex = headers.findIndex(text => /(?:дата|date|зададена\s+за)/.test(text) && !createdHeaderRe.test(text));
    if (dueIndex === -1) dueIndex = headers.findIndex(text => /срок|deadline|due|зададена|поставена|дата|date/.test(text));
    let homeworkIndex = headers.findIndex(text => /домашн|задач|описание|тема|задание|съдържание|текст|детайл|указани|материал|homework|assignment|task|description|content|details/.test(text));
    if (homeworkIndex === -1 && dueIndex !== -1 && headers.length >= 2) {
      homeworkIndex = headers.findIndex((text, idx) => idx !== dueIndex && idx !== subjectIndex && idx !== teacherIndex
        && !createdHeaderRe.test(text) && !/^(?:№|#|статус|status|файл|files?)$/i.test(text.trim()));
    }
    if ((!subject && subjectIndex === -1) || dueIndex === -1 || homeworkIndex === -1) return [];
    const today = todayInSofia();
    const result = [];
    for (const row of rows) {
      if (row === headerRow) continue;
      const rowText = space(row.textContent);
      if (isHomeworkNoise(rowText)) continue;
      const cellNodes = Array.from(row.querySelectorAll('td, th'));
      const cells = cellNodes.map(cell => readableText(cell));
      if (cells.length < 2) continue;
      let dueDate = cellDateCandidate(cellNodes[dueIndex], today);
      if (!dueDate || dueDate < today) {
        const altDates = [
          dueDateFromText(rowText),
          ...cellNodes
            .filter((_, idx) => idx !== dueIndex && !createdHeaderRe.test(headers[idx] || ''))
            .map(node => cellDateCandidate(node, today))
        ].filter(d => d && d >= today);
        if (altDates.length) dueDate = altDates[0];
      }
      if (!dueDate || dueDate < today) continue; // Skip items without deadline or expired
      const description = (homeworkIndex >= 0 ? cellValue(cells, homeworkIndex) : '') || cells.filter((_, index) => index !== subjectIndex && index !== dueIndex && index !== teacherIndex).join(' ');
      if (!description || description.length < 3 || isHomeworkNoise(description) || looksLikePersonName(description)) continue;
      const link = row.querySelector('a[href*="/diary/shi/"], a[href*="/homework"]');
      const externalId = urlOf(link?.getAttribute('href')) || row.dataset?.homeworkId || row.dataset?.id || '';
      const item = normalize({
        subject: subject || cellValue(cells, subjectIndex),
        teacher: teacher || cellValue(cells, teacherIndex),
        description,
        dueDate,
        externalId,
        url: link?.href || ''
      }, true);
      if (item) result.push(item);
    }
    return result;
  }

  function extractFromNode(node) {
    const text = readableText(node);
    if (!text || text.length < 6 || text.length > 5000) return null;
    if (isHomeworkNoise(text)) return null;
    const className = String(node.className || '');
    const id = String(node.id || '');
    const marker = /homework|domash|домашн|задач|assignment/i.test(`${className} ${id} ${text}`);
    if (!marker) return null;
    if (/(feedback|remark|review|otziv|забележ|похвал|отзив)/i.test(`${className} ${id}`)
      && !/(homework|domash|домашн|задач|assignment)/i.test(`${className} ${id}`)) return null;
    if (/(забележ|похвал|отзив|feedback|remark|review|comment)/i.test(text)
      && !/(homework|domash|домашн|задач|assignment)/i.test(`${className} ${id}`)) return null;

    let dueDate = dueDateFromText(text);
    if (!dueDate) {
      const dueNode = node.querySelector('[class*="deadline" i], [class*="due" i], [class*="date" i], time');
      if (dueNode) dueDate = parseDate(readableText(dueNode));
    }
    // Homework without an explicit valid deadline is rejected.
    if (!dueDate || dueDate < todayInSofia()) return null;

    let subject = '';
    const subjectNode = node.querySelector('[class*="subject" i], [class*="course" i], [class*="discipline" i]');
    if (subjectNode) subject = readableText(subjectNode);
    if (!subject) {
      const match = /(?:предмет|дисциплина|subject)\s*[:\-–]\s*([^\n,;]{2,80}?)(?=\s+(?:учител|преподавател|teacher|срок|до|deadline|дата|date|клас|забележка|похвала|отзив|задача|упражнение|задание|текст)\s*[:\-–]|$)/i.exec(text);
      if (match) subject = space(match[1]);
    }
    if (!subject) {
      const match = /домашн[ао]?(?:\s+работа)?\s*(?:по|:|-|–)\s*([^.,;:\n]{2,70}?)(?=\s+(?:учител|преподавател|teacher|срок|до|deadline|дата|клас|предмет)\s*[:\-–]|\s+(?:задача|упражнение|задание|текст)|$)/i.exec(text);
      if (match) subject = space(match[1]);
    }
    if (!subject) {
      const heading = node.querySelector('h1, h2, h3, h4, h5, h6, .title, .caption, strong');
      if (heading) subject = readableText(heading).slice(0, 100);
    }
    let teacher = '';
    const teacherMatch = /(?:учител|преподавател|teacher)\s*[:\-–]\s*([^\n,;]{2,80}?)(?=\s+(?:срок|до|deadline|клас|предмет)\s*[:\-–]|$)/i.exec(text);
    if (teacherMatch) teacher = space(teacherMatch[1]);

    const link = node.querySelector('a[href*="/diary/shi/"], a[href*="/homework"]');
    const externalId = node.dataset?.homeworkId || node.dataset?.id || urlOf(link?.getAttribute('href')) || (id && /homework|domash/i.test(id) ? id : '');
    const descriptionCandidates = Array.from(node.querySelectorAll('p, [class*="description" i], [class*="homework-text" i], [class*="task-text" i]'))
      .map(element => readableText(element))
      .filter(value => value.length >= 3 && value.length <= 2400
        && !/^(?:учител|преподавател|teacher|срок|deadline|дата|date|предмет|subject)\s*[:\-–]/i.test(value));
    let description = descriptionCandidates.sort((a, b) => b.length - a.length)[0] || '';
    if (!description) {
      description = space(text
        .replace(/(?:учител|преподавател|teacher)\s*[:\-–]\s*[^\n]+?(?=\s+(?:срок|deadline|due|дата|date|предмет|клас|забележка|похвала|отзив)\s*[:\-–]|$)/gi, ' ')
        .replace(/(?:срок|deadline|due)\s*[:\-–]?\s*[0-9]{1,2}[.\/-][0-9]{1,2}[.\/-][0-9]{2,4}/gi, ' ')
        .replace(/(?:срок|deadline|due)\s*[:\-–]?\s*[0-9]{4}-[0-9]{2}-[0-9]{2}/gi, ' ')) || text;
    }
    if (subject && description.toLocaleLowerCase('bg').startsWith(subject.toLocaleLowerCase('bg') + ' ')) {
      description = space(description.slice(subject.length));
    }
    return normalize({
      subject,
      teacher,
      description,
      dueDate,
      externalId,
      url: link?.href || ''
    }, true);
  }

  function extractFromDetailText(value) {
    const raw = String(value ?? '').replace(/\r\n?/g, '\n');
    const labelPattern = '(?:Домашна\\s+работа|Файл|Срок(?:\\s+за\\s+домашн[а-я]*(?:\\s+работа)?)?|Предмет|Дисциплина|Учител|Преподавател|Дата(?:\\s+и\\s+час(?:\\s+на\\s+провеждане)?)?|Вид(?:\\s+обучение)?|Маркиран(?:\\s+като\\s+взет)?)';
    const labelRe = new RegExp(`^(${labelPattern})\\s*[:\\-–]\\s*(.*)$`, 'iu');
    // Дори когато страницата е сгънала всичко в един ред, разделяме преди
    // познатите етикети, за да не влезе метаинформацията в текста на задачата.
    const text = raw.replace(new RegExp(`(?=${labelPattern}\\s*[:\\-–])`, 'giu'), '\n');
    const lines = text.split('\n').map(space).filter(Boolean);
    const taskLine = /(?:\bУТ\b|учебник|тетрадк|упр\.?|стр\.?|страниц|задач|напиш|реши|прочет|отговор|превед|изчисли|намери|допиш|довърш|научи|запомн|разгледа)/iu;
    const fields = new Map();
    for (let index = 0; index < lines.length; index += 1) {
      const match = labelRe.exec(lines[index]);
      if (!match) continue;
      const label = space(match[1]).toLocaleLowerCase('bg');
      let fieldValue = space(match[2] || '');
      let next = index + 1;
      while (next < lines.length && next <= index + 2 && !labelRe.test(lines[next])) {
        if (!fieldValue || /^(?:предмет|дисциплина)$/i.test(label)) {
          fieldValue = space(`${fieldValue} ${lines[next]}`);
          next += 1;
          continue;
        }
        break;
      }
      if (!fields.has(label)) fields.set(label, fieldValue);
    }
    let task = fields.get('домашна работа') || fields.get('задача') || fields.get('описание') || '';
    task = space(task.replace(/^['"“”]+/, ''));
    if (!task || !taskLine.test(task)) {
      const candidate = lines.find(line => taskLine.test(line) && !labelRe.test(line));
      if (!candidate) return [];
      task = space(candidate.replace(/^['"“”]+/, ''));
    }
    if (!task || task.length > 1200) return [];
    const dueRaw = fields.get('срок за домашната работа') || fields.get('срок') || '';
    const dueDate = parseDate(dueRaw) || dueDateFromText(text);
    if (!dueDate || dueDate < todayInSofia()) return [];
    let subject = fields.get('предмет') || fields.get('дисциплина') || '';
    let teacher = fields.get('учител') || fields.get('преподавател') || '';
    const parts = subject.split(/\s+[-\u2013\u2014]\s+/u);
    if (parts.length > 1) {
      teacher = teacher || space(parts.pop());
      subject = space(parts.join(' - '));
    }
    const item = normalize({ subject, teacher, description: task, dueDate }, true);
    return item ? dedupe([item]) : [];
  }

  function normalizedFieldLabel(value) {
    return space(value).toLocaleLowerCase('bg').replace(/\s*[:\-–]+\s*$/, '').trim();
  }

  // Пълната страница на домашно в Shkolo показва данните като двойки
  // label/.form-control-static. Това е много по-надеждно от свободния текст,
  // защото не смесва „Файл:“, „Срок…:“ и „Предмет:“ в описанието.
  function extractShkoloHomeworkDetail(documentValue) {
    const fields = new Map();
    for (const group of Array.from(documentValue.querySelectorAll('.form-group'))) {
      const label = normalizedFieldLabel(readableText(group.querySelector('label')));
      const value = readableText(group.querySelector('.form-control-static'));
      if (label && value && !fields.has(label)) fields.set(label, value);
    }
    const task = fields.get('домашна работа') || fields.get('задача') || fields.get('описание');
    if (!task || task.length < 3 || task.length > 5000) return [];
    const dueRaw = fields.get('срок за домашната работа')
      || fields.get('срок')
      || fields.get('краен срок')
      || fields.get('за дата')
      || fields.get('дата')
      || fields.get('за учебен час')
      || fields.get('for date');
    const dueDate = parseTargetDate(dueRaw) || parseDate(dueRaw);
    if (!dueDate || dueDate < todayInSofia()) return [];
    let subjectRaw = fields.get('предмет') || fields.get('дисциплина') || '';
    let teacher = fields.get('учител') || fields.get('преподавател') || '';
    let subject = subjectRaw;
    const parts = subjectRaw.split(/\s+[-\u2013\u2014]\s+/u);
    if (parts.length > 1) {
      teacher = teacher || space(parts.pop());
      subject = space(parts.join(' - '));
    }
    if (!subject) return [];
    let externalId = '';
    const screen = String(documentValue.querySelector('#screen')?.getAttribute('value') || '');
    const screenMatch = /(?:^|\/)diary\/shi\/homework\/(\d{4,30})/i.exec(screen);
    if (screenMatch) {
      externalId = `https://app.shkolo.bg/diary/shi/homework/${screenMatch[1]}`;
    }
    const item = normalize({
      subject,
      teacher,
      description: task,
      dueDate,
      externalId,
      url: externalId
    }, true);
    return item ? dedupe([item]) : [];
  }

  function extractHomeworkRowCellsFallback(row, options = {}, contextSubject = '') {
    const cells = Array.from(row.querySelectorAll('td, th')).map(cell => readableText(cell)).filter(Boolean);
    if (cells.length < 2) return null;
    const today = todayInSofia();
    const rowText = space(cells.join(' '));
    const hasHomeworkCue = Boolean(options.trusted || /(домашн|homework|задач|срок|краен|за\s+дата)/iu.test(rowText));
    if (!hasHomeworkCue) return null;
    if (isHomeworkNoise(rowText)) return null;

    let dueDate = '';
    const dateCells = new Set();
    for (const cell of cells) {
      if (cell.length > 80) continue;
      const parsed = parseTargetDate(cell, today);
      if (parsed && parsed >= today) {
        if (!dueDate) dueDate = parsed;
        dateCells.add(cell);
      } else if (parseDate(cell)) {
        dateCells.add(cell);
      }
    }
    if (!dueDate) dueDate = parseTargetDate(rowText, today);
    if (!dueDate || dueDate < today) return null;

    const textCells = cells.filter(cell => !dateCells.has(cell) && !/^\d{1,3}[.)]?$/.test(cell) && !looksLikePersonName(cell));
    if (!textCells.length) return null;

    let subject = contextSubject || '';
    let description = '';
    if (!subject && textCells.length >= 2) {
      const sorted = textCells.slice().sort((a, b) => a.length - b.length);
      subject = sorted[0];
      description = textCells.filter(c => c !== subject).join(' — ');
    } else {
      description = textCells.join(' — ');
    }
    description = space(description.replace(/^(?:домашна\s+работа|задача|homework|assignment)\s*[:\-–]\s*/iu, ''));
    if (!subject && description) subject = 'Домашно';
    if (!description || description.length < 3) return null;

    const link = row.querySelector('a[href*="/homework/"], a[href*="homework"], a[href]');
    const href = link ? urlOf(link.getAttribute('href') || link.href) : '';
    return normalize({
      subject,
      description,
      dueDate,
      externalId: row.dataset?.homeworkId || row.dataset?.id || (/homework/i.test(href) ? href : ''),
      url: /homework/i.test(href) ? href : ''
    }, true);
  }

  function extractHomeworkBlockFallback(node, options = {}, contextSubject = '') {
    if (!node || typeof node.querySelectorAll !== 'function') return null;
    const today = todayInSofia();
    const rawText = lineText(node);
    const flatText = space(rawText);
    if (flatText.length < 8 || flatText.length > 2600 || isHomeworkNoise(flatText)) return null;
    const dueDate = parseTargetDate(flatText, today) || parseDate(flatText);
    if (!dueDate || dueDate < today) return null;

    const blockMarker = `${node.className || ''} ${node.id || ''} ${flatText}`;
    if (!options.trusted && !/(домашн|homework|задач|срок|краен|за\s*:|за\s+дата)/iu.test(blockMarker)) return null;
    if (/(забележ|похвал|отзив|feedback|remark|review)/iu.test(`${node.className || ''} ${node.id || ''}`)) return null;

    let subject = contextSubject || '';
    let description = '';
    const labeled = extractFromDetailText(rawText);
    if (labeled.length) return labeled[0];

    const parts = Array.from(node.children || [])
      .map(ch => readableText(ch))
      .filter(Boolean);
    const nonDateParts = [];
    for (const part of parts.length ? parts : flatText.split(/\n+/).map(space).filter(Boolean)) {
      const cleaned = space(part
        .replace(/(?:срок|краен\s+срок|за\s+дата|за|deadline|due)\s*[:\-–]?\s*\d{1,2}[.\/-]\d{1,2}(?:[.\/-]\d{2,4})?/giu, '')
        .replace(/\b\d{1,2}[.\/-]\d{1,2}(?:[.\/-]\d{2,4})?\b/gu, '')
        .replace(/\b\d{4}-\d{2}-\d{2}\b/gu, ''));
      if (!cleaned || cleaned.length < 2 || looksLikePersonName(cleaned)) continue;
      nonDateParts.push(cleaned);
    }
    if (nonDateParts.length >= 2) {
      if (!subject) subject = nonDateParts[0];
      description = nonDateParts.slice(subject === nonDateParts[0] ? 1 : 0).join(' — ');
    } else if (nonDateParts.length === 1) {
      const single = nonDateParts[0];
      const splitMatch = /^([^\-:–—]{2,45}?)\s*[-–—:]\s+(.{4,})$/u.exec(single);
      if (!subject && splitMatch && !/^(?:домашн|задач|срок)/iu.test(splitMatch[1])) {
        subject = space(splitMatch[1]);
        description = space(splitMatch[2]);
      } else {
        description = single;
      }
    }
    description = space(description.replace(/^(?:домашна\s+работа|задача|homework|assignment)\s*[:\-–]\s*/iu, ''));
    if (!subject && description) subject = 'Домашно';
    if (!description || description.length < 3) return null;

    const link = node.querySelector('a[href*="/homework/"], a[href*="homework"], a[href]');
    const href = link ? urlOf(link.getAttribute('href') || link.href) : '';
    return normalize({
      subject,
      description,
      dueDate,
      externalId: node.dataset?.homeworkId || node.dataset?.id || (/homework/i.test(href) ? href : ''),
      url: /homework/i.test(href) ? href : ''
    }, true);
  }

  function extractFromDocument(documentValue, options = {}) {
    if (!documentValue || typeof documentValue.querySelectorAll !== 'function') return [];
    const detailItems = extractShkoloHomeworkDetail(documentValue);
    if (detailItems.length) return detailItems;
    const result = [];
    const tables = Array.from(documentValue.querySelectorAll('table'));
    for (const table of tables) {
      const tableItems = extractTable(table, options);
      if (tableItems.length) {
        result.push(...tableItems);
      } else {
        for (const row of Array.from(table.querySelectorAll('tr'))) {
          const fallbackItem = extractHomeworkRowCellsFallback(row, options);
          if (fallbackItem) result.push(fallbackItem);
        }
      }
    }
    // Реалната таблица на Shkolo съдържа „Домашна работа“ и „Срок“. Не
    // пускаме общите fallback-и върху самата таблица или върху контейнера ѝ,
    // защото така целият текст на таблицата може да стане едно измислено
    // домашно. Карти с домашни извън таблицата продължават да се четат.
    const homeworkTables = new Set(tables.filter(table => {
      const text = readableText(table).toLocaleLowerCase('bg');
      return /домашн|homework|задач|assignment/.test(text)
        && /срок|deadline|due/.test(text);
    }));
    const containsHomeworkTable = node => node
      && typeof node.querySelectorAll === 'function'
      && Array.from(node.querySelectorAll('table')).some(table => homeworkTables.has(table));
    const nodes = Array.from(documentValue.querySelectorAll('.homework, .homework-item, .homework-row, [class*="homework" i], [id*="homework" i], [class*="domash" i], [id*="domash" i], [class*="assignment" i], #tab_homeworks li, #tab_homeworks .row, #tab_homeworks .card, #tab_homeworks .portlet'));
    for (const node of nodes) {
      if (containsHomeworkTable(node)) continue;
      const nested = Array.from(nodes).some(other => other !== node && node.contains(other)
        && readableText(other).length >= 20
        && (extractFromNode(other) !== null || extractHomeworkBlockFallback(other, options) !== null));
      if (nested) continue;
      const item = extractFromNode(node) || extractHomeworkBlockFallback(node, options);
      if (item) result.push(item);
    }
    if (!result.length) {
      const candidates = Array.from(documentValue.querySelectorAll('article, li, .portlet, .panel, .card, .note, .alert, .list-group-item, .feed-element, .widget, .media, .timeline-item, .box, .item'));
      for (const node of candidates) {
        const text = readableText(node);
        if (text.length < 12 || text.length > 1800) continue;
        if (!/(домашн|homework|задач|assignment)/i.test(text) && !options.trusted) continue;
        if (isHomeworkNoise(text)) continue;
        if (containsHomeworkTable(node)) continue;
        if (/(забележ|похвал|отзив|feedback|remark|review)/i.test(`${node.className || ''} ${node.id || ''}`)) continue;
        const table = node.closest?.('table');
        if (table && /(забележ|похвал|отзив|feedback|remark|review)/i.test(table.textContent || '')) continue;
        const item = extractFromNode(node) || extractHomeworkBlockFallback(node, options);
        if (item) result.push(item);
      }
    }
    // Shkolo понякога показва детайла като свободен текст без .homework клас.
    // Тогава срокът и задачата се разпознават по етикетите от страницата.
    const bodyText = documentValue.body?.innerText || documentValue.body?.textContent || '';
    const dueLabelRe = /(?:срок|deadline|due)\s*(?:за\s+домашн[а-я]*(?:\s+работа)?)?\s*[:\-–]/iu;
    if (!homeworkTables.size && bodyText && dueLabelRe.test(bodyText)) {
      const nodeTexts = nodes.map(readableText);
      // Търсим най-малкия блок, който съдържа „Срок…:“, вместо целия body.
      // Така задачата не се смесва с други карти или навигация.
      const detailNodes = Array.from(documentValue.querySelectorAll('div, section, article, li, p, form'));
      for (const node of detailNodes) {
        if (typeof node.querySelectorAll !== 'function') continue;
        if (node.querySelector('table')) continue;
        const text = readableText(node);
        if (text.length < 12 || text.length > 4000 || !dueLabelRe.test(text)) continue;
        const hasSmallerMatch = Array.from(node.querySelectorAll('*')).some(child => {
          if (child === node || typeof child.querySelectorAll !== 'function' || child.querySelector('table')) return false;
          const childText = readableText(child);
          return childText.length >= 12 && childText.length < text.length && dueLabelRe.test(childText);
        });
        if (hasSmallerMatch) continue;
        for (const item of extractFromDetailText(text)) {
          const description = space(item.description);
          if (result.some(existing => space(existing.description) === description)) continue;
          // Ако детайлът вече е част от карта с .homework клас, нормалното
          // извличане го е хванало и не трябва да се добавя втори път.
          if (nodeTexts.some(value => value.includes(description))) continue;
          result.push(item);
        }
      }
    }
    return dedupe(result);
  }

  function extractFromText(value) {
    const text = String(value ?? '').replace(/\r\n?/g, '\n');
    const blocks = text.split(/\n{2,}/).map(space).filter(block => block.length >= 12 && block.length <= 2400);
    const result = extractFromDetailText(text);
    for (const block of blocks) {
      if (!/(домашн|homework|задач|assignment)/i.test(block)) continue;
      const item = normalize({ description: block }, true);
      if (item && !result.some(existing => space(existing.description) === space(item.description))) result.push(item);
    }
    return dedupe(result);
  }

  /* ---------------- REMARKS / OTZIVI EXTRACTION ---------------- */

  function remarkKind(...values) {
    const normalized = values.map(value => space(value)).join(' ').toLocaleLowerCase('bg');
    return /(похвал|praise|positive|commend|отличн|браво|активност|награда)/.test(normalized) ? 'praise' : 'remark';
  }

  function cleanRemarkDescription(value) {
    return stripHtml(value)
      .replace(/^(?:забележка|похвала|отзив|коментар|feedback|remark|review|note)\s*[:\-–]\s*/i, '')
      .trim();
  }

  const GENERIC_REMARK_TEXT = /^(?:забележка|забележки|похвала|похвали|отзив|отзиви|коментар|бележка|общи отзиви|всички известия|известия|notification|feedback|remark|review)$/i;
  const FEEDBACK_NOTIFICATION = /(?:всички известия|общи отзиви|предстоящ[оа]?\s+събитие|ново\s+събитие|нова\s+оценка|нов[ао]\s+домашн[ао]?(?:\s+работа)?|ново\s+съобщение|нов[оа]\s+известие)/iu;
  const FEEDBACK_LEGEND_LABELS = [
    'обща похвала', 'активно участие', 'отлично представяне', 'изпълнена задача', 'любознание',
    'старание', 'прогрес', 'комуникативност', 'бодър ум', 'концентрация', 'креативност',
    'работа в екип', 'лидерство', 'родолюбие', 'толерантност', 'емоционална интелигентност',
    'презентационни умения', 'липса на внимание', 'неизпълнена задача', 'нарушение'
  ];

  // Записи, които не са отзиви: извинени/неизвинени дни и отсъствия.
  const ABSENCE_RECORD = /(?:^|[^а-яa-z])(?:(?:не)?извинен[а-яa-z]*\s*(?:\d+\s*)?(?:дни|ден|отсъстви[а-яa-z]*|часове|час)|отсъств[а-яa-z]*|(?:по\s+)?уважителн[а-яa-z]*\s+причин[а-яa-z]*|excused|absences?)(?:[^а-яa-z]|$)/iu;
  const POSITIVE_LABELS = ['обща похвала', 'активно участие', 'отлично представяне', 'изпълнена задача', 'любознание',
    'старание', 'прогрес', 'комуникативност', 'бодър ум', 'концентрация', 'креативност', 'работа в екип',
    'лидерство', 'родолюбие', 'толерантност', 'емоционална интелигентност', 'презентационни умения'];
  const NEGATIVE_LABELS = ['липса на внимание', 'неизпълнена задача', 'нарушение'];

  function kindFromLabel(value) {
    const text = space(value).toLocaleLowerCase('bg');
    if (!text) return '';
    if (NEGATIVE_LABELS.some(label => text.includes(label))) return 'remark';
    if (POSITIVE_LABELS.some(label => text.includes(label))) return 'praise';
    return '';
  }

  function isNumericLabel(value) {
    return /^\d{1,4}(?:[.,]\d+)?$/.test(space(value));
  }

  function looksLikeFeedbackLegend(value) {
    const text = space(value).toLocaleLowerCase('bg');
    if (text.length < 80) return false;
    return FEEDBACK_LEGEND_LABELS.filter(label => text.includes(label)).length >= 4;
  }

  function isGenericRemarkText(value) {
    const text = space(value);
    return !text || text.length < 2 || GENERIC_REMARK_TEXT.test(text) || isNumericLabel(text);
  }

  function isRealRemark(note) {
    if (!note || !note.date || !/^\d{4}-\d{2}-\d{2}$/.test(note.date)) return false;
    const subject = space(note.subject);
    const badge = space(note.badge);
    const comment = space(note.comment);
    const description = space(note.description);
    if (/^(?:всички известия|общи отзиви|известия|notifications?)$/i.test(subject) || /^\d+$/.test(subject)) return false;
    if (FEEDBACK_NOTIFICATION.test([subject, badge, comment, description, note.url, note.externalId].filter(Boolean).join(' '))) return false;
    if (looksLikeFeedbackLegend(`${badge} ${comment} ${description}`)) return false;
    if (isNumericLabel(description) || isNumericLabel(comment) || isNumericLabel(badge)) return false;
    if (!description && !badge && !comment) return false;
    if (ABSENCE_RECORD.test([subject, badge].filter(Boolean).join(' '))) return false;
    if (description.length <= 160 && ABSENCE_RECORD.test(description)) return false;
    return true;
  }

  function normalizeRemark(object, pathHint = '') {
    if (!object || typeof object !== 'object' || Array.isArray(object)) return null;

    // 1. Kind:
    const rawKind = valueOf(object, ['kind', 'type', 'category', 'feedbackType', 'feedback_type', 'badgeType', 'badge_type', 'status']);
    const isPraiseFlag = object.is_positive === true || object.is_praise === true || object.positive === 1 || object.positive === true;
    const kind = isPraiseFlag ? 'praise' : (kindFromLabel(String(object.badge || object.badge_name || object.reason || object.title || '')) || remarkKind(rawKind, pathHint, String(object.badge || object.badge_name || object.reason || object.title || '')));

    // 2. Badge / Reason / Title:
    const badge = cleanRemarkDescription(nameOf(valueOf(object, [
      'badge', 'badgeName', 'badge_name', 'badgeTitle', 'reason', 'reasonName', 'reason_name', 'typeName', 'type_name', 'categoryName', 'category_name'
    ])));

    // 3. Comment / Text:
    let comment = cleanRemarkDescription(valueOf(object, [
      'description', 'comment', 'text', 'body', 'remark', 'feedback', 'note', 'content', 'message', 'title', 'name'
    ]));

    // Construct unified description
    let description = '';
    if (badge && comment && badge.toLowerCase() !== comment.toLowerCase()) {
      if (comment.toLocaleLowerCase('bg').includes(badge.toLocaleLowerCase('bg'))) {
        description = comment;
      } else {
        description = `${badge}: ${comment}`;
      }
    } else {
      description = comment || badge || (kind === 'praise' ? 'Похвала' : 'Забележка');
    }

    if (!description || description.length < 2) description = kind === 'praise' ? 'Похвала' : 'Забележка';

    // 4. Subject:
    let subject = nameOf(valueOf(object, ['subject', 'subjectName', 'subject_name', 'course', 'courseName', 'discipline']));
    if (!subject) {
      const match = /(?:предмет|дисциплина|subject)\s*[:\-–]\s*([^.,;\n]{2,60})/i.exec(description);
      if (match) subject = space(match[1]);
    }
    if (!subject) subject = kind === 'praise' ? 'Похвала' : 'Забележка';

    // 5. Teacher:
    const teacher = nameOf(valueOf(object, ['teacher', 'teacherName', 'teacher_name', 'userName', 'createdBy', 'author', 'lecturer']));

    // 6. Date & Time:
    const rawDateTime = valueOf(object, ['dateTime', 'date_time', 'createdAt', 'created_at', 'dateCreated', 'publishedAt', 'date', 'forDate', 'dueDate']);
    const rawTime = valueOf(object, ['time', 'hour', 'created_time', 'time_created']);
    const dt = parseDateTime(rawDateTime, rawTime);
    const date = dt.date;
    const time = dt.time || null;

    // 7. External ID:
    const externalId = space(valueOf(object, ['externalId', 'external_id', 'feedbackId', 'feedback_id', 'remarkId', 'remark_id', 'id', 'uuid', 'code', 'key']));
    const url = urlOf(valueOf(object, ['url', 'link', 'href']));

    const note = {
      kind,
      subject: subject.slice(0, 120),
      teacher: teacher.slice(0, 120),
      date,
      time,
      badge: badge ? badge.slice(0, 200) : null,
      comment: comment ? comment.slice(0, 2000) : null,
      description: description.slice(0, 2000),
      externalId: externalId.slice(0, 220),
      url
    };
    return isRealRemark(note) ? note : null;
  }

  function dedupeRemarks(items) {
    const map = new Map();
    for (const item of items) {
      if (!item || !item.description) continue;
      const isGenericId = !item.externalId || /^(badge|table|feedback|row|entry|tr|_)/i.test(item.externalId);
      const signature = `${item.kind}|${item.subject}|${item.teacher}|${item.date}|${item.time || ''}|${item.badge || ''}|${item.description}`;
      const key = isGenericId ? `content:${hash(signature)}` : `id:${item.externalId}|${hash(signature)}`;
      const previous = map.get(key);
      if (!previous) {
        map.set(key, { ...item });
        continue;
      }
      map.set(key, {
        ...previous,
        subject: previous.subject || item.subject,
        teacher: previous.teacher || item.teacher,
        date: previous.date || item.date,
        time: previous.time || item.time,
        badge: previous.badge || item.badge,
        comment: (item.comment && item.comment.length > (previous.comment || '').length) ? item.comment : (previous.comment || item.comment),
        description: item.description.length > previous.description.length ? item.description : previous.description,
        externalId: previous.externalId || item.externalId,
        url: previous.url || item.url
      });
    }
    return Array.from(map.values()).slice(0, 200);
  }

  function extractRemarkTable(table) {
    const tableText = space(table.textContent).toLocaleLowerCase('bg');
    if (!/(забележ|похвал|отзив|feedback|remark|review|comment|поведение|дисциплина)/.test(tableText)) return [];
    // Shkolo's #tableFeedbacks is a per-subject count summary, not a list of
    // remarks. It only becomes useful when the response also contains the
    // detailed fields (some Shkolo versions embed them in the same table).
    if (String(table.id || '').toLowerCase() === 'tablefeedbacks'
      && !/(коментар|comment|от\s*:|предмет\s*:)/iu.test(tableText)) return [];
    const rows = Array.from(table.querySelectorAll('tr'));
    if (rows.length < 1) return [];

    let containerSubject = '';
    let cur = table.parentElement;
    const docBody = table.ownerDocument?.body || null;
    while (cur && cur !== docBody && !containerSubject) {
      const heading = cur.querySelector('h1, h2, h3, h4, h5, h6, .panel-title, .ibox-title, .card-title, .caption, strong');
      if (heading && !table.contains(heading)) {
        const hText = readableText(heading);
        if (hText && hText.length >= 2 && hText.length <= 100 && !/(отзив|забележ|похвал|дневник)/i.test(hText)) {
          containerSubject = space(hText.replace(/\s*\(\d+.*?\)\s*/g, ''));
        }
      }
      cur = cur.parentElement;
    }

    const headerRow = rows.find(row => row.querySelector('th')) || (rows.length > 1 && /(предмет|учител|дата|час|вид|тип|отзив|коментар)/i.test(rows[0].textContent) ? rows[0] : null);
    const headers = headerRow ? Array.from(headerRow.querySelectorAll('th, td')).map(cell => readableText(cell).toLocaleLowerCase('bg')) : [];

    const subjectIndex = headers.findIndex(text => /предмет|дисциплина|subject|course/.test(text));
    const teacherIndex = headers.findIndex(text => /учител|преподавател|teacher/.test(text));
    const dateIndex = headers.findIndex(text => /дата|date|кога|създадена/.test(text));
    const timeIndex = headers.findIndex(text => /час|time|hour/.test(text));
    const typeIndex = headers.findIndex(text => /тип|вид|категория|значка|type|category|badge/.test(text));
    let descriptionIndex = headers.findIndex(text => /коментар|описание|текст|съдържание|отзив|причина|бележка|remark|comment|feedback|note/.test(text));
    if (descriptionIndex === -1) descriptionIndex = headers.findIndex(text => /забележ|похвал/.test(text));

    const result = [];
    for (const row of rows) {
      if (row === headerRow) continue;
      const cells = Array.from(row.querySelectorAll('td, th')).map(cell => readableText(cell));
      if (!cells.length) continue;

      let rawDate = dateIndex >= 0 ? cellValue(cells, dateIndex) : '';
      let rawTime = timeIndex >= 0 ? cellValue(cells, timeIndex) : '';
      let teacher = teacherIndex >= 0 ? cellValue(cells, teacherIndex) : '';
      let subject = subjectIndex >= 0 ? cellValue(cells, subjectIndex) : containerSubject;
      let badge = typeIndex >= 0 ? cellValue(cells, typeIndex) : '';
      let description = descriptionIndex >= 0 ? cellValue(cells, descriptionIndex) : '';

      let dt = parseDateTime(rawDate, rawTime);
      if (!dt.date) {
        for (const cell of cells) {
          const tryDt = parseDateTime(cell, rawTime);
          if (tryDt.date) { dt = tryDt; break; }
        }
      }
      if (!dt.time) {
        for (const cell of cells) {
          const t = parseTime(cell);
          if (t) { dt.time = t; break; }
        }
      }

      if (!badge) {
        for (const cell of cells) {
          if (/(забележ|похвал|отзив|без домашн|закъснение|поведение)/i.test(cell)) {
            badge = cell;
            break;
          }
        }
      }
      if (!description) {
        description = cells.filter(cell => cell !== rawDate && cell !== rawTime && cell !== teacher && cell !== subject && cell !== badge).join(' ');
      }
      if (!description && badge) description = badge;
      if (!description && !badge) {
        const rowText = readableText(row);
        if (/(забележ|похвал|отзив)/i.test(rowText)) description = rowText;
      }
      if (!description) continue;

      const link = row.querySelector('a[href]');
      const externalId = row.dataset?.feedbackId || row.dataset?.remarkId || row.dataset?.id || urlOf(link?.getAttribute('href')) || '';

      const note = normalizeRemark({
        kind: remarkKind(badge, description),
        subject,
        teacher,
        date: dt.date,
        time: dt.time,
        badge,
        comment: description !== badge ? description : '',
        description,
        externalId,
        url: link?.href || ''
      }, 'feedback');
      if (note) result.push(note);
    }
    return result;
  }

  function extractRemarkFromNode(node) {
    const text = readableText(node);
    if (!text || text.length < 4 || text.length > 2500) return null;
    const className = String(node.className || '');
    const id = String(node.id || '');
    const fullMarker = `${className} ${id} ${text}`;
    if (!/(feedback|remark|review|comment|otziv|забележ|похвал|отзив|поведение|дисциплина|закъснение|без домашн)/i.test(fullMarker)) return null;

    let subject = '';
    const subjectNode = node.querySelector('[class*="subject" i], [class*="course" i], [class*="discipline" i], strong, h4, h5');
    if (subjectNode) {
      const sText = readableText(subjectNode);
      if (sText && sText.length <= 80 && !/(забележ|похвал|отзив|учител)/i.test(sText)) subject = sText;
    }
    if (!subject) {
      const match = /(?:предмет|дисциплина|subject)\s*[:\-–]\s*([^\n,;]{2,80}?)(?=\s+(?:учител|преподавател|teacher|дата|date|срок|клас|забележка|похвала|отзив|тип)\s*[:\-–]|$)/i.exec(text);
      if (match) subject = space(match[1]);
    }
    if (!subject) {
      const match = /(?:похвала|забележка|отзив)\s+по\s+([^\n,;.]{2,80})/i.exec(text);
      if (match) subject = space(match[1]);
    }
    if (!subject) {
      let cur = node.parentElement;
      const docBody = node.ownerDocument?.body || null;
      while (cur && cur !== docBody && !subject) {
        const heading = cur.querySelector('h1, h2, h3, h4, h5, h6, .panel-title, .ibox-title, .card-title');
        if (heading && !node.contains(heading)) {
          const hText = readableText(heading);
          if (hText && hText.length >= 2 && hText.length <= 80 && !/(отзив|забележ|похвал|дневник)/i.test(hText)) {
            subject = space(hText.replace(/\s*\(\d+.*?\)\s*/g, ''));
          }
        }
        cur = cur.parentElement;
      }
    }

    let teacher = '';
    const teacherNode = node.querySelector('[class*="teacher" i], [class*="author" i]');
    if (teacherNode) teacher = readableText(teacherNode);
    if (!teacher) {
      const teacherMatch = /(?:учител|преподавател|teacher)\s*[:\-–]\s*([^\n,;]{2,80}?)(?=\s+(?:дата|date|срок|предмет|клас|забележка|похвала|отзив|тип)\s*[:\-–]|$)/i.exec(text);
      if (teacherMatch) teacher = space(teacherMatch[1]);
    }
    if (!teacher) {
      const match = /(?:г-жа|г-н)\s+([А-Яа-яA-Za-z\s]{3,60})/u.exec(text);
      if (match) teacher = space(match[0]);
    }

    // Time from element or text:
    const timeNode = node.querySelector('[class*="time" i], [class*="hour" i], time');
    const rawTime = timeNode ? parseTime(readableText(timeNode)) : '';

    const dateMatch = /(?:дата|date)\s*[:\-–]?\s*([0-9]{1,2}[.\/-][0-9]{1,2}[.\/-][0-9]{2,4}|[0-9]{4}-[0-9]{2}-[0-9]{2})/i.exec(text);
    let dt = dateMatch ? parseDateTime(dateMatch[1], rawTime) : { date: '', time: rawTime };
    if (!dt.date) {
      const dateNode = node.querySelector('[class*="date" i], time, small');
      if (dateNode) dt = parseDateTime(readableText(dateNode), rawTime);
    }
    if (!dt.date) dt = parseDateTime(text, rawTime);
    if (!dt.time) dt.time = parseTime(text);

    let badge = '';
    const badgeNode = node.querySelector('.label, .badge, [class*="badge" i], [class*="kind" i], [class*="type" i], [class*="reason" i]');
    if (badgeNode && badgeNode !== subjectNode) badge = readableText(badgeNode);

    let comment = '';
    const descNode = node.querySelector('p, .well, .comment, [class*="text" i], [class*="comment" i], [class*="desc" i], [class*="content" i]');
    if (descNode && descNode !== subjectNode && descNode !== teacherNode && descNode !== badgeNode) {
      comment = readableText(descNode);
    }
    let description = comment;
    if (!description) {
      description = text;
      if (subject && description.startsWith(subject)) description = description.slice(subject.length).trim();
      if (teacher && description.includes(teacher)) description = description.replace(teacher, '').trim();
    }
    if (!description && badge) description = badge;
    if (!description) description = remarkKind(text) === 'praise' ? 'Похвала' : 'Забележка';

    const link = node.querySelector('a[href]');
    const externalId = node.dataset?.feedbackId || node.dataset?.remarkId || node.dataset?.id || urlOf(link?.getAttribute('href')) || '';

    return normalizeRemark({
      kind: remarkKind(badge, text),
      subject,
      teacher,
      date: dt.date,
      time: dt.time,
      badge,
      comment: comment && comment !== badge ? comment : '',
      description,
      externalId,
      url: link?.href || ''
    }, 'feedback');
  }

  function remarkKindFromContext(node) {
    let current = node;
    while (current && current.nodeType === 1) {
      const className = String(current.className || '').toLowerCase();
      const text = space(current.textContent).toLocaleLowerCase('bg');
      if (/(active|selected|current)/.test(className) && /(похвал|praise)/.test(text)) return 'praise';
      if (/(active|selected|current)/.test(className) && /(забележ|remark)/.test(text)) return 'remark';
      if (current.getAttribute?.('aria-selected') === 'true' && /(похвал|praise)/.test(text)) return 'praise';
      if (current.getAttribute?.('aria-selected') === 'true' && /(забележ|remark)/.test(text)) return 'remark';
      current = current.parentElement;
    }
    return '';
  }

  function extractFeedbackDetailsFromDocument(documentValue) {
    if (!documentValue || typeof documentValue.querySelectorAll !== 'function') return [];
    const candidateSet = new Set();
    const selectors = [
      '#feedbacks_for_delete [id^="badge_"]',
      '.delete-feedback-body [id^="badge_"]',
      '#feedbacks_for_delete .badge-details',
      '.delete-feedback-body .badge-details',
      '[class*="feedbackItem" i]',
      '[class*="feedback-item" i]',
      '[class*="feedback_row" i]',
      '[class*="feedback-row" i]',
      '[class*="feedback" i] .list-group-item',
      '[id*="feedback" i] .list-group-item',
      '.modal .feed-element',
      '.modal .timeline-item',
      '.modal .list-group-item',
      '.modal .media',
      '.modal tr'
    ];
    for (const selector of selectors) {
      for (const node of Array.from(documentValue.querySelectorAll(selector))) candidateSet.add(node);
    }
    // Real Shkolo feedback details use the labels "От:", "Предмет:" and
    // "Коментар:". Find their smallest containing entry even when the class
    // names change between Shkolo releases.
    for (const node of Array.from(documentValue.querySelectorAll('.modal, [id*="feedback" i], [class*="feedback" i], table'))) {
      const text = lineText(node);
      if (text.length > 8 && parseDate(text)) candidateSet.add(node);
    }

    const candidates = Array.from(candidateSet).filter(node => {
      if (!node || node.tagName === 'HTML' || node.tagName === 'BODY') return false;
      const text = lineText(node);
      if (text.length < 6 || text.length > 3500) return false;
      if (!parseDate(text)) return false;
      return /(?:коментар|comment|от|предмет|subject|отзив|описание|въведен)\s*:/iu.test(text)
        || /(?:badge_|feedback|remark|отзив|забележ|похвал)/iu.test(`${node.id || ''} ${node.className || ''}`);
    });

    const result = [];
    for (const node of candidates) {
      // Keep the smallest entry, not the modal that contains all of them.
      const hasMoreSpecific = candidates.some(other => other !== node && node.contains(other)
        && parseDate(lineText(other)));
      if (hasMoreSpecific) continue;

      const text = lineText(node);
      const flat = space(text);
      const date = parseDate(text);
      const time = parseTime(text);
      let teacher = '';
      let subject = '';
      let comment = '';
      let badge = '';

      let match = /(?:^|\n)\s*От\s*[:\-–]\s*([^\n]+)/iu.exec(text);
      if (match) teacher = space(match[1]);
      match = /(?:^|\n)\s*Предмет\s*[:\-–]\s*([^\n]+)/iu.exec(text);
      if (match) subject = space(match[1]);
      match = /(?:^|\n)\s*(?:Коментар|Описание|Отзив)\s*[:\-–]\s*([\s\S]+)$/iu.exec(text);
      if (match) {
        comment = space(match[1]
          .split(/\n\s*(?:От|Предмет|Дата|Тип|Вид|Категория|Коментар|Описание|Отзив)\s*[:\-–]/iu)[0]);
      }
      if (!comment) {
        match = /(?:Коментар|Описание|Отзив)\s*[:\-–]\s*([\s\S]+?)(?=\s+(?:От|Предмет|Дата|Тип|Вид|Категория)\s*[:\-–]|$)/iu.exec(flat);
        if (match) comment = space(match[1]);
      }
      if (!teacher) {
        match = /От\s*[:\-–]\s*([\s\S]+?)(?=\s+(?:Предмет|Коментар|Дата|Тип|Вид|Категория|Отзив)\s*[:\-–]|$)/iu.exec(flat);
        if (match) teacher = space(match[1]);
      }
      if (!subject) {
        match = /Предмет\s*[:\-–]\s*([\s\S]+?)(?=\s+(?:От|Коментар|Дата|Тип|Вид|Категория|Отзив)\s*[:\-–]|$)/iu.exec(flat);
        if (match) subject = space(match[1]);
      }

      const badgeNode = node.querySelector('.label, .badge, [class*="badge" i], [class*="reason" i], [class*="title" i], strong');
      if (badgeNode) {
        const value = readableText(badgeNode);
        if (value && value.length <= 120 && !isGenericRemarkText(value) && !parseDate(value)) badge = value;
      }
      if (!badge) {
        const firstLine = text.split('\n').map(space).find(line => line
          && !/^(?:от|предмет|коментар|дата|тип|вид|категория|отзив|похвали|забележки)\s*:/iu.test(line)
          && !parseDate(line) && !isGenericRemarkText(line) && line.length <= 120);
        if (firstLine) badge = firstLine;
      }

      let containerSubject = subject;
      if (!containerSubject) {
        let current = node.parentElement;
        while (current && current !== documentValue.body && !containerSubject) {
          const heading = current.querySelector('h1, h2, h3, h4, h5, h6, .panel-title, .ibox-title, .card-title, .modal-title');
          if (heading && !node.contains(heading)) {
            const value = readableText(heading);
            if (value && value.length >= 2 && value.length <= 100
              && !/(отзив|забележ|похвал|дневник|feedback|remark)/iu.test(value)) containerSubject = value;
          }
          current = current.parentElement;
        }
      }

      const contextKind = remarkKindFromContext(node);
      const kind = contextKind || remarkKind(badge, comment, text);
      const description = comment || badge || (kind === 'praise' ? 'Похвала' : 'Забележка');
      const link = node.querySelector('a[href]');
      const externalId = node.dataset?.feedbackId || node.dataset?.remarkId || node.dataset?.id
        || (node.id && /^badge_\d+$/i.test(node.id) ? node.id : '')
        || urlOf(link?.getAttribute('href')) || '';

      const note = normalizeRemark({
        kind,
        subject: containerSubject,
        teacher,
        date,
        time,
        badge,
        comment,
        description,
        externalId,
        url: link?.href || ''
      }, 'feedback');
      if (note) result.push(note);
    }
    return dedupeRemarks(result);
  }

  function extractBadgeDetails(documentValue, options = {}) {
    const result = [];
    const nodes = Array.from(documentValue.querySelectorAll(
      '.badge-details-holder, [id^="badge_details_"]'
    ));
    for (const node of nodes) {
      const flat = readableText(node);
      if (!flat || flat.length < 8) continue;
      const row = node.closest?.('.detailsRow, tr, [data-typeid], [class*="badges-type-"]');
      const rowClass = String(row?.className || '');
      let typeId = String(row?.getAttribute?.('data-typeid') || '')
        || (/(?:badges-type|feedback-type)-(\d+)/i.exec(rowClass) || [])[1]
        || '';
      if (!typeId) {
        const numericId = (String(node.id || '').match(/(\d+)$/) || [])[1] || '';
        const holder = numericId
          ? documentValue.querySelector(`.badge-holder[data-target_ids*="${numericId}"]`)
          : null;
        const badge = holder?.querySelector('.count.badge');
        if (badge?.classList?.contains('appraisal')) typeId = '1';
        else if (badge?.classList?.contains('remark')) typeId = '2';
      }
      const explicitKind = typeId === '1' ? 'praise' : (typeId === '2' ? 'remark' : (options.kind || ''));
      const subject = cleanCourseSubject(readableText(node.querySelector('.bold')));
      let description = '';
      const descriptionMatch = /(?:Описание|Коментар|Отзив)\s*[:\-–]\s*(.+?)(?=\s*(?:Въведен\w*\s+от|От\s*:|$))/iu.exec(flat);
      if (descriptionMatch) description = space(descriptionMatch[1]);
      if (!description) {
        const preAuthorMatch = /^(.+?)(?=\s*(?:Въведен\w*\s+от|От\s*:|$))/iu.exec(flat);
        if (preAuthorMatch) {
          description = space(preAuthorMatch[1]).replace(/^(?:забележка|похвала|отзив)\s*[:\-–]?\s*/iu, '');
        }
      }
      if (!description) {
        description = explicitKind === 'praise' ? 'Похвала' : 'Забележка';
      }

      let teacher = '';
      let date = '';
      let time = '';
      const authorMatch = /Въведен\w*\s+от\s*:?\s*(.+?)\s*\/\s*(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}\s+\d{1,2}:\d{2}(?::\d{2})?)/iu.exec(flat);
      if (authorMatch) {
        teacher = space(authorMatch[1]).replace(/\s*\((?:Учител|Преподавател|Родител|Ученик)\)\s*$/iu, '').trim();
        const dt = parseDateTime(authorMatch[2]);
        date = dt.date;
        time = dt.time;
      } else {
        date = parseDate(flat);
        time = parseTime(flat);
        const author = /Въведен\w*\s+от\s*:?\s*(.+?)(?=\s*\/|$)/iu.exec(flat);
        if (author) teacher = space(author[1]);
      }
      if (!date) continue;
      const note = normalizeRemark({
        kind: explicitKind || kindFromLabel(description) || remarkKind(description),
        subject,
        teacher,
        date,
        time,
        badge: description !== 'Похвала' && description !== 'Забележка' ? description : '',
        comment: description,
        description,
        externalId: node.id || '',
        url: ''
      }, 'feedback');
      if (note) result.push(note);
    }
    return dedupeRemarks(result);
  }

  function extractRemarksFromDocument(documentValue, options = {}) {
    if (!documentValue || typeof documentValue.querySelectorAll !== 'function') return [];
    const result = [];

    // 1. Реалните редове с отзиви в Shkolo: скритите .badge-details-holder
    // съдържат предмет, описание, учител и точен час. Таблицата-обобщение
    // #tableFeedbacks съдържа само бройки и не бива да създава записи.
    result.push(...extractBadgeDetails(documentValue, options));

    // 2. Tables
    for (const table of Array.from(documentValue.querySelectorAll('table'))) {
      result.push(...extractRemarkTable(table));
    }

    // 1b. Detailed feedback modal / "feedbacks_for_delete" rows.
    result.push(...extractFeedbackDetailsFromDocument(documentValue));

    // 2. Dedicated feedback containers
    const feedbackContainers = Array.from(documentValue.querySelectorAll(
      '#feedbacks, #tab_feedbacks, #tab-feedbacks, [id*="feedback" i], [id*="otziv" i], [class*="feedbacks" i], [class*="otziv" i]'
    ));
    for (const container of feedbackContainers) {
      if (container.tagName === 'TABLE') continue;
      const items = Array.from(container.querySelectorAll('.feed-element, .timeline-item, .list-group-item, tr, .card, .panel, .well, .item, .badge-item, [class*="item" i], [class*="entry" i], [class*="row" i]'));
      if (items.length) {
        for (const item of items) {
          if (item.tagName === 'TR') continue;
          const note = extractRemarkFromNode(item);
          if (note) result.push(note);
        }
      } else {
        const note = extractRemarkFromNode(container);
        if (note) result.push(note);
      }
    }

    // 3. Candidate nodes across document
    const candidates = Array.from(documentValue.querySelectorAll(
      '[class*="feedback" i], [class*="remark" i], [class*="review" i], [class*="otziv" i], [class*="zabelezh" i], .feed-element, .timeline-item, .list-group-item, article, li, .card, .panel, .alert'
    ));
    for (const node of candidates) {
      const text = readableText(node);
      if (text.length < 6 || text.length > 2500) continue;
      if (!/(забележ|похвал|отзив|feedback|remark|review|без домашн|закъснение|поведение)/i.test(text + ' ' + (node.className || '') + ' ' + (node.id || ''))) continue;
      const hasChildCandidate = candidates.some(other => other !== node && node.contains(other));
      if (hasChildCandidate) continue;

      const note = extractRemarkFromNode(node);
      if (note) result.push(note);
    }

    if (options.kind === 'praise' || options.kind === 'remark') {
      return dedupeRemarks(result.map(item => ({ ...item, kind: options.kind })));
    }
    return dedupeRemarks(result);
  }

  function extractRemarksFromText(value) {
    const text = String(value ?? '').replace(/\r\n?/g, '\n');
    const blocks = text.split(/\n{2,}/).map(space).filter(block => block.length >= 6 && block.length <= 2400);
    const result = [];
    for (const block of blocks) {
      if (!/(забележ|похвал|отзив|feedback|remark|review|без домашн|закъснение|поведение)/i.test(block)) continue;
      const note = normalizeRemark({ description: block }, 'feedback');
      if (note) result.push(note);
    }
    return dedupeRemarks(result);
  }

  function extractRemarksFromJson(value) {
    let parsed = value;
    if (typeof value === 'string') {
      const text = value.trim();
      if (!text) return [];
      if (/^[\[{]/.test(text)) {
        try { parsed = JSON.parse(text); } catch (_) {
          return /<(table|div|li|html)/i.test(text)
            ? extractRemarksFromDocument(parseHtmlDocument(text))
            : extractRemarksFromText(text);
        }
      } else if (/<(table|div|li|html)/i.test(text)) {
        return extractRemarksFromDocument(parseHtmlDocument(text));
      } else {
        return extractRemarksFromText(text);
      }
    }
    const result = [];
    const walk = (node, path, depth) => {
      if (depth > 9 || result.length >= 200 || node === null || node === undefined) return;
      if (typeof node === 'string') {
        const text = node.trim();
        if (text.length < 6) return;
        if (/^[\[{]/.test(text)) {
          try { walk(JSON.parse(text), path, depth + 1); } catch (_) {}
        } else if (/<(table|div|li|html)/i.test(text) && isRemarkPath(path) && !isRemarkFieldPath(path)) {
          result.push(...extractRemarksFromDocument(parseHtmlDocument(text)));
        } else if (isRemarkPath(path) && !isRemarkFieldPath(path)) {
          const note = normalizeRemark({ description: text }, path);
          if (note) result.push(note);
        }
        return;
      }
      if (Array.isArray(node)) {
        for (const child of node.slice(0, 250)) walk(child, path, depth + 1);
        return;
      }
      if (typeof node !== 'object') return;
      const homeworkSignal = /(homework|domash|task|assignment|домашн|задач)/i.test(path)
        || hasKey(node, /homework|domash|task|assignment/i);
      const remarkPath = isRemarkPath(path)
        || (hasKey(node, /feedback|remark|review|comment|otziv|забележ|похвал|отзив|badge/i) && !homeworkSignal);
      if (remarkPath) {
        const note = normalizeRemark(node, path);
        if (note) result.push(note);
      }
      for (const [key, child] of Object.entries(node)) {
        if (child && (typeof child === 'object' || typeof child === 'string')) {
          walk(child, `${path}.${key}`, depth + 1);
        }
      }
    };
    walk(parsed, '', 0);
    return dedupeRemarks(result);
  }

  /* ---------------- CONTROL TESTS / EXAMS EXTRACTION ---------------- */

  const DEFAULT_PERIOD_TIMES = ['', '07:30', '08:25', '09:20', '10:25', '11:20', '12:15', '13:10', '14:00', '14:50', '15:40', '16:30', '17:20'];
  const GENERIC_EXAM_TITLE = /^(?:контролн[ао]?|контролна\s+работа|класн[ао](?:\s+работа)?|самостоятелна\s+работа|входно\s+ниво|изходно\s+ниво|тематична\s+проверка|практическо\s+изпитване|писмено\s+изпитване|изпит(?:ване)?|тест|control\s*test|exam|test|quiz)$/iu;

  function parsePeriodNumber(value) {
    if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 12) return value;
    const text = space(value);
    if (!text || /:/.test(text)) return 0;
    let m = /^(\d{1,2})\s*(?:[-.]?(?:ти|ви|ри|ми|и)?\s*(?:учебен\s+)?(?:час|ч\.|period|lesson)?)\.?$/iu.exec(text);
    if (!m) m = /(?:^|[^\d])(\d{1,2})\s*(?:[-.]?(?:ти|ви|ри|ми|и)?\s*(?:учебен\s+)?(?:час|ч\.))\b/iu.exec(text);
    if (!m) m = /(?:час|period|lesson|№|#)\s*[:\-]?\s*(\d{1,2})\b/iu.exec(text);
    const num = m ? Number(m[1]) : 0;
    return Number.isInteger(num) && num >= 1 && num <= 12 ? num : 0;
  }

  function examSubjectFromTitle(title) {
    const text = space(title);
    let match = /\s+по\s+(.+)$/iu.exec(text);
    if (match) return stripTrailingPersonName(space(match[1]).replace(/\s+\d{4}$/, '')) || space(match[1]).replace(/\s+\d{4}$/, '');
    match = /^(?:контролн[ао]?|контролна\s+работа|класн[ао](?:\s+работа)?|самостоятелна\s+работа|входно\s+ниво|изходно\s+ниво|изпит(?:ване)?|тест)\s*[:\-–]?\s*(.*)$/iu.exec(text);
    if (match && match[1]) return stripTrailingPersonName(space(match[1])) || space(match[1]);
    return stripTrailingPersonName(text) || text;
  }

  function buildExamTitle(rawTitle, subject, typeName, trusted = false) {
    let title = space(rawTitle);
    const cleanSubject = space(subject);
    const cleanType = space(typeName);
    if (!title) {
      if (cleanType && cleanSubject) {
        return cleanType.toLowerCase().includes(cleanSubject.toLowerCase()) ? cleanType : `${cleanType} по ${cleanSubject}`;
      }
      if (cleanType) return cleanType;
      if (trusted && cleanSubject) return `Контролно по ${cleanSubject}`;
      return '';
    }
    if (cleanSubject && GENERIC_EXAM_TITLE.test(title) && !title.toLowerCase().includes(cleanSubject.toLowerCase())) {
      title = `${title} по ${cleanSubject}`;
    } else if (cleanSubject && trusted && !hasControlTestEvidence(title, true) && cleanType) {
      title = cleanType.toLowerCase().includes(cleanSubject.toLowerCase()) ? cleanType : `${cleanType} по ${cleanSubject}`;
    } else if (cleanSubject && trusted && !hasControlTestEvidence(title, true) && title.toLowerCase() === cleanSubject.toLowerCase()) {
      title = `Контролно по ${cleanSubject}`;
    }
    return title;
  }

  function normalizeExam(object, pathHint = '', trusted = false) {
    if (!object || typeof object !== 'object' || Array.isArray(object)) return null;
    const isTrusted = Boolean(trusted || /controltest|getcontroltests/i.test(String(pathHint || '')));
    const subjectObj = valueOf(object, ['subjectName', 'subject_name', 'course', 'courseName', 'discipline', 'subject']);
    const parsedSubject = nameOf(subjectObj);
    const typeName = nameOf(valueOf(object, ['type', 'typeName', 'type_name', 'category', 'categoryName', 'controlTestType', 'control_test_type']));
    const rawTitle = nameOf(valueOf(object, ['title', 'name', 'exam', 'controlTest', 'topic', 'theme', 'description', 'text']));
    const title = buildExamTitle(rawTitle, parsedSubject, typeName, isTrusted);
    if (!title || title.length < 3) return null;
    if (/^(?:дата|час|предмет|контролно|изпит|тест|вид|бележка)$/iu.test(title)) return null;

    const evidence = [
      title,
      typeName,
      stripHtml(valueOf(object, ['description', 'text', 'note', 'notes']))
    ].filter(Boolean).join(' ');
    const rawUrl = urlOf(valueOf(object, ['url', 'link', 'href']));
    if (!isTrusted && NON_EXAM_EVENT_EVIDENCE.test(evidence)) return null;
    if (!isTrusted && !hasControlTestEvidence(evidence, false)
      && !(isControlTestUrl(rawUrl) && hasControlTestEvidence(evidence, true))) return null;
    if (isTrusted && !hasControlTestEvidence(evidence, true) && !parsedSubject && !isControlTestUrl(rawUrl)) return null;

    const rawDate = valueOf(object, ['date', 'dateTime', 'date_time', 'forDate', 'scheduledFor', 'start', 'startDate', 'start_date', 'when', 'day']);
    const rawTime = valueOf(object, ['time', 'hour', 'startTime', 'start_time', 'begin']);
    const periodNumber = parsePeriodNumber(
      valueOf(object, ['period', 'periodNumber', 'period_number', 'lessonNumber', 'lesson_number', 'hourNumber', 'hour_number', 'slot']) || rawTime
    );
    const dt = parseDateTime(rawDate, rawTime);
    if (!dt.date || dt.date < currentSchoolYearStartInSofia()) return null;

    const explicitTime = dt.time || '';
    if (!explicitTime && !isTrusted && !periodNumber) return null;
    const finalTime = explicitTime || (periodNumber ? DEFAULT_PERIOD_TIMES[periodNumber] : '08:00');
    const timeEstimated = !explicitTime;

    const subject = parsedSubject || examSubjectFromTitle(title);
    // Профилните/учителските линкове не са контролно и не се пазят.
    const url = (rawUrl && isControlTestUrl(rawUrl)) ? rawUrl : '';
    const externalId = space(valueOf(object, ['externalId', 'external_id', 'id', 'controlTestId', 'control_test_id', 'testId', 'test_id', 'uuid', 'code', 'key']));
    const exam = {
      subject: (subject || title).slice(0, 120),
      title: title.slice(0, 240),
      date: dt.date,
      time: finalTime,
      dateTime: `${dt.date}T${finalTime}`,
      timeEstimated,
      fromControlTests: isTrusted,
      externalId: externalId.slice(0, 220),
      url
    };
    if (periodNumber > 0) exam.periodNumber = periodNumber;
    return exam;
  }

  function examChronologicalKey(exam) {
    const date = String(exam?.date || '9999-12-31').slice(0, 10);
    const tm = /^(\d{1,2}):(\d{2})/.exec(String(exam?.time || ''));
    const hhmm = tm ? `${tm[1].padStart(2, '0')}:${tm[2]}` : '23:59';
    return `${date}T${hhmm}`;
  }

  function sortExamsAscending(items) {
    return (Array.isArray(items) ? items.slice() : []).sort((a, b) => {
      const byTime = examChronologicalKey(a).localeCompare(examChronologicalKey(b));
      if (byTime) return byTime;
      const byPeriod = Number(a?.periodNumber || 0) - Number(b?.periodNumber || 0);
      if (byPeriod) return byPeriod;
      return String(a?.title || a?.subject || '').localeCompare(String(b?.title || b?.subject || ''), 'bg');
    });
  }

  function dedupeExams(items) {
    const minExamDate = currentSchoolYearStartInSofia();
    const map = new Map();
    for (const item of items) {
      if (!item || !item.title || !item.date || !item.time) continue;
      if (item.date < minExamDate) continue;
      const key = item.externalId
        ? `id:${item.externalId}`
        : `content:${hash(`${item.subject || ''}|${item.title}|${item.date}|${item.periodNumber || item.time}`)}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { ...item });
      } else {
        map.set(key, {
          ...existing,
          ...item,
          subject: (item.subject && item.subject.length >= (existing.subject || '').length) ? item.subject : existing.subject,
          title: (item.title && item.title.length >= (existing.title || '').length) ? item.title : existing.title,
          time: !item.timeEstimated ? item.time : (!existing.timeEstimated ? existing.time : item.time),
          dateTime: !item.timeEstimated ? item.dateTime : (!existing.timeEstimated ? existing.dateTime : item.dateTime),
          timeEstimated: Boolean(item.timeEstimated && existing.timeEstimated),
          periodNumber: item.periodNumber || existing.periodNumber || undefined,
          fromControlTests: Boolean(item.fromControlTests || existing.fromControlTests),
          url: item.url || existing.url || ''
        });
      }
    }
    return sortExamsAscending(Array.from(map.values())).slice(0, 500);
  }

  function examTitleFromText(value, trusted = false) {
    const text = space(value);
    const match = /((?:контролн[ао]?(?:\s+работа)?|класн[ао](?:\s+работа)?|самостоятелна\s+работа|входно\s+ниво|изходно\s+ниво|тематична\s+проверка|практическо\s+изпитване|писмено\s+изпитване|изпит(?:ване)?|тест|control\s*test|exam|test|quiz)[^|,;\n]{0,120})/iu.exec(text);
    if (!match || !hasControlTestEvidence(match[1], trusted)) return '';
    return space(match[1]
      .replace(/\b\d{1,2}[.\/-]\d{1,2}(?:[.\/-]\d{2,4})?\b/gu, ' ')
      .replace(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/gu, ' ')
      .replace(/\s+(?:от|в|на|учител|преподавател|teacher)\s*$/iu, ''));
  }

  function examTableColumnMap(row) {
    const table = row?.closest?.('table');
    if (!table) return null;
    const rows = Array.from(table.querySelectorAll('tr'));
    const headerRow = rows.find(r => r.querySelectorAll('th').length >= 2) || (rows[0]?.querySelector('th') ? rows[0] : null);
    if (!headerRow || headerRow === row) return null;
    const headers = Array.from(headerRow.querySelectorAll('td, th')).map(c => readableText(c).toLocaleLowerCase('bg'));
    const createdCol = headers.findIndex(h => /(?:добавен|въведен|създаден|актуализиран)/.test(h));
    const dateCol = headers.findIndex((h, idx) => idx !== createdCol && /(?:дата|ден|провеждан|date|when)/.test(h));
    const timeCol = headers.findIndex(h => /(?:начал|час|време|time|hour)/.test(h));
    const periodCol = headers.findIndex(h => /(?:час\s*№|пореден\s*час|учебен\s*час|period|lesson)/.test(h));
    const subjectCol = headers.findIndex(h => /(?:предмет|дисциплин|subject|course)/.test(h));
    const typeCol = headers.findIndex(h => /(?:вид|тип|категор|type|category)/.test(h));
    return { headers, createdCol, dateCol, timeCol, periodCol, subjectCol, typeCol };
  }

  function extractExamChildBlocks(row) {
    if (!row || !row.children) return [];
    let children = Array.from(row.children);
    // Single outer wrapper inside a controlTestBody entry -> unwrap once.
    while (children.length === 1 && children[0].children && children[0].children.length >= 2) {
      children = Array.from(children[0].children);
    }
    if (children.length >= 2) return children;
    const leafCandidates = row.querySelectorAll
      ? Array.from(row.querySelectorAll('a, span, small, strong, div, p')).filter(el => {
        const hasChildEls = el.children && Array.from(el.children).some(ch => readableText(ch).length >= 2);
        return !hasChildEls && readableText(el).length > 0;
      })
      : [];
    return leafCandidates;
  }

  function isRealControlTestHref(href) {
    const raw = String(href || '');
    if (!raw || raw === '#' || /^javascript:/i.test(raw)) return false;
    if (/\/(?:logout|login|profile|settings|notifications|messages)\b/i.test(raw)) return false;
    if (/\/(?:teacher|user)\//i.test(raw)) return false;
    if (/\/pupil\/\d+(?:\/profile)?\/?$/i.test(raw)) return false;
    return isControlTestUrl(raw) || /\/diary\/(?:pupil\/\d+\/)?(?:control[-_]?tests?|shi\/(?:control[-_]?test|test))\b/i.test(raw);
  }

  function parseExamRowElement(row, trustedControlResponse = false) {
    if (!row || typeof row.textContent !== 'string') return null;
    if (row.closest && row.closest('thead')) return null;
    const cells = row.querySelectorAll ? Array.from(row.querySelectorAll('td, th')) : [];
    if (cells.length && cells.every(cell => cell.tagName === 'TH')) return null;

    const text = space(row.textContent);
    if (text.length < 4 || text.length > 1400) return null;

    const links = row.querySelectorAll ? Array.from(row.querySelectorAll('a[href]')) : [];
    const controlLinks = links.filter(link => isRealControlTestHref(link.href || link.getAttribute('href')));
    const nonNavLinks = links.filter(link => !/\/(?:logout|login|profile|settings|notifications|messages)\b/i.test(link.href || link.getAttribute('href') || ''));
    if (!trustedControlResponse && !controlLinks.length && !hasControlTestEvidence(text, false)) return null;
    if (!trustedControlResponse && !controlLinks.length && nonNavLinks.some(link => /\/(?:teacher|user)\/|\/pupil\/\d+(?:\/profile)?\/?$/i.test(link.href || link.getAttribute('href') || ''))) return null;

    const minExamDate = currentSchoolYearStartInSofia();
    const colMap = cells.length ? examTableColumnMap(row) : null;
    const blocks = cells.length ? cells : extractExamChildBlocks(row);
    let date = '';
    let fallbackPastDate = '';
    let time = '';
    let periodNumber = 0;
    let subject = '';
    let typeName = '';
    let cellTitle = '';

    if (colMap && colMap.dateCol >= 0 && blocks[colMap.dateCol]) {
      const colDate = cellDateCandidate(blocks[colMap.dateCol], minExamDate);
      if (colDate && colDate >= minExamDate) date = colDate;
      else if (colDate) fallbackPastDate = colDate;
    }

    for (let idx = 0; idx < blocks.length; idx += 1) {
      const cell = blocks[idx];
      const cellText = space(cell.textContent);
      if (!cellText || cellText.length > 300) continue;
      if (!date && (!colMap || idx !== colMap.createdCol)) {
        const d = cellDateCandidate(cell, minExamDate);
        if (d && d >= minExamDate) date = d;
        else if (d && !fallbackPastDate) fallbackPastDate = d;
      }
      if (!time && (!colMap || colMap.timeCol < 0 || idx === colMap.timeCol)) {
        const t = parseTime(cellText);
        if (t) time = t;
      }
      if (!periodNumber) {
        const p = parsePeriodNumber(cellText);
        if (p) periodNumber = p;
      }
      if (colMap && colMap.subjectCol === idx && !subject && !looksLikePersonName(cellText)) {
        subject = cellText;
      }
      if (colMap && colMap.typeCol === idx && hasControlTestEvidence(cellText, true) && !typeName) {
        typeName = cellText;
      }
      const cleanedNoDate = space(cellText
        .replace(/\b\d{4}-\d{2}-\d{2}\b/gu, ' ')
        .replace(/\b\d{1,2}[.\/-]\d{1,2}(?:[.\/-]\d{2,4})?\b/gu, ' ')
        .replace(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/gu, ' '));
      if (!cleanedNoDate || /^\d{1,2}\s*(?:час|ч\.?)?$/iu.test(cleanedNoDate)) continue;
      if (looksLikePersonName(cleanedNoDate)) continue;
      if (hasControlTestEvidence(cleanedNoDate, true)) {
        if (GENERIC_EXAM_TITLE.test(cleanedNoDate)) typeName = typeName || cleanedNoDate;
        else if (!cellTitle || cleanedNoDate.length > cellTitle.length) cellTitle = cleanedNoDate;
      } else if (!subject && !/^(?:дата|час|предмет|учител|вид|описание|бележка)$/iu.test(cleanedNoDate)) {
        subject = cleanedNoDate;
      }
    }

    if (!date) date = parseTargetDate(text, minExamDate) || fallbackPastDate;
    if (!date || date < minExamDate) return null;
    if (!time) time = parseTime(text);
    if (!periodNumber) periodNumber = parsePeriodNumber(text);

    const hasEvidence = hasControlTestEvidence(text, trustedControlResponse) || Boolean(controlLinks.length);
    if (!hasEvidence && !trustedControlResponse) return null;
    if (!hasEvidence && trustedControlResponse && !subject && !cellTitle) return null;

    const link = controlLinks[0] || nonNavLinks[0] || null;
    let linkHref = link ? urlOf(link.href || link.getAttribute('href')) : '';
    const keepUrl = isRealControlTestHref(linkHref) ? linkHref : '';
    let linkTitle = link ? readableText(link) : '';
    if (linkTitle && !hasControlTestEvidence(linkTitle, trustedControlResponse)) linkTitle = '';
    const rawTitle = cellTitle || linkTitle || examTitleFromText(text, trustedControlResponse) || typeName;
    if (!rawTitle && !trustedControlResponse) return null;

    const rawSubject = subject || (!rawTitle && link ? readableText(link) : '');
    const safeSubject = stripTrailingPersonName(rawSubject) || rawSubject;
    return normalizeExam({
      subject: safeSubject,
      typeName,
      title: rawTitle || safeSubject,
      date,
      time,
      period: periodNumber || undefined,
      url: keepUrl,
      externalId: keepUrl || row.dataset?.controlTestId || row.dataset?.id || ''
    }, trustedControlResponse ? 'controltest' : 'diary', trustedControlResponse);
  }

  function extractControlTestBodyItems(scope, trustedControlResponse, result) {
    if (!scope || !scope.children) return;
    const candidateItems = [];
    const twList = scope.children?.[1]?.children?.[1];
    if (twList && twList.children && twList.children.length) {
      for (const ch of Array.from(twList.children)) candidateItems.push(ch);
    }
    // Generic div-list detection inside .controlTestBody when Shkolo wraps tests in plain <div> rows.
    const divs = scope.querySelectorAll ? Array.from(scope.querySelectorAll('div, ul')) : [];
    for (const box of divs) {
      const children = Array.from(box.children || []);
      if (children.length < 1 || children.length > 200) continue;
      const datedChildren = children.filter(ch => {
        const t = space(ch.textContent);
        return t.length >= 6 && t.length <= 1400 && Boolean(parseTargetDate(t));
      });
      if (datedChildren.length >= 1) {
        for (const ch of datedChildren) {
          const subDated = Array.from(ch.children || []).filter(sub => parseTargetDate(space(sub.textContent)));
          if (subDated.length >= 2) {
            for (const sub of subDated) candidateItems.push(sub);
          } else {
            candidateItems.push(ch);
          }
        }
      }
    }
    const seenNodes = new Set();
    for (const itemNode of candidateItems) {
      if (seenNodes.has(itemNode)) continue;
      seenNodes.add(itemNode);
      if (itemNode.querySelector && itemNode.querySelector('tr, .controlTestRow, .control-test-row, [data-control-test-id]')) {
        continue;
      }
      const exam = parseExamRowElement(itemNode, trustedControlResponse || scope.classList?.contains?.('controlTestBody'));
      if (exam) result.push(exam);
    }
    // Single-panel .controlTestBody fallback (e.g. one .controlTestBody card per test)
    if (!result.length && scope.classList?.contains?.('controlTestBody') && parseTargetDate(space(scope.textContent))) {
      const children = Array.from(scope.children || []);
      const target = (children.length === 1 && children[0].children?.length >= 2) ? children[0] : scope;
      const exam = parseExamRowElement(target, true);
      if (exam) result.push(exam);
    }
  }

  function examRowsFromScope(scope, trustedControlResponse, result) {
    const rowSelector = trustedControlResponse
      ? 'tr, li, .controlTestRow, .control-test-row, .controlTest, .control-test, [data-control-test-id], .row, .card, .list-group-item, .feed-element, .timeline-item'
      : 'tr, li, .controlTestRow, .control-test-row, .controlTest, .control-test, .row';
    const candidates = Array.from(scope.querySelectorAll(rowSelector));
    for (const row of candidates) {
      if (row.tagName !== 'TR' && row.querySelector?.('tr, .controlTestRow, .control-test-row, [data-control-test-id]')) {
        continue;
      }
      const exam = parseExamRowElement(row, trustedControlResponse);
      if (exam) result.push(exam);
    }
    extractControlTestBodyItems(scope, trustedControlResponse, result);
  }

  function extractExamsFromDocument(documentValue, trustedControlResponse = false) {
    if (!documentValue || typeof documentValue.querySelectorAll !== 'function') return [];
    const result = [];
    const scopes = Array.from(documentValue.querySelectorAll('.controlTestBody, #tab_control_test, #tab_control_tests, [id*="control_test" i], [id*="controlTest" i], [class*="controlTest" i], [class*="control-test" i]'));
    if (!scopes.length) {
      // Цялата страница се сканира само когато това е доверен отговор за
      // контролно. Dashboard/табло не може да поражда изпити.
      if (!trustedControlResponse) return [];
      scopes.push(documentValue);
    }
    for (const scope of scopes) examRowsFromScope(scope, trustedControlResponse, result);

    if (trustedControlResponse) {
      for (const table of Array.from(documentValue.querySelectorAll('table'))) {
        for (const row of Array.from(table.querySelectorAll('tr'))) {
          const exam = parseExamRowElement(row, true);
          if (exam) result.push(exam);
        }
      }
    }

    return dedupeExams(result);
  }

  function extractExamsFromJson(value, trustedControlResponse = true) {
    let parsed = value;
    if (typeof value === 'string') {
      const text = value.trim();
      if (!text) return [];
      if (/^[\[{]/.test(text)) {
        try { parsed = JSON.parse(text); } catch (_) {
          return /<(table|div|li|tr|ul|html)/i.test(text)
            ? extractExamsFromDocument(parseHtmlDocument(text), trustedControlResponse)
            : [];
        }
      } else if (/<(table|div|li|tr|ul|html)/i.test(text)) {
        return extractExamsFromDocument(parseHtmlDocument(text), trustedControlResponse);
      } else {
        return [];
      }
    }
    const result = [];
    const walk = (node, path, depth) => {
      if (depth > 9 || result.length >= 200 || node === null || node === undefined) return;
      if (typeof node === 'string') {
        const text = node.trim();
        if (text.length < 8) return;
        if (/^[\[{]/.test(text)) {
          try { walk(JSON.parse(text), path, depth + 1); } catch (_) {}
        } else if (/<(table|div|li|tr|ul|html)/i.test(text)) {
          result.push(...extractExamsFromDocument(parseHtmlDocument(text), trustedControlResponse));
        }
        return;
      }
      if (Array.isArray(node)) {
        for (const child of node.slice(0, 250)) walk(child, path, depth + 1);
        return;
      }
      if (typeof node !== 'object') return;
      const examPath = trustedControlResponse
        || /(control|test|exam|изпит|контрол)/i.test(path)
        || hasKey(node, /control|test|exam|изпит|контрол/i);
      if (examPath) {
        const exam = normalizeExam(node, `${path}${trustedControlResponse ? ' controltest' : ''}`, trustedControlResponse);
        if (exam) result.push(exam);
      }
      for (const [key, child] of Object.entries(node)) {
        if (child && (typeof child === 'object' || typeof child === 'string')) walk(child, `${path}.${key}`, depth + 1);
      }
    };
    walk(parsed, '', 0);
    return dedupeExams(result);
  }

  function extractFromJson(value) {
    let parsed = value;
    if (typeof value === 'string') {
      const text = value.trim();
      if (!text) return [];
      if (/^[\[{]/.test(text)) {
        try { parsed = JSON.parse(text); } catch (_) { return /<(table|div|li|html)/i.test(text) ? extractFromDocument(parseHtmlDocument(text)) : extractFromText(text); }
      } else if (/<(table|div|li|html)/i.test(text)) {
        return extractFromDocument(parseHtmlDocument(text));
      } else {
        return extractFromText(text);
      }
    }
    const result = [];
    const walk = (node, path, depth) => {
      if (depth > 9 || result.length >= 200 || node === null || node === undefined) return;
      if (typeof node === 'string') {
        const text = node.trim();
        if (text.length < 8) return;
        if (/^[\[{]/.test(text)) {
          try { walk(JSON.parse(text), path, depth + 1); } catch (_) {}
        } else if (/<(table|div|li|html)/i.test(text) && /(домашн|homework|задач|assignment)/i.test(text)) {
          if (!isRemarkPath(path)) result.push(...extractFromDocument(parseHtmlDocument(text)));
        }
        return;
      }
      if (Array.isArray(node)) {
        for (const child of node.slice(0, 250)) walk(child, path, depth + 1);
        return;
      }
      if (typeof node !== 'object') return;
      const pathHint = /(homework|domash|task|assignment|домашн|задач)/i.test(path);
      const homeworkSignal = pathHint || hasKey(node, /homework|domash|task|assignment/i);
      const remarkKeySignal = hasKey(node, /feedback|remark|review|comment|otziv|забележ|похвал|отзив|badge/i);
      const remarkPath = isRemarkPath(path) || (remarkKeySignal && !homeworkSignal);
      if (!remarkPath && looksLikeHomework(node, pathHint)) {
        const item = normalize(node, pathHint);
        if (item) result.push(item);
      }
      for (const [key, child] of Object.entries(node)) {
        if (child && (typeof child === 'object' || typeof child === 'string')) {
          walk(child, `${path}.${key}`, depth + 1);
        }
      }
    };
    walk(parsed, '', 0);
    return dedupe(result);
  }

  const SCHEDULE_WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  const SCHEDULE_WEEKDAY_PATTERNS = [
    /(?:^|[^\p{L}])(?:понеделник|пон\.?|monday|mon\.?)(?:[^\p{L}]|$)/iu,
    /(?:^|[^\p{L}])(?:вторник|вт\.?|tuesday|tue\.?)(?:[^\p{L}]|$)/iu,
    /(?:^|[^\p{L}])(?:сряда|ср\.?|wednesday|wed\.?)(?:[^\p{L}]|$)/iu,
    /(?:^|[^\p{L}])(?:четвъртък|четв?\.?|thursday|thu\.?)(?:[^\p{L}]|$)/iu,
    /(?:^|[^\p{L}])(?:петък|пет\.?|friday|fri\.?)(?:[^\p{L}]|$)/iu
  ];
  const FREE_SLOT_RE = /^(?:свободен\s+час|свободен|прозорец|няма\s+час|без\s+час|free|none|[-–—.\s]+)$/iu;

  function weekdayNameFromValue(value) {
    if (typeof value === 'number' && Number.isInteger(value)) {
      if (value >= 1 && value <= 5) return SCHEDULE_WEEKDAYS[value - 1];
      return '';
    }
    const text = space(String(value || ''));
    if (!text) return '';
    if (/^[1-5]$/.test(text)) return SCHEDULE_WEEKDAYS[Number(text) - 1];
    for (let i = 0; i < SCHEDULE_WEEKDAY_PATTERNS.length; i += 1) {
      if (SCHEDULE_WEEKDAY_PATTERNS[i].test(text)) return SCHEDULE_WEEKDAYS[i];
    }
    return '';
  }

  function weekdayNameFromDateIso(isoDate) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate || '').trim());
    if (!m) return '';
    const utcMidday = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0));
    const short = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Sofia', weekday: 'short' }).format(utcMidday);
    return ({ Mon: 'monday', Tue: 'tuesday', Wed: 'wednesday', Thu: 'thursday', Fri: 'friday' })[short] || '';
  }

  function timeToMinutes(hhmm) {
    const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(hhmm || '').trim());
    return m ? (Number(m[1]) * 60 + Number(m[2])) : -1;
  }

  function minutesToTime(totalMinutes) {
    if (!Number.isFinite(totalMinutes) || totalMinutes < 0) return '';
    const clamped = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
    return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
  }

  function parseTimeRange(value) {
    const raw = space(value);
    if (!raw) return { startTime: '', endTime: '' };
    const rangeMatch = /([01]?\d|2[0-3]):([0-5]\d)\s*[-–—]\s*([01]?\d|2[0-3]):([0-5]\d)/.exec(raw);
    if (rangeMatch) {
      return {
        startTime: `${rangeMatch[1].padStart(2, '0')}:${rangeMatch[2]}`,
        endTime: `${rangeMatch[3].padStart(2, '0')}:${rangeMatch[4]}`
      };
    }
    const single = parseTime(raw);
    return { startTime: single || '', endTime: '' };
  }

  function cleanScheduleSubject(raw) {
    let text = space(String(raw || ''))
      .replace(/^\d{1,2}\s*(?:(?:[-.]?\s*(?:ти|ви|ри|ми|и)\s+)?(?:учебен\s+)?(?:час|ч\.?)(?!\p{L})|[.)]|\s+(?=[\p{Lu}(]))\s*/iu, '')
      .replace(/\b(?:[01]?\d|2[0-3]):[0-5]\d(?:\s*[-–—]\s*(?:[01]?\d|2[0-3]):[0-5]\d)?\b/gu, ' ')
      .replace(/\b(?:каб(?:инет)?|стая|зала|сграда|корпус)\s*[.:№#-]?\s*[\dА-Яа-яA-Za-z-]{1,12}\b/giu, ' ')
      .replace(/\(\s*\)/g, ' ');
    text = stripTrailingPersonName(space(text));
    text = space(text);
    if (!text || text.length < 2) return '';
    if (FREE_SLOT_RE.test(text)) return '';
    if (/^(?:час|предмет|понеделник|вторник|сряда|четвъртък|петък|време|междучасие)$/iu.test(text)) return '';
    if (looksLikePersonName(text)) return '';
    return text.slice(0, 120);
  }

  function extractSubjectFromCellElement(cell) {
    if (!cell || typeof cell.querySelector !== 'function') return cleanScheduleSubject(cell?.textContent || '');
    const preferred = cell.querySelector('.courseName, .course-name, .subjectName, .subject-name, .subject, .discipline, strong, b, a[href*="/course" i]');
    if (preferred) {
      const candidate = cleanScheduleSubject(preferred.textContent);
      if (candidate) return candidate;
    }
    const htmlLines = String(cell.innerHTML || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(?:div|p|li|span|strong|b|a)>/gi, '\n')
      .split('\n');
    for (const part of htmlLines) {
      const plain = stripHtml(part);
      const cleaned = cleanScheduleSubject(plain);
      if (cleaned) return cleaned;
    }
    return cleanScheduleSubject(cell.textContent);
  }

  function deriveScheduleConfig(days) {
    if (!days || typeof days !== 'object') return null;
    const classDurations = [];
    const breaksAfterPeriod = new Map();
    let maxPeriods = 0;
    let firstPeriodStart = '';

    for (const day of SCHEDULE_WEEKDAYS) {
      const slots = Array.isArray(days[day]) ? days[day] : [];
      if (slots.length > maxPeriods) maxPeriods = slots.length;
      for (let idx = 0; idx < slots.length; idx += 1) {
        const slot = slots[idx];
        if (!slot || !slot.subject) continue;
        const sMin = timeToMinutes(slot.startTime);
        const eMin = timeToMinutes(slot.endTime);
        if (idx === 0 && sMin >= 0 && (!firstPeriodStart || sMin < timeToMinutes(firstPeriodStart))) {
          firstPeriodStart = minutesToTime(sMin);
        }
        if (sMin >= 0 && eMin > sMin && (eMin - sMin) >= 20 && (eMin - sMin) <= 90) {
          classDurations.push(eMin - sMin);
        }
        const next = slots[idx + 1];
        if (next && eMin >= 0) {
          const nextStart = timeToMinutes(next.startTime);
          const gap = nextStart - eMin;
          if (gap >= 0 && gap <= 45) {
            const pNum = idx + 1;
            if (!breaksAfterPeriod.has(pNum)) breaksAfterPeriod.set(pNum, []);
            breaksAfterPeriod.get(pNum).push(gap);
          }
        }
      }
    }

    if (!firstPeriodStart && !classDurations.length) return null;
    const sortedDur = classDurations.slice().sort((a, b) => a - b);
    const classMinutes = sortedDur.length ? sortedDur[Math.floor(sortedDur.length / 2)] : 40;

    const avgBreaks = [];
    for (const [periodNum, gaps] of breaksAfterPeriod.entries()) {
      const sorted = gaps.slice().sort((a, b) => a - b);
      avgBreaks.push({ periodNum, gap: sorted[Math.floor(sorted.length / 2)] });
    }
    avgBreaks.sort((a, b) => a.periodNum - b.periodNum);
    const smallBreaks = avgBreaks.map(b => b.gap).sort((a, b) => a - b);
    const smallBreakMinutes = smallBreaks.length ? smallBreaks[0] : 10;
    const bigEntry = avgBreaks.find(b => b.gap >= smallBreakMinutes + 5);
    const bigBreakMinutes = bigEntry ? bigEntry.gap : Math.max(smallBreakMinutes, 20);
    const bigBreakAfter = bigEntry ? bigEntry.periodNum : 3;

    if (!firstPeriodStart) {
      // Extrapolate period 1 start time from earliest known slot if period 1 has no timestamp.
      let earliestKnown = null;
      for (const day of SCHEDULE_WEEKDAYS) {
        const slots = Array.isArray(days[day]) ? days[day] : [];
        for (let idx = 0; idx < slots.length; idx += 1) {
          const sMin = timeToMinutes(slots[idx]?.startTime);
          if (sMin >= 0 && (!earliestKnown || sMin < earliestKnown.sMin)) {
            earliestKnown = { idx, sMin };
          }
        }
      }
      if (earliestKnown) {
        const est = earliestKnown.sMin - earliestKnown.idx * (classMinutes + smallBreakMinutes);
        firstPeriodStart = minutesToTime(est >= 360 ? est : 480);
      }
    }

    return {
      startTime: firstPeriodStart || '08:00',
      classMinutes,
      smallBreakMinutes,
      bigBreakMinutes,
      bigBreakAfter,
      periods: Math.max(1, Math.min(12, maxPeriods || 7))
    };
  }

  function buildNormalizedSchedule(daySlotsMap) {
    const days = {};
    let totalSubjects = 0;
    let maxPeriods = 0;

    for (const day of SCHEDULE_WEEKDAYS) {
      const slotMap = daySlotsMap[day];
      if (!slotMap || !slotMap.size) {
        days[day] = [];
        continue;
      }
      let lastNonEmpty = -1;
      for (const [idx, slot] of slotMap.entries()) {
        if (idx >= 0 && idx < 12 && slot && slot.subject && idx > lastNonEmpty) {
          lastNonEmpty = idx;
        }
      }
      const list = [];
      for (let i = 0; i <= lastNonEmpty; i += 1) {
        const slot = slotMap.get(i);
        if (slot && slot.subject) {
          totalSubjects += 1;
          const entry = {
            subject: slot.subject.slice(0, 120),
            hasExam: Boolean(slot.hasExam)
          };
          if (slot.startTime) entry.startTime = slot.startTime;
          if (slot.endTime) entry.endTime = slot.endTime;
          list.push(entry);
        } else {
          list.push({ subject: '', hasExam: false });
        }
      }
      days[day] = list;
      if (list.length > maxPeriods) maxPeriods = list.length;
    }

    if (totalSubjects === 0) return null;
    const scheduleConfig = deriveScheduleConfig(days);
    return {
      days,
      totalSubjects,
      periods: maxPeriods,
      scheduleConfig,
      capturedAt: new Date().toISOString()
    };
  }

  function createDaySlotMaps() {
    const map = {};
    for (const day of SCHEDULE_WEEKDAYS) map[day] = new Map();
    return map;
  }

  function putDaySlot(daySlotsMap, day, periodIdx0, candidate) {
    if (!day || !(periodIdx0 >= 0 && periodIdx0 < 12) || !candidate) return;
    const subject = cleanScheduleSubject(candidate.subject);
    if (!subject && !candidate.startTime) return;
    const existing = daySlotsMap[day].get(periodIdx0);
    if (!existing) {
      daySlotsMap[day].set(periodIdx0, {
        subject,
        hasExam: Boolean(candidate.hasExam),
        startTime: candidate.startTime || '',
        endTime: candidate.endTime || ''
      });
      return;
    }
    daySlotsMap[day].set(periodIdx0, {
      subject: existing.subject || subject,
      hasExam: Boolean(existing.hasExam || candidate.hasExam),
      startTime: existing.startTime || candidate.startTime || '',
      endTime: existing.endTime || candidate.endTime || ''
    });
  }

  function extractScheduleFromTable(table) {
    if (!table || typeof table.querySelectorAll !== 'function') return null;
    if (table.closest && table.closest('.controlTestBody, #tab_control_test, #tab_control_tests, #tab_homeworks, .homeworkBody, #tab_feedbacks')) {
      return null;
    }
    const rows = Array.from(table.querySelectorAll('tr'));
    if (rows.length < 2) return null;

    // Strategy A: column headers contain weekday names.
    let headerRowIdx = -1;
    let colToDay = null;
    for (let r = 0; r < Math.min(3, rows.length); r += 1) {
      const cells = Array.from(rows[r].querySelectorAll('th, td'));
      const candidateCols = new Map();
      for (let c = 0; c < cells.length; c += 1) {
        const day = weekdayNameFromValue(cells[c].textContent);
        if (day && !Array.from(candidateCols.values()).includes(day)) {
          candidateCols.set(c, day);
        }
      }
      if (candidateCols.size >= 2) {
        headerRowIdx = r;
        colToDay = candidateCols;
        break;
      }
    }

    if (colToDay) {
      const daySlots = createDaySlotMaps();
      let seqPeriod = 0;
      for (let r = headerRowIdx + 1; r < rows.length; r += 1) {
        const cells = Array.from(rows[r].querySelectorAll('th, td'));
        if (!cells.length) continue;
        let rowPeriod = 0;
        let rowRange = { startTime: '', endTime: '' };
        const firstDayCol = Math.min(...Array.from(colToDay.keys()));
        for (let c = 0; c < firstDayCol && c < cells.length; c += 1) {
          const cellText = space(cells[c].textContent);
          if (!rowPeriod) rowPeriod = parsePeriodNumber(cellText);
          if (!rowRange.startTime) rowRange = parseTimeRange(cellText);
        }
        const periodIdx0 = rowPeriod ? (rowPeriod - 1) : seqPeriod;
        seqPeriod = Math.max(seqPeriod + 1, periodIdx0 + 1);
        if (periodIdx0 < 0 || periodIdx0 >= 12) continue;

        for (const [colIdx, day] of colToDay.entries()) {
          const cell = cells[colIdx];
          if (!cell) continue;
          const rawText = space(cell.textContent);
          if (!rawText) continue;
          const cellRange = parseTimeRange(rawText);
          const subject = extractSubjectFromCellElement(cell);
          if (!subject) continue;
          const hasExam = Boolean(
            cell.querySelector('.controlTest, .control-test, [class*="controlTest" i], [class*="exam" i]')
            || /(?:контролн|изпит|тест)/iu.test(rawText)
          );
          putDaySlot(daySlots, day, periodIdx0, {
            subject,
            hasExam,
            startTime: cellRange.startTime || rowRange.startTime,
            endTime: cellRange.endTime || rowRange.endTime
          });
        }
      }
      const normalized = buildNormalizedSchedule(daySlots);
      if (normalized) return normalized;
    }

    // Strategy B: vertical sections inside a table (day heading rows followed by period rows).
    const daySlotsVertical = createDaySlotMaps();
    let currentDay = '';
    let seqIdx = 0;
    let foundDayHeaders = 0;
    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll('th, td'));
      if (!cells.length) continue;
      if (cells.length <= 2) {
        const maybeDay = weekdayNameFromValue(cells[0].textContent);
        if (maybeDay && space(cells[0].textContent).length <= 40) {
          currentDay = maybeDay;
          seqIdx = 0;
          foundDayHeaders += 1;
          continue;
        }
      }
      const cellDay = weekdayNameFromValue(cells[0].textContent);
      let startCellIdx = 0;
      if (cellDay && cells.length >= 2) {
        if (cellDay !== currentDay) {
          currentDay = cellDay;
          seqIdx = 0;
          foundDayHeaders += 1;
        }
        startCellIdx = 1;
      }
      if (!currentDay) continue;
      const rowText = space(row.textContent);
      const pNum = parsePeriodNumber(cells[startCellIdx]?.textContent || rowText);
      const pIdx = pNum ? (pNum - 1) : seqIdx;
      seqIdx = Math.max(seqIdx + 1, pIdx + 1);
      const range = parseTimeRange(rowText);
      let subject = '';
      for (let c = startCellIdx; c < cells.length; c += 1) {
        const candidate = extractSubjectFromCellElement(cells[c]);
        if (candidate) { subject = candidate; break; }
      }
      if (subject) {
        putDaySlot(daySlotsVertical, currentDay, pIdx, {
          subject,
          hasExam: /(?:контролн|изпит|тест)/iu.test(rowText),
          startTime: range.startTime,
          endTime: range.endTime
        });
      }
    }
    if (foundDayHeaders >= 2) return buildNormalizedSchedule(daySlotsVertical);
    return null;
  }

  function unwrapScheduleSlotNodes(body, heading) {
    let slotNodes = Array.from(body?.children || []).filter(el => el !== heading);
    while (slotNodes.length === 1 && slotNodes[0].children?.length >= 1) {
      const children = Array.from(slotNodes[0].children);
      if (children.length === 1 && children[0].children?.length >= 1) {
        slotNodes = children;
        continue;
      }
      if (children.length >= 2) {
        const timedChildren = children.filter(ch => /\d{1,2}:\d{2}/.test(space(ch.textContent)));
        if (timedChildren.length >= 2) {
          slotNodes = children;
          continue;
        }
      }
      break;
    }
    return slotNodes;
  }

  function extractSubjectFromScheduleSlot(slot) {
    let subject = '';
    let detailContainer = slot;
    while (detailContainer.children?.length === 1 && detailContainer.children[0].children?.length >= 1) {
      detailContainer = detailContainer.children[0];
    }
    const collectLeafParts = (node, depth = 0) => {
      if (!node || depth > 4) return [];
      const cls = String(node.className || node.getAttribute?.('class') || '');
      if (/(?:^|\s)(?:controlTest|control-test|hasExam|tooltip|badge|icon)(?:\s|$)/i.test(cls)) return [];
      const kids = Array.from(node.children || []);
      if (!kids.length) {
        const txt = readableText(node);
        return txt ? [txt] : [];
      }
      const out = [];
      for (const ch of kids) out.push(...collectLeafParts(ch, depth + 1));
      return out;
    };
    const detailParts = collectLeafParts(detailContainer);
    const specificEl = slot.querySelector?.('.course-name, .courseName, .subject, .subject-name, .subjectName, a[href*="/course/"]');
    if (specificEl) {
      subject = cleanScheduleSubject(readableText(specificEl));
    }
    if (!subject && detailParts.length >= 2) {
      for (const part of detailParts) {
        if (/^\d{1,2}:\d{2}\s*[-–—]\s*\d{1,2}:\d{2}$/.test(part)) continue;
        if (/^(?:стая|каб\.?|кабинет|room)\b/iu.test(part) || /^\d{1,4}[а-яa-z]?\s*(?:\(|$)/iu.test(part)) continue;
        if (looksLikePersonName(part)) continue;
        if (/^(?:контролна\s+работа|класна\s+работа|контролно|изпит|тест|самостоятелна\s+работа)$/iu.test(part)) continue;
        const candidate = cleanScheduleSubject(part);
        if (candidate) { subject = candidate; break; }
      }
    }
    if (!subject) {
      const broaderEl = slot.querySelector?.('[class*="course" i], [class*="subject" i]');
      if (broaderEl) {
        subject = cleanScheduleSubject(readableText(broaderEl));
      }
    }
    if (!subject) {
      subject = extractSubjectFromCellElement(slot);
    }
    if (subject) {
      subject = space(stripTrailingPersonName(subject).replace(/\s*\((?:ЗП|ИУЧ|ЗИП|ФУЧ|ПП|РП|ООП)\)\s*$/iu, ''));
    }
    return subject;
  }

  function extractScheduleFromShkoloColumns(documentValue) {
    if (!documentValue || typeof documentValue.querySelectorAll !== 'function') return null;
    const columns = Array.from(documentValue.querySelectorAll(
      '.scheduleTable .scheduleTableColumn, .scheduleTableColumn, [class*="scheduleTableColumn" i]'
    ));
    if (!columns.length) return null;
    const daySlots = createDaySlotMaps();
    let foundAny = false;

    columns.forEach((col, colIndex) => {
      const heading = col.querySelector?.('.scheduleTableHeading, [class*="scheduleTableHeading" i], h3, h4, strong, th')
        || col.children?.[0]
        || null;
      const headingText = heading ? readableText(heading) : '';
      let day = weekdayNameFromValue(headingText);
      if (!day && headingText) {
        day = weekdayNameFromDateIso(parseDate(headingText));
      }
      if (!day && columns.length <= 5 && colIndex < 5) {
        day = SCHEDULE_WEEKDAYS[colIndex];
      }
      if (!day) return;

      const body = col.querySelector?.('.scheduleTableBody, [class*="scheduleTableBody" i]') || col;
      const slotNodes = unwrapScheduleSlotNodes(body, heading);

      for (let i = 0; i < slotNodes.length; i += 1) {
        const slot = slotNodes[i];
        const slotText = readableText(slot);
        if (!slotText || /^(?:-|—|свободен\s+час|няма\s+час|free(?:\s+lesson|\s+period)?)$/iu.test(slotText)) {
          putDaySlot(daySlots, day, i, { subject: '', hasExam: false, startTime: '', endTime: '' });
          continue;
        }
        const range = parseTimeRange(slotText);
        const pNum = parsePeriodNumber(slotText);
        const pIdx = pNum >= 1 ? (pNum - 1) : i;
        const hasExam = Boolean(
          /(?:control[-_]?test|hasexam|exam)/i.test(String(slot.className || slot.getAttribute?.('class') || ''))
          || slot.querySelector?.('.controlTest, .control-test, [class*="controlTest" i], [class*="control-test" i]')
          || /(?:контролн|класн|изпит|самостоятелна)/iu.test(slotText)
        );

        const subject = extractSubjectFromScheduleSlot(slot);
        if (!subject) {
          putDaySlot(daySlots, day, pIdx, { subject: '', hasExam: false, startTime: range.startTime, endTime: range.endTime });
          continue;
        }
        putDaySlot(daySlots, day, pIdx, {
          subject,
          hasExam,
          startTime: range.startTime,
          endTime: range.endTime
        });
        foundAny = true;
      }
    });

    if (!foundAny) return null;
    return buildNormalizedSchedule(daySlots);
  }

  function extractDatedExamsFromScheduleDocument(documentValue, fallbackYear = null) {
    if (!documentValue || typeof documentValue.querySelectorAll !== 'function') return [];
    const columns = Array.from(documentValue.querySelectorAll(
      '.scheduleTable .scheduleTableColumn, .scheduleTableColumn, [class*="scheduleTableColumn" i]'
    ));
    if (!columns.length) return [];
    const today = todayInSofia();
    const minExamDate = currentSchoolYearStartInSofia();
    const refYear = Number(fallbackYear) >= 2020 ? Number(fallbackYear) : Number(today.slice(0, 4));
    const exams = [];
    const examMarkerRe = /(?:контролн|класн[ао](?:\s+работа)?|самостоятелна\s+работа|изпит(?:ване)?|входно\s+ниво|изходно\s+ниво|тематична\s+проверка|control\s*test|\bexam\b)/iu;

    for (const col of columns) {
      const heading = col.querySelector?.('.scheduleTableHeading, [class*="scheduleTableHeading" i], h3, h4, strong, th')
        || col.children?.[0]
        || null;
      const headingText = heading ? readableText(heading) : '';
      let colDate = headingText ? parseTargetDate(headingText, minExamDate) : '';
      if (!colDate && headingText) {
        const dm = /(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?/.exec(headingText);
        if (dm) {
          const dayNum = Number(dm[1]);
          const monthNum = Number(dm[2]);
          let yr = dm[3] ? Number(dm[3].length === 2 ? `20${dm[3]}` : dm[3]) : refYear;
          if (!dm[3] && monthNum >= 1 && monthNum <= 7 && Number(today.slice(5, 7)) >= 9) {
            yr = refYear + 1;
          }
          if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12) {
            colDate = `${yr}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
          }
        }
      }
      if (!colDate || colDate < minExamDate) continue;

      const body = col.querySelector?.('.scheduleTableBody, [class*="scheduleTableBody" i]') || col;
      const slotNodes = unwrapScheduleSlotNodes(body, heading);

      for (let i = 0; i < slotNodes.length; i += 1) {
        const slot = slotNodes[i];
        const slotText = readableText(slot);
        if (!slotText) continue;
        const examEl = slot.querySelector?.('.controlTest, .control-test, .hasExam, [class*="controlTest" i], [class*="control-test" i], [data-control-test-id], [title*="контролн" i], [title*="класн" i], [title*="изпит" i], [data-original-title*="контролн" i], [data-original-title*="класн" i], [data-original-title*="изпит" i], [data-bs-original-title*="контролн" i], [aria-label*="контролн" i]');
        const attrText = [
          slot.getAttribute?.('class') || '',
          slot.getAttribute?.('title') || '',
          slot.getAttribute?.('data-original-title') || '',
          slot.getAttribute?.('data-bs-original-title') || '',
          slot.getAttribute?.('aria-label') || '',
          examEl?.getAttribute?.('title') || '',
          examEl?.getAttribute?.('data-original-title') || '',
          examEl?.getAttribute?.('data-bs-original-title') || '',
          examEl?.textContent || ''
        ].join(' ');
        const hasExamMarker = Boolean(
          examEl
          || /(?:control[-_]?test|hasexam)/i.test(String(slot.className || slot.getAttribute?.('class') || ''))
          || examMarkerRe.test(`${slotText} ${attrText}`)
        );
        if (!hasExamMarker) continue;

        const subject = extractSubjectFromScheduleSlot(slot);
        if (!subject) continue;

        const range = parseTimeRange(slotText);
        const pNum = parsePeriodNumber(slotText) || (i + 1);
        const titleCandidate = space(examEl?.getAttribute?.('title') || examEl?.getAttribute?.('data-original-title') || examEl?.textContent || '');
        const linkEl = slot.querySelector?.('a[href]');
        const rawHref = linkEl ? (linkEl.href || linkEl.getAttribute('href') || '') : '';
        const keepUrl = isRealControlTestHref(rawHref) ? urlOf(rawHref) : '';
        const normalized = normalizeExam({
          subject,
          title: titleCandidate && titleCandidate.length >= 4 ? titleCandidate : `Контролно по ${subject}`,
          date: colDate,
          time: range.startTime || '',
          period: pNum,
          url: keepUrl,
          externalId: keepUrl || `${colDate}|${pNum}|${subject.toLowerCase()}`
        }, 'schedule', true);
        if (normalized) exams.push(normalized);
      }
    }
    return sortExamsAscending(exams);
  }

  function extractScheduleFromDocument(documentValue) {
    if (!documentValue || typeof documentValue.querySelectorAll !== 'function') return null;
    const extracted = [];
    const fromColumns = extractScheduleFromShkoloColumns(documentValue);
    if (fromColumns) extracted.push(fromColumns);

    const tables = [];
    const seen = new Set();
    const priorityContainers = Array.from(documentValue.querySelectorAll('#tab_schedule, #schedule, [id*="schedule" i], [class*="schedule" i], [id*="program" i], [class*="program" i], .timetable'));
    for (const container of priorityContainers) {
      for (const table of Array.from(container.querySelectorAll('table'))) {
        if (!seen.has(table)) { seen.add(table); tables.push(table); }
      }
    }
    for (const table of Array.from(documentValue.querySelectorAll('table'))) {
      if (!seen.has(table)) { seen.add(table); tables.push(table); }
    }

    for (const table of tables) {
      const parsed = extractScheduleFromTable(table);
      if (parsed) extracted.push(parsed);
    }

    // Fallback: div/card day blocks (e.g. mobile/accordion timetable).
    const dayBlocks = Array.from(documentValue.querySelectorAll('[data-day], [data-weekday], .schedule-day, .day-schedule, .scheduleDay'));
    if (dayBlocks.length) {
      const daySlots = createDaySlotMaps();
      for (const block of dayBlocks) {
        const rawDay = block.getAttribute?.('data-day') || block.getAttribute?.('data-weekday')
          || block.querySelector?.('h2, h3, h4, .day-title, .card-header, .panel-title, strong')?.textContent || '';
        const day = weekdayNameFromValue(rawDay);
        if (!day) continue;
        let seqIdx = 0;
        for (const item of Array.from(block.querySelectorAll('li, .lesson, .period, .schedule-item, .row, tr'))) {
          const itemText = space(item.textContent);
          if (!itemText || itemText.length > 250) continue;
          const pNum = parsePeriodNumber(item.querySelector?.('.hour, .period, .num')?.textContent || itemText);
          const pIdx = pNum ? (pNum - 1) : seqIdx;
          seqIdx = Math.max(seqIdx + 1, pIdx + 1);
          const range = parseTimeRange(itemText);
          const subject = extractSubjectFromCellElement(item.querySelector?.('.subject, .course, .course-name, .name') || item);
          if (subject) {
            putDaySlot(daySlots, day, pIdx, {
              subject,
              hasExam: /(?:контролн|изпит|тест)/iu.test(itemText),
              startTime: range.startTime,
              endTime: range.endTime
            });
          }
        }
      }
      const fromBlocks = buildNormalizedSchedule(daySlots);
      if (fromBlocks) extracted.push(fromBlocks);
    }

    return mergeSchedules(...extracted);
  }

  function extractScheduleFromJson(value) {
    let parsed = value;
    if (typeof value === 'string') {
      const text = value.trim();
      if (!text) return null;
      if (/^[\[{]/.test(text)) {
        try { parsed = JSON.parse(text); } catch (_) {
          return /<(table|div|li|tr|html)/i.test(text)
            ? extractScheduleFromDocument(parseHtmlDocument(text))
            : null;
        }
      } else if (/<(table|div|li|tr|html)/i.test(text)) {
        return extractScheduleFromDocument(parseHtmlDocument(text));
      } else {
        return null;
      }
    }

    const extractedDocs = [];
    const daySlots = createDaySlotMaps();

    const recordSlotObj = (obj, dayHint = '', periodHint = 0) => {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
      const dayVal = valueOf(obj, ['dayName', 'day_name', 'weekdayName', 'weekday', 'dayOfWeek', 'day_of_week', 'day', 'weekDay']);
      const day = weekdayNameFromValue(dayVal) || dayHint || weekdayNameFromDateIso(parseDate(valueOf(obj, ['date', 'forDate', 'start_date', 'start'])));
      const subjectRaw = nameOf(valueOf(obj, ['short_course_name', 'shortCourseName', 'subjectName', 'subject_name', 'courseName', 'course_name', 'course', 'subject', 'discipline', 'title', 'name']));
      const isFree = obj.is_free_hour === 1 || obj.is_free_hour === true || obj.isFreeLesson === true;
      const subject = isFree ? '' : cleanScheduleSubject(subjectRaw);
      const rawPeriod = valueOf(obj, ['period', 'periodNumber', 'period_number', 'hour', 'hourNumber', 'hour_number', 'lessonNumber', 'lesson_number', 'order', 'slot', 'index']);
      const pNum = parsePeriodNumber(rawPeriod) || periodHint;
      const startTime = parseTime(valueOf(obj, ['startTime', 'start_time', 'fromTime', 'from_time', 'from', 'begin', 'timeFrom', 'start']))
        || parseTimeRange(valueOf(obj, ['time', 'timeRange', 'interval'])).startTime;
      const endTime = parseTime(valueOf(obj, ['endTime', 'end_time', 'toTime', 'to_time', 'to', 'end', 'timeTo']))
        || parseTimeRange(valueOf(obj, ['time', 'timeRange', 'interval'])).endTime;
      if (!day || (!subject && !startTime)) return false;
      const pIdx = pNum >= 1 ? (pNum - 1) : daySlots[day].size;
      putDaySlot(daySlots, day, pIdx, {
        subject,
        hasExam: Boolean(valueOf(obj, ['hasExam', 'hasControlTest', 'has_control_test', 'controlTest', 'has_test'])),
        startTime,
        endTime
      });
      return true;
    };

    const walk = (node, dayHint, periodHint, depth) => {
      if (depth > 8 || node === null || node === undefined) return;
      if (typeof node === 'string') {
        const text = node.trim();
        if (text.length < 8) return;
        if (/^[\[{]/.test(text)) {
          try { walk(JSON.parse(text), dayHint, periodHint, depth + 1); } catch (_) {}
        } else if (/<(table|div|li|tr|html)/i.test(text)) {
          const docSched = extractScheduleFromDocument(parseHtmlDocument(text));
          if (docSched) extractedDocs.push(docSched);
        }
        return;
      }
      if (Array.isArray(node)) {
        for (let i = 0; i < Math.min(node.length, 250); i += 1) {
          walk(node[i], dayHint, dayHint ? (i + 1) : periodHint, depth + 1);
        }
        return;
      }
      if (typeof node !== 'object') return;
      if (recordSlotObj(node, dayHint, periodHint)) return;
      for (const [key, child] of Object.entries(node)) {
        const keyDay = weekdayNameFromValue(key) || dayHint;
        const keyPeriod = !keyDay ? (parsePeriodNumber(key) || periodHint) : 0;
        if (child && (typeof child === 'object' || typeof child === 'string')) {
          walk(child, keyDay, keyPeriod, depth + 1);
        }
      }
    };

    walk(parsed, '', 0, 0);
    const fromObjects = buildNormalizedSchedule(daySlots);
    if (fromObjects) extractedDocs.push(fromObjects);
    return mergeSchedules(...extractedDocs);
  }

  function mergeSchedules(...schedules) {
    const valid = schedules.filter(s => s && s.days && Number(s.totalSubjects) > 0);
    if (!valid.length) return null;
    if (valid.length === 1) return valid[0];
    const daySlots = createDaySlotMaps();
    for (const sched of valid) {
      for (const day of SCHEDULE_WEEKDAYS) {
        const slots = Array.isArray(sched.days[day]) ? sched.days[day] : [];
        for (let i = 0; i < slots.length; i += 1) {
          const slot = slots[i];
          if (!slot) continue;
          putDaySlot(daySlots, day, i, slot);
        }
      }
    }
    return buildNormalizedSchedule(daySlots);
  }

  function estimatePeriodStartTime(periodNumber, scheduleConfig) {
    if (!scheduleConfig || !(periodNumber >= 1 && periodNumber <= 12)) return '';
    const startMin = timeToMinutes(scheduleConfig.startTime || '08:00');
    if (startMin < 0) return '';
    const classMin = Number(scheduleConfig.classMinutes) || 40;
    const smallBreak = Number(scheduleConfig.smallBreakMinutes) >= 0 ? Number(scheduleConfig.smallBreakMinutes) : 10;
    const bigBreak = Number(scheduleConfig.bigBreakMinutes) >= 0 ? Number(scheduleConfig.bigBreakMinutes) : smallBreak;
    const bigAfter = Number(scheduleConfig.bigBreakAfter) || 3;
    let cursor = startMin;
    for (let p = 1; p < periodNumber; p += 1) {
      cursor += classMin + (p === bigAfter ? bigBreak : smallBreak);
    }
    return minutesToTime(cursor);
  }

  function resolveExamTimesWithSchedule(exams, schedule) {
    if (!Array.isArray(exams) || !exams.length) return [];
    const days = schedule?.days || null;
    const config = schedule?.scheduleConfig || null;
    const resolved = exams.map((exam) => {
      if (!exam || !exam.timeEstimated) return exam;
      const dayName = weekdayNameFromDateIso(exam.date);
      const daySlots = (days && dayName && Array.isArray(days[dayName])) ? days[dayName] : [];
      let periodNumber = Number(exam.periodNumber) || 0;
      let resolvedTime = '';
      let resolvedExact = false;

      if (periodNumber >= 1 && daySlots[periodNumber - 1]?.startTime) {
        resolvedTime = daySlots[periodNumber - 1].startTime;
        resolvedExact = true;
      } else if (!periodNumber && daySlots.length && exam.subject) {
        const needle = space(exam.subject).toLocaleLowerCase('bg');
        const matches = daySlots
          .map((slot, idx) => ({ slot, period: idx + 1 }))
          .filter(({ slot }) => {
            const subj = space(slot?.subject || '').toLocaleLowerCase('bg');
            return subj && (subj === needle || subj.includes(needle) || needle.includes(subj));
          });
        if (matches.length >= 1) {
          periodNumber = matches[0].period;
          if (matches[0].slot.startTime) {
            resolvedTime = matches[0].slot.startTime;
            resolvedExact = true;
          }
        }
      }

      if (!resolvedTime && periodNumber >= 1 && config) {
        resolvedTime = estimatePeriodStartTime(periodNumber, config);
        if (resolvedTime) resolvedExact = true;
      }
      if (!resolvedTime && config?.startTime && !exam.periodNumber) {
        resolvedTime = config.startTime;
      }

      if (!resolvedTime && !periodNumber) return exam;
      const nextTime = resolvedTime || exam.time;
      return {
        ...exam,
        ...(periodNumber > 0 ? { periodNumber } : {}),
        time: nextTime,
        dateTime: `${exam.date}T${nextTime}`,
        timeEstimated: !resolvedExact
      };
    });
    return sortExamsAscending(resolved);
  }

  function extractHomeworkFromResponse(raw, options = {}) {
    const items = [];
    const courses = new Map();
    const recordCourses = (doc) => {
      for (const c of extractCoursesFromDocument(doc)) {
        if (!courses.has(c.id)) courses.set(c.id, c);
      }
    };
    const rawStr = typeof raw === 'string' ? raw.trim() : '';
    if (!rawStr) return { items, courses: [] };
    if (/^[\[{]/.test(rawStr)) {
      items.push(...extractFromJson(rawStr));
      try {
        const parsed = JSON.parse(rawStr);
        const walkHtml = (node, depth) => {
          if (depth > 8 || node === null || node === undefined) return;
          if (typeof node === 'string') {
            if (/<(table|div|li|tr|ul|select|a|html)/i.test(node)) {
              const doc = parseHtmlDocument(node);
              recordCourses(doc);
              const sel = selectedCourseFromDocument(doc);
              const ctx = { subject: options.subject || sel.subject, teacher: options.teacher || sel.teacher };
              items.push(...extractFromDocument(doc, ctx));
            }
            return;
          }
          if (Array.isArray(node)) {
            for (const child of node.slice(0, 100)) walkHtml(child, depth + 1);
          } else if (typeof node === 'object') {
            for (const child of Object.values(node)) walkHtml(child, depth + 1);
          }
        };
        walkHtml(parsed, 0);
      } catch (_) {}
      return { items: dedupe(items), courses: Array.from(courses.values()) };
    }
    const doc = parseHtmlDocument(rawStr);
    recordCourses(doc);
    const selected = selectedCourseFromDocument(doc);
    items.push(...extractFromDocument(doc));
    if (options.subject || options.teacher || selected.subject || selected.teacher) {
      items.push(...extractFromDocument(doc, {
        subject: options.subject || selected.subject,
        teacher: options.teacher || selected.teacher
      }));
    }
    return { items: dedupe(items), courses: Array.from(courses.values()), doc };
  }

  function extractExamsFromResponse(raw, trusted = true) {
    const rawStr = typeof raw === 'string' ? raw.trim() : '';
    if (!rawStr) return { items: [], pages: [] };
    if (/^[\[{]/.test(rawStr)) {
      let pages = extractPaginationPages(rawStr, null);
      const items = extractExamsFromJson(rawStr, trusted);
      try {
        const parsed = JSON.parse(rawStr);
        const walkDocs = (node, depth) => {
          if (depth > 6 || node === null || node === undefined) return;
          if (typeof node === 'string' && /<(a|li|ul|div|nav)/i.test(node)) {
            pages = Array.from(new Set([...pages, ...extractPaginationPages('', parseHtmlDocument(node))])).sort((a, b) => a - b);
          } else if (Array.isArray(node)) {
            for (const child of node.slice(0, 50)) walkDocs(child, depth + 1);
          } else if (typeof node === 'object') {
            for (const child of Object.values(node)) walkDocs(child, depth + 1);
          }
        };
        walkDocs(parsed, 0);
      } catch (_) {}
      return { items, pages };
    }
    const doc = parseHtmlDocument(rawStr);
    return {
      items: extractExamsFromDocument(doc, trusted),
      pages: extractPaginationPages(rawStr, doc)
    };
  }

  window.ShkoloExtractor = {
    sanitizeHtmlForParser,
    parseHtmlDocument,
    extractFromDocument,
    extractFromJson,
    extractFromText,
    extractFromDetailText,
    extractHomeworkFromResponse,
    extractCoursesFromDocument,
    selectedCourseFromDocument,
    extractPaginationPages,
    extractRemarksFromDocument,
    extractRemarksFromJson,
    extractRemarksFromText,
    extractRemarkFromNode,
    extractExamsFromDocument,
    extractExamsFromJson,
    extractExamsFromResponse,
    sortExamsAscending,
    extractScheduleFromDocument,
    extractScheduleFromJson,
    extractDatedExamsFromScheduleDocument,
    mergeSchedules,
    resolveExamTimesWithSchedule,
    parseDate,
    parseTargetDate,
    parseTime,
    parseDateTime,
    normalize,
    normalizeRemark,
    isControlTestUrl,
    todayInSofia
  };
})();
