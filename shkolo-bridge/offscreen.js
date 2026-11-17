/* Работи в скрит offscreen документ на разширението: никакъв таб на Shkolo не се отваря. */
(() => {
  const ORIGIN = 'https://app.shkolo.bg';
  const captured = new Map();
  const capturedRemarks = new Map();
  const capturedExams = new Map();
  const LOCATION_ORIGIN = ORIGIN;
  let capturedSchedule = null;
  let pageContext = {};
  const discoveredCourses = new Map();
  const detailVisited = new Set();
  const location = { pathname: '', href: ORIGIN + '/', origin: ORIGIN };
  const LOGIN_MSG = 'Не си влязъл в Shkolo в този браузър. Влез веднъж в app.shkolo.bg (с „Запомни ме“) и синхронизацията ще продължи автоматично.';

  function extractFromDocument(documentValue, includeExams = false) {
    const result = { homework: [], remarks: [], exams: [], schedule: null };
    try { result.homework.push(...window.ShkoloExtractor.extractFromDocument(documentValue)); } catch (_) {}
    try { result.remarks.push(...window.ShkoloExtractor.extractRemarksFromDocument(documentValue)); } catch (_) {}
    try { result.schedule = window.ShkoloExtractor.extractScheduleFromDocument(documentValue); } catch (_) {}
    if (includeExams) {
      try { result.exams.push(...window.ShkoloExtractor.extractExamsFromDocument(documentValue, true)); } catch (_) {}
    }
    return result;
  }

  function mergeSchedule(nextSchedule) {
    if (!nextSchedule || !nextSchedule.totalSubjects) return;
    capturedSchedule = window.ShkoloExtractor.mergeSchedules(capturedSchedule, nextSchedule);
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

  function itemKey(item) {
    return item.externalId
      ? `id:${item.externalId}`
      : `content:${hash(`${item.subject}|${item.teacher}|${item.dueDate}|${item.description}`)}`;
  }

  function remarkKey(item) {
    const isGeneric = !item.externalId || /^(badge|table|feedback|row|entry|tr|_)/i.test(item.externalId);
    const sig = `${item.kind}|${item.subject}|${item.teacher}|${item.date}|${item.time || ''}|${item.badge || ''}|${item.comment || ''}|${item.description || ''}`;
    return isGeneric ? `content:${hash(sig)}` : `id:${item.externalId}|${hash(sig)}`;
  }

  function examKey(item) {
    return item.externalId
      ? `id:${item.externalId}`
      : `content:${hash(`${item.subject || ''}|${item.title}|${item.date}|${item.periodNumber || item.time}`)}`;
  }

  function merge(items) {
    let changed = false;
    const today = window.ShkoloExtractor?.todayInSofia ? window.ShkoloExtractor.todayInSofia() : new Date().toISOString().slice(0, 10);
    for (const item of items) {
      if (!item || !item.description || !item.dueDate) continue;
      if (item.dueDate < today) continue; // Без срок или с изтекъл срок не се пазят
      const key = itemKey(item);
      const previous = captured.get(key);
      if (!previous) {
        captured.set(key, { ...item, capturedAt: new Date().toISOString() });
        changed = true;
      } else {
        const merged = {
          ...previous,
          subject: item.subject || previous.subject,
          teacher: item.teacher || previous.teacher,
          dueDate: item.dueDate || previous.dueDate,
          description: item.description.length > previous.description.length ? item.description : previous.description,
          externalId: previous.externalId || item.externalId,
          url: item.url || previous.url,
          capturedAt: previous.capturedAt || new Date().toISOString()
        };
        if (JSON.stringify(merged) !== JSON.stringify(previous)) {
          captured.set(key, merged);
          changed = true;
        }
      }
    }
    while (captured.size > 400) captured.delete(captured.keys().next().value);
    return changed;
  }

  function mergeRemarks(items) {
    let changed = false;
    for (const item of items) {
      if (!item || (!item.description && !item.badge && !item.comment)) continue;
      const key = remarkKey(item);
      const previous = capturedRemarks.get(key);
      if (!previous) {
        capturedRemarks.set(key, { ...item, capturedAt: new Date().toISOString() });
        changed = true;
      } else {
        const merged = {
          ...previous,
          kind: item.kind || previous.kind,
          subject: item.subject || previous.subject,
          teacher: item.teacher || previous.teacher,
          date: item.date || previous.date,
          time: item.time || previous.time,
          badge: item.badge || previous.badge,
          comment: item.comment || previous.comment,
          description: (item.description && item.description.length > (previous.description || '').length) ? item.description : previous.description,
          externalId: item.externalId || previous.externalId,
          url: item.url || previous.url,
          capturedAt: previous.capturedAt || new Date().toISOString()
        };
        if (JSON.stringify(merged) !== JSON.stringify(previous)) {
          capturedRemarks.set(key, merged);
          changed = true;
        }
      }
    }
    while (capturedRemarks.size > 400) capturedRemarks.delete(capturedRemarks.keys().next().value);
    return changed;
  }

  function mergeExams(items) {
    let changed = false;
    const today = window.ShkoloExtractor?.todayInSofia ? window.ShkoloExtractor.todayInSofia() : new Date().toISOString().slice(0, 10);
    for (const item of items) {
      if (!item || !item.title || !item.date || !item.time) continue;
      if (item.date < today) continue;
      const key = examKey(item);
      const previous = capturedExams.get(key);
      if (!previous) {
        capturedExams.set(key, { ...item, capturedAt: new Date().toISOString() });
        changed = true;
      } else {
        const merged = {
          ...previous,
          subject: item.subject || previous.subject,
          title: (item.title || '').length >= (previous.title || '').length ? item.title : previous.title,
          date: item.date || previous.date,
          time: !item.timeEstimated ? item.time : (!previous.timeEstimated ? previous.time : item.time),
          dateTime: !item.timeEstimated ? item.dateTime : (!previous.timeEstimated ? previous.dateTime : item.dateTime),
          timeEstimated: Boolean(item.timeEstimated && previous.timeEstimated),
          periodNumber: item.periodNumber || previous.periodNumber || undefined,
          fromControlTests: Boolean(item.fromControlTests || previous.fromControlTests),
          externalId: previous.externalId || item.externalId,
          url: item.url || previous.url,
          capturedAt: previous.capturedAt || new Date().toISOString()
        };
        if (JSON.stringify(merged) !== JSON.stringify(previous)) {
          capturedExams.set(key, merged);
          changed = true;
        }
      }
    }
    while (capturedExams.size > 120) capturedExams.delete(capturedExams.keys().next().value);
    return changed;
  }


  function validShkoloId(value) {
    return /^\d{4,20}$/.test(String(value || '').trim());
  }

  function classFromText(value) {
    const raw = String(value || '').replace(/\s+/g, ' ').trim();
    if (!raw || raw.length > 800) return '';
    const romanMap = { 'XII': 12, 'XI': 11, 'X': 10, 'IX': 9, 'VIII': 8, 'VII': 7, 'VI': 6, 'V': 5, 'IV': 4, 'III': 3, 'II': 2, 'I': 1 };
    const romanMatch = /(?:^|[^\wА-Яа-я])(XII|XI|IX|X|VIII|VII|VI|IV|V|III|II|I)\s*[.\-–—]?\s*([А-Яа-яA-Za-z])(?![А-Яа-яA-Za-z])/u.exec(raw);
    if (romanMatch && romanMap[romanMatch[1].toUpperCase()]) {
      return `${romanMap[romanMatch[1].toUpperCase()]}${romanMatch[2].toLowerCase()}`;
    }
    const match = /(?:^|[^\dА-Яа-яA-Za-z])((?:1[0-2]|[1-9]))\s*[.\-–—]?\s*([А-Яа-яA-Za-z])(?![А-Яа-яA-Za-z])/u.exec(raw);
    return match ? `${Number(match[1])}${match[2].toLowerCase()}` : '';
  }

  function hiddenValue(root, selectors) {
    for (const selector of selectors) {
      for (const node of Array.from(root.querySelectorAll(selector))) {
        const value = String(node.value ?? node.getAttribute?.('value') ?? '').trim();
        if (validShkoloId(value)) return value;
      }
    }
    return '';
  }

  function mergeContextFromDocument(root) {
    if (!root || typeof root.querySelectorAll !== 'function') return;
    const current = { ...pageContext };
    const pupilId = hiddenValue(root, [
      '#pupil_id_field', '#pupil-id-hidden', 'input[name="pupil_id"]', 'input[name="pupilId"]', '[data-pupil-id]'
    ]) || (() => {
      const match = /\/diary\/pupil\/(\d{4,20})/.exec(location.pathname);
      return match ? match[1] : '';
    })() || (() => {
      for (const link of Array.from(root.querySelectorAll('a[href*="/diary/pupil/"]'))) {
        const match = /\/diary\/pupil\/(\d{4,20})/.exec(link.getAttribute('href') || '');
        if (match && validShkoloId(match[1])) return match[1];
      }
      return '';
    })() || (() => {
      for (const link of Array.from(root.querySelectorAll('a[href*="/pupil/"]'))) {
        const match = /\/pupil\/(\d{4,20})/.exec(link.getAttribute('href') || '');
        if (match && validShkoloId(match[1])) return match[1];
      }
      return '';
    })() || (() => {
      const profile = root.querySelector('body > div.page-container > div.page-content-wrapper > div > div > div > a[href]');
      const href = profile ? String(profile.getAttribute('href') || '').trim() : '';
      const match = /\/(\d{4,20})(?:[/?#]|$)/.exec(href);
      return match && validShkoloId(match[1]) ? match[1] : '';
    })() || (() => {
      for (const link of Array.from(root.querySelectorAll('a[href]'))) {
        const href = String(link.getAttribute('href') || '');
        if (/diary|pupil|student/i.test(href)) {
          const match = /\/(\d{4,20})(?:[/?#]|$)/.exec(href);
          if (match && validShkoloId(match[1])) return match[1];
        }
      }
      return '';
    })();

    const classYearId = hiddenValue(root, [
      '#class_year_id_field', '#class_year_id', '#virtual_class_year_id_field',
      'input[name="class_year_id"]', 'input[name="classYearId"]',
      'input[name="virtual_class_year_id"]', '[data-class-year-id]'
    ]) || (() => {
      const match = /[?&]class_year_id=(\d{4,20})/.exec(location.href);
      return match ? match[1] : '';
    })() || (() => {
      for (const link of Array.from(root.querySelectorAll('a[href*="class_year_id="]'))) {
        const match = /[?&]class_year_id=(\d{4,20})/.exec(link.getAttribute('href') || '');
        if (match && validShkoloId(match[1])) return match[1];
      }
      return '';
    })();

    let className = '';
    const explicitClassSelectors = [
      '#class_year_name', '#class-year-name', '#classYearName', '#sc-class-lbl', '#sc-class-name',
      '.class-year-name', '.classYearName', '.sc-class-name', '.class-name',
      '[data-class-name]', '[data-classname]', '[data-class-year-name]',
      '.page-title', '.page-header', '.breadcrumb', 'h1', 'h2', 'title'
    ];
    for (const selector of explicitClassSelectors) {
      for (const node of Array.from(root.querySelectorAll(selector))) {
        const textVal = (node.getAttribute?.('data-class-name')
          || node.getAttribute?.('data-classname')
          || node.getAttribute?.('data-class-year-name')
          || node.value
          || node.textContent || '').trim();
        const found = classFromText(textVal);
        if (found) { className = found; break; }
      }
      if (className) break;
    }
    if (!className) {
      const classField = root.querySelector('#class_year_id_field, input[name="class_year_id"]');
      let parent = classField;
      for (let depth = 0; parent && depth < 4; depth += 1, parent = parent.parentElement) {
        const text = (parent.textContent || '').trim();
        if (!text || text.length > 300) continue;
        const found = classFromText(text);
        if (found) { className = found; break; }
      }
    }
    if (!className) {
      for (const el of Array.from(root.querySelectorAll('span, div, p, b, strong, td, th, a, h3, h4, .badge, .label'))) {
        const text = (el.textContent || '').trim();
        if (text.length > 120 || !text.includes('клас')) continue;
        const found = classFromText(text);
        if (found) { className = found; break; }
      }
    }
    pageContext = {
      ...current,
      pupilId: validShkoloId(pupilId) ? pupilId : current.pupilId,
      classYearId: validShkoloId(classYearId) ? classYearId : current.classYearId,
      className: className || current.className,
      schoolId: current.schoolId,
      schoolName: current.schoolName
    };
  }


  function courseListFromDocument(root) {
    if (window.ShkoloExtractor?.extractCoursesFromDocument) {
      return window.ShkoloExtractor.extractCoursesFromDocument(root);
    }
    return [];
  }

  function rememberCourses(courses = []) {
    for (const course of courses) {
      if (!course || !course.id) continue;
      const prev = discoveredCourses.get(course.id);
      if (!prev) discoveredCourses.set(course.id, course);
      else if (!prev.subject && course.subject) {
        discoveredCourses.set(course.id, { ...prev, subject: course.subject, teacher: prev.teacher || course.teacher });
      }
    }
  }

  function selectedCourseFromDocument(root) {
    if (window.ShkoloExtractor?.selectedCourseFromDocument) {
      return window.ShkoloExtractor.selectedCourseFromDocument(root);
    }
    return { subject: '', teacher: '' };
  }



  function isLoginUrl(url) {
    try {
      const u = new URL(url);
      return /(login|signin|sign-in|auth\/login)/i.test(u.pathname) || /^(login|auth|accounts|sso)\./i.test(u.hostname);
    } catch (_) { return false; }
  }

  let csrfToken = '';
  const probeStats = [];
  function recordProbe(path, params, status, text, extra = {}) {
    if (probeStats.length >= 60) return;
    const paramKeys = Object.keys(params || {}).filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '').sort();
    probeStats.push({
      path: String(path || '').split('?')[0],
      paramKeys,
      status: Number(status || 0),
      bytes: text ? text.length : 0,
      hasTable: Boolean(text && /<table\b/i.test(text)),
      hasScheduleTable: Boolean(text && /scheduleTable/i.test(text)),
      hasControlTestBody: Boolean(text && /controlTestBody/i.test(text)),
      trCount: text ? (text.match(/<tr\b/gi) || []).length : 0,
      ...extra
    });
  }

  async function fetchRaw(path, params = {}) {
    const url = new URL(path, ORIGIN);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }
    const headers = {
      'Accept': 'text/html,application/json,text/plain',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': `${ORIGIN}/diary`
    };
    if (csrfToken) headers['X-CSRF-TOKEN'] = csrfToken;
    const response = await fetch(url.href, {
      credentials: 'include',
      cache: 'no-store',
      headers
    });
    const text = response.ok ? await response.text() : '';
    const safeText = text.length > 2000000 ? '' : text;
    if (/^\/ajax\//i.test(String(path || ''))) {
      recordProbe(path, params, response.status, safeText);
    }
    if (response.status === 403 || response.status === 429) {
      throw makeHttpStopError(response.status);
    }
    return { ok: response.ok, status: response.status, url: response.url, text: safeText };
  }
  function makeHttpStopError(status) {
    const msg = status === 429
      ? 'Shkolo ограничи временно заявките (HTTP 429). Автоматичното четене спря веднага без повторения.'
      : 'Shkolo отказа достъп (HTTP 403). Четенето спря веднага без повторения.';
    return Object.assign(new Error(msg), { name: 'ShkoloHttpStopError', status, rateLimited: true });
  }
  function isHttpStopError(error) {
    return Boolean(error && (error.name === 'ShkoloHttpStopError' || error.status === 403 || error.status === 429));
  }
  async function fetchText(path, params) {
    try {
      return (await fetchRaw(path, params)).text;
    } catch (error) {
      if (isHttpStopError(error)) throw error;
      return '';
    }
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

  const parse = html => (window.ShkoloExtractor?.parseHtmlDocument
    ? window.ShkoloExtractor.parseHtmlDocument(html)
    : new DOMParser().parseFromString(sanitizeHtmlForParser(html), 'text/html'));

  async function pool(items, limit, fn) {
    const queue = items.slice();
    let stopError = null;
    await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, queue.length)) }, async () => {
      while (queue.length && !stopError) {
        try {
          await fn(queue.shift());
        } catch (error) {
          if (isHttpStopError(error) && !stopError) stopError = error;
        }
      }
    }));
    if (stopError) throw stopError;
  }

  async function loadDiaryPage(path) {
    try {
      const page = await fetchRaw(path);
      if (isLoginUrl(page.url) || page.status === 401) return { login: true, url: page.url };
      if (!page.text) return { url: page.url, status: page.status };
      location.pathname = new URL(page.url).pathname;
      location.href = page.url;
      const doc = parse(page.text);
      const tokenVal = doc.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
        || doc.querySelector('input[name="_token"]')?.getAttribute('value')
        || '';
      if (tokenVal) csrfToken = tokenVal.trim();
      const loginForm = doc.querySelector('form[action*="login" i] input[type="password"]');
      if (loginForm && !doc.querySelector('a[href*="logout" i], #pupil_id_field, a[href*="/pupil/"], .page-sidebar')) return { login: true, url: page.url };
      mergeContextFromDocument(doc);
      rememberCourses(courseListFromDocument(doc));
      const trustedCt = window.ShkoloExtractor?.isControlTestUrl ? window.ShkoloExtractor.isControlTestUrl(page.url) : /control[-_]?test/i.test(page.url);
      const found = extractFromDocument(doc, trustedCt);
      merge(found.homework); mergeRemarks(found.remarks); mergeExams(found.exams); mergeSchedule(found.schedule);
      return { html: page.text, url: page.url };
    } catch (error) {
      if (isHttpStopError(error)) throw error;
      return { error: String(error && error.message || error) };
    }
  }

  function parseScheduleResponse(raw) {
    if (!raw) return null;
    try {
      return /^\s*[\[{]/.test(raw)
        ? window.ShkoloExtractor.extractScheduleFromJson(raw)
        : window.ShkoloExtractor.extractScheduleFromDocument(parse(raw));
    } catch (_) { return null; }
  }

  function parseExamResponse(raw, trusted = true) {
    if (!raw) return [];
    try {
      return /^\s*[\[{]/.test(raw)
        ? window.ShkoloExtractor.extractExamsFromJson(raw, trusted)
        : window.ShkoloExtractor.extractExamsFromDocument(parse(raw), trusted);
    } catch (_) { return []; }
  }

  async function collect(stored = {}) {
    csrfToken = '';
    probeStats.length = 0;
    capturedSchedule = null;
    discoveredCourses.clear();
    detailVisited.clear();
    pageContext = {
      pupilId: validShkoloId(stored.lastPupilId) ? String(stored.lastPupilId) : '',
      classYearId: String(stored.lastClassYearId || ''),
      className: String(stored.lastClassName || ''),
      schoolId: String(stored.lastSchoolId || ''),
      schoolName: String(stored.lastSchoolName || '')
    };
    const discoverPupilIdFromHome = async () => {
      const home = await loadDiaryPage('/');
      if (home.login) return { login: true, url: home.url };
      if (home.error) return { error: home.error };
      const match = home.html && (/\/diary\/pupil\/(\d{4,20})/.exec(home.html) || /[?&]pupil_id=(\d{4,20})/.exec(home.html));
      if (match) pageContext.pupilId = match[1];
      return {};
    };
    if (!pageContext.pupilId) {
      const homeRes = await discoverPupilIdFromHome();
      if (homeRes.login) return { ok: false, needsLogin: true, error: LOGIN_MSG + (homeRes.url ? ` [${homeRes.url}]` : '') };
      if (homeRes.error) return { ok: false, error: 'Няма връзка с Shkolo: ' + homeRes.error };
    }
    if (!pageContext.pupilId) return { ok: false, notReady: true, error: 'Ученикът в Shkolo не беше разпознат. Отвори app.shkolo.bg с родителски или ученически профил (един път) и опитай пак.' };
    let diary = await loadDiaryPage(`/diary/pupil/${pageContext.pupilId}`);
    if (diary.login) return { ok: false, needsLogin: true, error: LOGIN_MSG + (diary.url ? ` [${diary.url}]` : '') };
    if (!diary.html && stored.lastPupilId) {
      pageContext = { pupilId: '', classYearId: '', className: '', schoolId: '', schoolName: '' };
      const homeRes = await discoverPupilIdFromHome();
      if (homeRes.login) return { ok: false, needsLogin: true, error: LOGIN_MSG + (homeRes.url ? ` [${homeRes.url}]` : '') };
      if (homeRes.error) return { ok: false, error: 'Няма връзка с Shkolo: ' + homeRes.error };
      if (!pageContext.pupilId) return { ok: false, notReady: true, error: 'Ученикът в Shkolo не беше разпознат. Отвори app.shkolo.bg с родителски или ученически профил (един път) и опитай пак.' };
      diary = await loadDiaryPage(`/diary/pupil/${pageContext.pupilId}`);
      if (diary.login) return { ok: false, needsLogin: true, error: LOGIN_MSG + (diary.url ? ` [${diary.url}]` : '') };
    }
    if (!pageContext.classYearId || !pageContext.className) await loadDiaryPage(`/pupil/${pageContext.pupilId}`);
    const context = {
      pupilId: pageContext.pupilId,
      classYearId: pageContext.classYearId || '',
      className: pageContext.className || '',
      schoolId: pageContext.schoolId || '',
      schoolName: pageContext.schoolName || ''
    };
    if (!context.classYearId || !context.className) return { ok: false, notReady: true, error: 'Класът в Shkolo не беше разпознат. Отвори app.shkolo.bg веднъж, за да се запомни.' };

    const summary = await fetchText('/ajax/diary/getFeedbacksForPupil', { pupil_id: context.pupilId, class_year_id: context.classYearId });
    if (summary) {
      const summaryDoc = parse(summary);
      const pairs = new Map();
      for (const el of Array.from(summaryDoc.querySelectorAll('button, a, [role="button"], .badge-holder, [data-type_id], [data-mix_id], [class*="feedbacks"]'))) {
        let typeId = el.getAttribute('data-type_id') || el.getAttribute('data-type') || '';
        let mixId = el.getAttribute('data-mix_id') || el.getAttribute('data-mix') || el.getAttribute('data-cyc_group_id') || '';
        const idStr = String(el.id || '');
        if ((!typeId || !mixId) && idStr) {
          const m = /(?:^|[^\d])([12])\s*[:_]\s*([a-zA-Z0-9_-]+)/.exec(idStr);
          if (m) { typeId = typeId || m[1]; mixId = mixId || m[2]; }
        }
        const onclick = String(el.getAttribute('data-attr-onclick') || el.getAttribute('onclick') || '');
        if ((!typeId || !mixId) && onclick) {
          const m = /(?:getFeedback\w*|feedbacks?)\s*\(\s*[^)]*?['"]?([12])['"]?\s*,\s*['"]?([a-zA-Z0-9_-]+)['"]?/i.exec(onclick);
          if (m) { typeId = typeId || m[1]; mixId = mixId || m[2]; }
        }
        if (!typeId) {
          if (el.classList?.contains('appraisal') || el.closest?.('.appraisal')) typeId = '1';
          else if (el.classList?.contains('remark') || el.closest?.('.remark')) typeId = '2';
        }
        if (!typeId || !mixId) continue;
        const digits = String(el.textContent || '').replace(/[^\d]/g, '');
        if (digits && parseInt(digits, 10) <= 0) continue;
        pairs.set(`${typeId}:${mixId}`, { typeId, mixId });
      }
      await pool(Array.from(pairs.values()), 6, async pair => {
        const html = await fetchText('/ajax/diary/getFeedbackDataByTypeAndCourse', {
          pupil_id: context.pupilId, class_year_id: context.classYearId, type_id: pair.typeId, mix_id: pair.mixId
        });
        if (!html) return;
        mergeRemarks(window.ShkoloExtractor.extractRemarksFromDocument(parse(html), { kind: pair.typeId === '1' ? 'praise' : 'remark' }));
      });
    }

    const processHomeworkRaw = (raw, options = {}) => {
      if (!raw) return null;
      const mergedOptions = { trusted: true, ...options };
      const extracted = window.ShkoloExtractor?.extractHomeworkFromResponse
        ? window.ShkoloExtractor.extractHomeworkFromResponse(raw, mergedOptions)
        : { items: window.ShkoloExtractor.extractFromDocument(parse(raw), mergedOptions), courses: [], doc: parse(raw) };
      if (extracted.items?.length) merge(extracted.items);
      if (extracted.courses?.length) rememberCourses(extracted.courses);
      return extracted;
    };

    const isoWeekInfo = (offsetDays = 0) => {
      const base = new Date(Date.now() + offsetDays * 86400000);
      const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
      const year2 = String(d.getUTCFullYear()).slice(-2);
      const year4 = String(d.getUTCFullYear());
      return { week, year2, year4 };
    };
    const thisIso = isoWeekInfo(0);
    const nextIso = isoWeekInfo(7);

    const hwAttempts = [
      ['/ajax/diary/getHomeworks', { pupil_id: context.pupilId, class_year_id: context.classYearId }],
      ['/ajax/diary/getHomeworks', { pupil_id: context.pupilId }],
      ['/ajax/diary/getHomeworks', { pupil_id: context.pupilId, year: thisIso.year2, week: thisIso.week, class_year_id: context.classYearId }],
      ['/ajax/diary/getHomeworks', { pupil_id: context.pupilId, year: nextIso.year2, week: nextIso.week, class_year_id: context.classYearId }]
    ];
    for (const [ep, prm] of hwAttempts) {
      const hw = await fetchText(ep, prm);
      if (!hw) continue;
      const hwRes = processHomeworkRaw(hw);
      const hwPages = window.ShkoloExtractor?.extractPaginationPages
        ? window.ShkoloExtractor.extractPaginationPages(hw, hwRes?.doc, 8)
        : [];
      await pool(hwPages, 3, async pageNum => {
        const nextRaw = await fetchText(ep, { ...prm, page: pageNum });
        processHomeworkRaw(nextRaw);
      });
      if (captured.size > 0 && ep === hwAttempts[0][0] && prm.class_year_id) break;
    }

    await pool(Array.from(discoveredCourses.values()).slice(0, 40), 6, async course => {
      const raw = await fetchText('/ajax/diary/getHomeworks', { pupil_id: context.pupilId, class_year_id: context.classYearId, cyc_group_id: course.id });
      const res = processHomeworkRaw(raw, { subject: course.subject, teacher: course.teacher });
      const pages = window.ShkoloExtractor?.extractPaginationPages
        ? window.ShkoloExtractor.extractPaginationPages(raw, res?.doc, 5)
        : [];
      for (const pageNum of pages) {
        const nextRaw = await fetchText('/ajax/diary/getHomeworks', { pupil_id: context.pupilId, class_year_id: context.classYearId, cyc_group_id: course.id, page: pageNum });
        processHomeworkRaw(nextRaw, { subject: course.subject, teacher: course.teacher });
      }
      if (!res?.items?.length && !raw) {
        const rawNoClass = await fetchText('/ajax/diary/getHomeworks', { pupil_id: context.pupilId, course_id: course.id });
        processHomeworkRaw(rawNoClass, { subject: course.subject, teacher: course.teacher });
      }
    });

    if (!captured.size) {
      for (const altEndpoint of ['/ajax/diary/getHomeworksForPupil', '/ajax/homework/getHomeworks']) {
        const altHw = await fetchText(altEndpoint, { pupil_id: context.pupilId, class_year_id: context.classYearId })
          || await fetchText(altEndpoint, { pupil_id: context.pupilId });
        if (altHw) processHomeworkRaw(altHw);
        if (captured.size) break;
      }
    }

    const hwLinks = [];
    for (const item of captured.values()) {
      if (!item.url) continue;
      try {
        const u = new URL(item.url, ORIGIN);
        if (u.origin === ORIGIN && /\/diary\/shi\/|\/homework/i.test(u.pathname) && !detailVisited.has(u.href)) {
          detailVisited.add(u.href);
          hwLinks.push(u.pathname + u.search);
        }
      } catch (_) {}
      if (hwLinks.length >= 14) break;
    }
    await pool(hwLinks, 4, async relPath => {
      const raw = await fetchText(relPath);
      if (raw) processHomeworkRaw(raw);
    });

    const collectExamsFromEndpoint = async (endpoint, baseParams, extraCourse = null) => {
      const firstRaw = await fetchText(endpoint, baseParams);
      if (!firstRaw) return 0;
      const firstParsed = window.ShkoloExtractor?.extractExamsFromResponse
        ? window.ShkoloExtractor.extractExamsFromResponse(firstRaw, true)
        : { items: parseExamResponse(firstRaw), pages: [] };
      const applyFallbackSubject = items => (extraCourse?.subject
        ? (items || []).map(ex => (!ex.subject || ex.subject === ex.title ? { ...ex, subject: extraCourse.subject } : ex))
        : (items || []));
      const initialCount = capturedExams.size;
      mergeExams(applyFallbackSubject(firstParsed.items));
      if (firstParsed.pages.length) {
        await pool(firstParsed.pages, 3, async pageNum => {
          const nextRaw = await fetchText(endpoint, { ...baseParams, page: pageNum });
          if (nextRaw) mergeExams(applyFallbackSubject(parseExamResponse(nextRaw)));
        });
      } else if (firstParsed.items.length >= 1) {
        let addedByPage = 0;
        for (let pageNum = 2; pageNum <= 15; pageNum += 1) {
          const nextRaw = await fetchText(endpoint, { ...baseParams, page: pageNum });
          if (!nextRaw || nextRaw === firstRaw) break;
          const before = capturedExams.size;
          const nextItems = applyFallbackSubject(parseExamResponse(nextRaw));
          if (!nextItems.length) break;
          mergeExams(nextItems);
          if (capturedExams.size === before) break;
          addedByPage += (capturedExams.size - before);
        }
        if (addedByPage === 0 && firstParsed.items.length >= 4) {
          const step = firstParsed.items.length;
          for (let offset = step; offset <= step * 6; offset += step) {
            const offRaw = await fetchText(endpoint, { ...baseParams, start: offset, length: step });
            if (!offRaw || offRaw === firstRaw) break;
            const before = capturedExams.size;
            const nextItems = applyFallbackSubject(parseExamResponse(offRaw));
            if (!nextItems.length) break;
            mergeExams(nextItems);
            if (capturedExams.size === before) break;
          }
        }
      }
      return capturedExams.size - initialCount;
    };

    await collectExamsFromEndpoint('/ajax/diary/getControlTests', { pupil_id: context.pupilId, class_year_id: context.classYearId });
    // Винаги пробваме и без class_year_id (подобно на ShkoloTweaks), защото
    // с class_year_id сървърът може да филтрира само част от предметите/периодите.
    await collectExamsFromEndpoint('/ajax/diary/getControlTests', { pupil_id: context.pupilId });
    if (capturedExams.size <= 15) {
      await collectExamsFromEndpoint('/ajax/diary/getControlTestsForPupil', { pupil_id: context.pupilId, class_year_id: context.classYearId });
      await collectExamsFromEndpoint('/ajax/diary/getControlTestsForPupil', { pupil_id: context.pupilId });
    }
    const soonestExam = Array.from(capturedExams.values()).sort((a, b) => a.date.localeCompare(b.date))[0];
    const farOnly = soonestExam && soonestExam.date > new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10);
    if (capturedExams.size <= 12 || farOnly) {
      await pool(Array.from(discoveredCourses.values()).slice(0, 30), 6, async course => {
        await collectExamsFromEndpoint('/ajax/diary/getControlTests', {
          pupil_id: context.pupilId,
          class_year_id: context.classYearId,
          cyc_group_id: course.id
        }, course);
      });
      for (const ctPath of ['/diary/controltests', `/diary/pupil/${context.pupilId}/controltests`]) {
        const pageRes = await loadDiaryPage(ctPath);
        if (pageRes?.html) {
          mergeExams(parseExamResponse(pageRes.html, true));
        }
      }
      for (const calEp of ['/ajax/diary/getDiaryCalendar', '/ajax/diary/getEvents']) {
        const calRaw = await fetchText(calEp, { pupil_id: context.pupilId, class_year_id: context.classYearId });
        if (calRaw) mergeExams(parseExamResponse(calRaw, false));
      }
    }

    const scheduleWeeks = [0, 7, 14, 21, 28, 35].map(offset => ({ offset, ...isoWeekInfo(offset) }));
    const processScheduleRaw = (raw, refYear) => {
      if (!raw) return false;
      const parsedSchedule = parseScheduleResponse(raw);
      if (parsedSchedule) mergeSchedule(parsedSchedule);
      if (!/^\s*[\[{]/.test(raw) && window.ShkoloExtractor?.extractDatedExamsFromScheduleDocument) {
        try {
          const datedExams = window.ShkoloExtractor.extractDatedExamsFromScheduleDocument(parse(raw), refYear);
          if (datedExams.length) mergeExams(datedExams);
        } catch (_) {}
      }
      return Boolean(parsedSchedule);
    };

    const scheduleEndpoints = [
      ['/ajax/diary/getScheduleForClass', { pupil_id: context.pupilId, year: thisIso.year2, week: thisIso.week, class_year_id: context.classYearId }, thisIso.year4],
      ['/ajax/diary/getScheduleForClass', { pupil_id: context.pupilId, year: thisIso.year2, week: thisIso.week }, thisIso.year4],
      ['/ajax/diary/getScheduleForClass', { pupil_id: context.pupilId, year: nextIso.year2, week: nextIso.week, class_year_id: context.classYearId }, nextIso.year4],
      ['/ajax/diary/getScheduleForClass', { pupil_id: context.pupilId, year: nextIso.year2, week: nextIso.week }, nextIso.year4],
      ['/ajax/diary/getScheduleForClass', { pupil_id: context.pupilId, class_year_id: context.classYearId }, thisIso.year4],
      ['/ajax/diary/getScheduleForPupil', { pupil_id: context.pupilId, year: thisIso.year2, week: thisIso.week, class_year_id: context.classYearId }, thisIso.year4],
      ['/ajax/diary/getScheduleForPupil', { pupil_id: context.pupilId, year: nextIso.year2, week: nextIso.week, class_year_id: context.classYearId }, nextIso.year4],
      ['/ajax/diary/getScheduleForPupil', { pupil_id: context.pupilId, class_year_id: context.classYearId }, thisIso.year4]
    ];
    for (const [endpoint, params, refYear] of scheduleEndpoints) {
      const raw = await fetchText(endpoint, params);
      processScheduleRaw(raw, refYear);
    }
    await pool(scheduleWeeks.slice(2), 4, async wi => {
      const raw = await fetchText('/ajax/diary/getScheduleForClass', { pupil_id: context.pupilId, year: wi.year2, week: wi.week, class_year_id: context.classYearId });
      if (!processScheduleRaw(raw, wi.year4)) {
        const altRaw = await fetchText('/ajax/diary/getScheduleForClass', { pupil_id: context.pupilId, year: wi.year2, week: wi.week });
        processScheduleRaw(altRaw, wi.year4);
      }
    });

    const resolvedList = window.ShkoloExtractor.resolveExamTimesWithSchedule(
      Array.from(capturedExams.values()),
      capturedSchedule
    );
    const resolvedExams = window.ShkoloExtractor?.sortExamsAscending
      ? window.ShkoloExtractor.sortExamsAscending(resolvedList)
      : resolvedList;

    return {
      ok: true,
      context,
      homework: Array.from(captured.values()),
      remarks: Array.from(capturedRemarks.values()),
      exams: resolvedExams,
      schedule: capturedSchedule,
      diagnostics: {
        at: new Date().toISOString(),
        homeworkCount: captured.size,
        examCount: resolvedExams.length,
        remarkCount: capturedRemarks.size,
        scheduleSubjects: capturedSchedule?.totalSubjects || 0,
        probes: probeStats.slice()
      }
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'offscreen-collect') return false;
    captured.clear(); capturedRemarks.clear(); capturedExams.clear();
    collect(message.stored || {}).then(sendResponse).catch(error => sendResponse({
      ok: false,
      status: error?.status || 0,
      rateLimited: Boolean(error?.rateLimited),
      error: error.message || 'Грешка при четене от Shkolo.'
    }));
    return true;
  });
})();
