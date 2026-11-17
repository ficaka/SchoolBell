(() => {
  const CONSENT_VERSION = 1;
  let activeCleanup = null;

  function isConsentGranted(consent) {
    return Boolean(consent && consent.consent === true && Number(consent.version) === CONSENT_VERSION);
  }

  function createCaptureNonce() {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    }
    return '';
  }

  function activateContent() {
    if (activeCleanup || typeof window === 'undefined' || typeof document === 'undefined') return;
    if (window.__schoolBellShkoloContentInstalled) return;
    window.__schoolBellShkoloContentInstalled = true;

    const captureNonce = createCaptureNonce();
    const timers = [];
    const intervals = [];
    let domObserver = null;

    function postCaptureControl(type) {
      if (!captureNonce) return;
      try {
        window.postMessage({ type, version: 1, nonce: captureNonce }, location.origin);
      } catch (_) {}
    }

  function sanitizeHtmlForParser(raw) {
    if (window.ShkoloExtractor?.sanitizeHtmlForParser) return window.ShkoloExtractor.sanitizeHtmlForParser(raw);
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
    if (window.ShkoloExtractor?.parseHtmlDocument) return window.ShkoloExtractor.parseHtmlDocument(raw);
    return new DOMParser().parseFromString(sanitizeHtmlForParser(raw), 'text/html');
  }

  const captured = new Map();
  const capturedRemarks = new Map();
  const capturedExams = new Map();
  let capturedSchedule = null;
  const sentHomeworkKeys = new Set();
  const sentRemarkKeys = new Set();
  const sentExamKeys = new Set();
  let sentScheduleSignature = '';
  const detailVisited = new Set();
  let sentLoaded = false;
  let lastSentAt = 0;
  let lastUrl = location.href;
  let scanTimer = null;
  let toastTimer = null;
  let sending = Promise.resolve();
  let activeScanPromise = null;
  let lastHttpStopAt = 0;
  let detailsRunning = false;

  function makeHttpStopError(status) {
    const msg = status === 429
      ? 'Shkolo ограничи временно заявките (HTTP 429). Автоматичното четене спря веднага без повторения.'
      : 'Shkolo отказа достъп (HTTP 403). Четенето спря веднага без повторения.';
    return Object.assign(new Error(msg), { name: 'ShkoloHttpStopError', status, rateLimited: true });
  }

  function isHttpStopError(error) {
    return Boolean(error && (error.name === 'ShkoloHttpStopError' || error.status === 403 || error.status === 429));
  }
  let examsHydratedFor = '';
  let examsHydratedAt = 0;
  let scheduleHydratedFor = '';
  let scheduleHydratedAt = 0;
  let homeworkHydratedFor = '';
  let homeworkHydratedAt = 0;
  let pageContext = {};
  let contextDiscoveryPromise = null;
  let feedbackHydratedFor = '';
  let feedbackHydratedAt = 0;
  let feedbackDetailVisited = new Map();
  let lastTokenFingerprint = null;

  function resetCaptureState(reason = '') {
    captured.clear();
    capturedRemarks.clear();
    capturedExams.clear();
    capturedSchedule = null;
    sentHomeworkKeys.clear();
    sentRemarkKeys.clear();
    sentExamKeys.clear();
    sentScheduleSignature = '';
    detailVisited.clear();
    lastSentAt = 0;
    examsHydratedFor = '';
    examsHydratedAt = 0;
    scheduleHydratedFor = '';
    scheduleHydratedAt = 0;
    homeworkHydratedFor = '';
    homeworkHydratedAt = 0;
    feedbackHydratedFor = '';
    feedbackHydratedAt = 0;
    feedbackDetailVisited.clear();
    sentLoaded = true;
    try {
      chrome.storage.local.remove(['sentHomeworkKeys', 'sentRemarkKeys', 'sentExamKeys', 'sentScheduleSignature']).catch(() => {});
    } catch (_) {}
    if (reason) console.info(`[School Bell] Shkolo capture reset: ${reason}`);
  }

  function contextData() {
    return {
      pupilId: String(pageContext.pupilId || pageContext.pupil_id || pageContext.shkoloPupilId || '').trim(),
      classYearId: String(pageContext.classYearId || pageContext.class_year_id || pageContext.shkoloClassYearId || '').trim(),
      schoolId: String(pageContext.schoolId || pageContext.school_id || '').trim(),
      className: String(pageContext.className || pageContext.class_name || '').trim(),
      schoolName: String(pageContext.schoolName || pageContext.school_name || '').trim()
    };
  }

  function contextSignature(data = contextData()) {
    if (!data.pupilId || !data.classYearId || !data.className) return '';
    return `${data.pupilId}|${data.classYearId}|${data.className}|${data.schoolId}|${data.schoolName}`;
  }

  async function checkTokenChange(config) {
    const token = String(config?.token || '');
    if (lastTokenFingerprint !== null && token !== lastTokenFingerprint) {
      resetCaptureState('token changed');
    }
    lastTokenFingerprint = token;
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

  function mergeSchedule(nextSchedule) {
    if (!nextSchedule || !nextSchedule.totalSubjects || !window.ShkoloExtractor?.mergeSchedules) return false;
    const prevSig = capturedSchedule ? hash(JSON.stringify(capturedSchedule.days)) : '';
    capturedSchedule = window.ShkoloExtractor.mergeSchedules(capturedSchedule, nextSchedule);
    const nextSig = capturedSchedule ? hash(JSON.stringify(capturedSchedule.days)) : '';
    if (capturedSchedule && capturedExams.size && window.ShkoloExtractor.resolveExamTimesWithSchedule) {
      const resolved = window.ShkoloExtractor.resolveExamTimesWithSchedule(Array.from(capturedExams.values()), capturedSchedule);
      mergeExams(resolved);
    }
    return nextSig !== prevSig;
  }

  function scheduleSignature(sched = capturedSchedule) {
    return sched && sched.totalSubjects ? hash(JSON.stringify(sched.days)) : '';
  }

  function showToast(message, isError = false) {
    try {
      let element = document.getElementById('school-bell-shkolo-toast');
      if (!element) {
        element = document.createElement('div');
        element.id = 'school-bell-shkolo-toast';
        element.style.cssText = [
          'position:fixed', 'right:18px', 'bottom:18px', 'z-index:2147483647',
          'max-width:360px', 'padding:12px 16px', 'border-radius:12px',
          'font:600 14px/1.4 system-ui,sans-serif', 'color:#fff',
          'box-shadow:0 12px 30px rgba(0,0,0,.35)', 'transition:opacity .2s ease',
          'pointer-events:none'
        ].join(';');
        document.documentElement.appendChild(element);
      }
      element.style.background = isError ? '#b91c1c' : '#166534';
      element.textContent = message;
      element.style.opacity = '1';
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { element.style.opacity = '0'; }, 4600);
    } catch (_) {}
  }

  async function getConfig() {
    try {
      return await chrome.storage.local.get(['appUrl', 'token', 'autoSync']);
    } catch (_) {
      return {};
    }
  }

  async function loadSent() {
    if (sentLoaded) return;
    sentLoaded = true;
    try {
      const state = await chrome.storage.local.get(['sentHomeworkKeys', 'sentRemarkKeys', 'sentExamKeys', 'sentScheduleSignature']);
      for (const key of Array.isArray(state.sentHomeworkKeys) ? state.sentHomeworkKeys : []) {
        if (typeof key === 'string') sentHomeworkKeys.add(key);
      }
      for (const key of Array.isArray(state.sentRemarkKeys) ? state.sentRemarkKeys : []) {
        if (typeof key === 'string') sentRemarkKeys.add(key);
      }
      for (const key of Array.isArray(state.sentExamKeys) ? state.sentExamKeys : []) {
        if (typeof key === 'string') sentExamKeys.add(key);
      }
      if (typeof state.sentScheduleSignature === 'string') sentScheduleSignature = state.sentScheduleSignature;
    } catch (_) {}
  }

  async function markSent(homeworkKeys, remarkKeys, examKeys = [], scheduleSig = '') {
    for (const key of homeworkKeys) sentHomeworkKeys.add(key);
    for (const key of remarkKeys) sentRemarkKeys.add(key);
    for (const key of examKeys) sentExamKeys.add(key);
    if (scheduleSig) sentScheduleSignature = scheduleSig;
    try {
      await chrome.storage.local.set({
        sentHomeworkKeys: Array.from(sentHomeworkKeys).slice(-1200),
        sentRemarkKeys: Array.from(sentRemarkKeys).slice(-1200),
        sentExamKeys: Array.from(sentExamKeys).slice(-400),
        sentScheduleSignature
      });
    } catch (_) {}
  }

  function pending() {
    const homework = [];
    const remarks = [];
    const exams = [];
    for (const [key, item] of captured.entries()) {
      if (!sentHomeworkKeys.has(key)) homework.push({ key, item });
    }
    for (const [key, item] of capturedRemarks.entries()) {
      if (!sentRemarkKeys.has(key)) remarks.push({ key, item });
    }
    for (const [key, item] of capturedExams.entries()) {
      if (!sentExamKeys.has(key)) exams.push({ key, item });
    }
    return { homework, remarks, exams };
  }

  function allCaptured() {
    return {
      homework: Array.from(captured.entries()).map(([key, item]) => ({ key, item })),
      remarks: Array.from(capturedRemarks.entries()).map(([key, item]) => ({ key, item })),
      exams: Array.from(capturedExams.entries()).map(([key, item]) => ({ key, item }))
    };
  }

  function looksLikeAccessDenied() {
    try {
      const text = (document.body?.innerText || document.body?.textContent || '').slice(0, 1500).toLowerCase();
      return /(нямате\s+достъп|нямате\s+права|access\s+denied|forbidden)/i.test(text);
    } catch (_) { return false; }
  }

  function isUserLoggedIn() {
    try {
      if (document.querySelector('a[href*="logout"], a[href*="/auth/logout"], button[data-logout], .logout, [title*="Изход"], [aria-label*="Изход"]')) return true;
      if (document.querySelector('.user-profile, .user-menu, .dropdown-user, .profile-userpic, a[href*="/user/"], a[href*="/profile"]')) return true;
      if (document.querySelector('#pupil_id_field, #class_year_id_field, a[href*="/diary/pupil/"], a[href*="/pupil/"], .pupil-card, .pupil-row')) return true;
      if (document.querySelector('.page-sidebar, .page-header, .page-container, #tableFeedbacks, .coursesNav')) return true;
      if (window.user || window.currentUser || window.shkolo || window.Shkolo) return true;
    } catch (_) {}
    return false;
  }

  function looksLikeLoginPage() {
    try {
      if (isUserLoggedIn()) return false;
      if (/(login|signin|sign-in|auth\/login)/i.test(location.pathname)) return true;
      const loginForm = document.querySelector('form[action*="login"]');
      if (loginForm && loginForm.querySelector('input[type="password"]')) return true;
      const usernameInput = document.querySelector('input[name="username"], input[name="email"], input[name="phone"]');
      const passwordInput = document.querySelector('input[type="password"]');
      if (usernameInput && passwordInput && !isUserLoggedIn()) return true;
    } catch (_) {}
    return false;
  }

  async function send(reason = 'auto', force = false) {
    const config = await getConfig();
    await checkTokenChange(config);
    await loadSent();
    const pendingItems = force ? allCaptured() : pending();
    const homework = pendingItems.homework;
    const remarks = pendingItems.remarks;
    let exams = pendingItems.exams;
    const curSchedSig = scheduleSignature();
    const schedulePending = Boolean(capturedSchedule && curSchedSig && (force || curSchedSig !== sentScheduleSignature));
    const found = captured.size + capturedRemarks.size + capturedExams.size + (capturedSchedule?.totalSubjects || 0);
    if (found === 0) {
      if (looksLikeLoginPage()) {
        return { ok: false, count: 0, found: 0, needsLogin: true, error: 'Не си влязъл в Shkolo в този браузър. Влез веднъж в app.shkolo.bg (с „Запомни ме“).' };
      }
      if (looksLikeAccessDenied()) {
        return { ok: false, count: 0, found: 0, accessDenied: true, error: 'Нямате достъп до тази страница в Shkolo. Влезте в app.shkolo.bg с родителски или ученически профил.' };
      }
      const context = contextData();
      if (!context.pupilId || !context.classYearId || !context.className) {
        return { ok: false, count: 0, found: 0, notReady: true, error: 'Shkolo още не е разпознат напълно. Отвори app.shkolo.bg и изчакай да зареди.' };
      }
    }
    if (!homework.length && !remarks.length && !exams.length && !schedulePending && !force) {
      return { ok: true, count: 0, found, message: 'Няма нови домашни, забележки, изпити или промени в програмата.' };
    }
    if (config.autoSync !== true && !force) {
      return { ok: true, count: 0, found, message: 'Автоматичната синхронизация е изключена.' };
    }
    if (!config.token) {
      return { ok: false, count: 0, found, error: 'Разширението още не е свързано с училищното приложение.' };
    }
    const context = contextData();
    if (!context.pupilId || !context.classYearId || !context.className) {
      return { ok: false, count: 0, found, error: 'Shkolo още не е разпознат напълно. Отвори началната страница на Shkolo и изчакай да зареди.' };
    }
    try {
      let examPayloads = exams.map(item => item.item);
      if (capturedSchedule && examPayloads.length && window.ShkoloExtractor?.resolveExamTimesWithSchedule) {
        examPayloads = window.ShkoloExtractor.resolveExamTimesWithSchedule(examPayloads, capturedSchedule);
      }
      if (examPayloads.length && window.ShkoloExtractor?.sortExamsAscending) {
        examPayloads = window.ShkoloExtractor.sortExamsAscending(examPayloads);
      }
      const response = await chrome.runtime.sendMessage({
        type: 'sync-homework',
        version: chrome.runtime.getManifest?.().version || '',
        context,
        items: homework.map(item => item.item),
        remarks: remarks.map(item => item.item),
        exams: examPayloads,
        schedule: schedulePending ? capturedSchedule : undefined,
        reason
      });
      if (response?.ok) {
        await markSent(
          homework.map(item => item.key),
          remarks.map(item => item.key),
          exams.map(item => item.key),
          schedulePending ? curSchedSig : ''
        );
        lastSentAt = Date.now();
        const added = response.added || 0;
        const notesAdded = response.notesAdded || 0;
        const examsAdded = response.examsAdded || 0;
        if (added || notesAdded || examsAdded || response.updated || response.notesUpdated || response.examsUpdated || response.scheduleUpdated) {
          const schedPart = response.scheduleUpdated ? ', програма обновена' : '';
          showToast(`Shkolo: ${added} нови домашни, ${notesAdded} нови забележки, ${examsAdded} изпита${schedPart}.`);
        }
      } else if (response?.error) {
        showToast(`Shkolo: ${response.error}`, true);
      }
      return {
        ...(response && typeof response === 'object' ? response : {}),
        ok: !!response?.ok,
        count: homework.length + remarks.length + exams.length + (schedulePending ? 1 : 0),
        found
      };
    } catch (error) {
      showToast(`Shkolo: ${error.message || 'грешка при синхронизация'}`, true);
      return { ok: false, count: 0, found, error: error.message || 'Грешка при синхронизация.' };
    }
  }

  function enqueueSend(reason = 'auto', force = false) {
    const task = () => send(reason, force);
    sending = sending.then(task, task);
    return sending;
  }

  function trustedExamUrl(raw) {
    try {
      const url = new URL(String(raw || ''), location.href);
      return /\/ajax\/diary\/getControlTests?(?:ForPupil|ByCourse)?(?:\/|$)|\/diary\/controltests?(?:\/|$)|\/controltests?(?:\/|$)/i.test(url.pathname);
    } catch (_) { return false; }
  }

  function trustedScheduleUrl(raw) {
    try {
      const url = new URL(String(raw || ''), location.href);
      return /\/ajax\/diary\/getSchedule(?:ForClass|ForPupil)?(?:\/|$)|\/diary\/(?:pupil|schedule)(?:\/|$)|\/schedule(?:\/|$)/i.test(url.pathname);
    } catch (_) { return false; }
  }

  function extractFromDocument(documentValue, includeExams = false) {
    const result = { homework: [], remarks: [], exams: [], schedule: null };
    if (!window.ShkoloExtractor) return result;
    try { result.homework.push(...window.ShkoloExtractor.extractFromDocument(documentValue)); } catch (_) {}
    try { result.remarks.push(...window.ShkoloExtractor.extractRemarksFromDocument(documentValue)); } catch (_) {}
    try { result.schedule = window.ShkoloExtractor.extractScheduleFromDocument(documentValue); } catch (_) {}
    if (includeExams) {
      try { result.exams.push(...window.ShkoloExtractor.extractExamsFromDocument(documentValue, true)); } catch (_) {}
    }
    return result;
  }

  function scanDocument() {
    if (!window.ShkoloExtractor || !document.documentElement) return { homework: 0, remarks: 0, exams: 0 };
    const found = { homework: [], remarks: [], exams: [] };
    const includeExams = trustedExamUrl(location.href) || Boolean(document.querySelector('.controlTestBody, #tab_control_test, #tab_control_tests'));
    const current = extractFromDocument(document, includeExams);
    found.homework.push(...current.homework);
    found.remarks.push(...current.remarks);
    found.exams.push(...current.exams);
    if (current.schedule) mergeSchedule(current.schedule);
    for (const frame of Array.from(document.querySelectorAll('iframe'))) {
      try {
        if (!frame.contentDocument) continue;
        const nested = extractFromDocument(frame.contentDocument, includeExams);
        found.homework.push(...nested.homework);
        found.remarks.push(...nested.remarks);
        found.exams.push(...nested.exams);
        if (nested.schedule) mergeSchedule(nested.schedule);
      } catch (_) {}
    }
    merge(found.homework);
    mergeRemarks(found.remarks);
    mergeExams(found.exams);
    return { homework: captured.size, remarks: capturedRemarks.size, exams: capturedExams.size, scheduleSubjects: capturedSchedule?.totalSubjects || 0 };
  }

  function addDetailLink(links, raw) {
    if (!raw) return;
    try {
      const url = new URL(String(raw), location.href);
      if (url.origin !== location.origin) return;
      if (!/\/diary\/shi\/|\/homework(?:\/|$)|\/diary\/[^?#]*(?:homework|domash|task|assignment|feedback|remark|otziv)(?:\/|$)|\/feedback(?:\/|$)|\/remark(?:\/|$)/i.test(url.pathname + url.search)) return;
      if (url.href === location.href) return;
      links.add(url.href);
    } catch (_) {}
  }

  function collectDetailLinks() {
    // Отваряме само адреси, които вече принадлежат на заснет елемент.
    // Така страницата не може да „открие“ стари домашни от навигацията.
    const links = new Set();
    for (const item of captured.values()) addDetailLink(links, item.url);
    for (const item of capturedRemarks.values()) addDetailLink(links, item.url);
    return links;
  }

  async function hydrateDetails() {
    if (detailsRunning) return;
    detailsRunning = true;
    try {
      const links = Array.from(collectDetailLinks());
      let fetched = 0;
      for (const link of links) {
        if (fetched >= 14) break;
        if (detailVisited.has(link)) continue;
        detailVisited.add(link);
        fetched += 1;
        try {
          const response = await fetch(link, {
            credentials: 'include',
            cache: 'no-store',
            headers: {
              'Accept': 'text/html,application/xhtml+xml,application/json,text/plain',
              'X-Requested-With': 'XMLHttpRequest'
            }
          });
          if (response.status === 403 || response.status === 429) throw makeHttpStopError(response.status);
          if (!response.ok) continue;
          const type = response.headers.get('content-type') || '';
          const text = await response.text();
          if (!text || text.length > 2_000_000) continue;
          let homework = [];
          let remarks = [];
          if (/json/i.test(type) || /^\s*[\[{]/.test(text)) {
            homework = window.ShkoloExtractor.extractFromJson(text);
            remarks = window.ShkoloExtractor.extractRemarksFromJson(text);
          } else {
            const parsed = parseHtmlDocument(text);
            homework = window.ShkoloExtractor.extractFromDocument(parsed);
            remarks = window.ShkoloExtractor.extractRemarksFromDocument(parsed);
          }
          merge(homework);
          mergeRemarks(remarks);
        } catch (error) {
          if (isHttpStopError(error)) throw error;
        }
        await wait(280);
      }
      if (detailVisited.size > 600) detailVisited.clear();
    } finally {
      detailsRunning = false;
    }
  }

  const homeworkCourseCache = new Map();

  function wait(ms) {
    if (document.hidden) return Promise.resolve();
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function mapPool(items, limit, fn) {
    const queue = items.slice();
    let stopError = null;
    const workers = Array.from({ length: Math.max(1, Math.min(limit, queue.length)) }, async () => {
      while (queue.length && !stopError) {
        const item = queue.shift();
        try {
          await fn(item);
        } catch (error) {
          if (isHttpStopError(error) && !stopError) stopError = error;
        }
      }
    });
    await Promise.all(workers);
    if (stopError) throw stopError;
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

  function mergeContextFromPerformance() {
    try {
      for (const entry of performance.getEntriesByType('resource')) {
        const name = String(entry.name || '');
        if (!pageContext.pupilId) {
          const pupil = /[?&]pupil_id=(\d{4,20})/.exec(name);
          if (pupil) pageContext = { ...pageContext, pupilId: pupil[1] };
        }
        if (!pageContext.classYearId) {
          const classYear = /[?&]class_year_id=(\d{4,20})/.exec(name);
          if (classYear) pageContext = { ...pageContext, classYearId: classYear[1] };
        }
      }
    } catch (_) {}
  }

  async function discoverDiaryContext(pupilId) {
    if (!validShkoloId(pupilId)) return;
    if (contextDiscoveryPromise) return contextDiscoveryPromise;
    contextDiscoveryPromise = (async () => {
      try {
        const response = await fetch(`/diary/pupil/${pupilId}`, {
          credentials: 'include',
          cache: 'no-store',
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          }
        });
        if (response.status === 403 || response.status === 429) throw makeHttpStopError(response.status);
        if (response.ok) {
          const text = await response.text();
          if (text && text.length <= 2_000_000) {
            const doc = parseHtmlDocument(text);
            mergeContextFromDocument(doc);
            rememberCourses(courseListFromDocument(doc));
            const extracted = extractFromDocument(doc, true);
            merge(extracted.homework);
            mergeRemarks(extracted.remarks);
            mergeExams(extracted.exams);
            mergeSchedule(extracted.schedule);
          }
        }
      } catch (error) {
        if (isHttpStopError(error)) throw error;
      }
      try {
        const timelineResp = await fetch(`/pupil/${pupilId}`, {
          credentials: 'include',
          cache: 'no-store',
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          }
        });
        if (timelineResp.status === 403 || timelineResp.status === 429) throw makeHttpStopError(timelineResp.status);
        if (timelineResp.ok) {
          const tText = await timelineResp.text();
          if (tText && tText.length <= 2_000_000) {
            const tDoc = parseHtmlDocument(tText);
            mergeContextFromDocument(tDoc);
            const tExt = extractFromDocument(tDoc, true);
            merge(tExt.homework);
            mergeRemarks(tExt.remarks);
            mergeExams(tExt.exams);
            mergeSchedule(tExt.schedule);
          }
        }
      } catch (error) {
        if (isHttpStopError(error)) throw error;
      }
    })().finally(() => { contextDiscoveryPromise = null; });
    return contextDiscoveryPromise;
  }

  async function ensureContext(force = false) {
    if (!pageContext.pupilId) {
      try {
        const stored = await chrome.storage.local.get(['lastPupilId', 'lastClassYearId', 'lastClassName', 'lastSchoolId', 'lastSchoolName']);
        if (stored.lastPupilId && validShkoloId(stored.lastPupilId)) {
          pageContext.pupilId = String(stored.lastPupilId);
          if (!pageContext.classYearId && stored.lastClassYearId) pageContext.classYearId = String(stored.lastClassYearId);
          if (!pageContext.className && stored.lastClassName) pageContext.className = String(stored.lastClassName);
          if (!pageContext.schoolId && stored.lastSchoolId) pageContext.schoolId = String(stored.lastSchoolId);
          if (!pageContext.schoolName && stored.lastSchoolName) pageContext.schoolName = String(stored.lastSchoolName);
        }
      } catch (_) {}
    }
    mergeContextFromDocument(document);
    mergeContextFromPerformance();
    const pupilId = pageContext.pupilId || pageContext.pupil_id || '';
    if (validShkoloId(pupilId)) {
      if (!pageContext.classYearId || !pageContext.className) {
        await discoverDiaryContext(pupilId);
        mergeContextFromDocument(document);
      }
      try {
        chrome.storage.local.set({
          lastPupilId: pupilId,
          lastClassYearId: pageContext.classYearId || '',
          lastClassName: pageContext.className || '',
          lastSchoolId: pageContext.schoolId || '',
          lastSchoolName: pageContext.schoolName || ''
        }).catch(() => {});
      } catch (_) {}
    }
    return contextData();
  }

  function pageCsrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')?.trim()
      || document.querySelector('input[name="_token"]')?.getAttribute('value')?.trim()
      || '';
  }

  async function fetchText(path, params = {}) {
    const url = new URL(path, location.origin);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }
    const headers = {
      'Accept': 'text/html,application/json,text/plain,*/*',
      'X-Requested-With': 'XMLHttpRequest'
    };
    const token = pageCsrfToken();
    if (token) headers['X-CSRF-TOKEN'] = token;
    const response = await fetch(url.href, {
      credentials: 'include',
      cache: 'no-store',
      headers
    });
    if (response.status === 403 || response.status === 429) throw makeHttpStopError(response.status);
    if (!response.ok) return '';
    const text = await response.text();
    if (!text || text.length > 2_000_000) return '';
    return text;
  }

  const discoveredCourses = new Map();

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

  function courseListFromDocument(root) {
    if (window.ShkoloExtractor?.extractCoursesFromDocument) {
      return window.ShkoloExtractor.extractCoursesFromDocument(root);
    }
    return [];
  }

  function selectedCourseFromDocument(root) {
    if (window.ShkoloExtractor?.selectedCourseFromDocument) {
      return window.ShkoloExtractor.selectedCourseFromDocument(root);
    }
    return { subject: '', teacher: '' };
  }

  async function hydrateFeedback(force = false) {
    const context = await ensureContext(force);
    const pupilId = context.pupilId;
    if (!pupilId) return;
    const cacheKey = `${pupilId}|${context.classYearId}`;
    if (!force && feedbackHydratedFor === cacheKey && Date.now() - feedbackHydratedAt < 4 * 60 * 1000) return;
    feedbackHydratedFor = cacheKey;
    feedbackHydratedAt = Date.now();
    // Таблицата getFeedbacksForPupil съдържа само бройки по предмети.
    // Истинските записи се крият в getFeedbackDataByTypeAndCourse за всяка
    // двойка type_id (1=похвала, 2=забележка) и mix_id от бутоните.
    const summary = await fetchText('/ajax/diary/getFeedbacksForPupil', {
      pupil_id: pupilId,
      class_year_id: context.classYearId
    });
    let summaryDoc = null;
    if (summary) {
      // Обобщението съдържа само бройки (и други секции, напр. извинени дни) — не е източник на записи.
      summaryDoc = parseHtmlDocument(summary);
    }
    const pairs = new Map();
    const candidateElements = [
      ...(summaryDoc ? Array.from(summaryDoc.querySelectorAll('button, a, [role="button"], .badge-holder, [data-type_id], [data-mix_id], [class*="feedbacks"]')) : []),
      ...Array.from(document.querySelectorAll('#tableFeedbacks button, #tableFeedbacks a, #tableFeedbacks [role="button"], #tableFeedbacks [data-type_id], #tableFeedbacks .feedbacks, [id*="feedback" i] button'))
    ];
    for (const el of candidateElements) {
      let typeId = el.getAttribute('data-type_id') || el.getAttribute('data-type') || '';
      let mixId = el.getAttribute('data-mix_id') || el.getAttribute('data-mix') || el.getAttribute('data-cyc_group_id') || '';

      const idStr = String(el.id || '');
      if ((!typeId || !mixId) && idStr) {
        const idMatch = /(?:^|[^\d])([12])\s*[:_]\s*([a-zA-Z0-9_-]+)/.exec(idStr);
        if (idMatch) {
          if (!typeId) typeId = idMatch[1];
          if (!mixId) mixId = idMatch[2];
        }
      }

      const onclickStr = String(el.getAttribute('data-attr-onclick') || el.getAttribute('onclick') || '');
      if ((!typeId || !mixId) && onclickStr) {
        const clickMatch = /(?:getFeedback\w*|feedbacks?)\s*\(\s*[^)]*?['"]?([12])['"]?\s*,\s*['"]?([a-zA-Z0-9_-]+)['"]?/i.exec(onclickStr);
        if (clickMatch) {
          if (!typeId) typeId = clickMatch[1];
          if (!mixId) mixId = clickMatch[2];
        }
      }

      if (!typeId) {
        if (el.classList?.contains('appraisal') || el.closest?.('.appraisal')) typeId = '1';
        else if (el.classList?.contains('remark') || el.closest?.('.remark')) typeId = '2';
      }

      if (!typeId || !mixId) continue;
      const textDigits = String(el.textContent || '').replace(/[^\d]/g, '');
      const count = textDigits ? parseInt(textDigits, 10) : NaN;
      if (!isNaN(count) && count <= 0) continue;
      pairs.set(`${typeId}:${mixId}`, { typeId, mixId });
    }

    await mapPool(Array.from(pairs.values()), 6, async pair => {
      const detailKey = `${pupilId}|${pair.typeId}:${pair.mixId}`;
      if (!force && Date.now() - (feedbackDetailVisited.get(detailKey) || 0) < 4 * 60 * 1000) return;
      const html = await fetchText('/ajax/diary/getFeedbackDataByTypeAndCourse', {
        pupil_id: pupilId,
        class_year_id: context.classYearId,
        type_id: pair.typeId,
        mix_id: pair.mixId
      });
      if (!html) return;
      const doc = parseHtmlDocument(html);
      const kind = pair.typeId === '1' ? 'praise' : 'remark';
      mergeRemarks(window.ShkoloExtractor.extractRemarksFromDocument(doc, { kind }));
      feedbackDetailVisited.set(detailKey, Date.now());
    });
    if (feedbackDetailVisited.size > 800) feedbackDetailVisited.clear();
  }

  async function hydrateKnownHomework(force = false) {
    const context = await ensureContext(force);
    const pupilId = context.pupilId;
    if (!pupilId) return;
    const cacheKey = `${pupilId}|${context.classYearId}`;
    if (!force && homeworkHydratedFor === cacheKey && Date.now() - homeworkHydratedAt < 4 * 60 * 1000) return;
    homeworkHydratedFor = cacheKey;
    homeworkHydratedAt = Date.now();
    rememberCourses(courseListFromDocument(document));

    const processHomeworkRaw = (raw, options = {}) => {
      if (!raw) return null;
      const extracted = window.ShkoloExtractor?.extractHomeworkFromResponse
        ? window.ShkoloExtractor.extractHomeworkFromResponse(raw, options)
        : { items: window.ShkoloExtractor.extractFromDocument(parseHtmlDocument(raw), options), courses: [], doc: parseHtmlDocument(raw) };
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
      return { week, year2 };
    };
    const thisIso = isoWeekInfo(0);
    const nextIso = isoWeekInfo(7);

    // getHomeworks връща таблицата само на избрания курс или за текущата седмица.
    let summary = await fetchText('/ajax/diary/getHomeworks', { pupil_id: pupilId, class_year_id: context.classYearId });
    if (summary) {
      const summaryRes = processHomeworkRaw(summary, { trusted: true });
      const hwPages = window.ShkoloExtractor?.extractPaginationPages
        ? window.ShkoloExtractor.extractPaginationPages(summary, summaryRes?.doc, 8)
        : [];
      await mapPool(hwPages, 3, async pageNum => {
        const nextRaw = await fetchText('/ajax/diary/getHomeworks', { pupil_id: pupilId, class_year_id: context.classYearId, page: pageNum });
        processHomeworkRaw(nextRaw, { trusted: true });
      });
    }
    if (!captured.size) {
      for (const fallbackParams of [
        { pupil_id: pupilId },
        { pupil_id: pupilId, year: thisIso.year2, week: thisIso.week, class_year_id: context.classYearId },
        { pupil_id: pupilId, year: nextIso.year2, week: nextIso.week, class_year_id: context.classYearId }
      ]) {
        const altRaw = await fetchText('/ajax/diary/getHomeworks', fallbackParams);
        if (altRaw) processHomeworkRaw(altRaw, { trusted: true });
        if (captured.size) break;
      }
    }
    const courses = Array.from(discoveredCourses.values()).slice(0, 40);
    await mapPool(courses, 6, async course => {
      const courseKey = `${pupilId}|${course.id}`;
      if (!force && Date.now() - (homeworkCourseCache.get(courseKey) || 0) < 4 * 60 * 1000) return;
      const raw = await fetchText('/ajax/diary/getHomeworks', {
        pupil_id: pupilId,
        class_year_id: context.classYearId,
        cyc_group_id: course.id
      });
      if (!raw) return;
      const res = processHomeworkRaw(raw, { trusted: true, subject: course.subject, teacher: course.teacher });
      const pages = window.ShkoloExtractor?.extractPaginationPages
        ? window.ShkoloExtractor.extractPaginationPages(raw, res?.doc, 5)
        : [];
      for (const pageNum of pages) {
        const nextRaw = await fetchText('/ajax/diary/getHomeworks', {
          pupil_id: pupilId,
          class_year_id: context.classYearId,
          cyc_group_id: course.id,
          page: pageNum
        });
        processHomeworkRaw(nextRaw, { trusted: true, subject: course.subject, teacher: course.teacher });
      }
      homeworkCourseCache.set(courseKey, Date.now());
    });
    if (!captured.size) {
      const altHw = await fetchText('/ajax/diary/getHomeworksForPupil', {
        pupil_id: pupilId,
        class_year_id: context.classYearId
      }) || await fetchText('/ajax/diary/getHomeworksForPupil', { pupil_id: pupilId });
      processHomeworkRaw(altHw, { trusted: true });
    }
    if (homeworkCourseCache.size > 400) homeworkCourseCache.clear();
  }

  async function hydrateSchedule(force = false) {
    const context = await ensureContext(force);
    const pupilId = context.pupilId;
    if (!pupilId) return;
    const cacheKey = `${pupilId}|${context.classYearId}`;
    if (!force && scheduleHydratedFor === cacheKey && Date.now() - scheduleHydratedAt < 10 * 60 * 1000) return;
    scheduleHydratedFor = cacheKey;
    scheduleHydratedAt = Date.now();
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
    const futureWeeks = [14, 21, 28, 35].map(offset => isoWeekInfo(offset));
    const processScheduleText = (text, refYear) => {
      if (!text) return false;
      const isJson = /^\s*[\[{]/.test(text);
      const doc = isJson ? null : parseHtmlDocument(text);
      const parsed = isJson
        ? window.ShkoloExtractor.extractScheduleFromJson(text)
        : window.ShkoloExtractor.extractScheduleFromDocument(doc);
      if (parsed) mergeSchedule(parsed);
      if (doc && window.ShkoloExtractor?.extractDatedExamsFromScheduleDocument) {
        try {
          const dated = window.ShkoloExtractor.extractDatedExamsFromScheduleDocument(doc, refYear);
          if (dated.length) mergeExams(dated);
        } catch (_) {}
      }
      return Boolean(parsed);
    };
    const endpoints = [
      ['/ajax/diary/getScheduleForClass', { pupil_id: pupilId, year: thisIso.year2, week: thisIso.week, class_year_id: context.classYearId }, thisIso.year4],
      ['/ajax/diary/getScheduleForClass', { pupil_id: pupilId, year: thisIso.year2, week: thisIso.week }, thisIso.year4],
      ['/ajax/diary/getScheduleForClass', { pupil_id: pupilId, year: nextIso.year2, week: nextIso.week, class_year_id: context.classYearId }, nextIso.year4],
      ['/ajax/diary/getScheduleForClass', { pupil_id: pupilId, class_year_id: context.classYearId }, thisIso.year4],
      ['/ajax/diary/getScheduleForPupil', { pupil_id: pupilId, year: thisIso.year2, week: thisIso.week, class_year_id: context.classYearId }, thisIso.year4],
      ['/ajax/diary/getScheduleForPupil', { pupil_id: pupilId, class_year_id: context.classYearId }, thisIso.year4]
    ];
    for (const [endpoint, params, refYear] of endpoints) {
      const text = await fetchText(endpoint, params);
      processScheduleText(text, refYear);
    }
    await mapPool(futureWeeks, 3, async wi => {
      const text = await fetchText('/ajax/diary/getScheduleForClass', { pupil_id: pupilId, year: wi.year2, week: wi.week, class_year_id: context.classYearId });
      if (!processScheduleText(text, wi.year4)) {
        const altText = await fetchText('/ajax/diary/getScheduleForClass', { pupil_id: pupilId, year: wi.year2, week: wi.week });
        processScheduleText(altText, wi.year4);
      }
    });
  }

  async function hydrateExams(force = false) {
    const context = await ensureContext(force);
    const pupilId = context.pupilId;
    if (!pupilId) return;
    const cacheKey = `${pupilId}|${context.classYearId}`;
    if (!force && examsHydratedFor === cacheKey && Date.now() - examsHydratedAt < 4 * 60 * 1000) return;
    examsHydratedFor = cacheKey;
    examsHydratedAt = Date.now();

    const parseRawExams = (raw, trusted = true) => (/^\s*[\[{]/.test(raw)
      ? window.ShkoloExtractor.extractExamsFromJson(raw, trusted)
      : window.ShkoloExtractor.extractExamsFromDocument(parseHtmlDocument(raw), trusted));

    const collectEndpoint = async (endpoint, params, extraCourse = null) => {
      const firstRaw = await fetchText(endpoint, params);
      if (!firstRaw) return 0;
      const firstParsed = window.ShkoloExtractor?.extractExamsFromResponse
        ? window.ShkoloExtractor.extractExamsFromResponse(firstRaw, true)
        : { items: parseRawExams(firstRaw, true), pages: [] };
      const applyCourse = items => (extraCourse?.subject
        ? (items || []).map(ex => (!ex.subject || ex.subject === ex.title ? { ...ex, subject: extraCourse.subject } : ex))
        : (items || []));
      const initialCount = capturedExams.size;
      mergeExams(applyCourse(firstParsed.items));
      if (firstParsed.pages.length) {
        await mapPool(firstParsed.pages, 3, async pageNum => {
          const nextRaw = await fetchText(endpoint, { ...params, page: pageNum });
          if (nextRaw) mergeExams(applyCourse(parseRawExams(nextRaw, true)));
        });
      } else if (firstParsed.items.length >= 1) {
        let addedByPage = 0;
        for (let pageNum = 2; pageNum <= 15; pageNum += 1) {
          const nextRaw = await fetchText(endpoint, { ...params, page: pageNum });
          if (!nextRaw || nextRaw === firstRaw) break;
          const before = capturedExams.size;
          const nextItems = applyCourse(parseRawExams(nextRaw, true));
          if (!nextItems.length) break;
          mergeExams(nextItems);
          if (capturedExams.size === before) break;
          addedByPage += (capturedExams.size - before);
        }
        if (addedByPage === 0 && firstParsed.items.length >= 4) {
          const step = firstParsed.items.length;
          for (let offset = step; offset <= step * 6; offset += step) {
            const offRaw = await fetchText(endpoint, { ...params, start: offset, length: step });
            if (!offRaw || offRaw === firstRaw) break;
            const before = capturedExams.size;
            const nextItems = applyCourse(parseRawExams(offRaw, true));
            if (!nextItems.length) break;
            mergeExams(nextItems);
            if (capturedExams.size === before) break;
          }
        }
      }
      return capturedExams.size - initialCount;
    };

    await collectEndpoint('/ajax/diary/getControlTests', {
      pupil_id: pupilId,
      class_year_id: context.classYearId
    });
    await collectEndpoint('/ajax/diary/getControlTests', { pupil_id: pupilId });
    if (capturedExams.size <= 15) {
      await collectEndpoint('/ajax/diary/getControlTestsForPupil', {
        pupil_id: pupilId,
        class_year_id: context.classYearId
      });
      await collectEndpoint('/ajax/diary/getControlTestsForPupil', { pupil_id: pupilId });
    }
    const soonestExam = Array.from(capturedExams.values()).sort((a, b) => a.date.localeCompare(b.date))[0];
    const farOnly = soonestExam && soonestExam.date > new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10);
    if (capturedExams.size <= 12 || farOnly) {
      await mapPool(Array.from(discoveredCourses.values()).slice(0, 30), 6, async course => {
        await collectEndpoint('/ajax/diary/getControlTests', {
          pupil_id: pupilId,
          class_year_id: context.classYearId,
          cyc_group_id: course.id
        }, course);
      });
      for (const ctPath of ['/diary/controltests', `/diary/pupil/${pupilId}/controltests`]) {
        const pageRaw = await fetchText(ctPath);
        if (pageRaw) mergeExams(parseRawExams(pageRaw, true));
      }
      for (const calEp of ['/ajax/diary/getDiaryCalendar', '/ajax/diary/getEvents']) {
        const calRaw = await fetchText(calEp, { pupil_id: pupilId, class_year_id: context.classYearId });
        if (calRaw) mergeExams(parseRawExams(calRaw, false));
      }
    }
    if (capturedSchedule && capturedExams.size && window.ShkoloExtractor?.resolveExamTimesWithSchedule) {
      mergeExams(window.ShkoloExtractor.resolveExamTimesWithSchedule(Array.from(capturedExams.values()), capturedSchedule));
    }
  }

  async function scanAndSend(reason = 'page', force = false) {
    if (!force && lastHttpStopAt && Date.now() - lastHttpStopAt < 60 * 60 * 1000) {
      return { ok: false, rateLimited: true, error: 'Синхронизацията е временно спряна след HTTP 403/429 от Shkolo.' };
    }
    if (activeScanPromise) return activeScanPromise;
    activeScanPromise = (async () => {
      try {
        const config = await getConfig();
        await checkTokenChange(config);
        if (config.autoSync !== true && !force) {
          return { ok: true, count: 0, found: captured.size + capturedRemarks.size + capturedExams.size + (capturedSchedule?.totalSubjects || 0), message: 'Автоматичната синхронизация е изключена.' };
        }
        if (!config.token && !force) {
          return { ok: true, count: 0, found: captured.size + capturedRemarks.size + capturedExams.size + (capturedSchedule?.totalSubjects || 0), message: 'Разширението още не е свързано с училищното приложение.' };
        }
        await ensureContext(force);
        if (pageContext.pupilId && !location.pathname.includes('/diary/pupil/')) {
          await discoverDiaryContext(pageContext.pupilId);
        }
        scanDocument();
        await hydrateFeedback(force);
        await hydrateKnownHomework(force);
        await hydrateSchedule(force);
        await hydrateExams(force);
        await hydrateDetails();
        scanDocument();
        return await enqueueSend(reason, force);
      } catch (error) {
        if (isHttpStopError(error)) {
          lastHttpStopAt = Date.now();
          if (force) showToast(`Shkolo: ${error.message}`, true);
          return { ok: false, status: error.status, rateLimited: true, error: error.message };
        }
        throw error;
      }
    })().finally(() => {
      activeScanPromise = null;
    });
    return activeScanPromise;
  }

  function scheduleScan(delay = 1800) {
    if (disposed) return;
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => { if (!disposed) scanAndSend('page').catch(() => {}); }, delay);
  }

  function shouldScan() {
    if (!document.documentElement) return false;
    const text = document.body?.textContent || '';
    return /(домашн|homework|задач|assignment|забележ|отзив|feedback|remark|контролн|изпит|тест|control\s*test|exam|програм|разписан|schedule|timetable)/i.test(text)
      || /\/(diary|dashboard|homework|feedback|remark|control|exam|schedule|program)/i.test(location.pathname);
  }

  let disposed = false;

  function onWindowMessage(event) {
    if (disposed || event.source !== window || event.origin !== location.origin) return;
    const data = event.data;
    if (!data) return;
    if (data.__schoolBellShkoloContext === true) {
      const previous = contextSignature();
      pageContext = { ...pageContext, ...data };
      const next = contextSignature();
      if (previous && next && previous !== next) resetCaptureState('Shkolo pupil/class changed');
      if (next) scheduleScan(500);
      return;
    }
    if (data.__schoolBellShkoloCapture !== true || typeof data.body !== 'string') return;
    if (!window.ShkoloExtractor) return;
    let homework = [];
    let remarks = [];
    let exams = [];
    let schedule = null;
    const trustedExams = trustedExamUrl(data.url);
    const trustedSchedule = trustedScheduleUrl(data.url);
    try {
      if (/\/ajax\/diary\/getFeedbacksForPupil/i.test(new URL(data.url, location.href).pathname)) return;
    } catch (_) {}
    try {
      const type = String(data.contentType || '');
      if (trustedExams) {
        // Само доверен отговор за контролни може да създава изпити.
        if (/json/i.test(type) || /^\s*[\[{]/.test(data.body)) {
          exams = window.ShkoloExtractor.extractExamsFromJson(data.body, true);
        } else if (/html|xml/i.test(type) || /<(table|div|li|tr|html)/i.test(data.body)) {
          exams = window.ShkoloExtractor.extractExamsFromDocument(
            parseHtmlDocument(data.body), true
          );
        }
      } else if (trustedSchedule) {
        if (/json/i.test(type) || /^\s*[\[{]/.test(data.body)) {
          schedule = window.ShkoloExtractor.extractScheduleFromJson(data.body);
        } else if (/html|xml/i.test(type) || /<(table|div|li|tr|html)/i.test(data.body)) {
          const parsed = parseHtmlDocument(data.body);
          schedule = window.ShkoloExtractor.extractScheduleFromDocument(parsed);
          homework = window.ShkoloExtractor.extractFromDocument(parsed);
          remarks = window.ShkoloExtractor.extractRemarksFromDocument(parsed);
        }
      } else if (/json/i.test(type) || /^\s*[\[{]/.test(data.body)) {
        homework = window.ShkoloExtractor.extractFromJson(data.body);
        remarks = window.ShkoloExtractor.extractRemarksFromJson(data.body);
      } else if (/html|xml/i.test(type) || /<(table|div|li|tr|html)/i.test(data.body)) {
        const parsed = parseHtmlDocument(data.body);
        let feedbackKind = '';
        try {
          const requestUrl = new URL(data.url, location.href);
          if (/getFeedbackDataByTypeAndCourse/i.test(requestUrl.pathname)) {
            feedbackKind = requestUrl.searchParams.get('type_id') === '1' ? 'praise' : 'remark';
          }
        } catch (_) {}
        homework = window.ShkoloExtractor.extractFromDocument(parsed);
        remarks = window.ShkoloExtractor.extractRemarksFromDocument(parsed, feedbackKind ? { kind: feedbackKind } : {});
        schedule = window.ShkoloExtractor.extractScheduleFromDocument(parsed);
      } else {
        homework = window.ShkoloExtractor.extractFromText(data.body);
        remarks = window.ShkoloExtractor.extractRemarksFromText(data.body);
      }
    } catch (_) {}
    const scheduleChanged = schedule ? mergeSchedule(schedule) : false;
    if (!homework.length && !remarks.length && !exams.length && !scheduleChanged) return;
    merge(homework);
    mergeRemarks(remarks);
    mergeExams(exams);
    getConfig().then(async config => {
      if (disposed) return;
      await checkTokenChange(config);
      if (disposed || config.autoSync !== true || !config.token) return;
      enqueueSend('network').catch(() => {});
    }).catch(() => {});
  }

  function onRuntimeMessage(message, _sender, sendResponse) {
    if (disposed) return false;
    if (message?.type === 'sync-now') {
      if (looksLikeLoginPage()) {
        sendResponse({ ok: false, needsLogin: true, error: 'Не си влязъл в Shkolo в този браузър. Влез веднъж в app.shkolo.bg (с „Запомни ме“) и синхронизацията ще продължи автоматично.' });
        return false;
      }
      scanAndSend('manual', true)
        .then(result => sendResponse({ ...result, found: captured.size + capturedRemarks.size + capturedExams.size + (capturedSchedule?.totalSubjects || 0) }))
        .catch(error => sendResponse({ ok: false, error: error.message || 'Грешка при синхронизация.' }));
      return true;
    }
    if (message?.type === 'get-capture-status') {
      getConfig().then(config => {
        sendResponse({
          url: location.href,
          captured: captured.size,
          remarks: capturedRemarks.size,
          exams: capturedExams.size,
          scheduleSubjects: capturedSchedule?.totalSubjects || 0,
          sentHomework: sentHomeworkKeys.size,
          sentRemarks: sentRemarkKeys.size,
          sentExams: sentExamKeys.size,
          lastSentAt,
          autoSync: config.autoSync === true,
          pageContext
        });
      }).catch(() => {
        sendResponse({
          url: location.href,
          captured: captured.size,
          remarks: capturedRemarks.size,
          exams: capturedExams.size,
          scheduleSubjects: capturedSchedule?.totalSubjects || 0,
          sentHomework: sentHomeworkKeys.size,
          sentRemarks: sentRemarkKeys.size,
          sentExams: sentExamKeys.size,
          lastSentAt,
          autoSync: false,
          pageContext
        });
      });
      return true;
    }
    return false;
  }

  function onVisibilityChange() {
    if (!disposed && !document.hidden && shouldScan()) scheduleScan(1200);
  }

  function onDocumentClick(event) {
    if (disposed) return;
    const target = event.target;
    if (!target) return;
    const text = ((target.textContent || '') + ' ' + (target.getAttribute?.('href') || '')).toLowerCase();
    if (/(отзив|забележ|похвал|домашн|feedback|remark|review|homework|контролн|изпит|control|exam)/.test(text)) {
      scheduleScan(400);
      scheduleScan(1500);
    }
  }

  function onHashChange() {
    if (!disposed) scheduleScan(600);
  }

  function onPopState() {
    if (!disposed) scheduleScan(600);
  }

  window.addEventListener('message', onWindowMessage);
  chrome.runtime.onMessage.addListener(onRuntimeMessage);

  function start() {
    if (disposed) return;
    postCaptureControl('school-bell:activate-shkolo-capture');
    loadSent().catch(() => {});
    timers.push(setTimeout(() => { if (!disposed && shouldScan()) scanAndSend('page').catch(() => {}); }, 1200));
    timers.push(setTimeout(() => { if (!disposed && shouldScan()) scanAndSend('page').catch(() => {}); }, 4500));
    timers.push(setTimeout(() => { if (!disposed && shouldScan()) scanAndSend('page').catch(() => {}); }, 9500));
    intervals.push(setInterval(() => { if (!disposed && !document.hidden && shouldScan()) scanAndSend('page').catch(() => {}); }, 30000));
    document.addEventListener('visibilitychange', onVisibilityChange);
    // Сканиране при превключване на табове (Отзиви, Домашни)
    document.addEventListener('click', onDocumentClick, { passive: true });
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('popstate', onPopState);
    try {
      domObserver = new MutationObserver(() => {
        if (!disposed && shouldScan()) scheduleScan(2600);
      });
      domObserver.observe(document.documentElement, { childList: true, subtree: true });
    } catch (_) {}
    intervals.push(setInterval(() => {
      if (!disposed && location.href !== lastUrl) {
        lastUrl = location.href;
        scheduleScan(1600);
      }
    }, 1500));
  }

  postCaptureControl('school-bell:activate-shkolo-capture');
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  activeCleanup = () => {
    if (disposed) return;
    disposed = true;
    clearTimeout(scanTimer);
    scanTimer = null;
    clearTimeout(toastTimer);
    toastTimer = null;
    while (timers.length) clearTimeout(timers.pop());
    while (intervals.length) clearInterval(intervals.pop());
    if (domObserver) {
      try { domObserver.disconnect(); } catch (_) {}
      domObserver = null;
    }
    document.removeEventListener('DOMContentLoaded', start);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    document.removeEventListener('click', onDocumentClick);
    window.removeEventListener('hashchange', onHashChange);
    window.removeEventListener('popstate', onPopState);
    window.removeEventListener('message', onWindowMessage);
    chrome.runtime?.onMessage?.removeListener?.(onRuntimeMessage);
    postCaptureControl('school-bell:deactivate-shkolo-capture');
    captured.clear();
    capturedRemarks.clear();
    capturedExams.clear();
    capturedSchedule = null;
    try { delete window.__schoolBellShkoloContentInstalled; } catch (_) { window.__schoolBellShkoloContentInstalled = false; }
  };
  }

  function deactivateContent() {
    if (!activeCleanup) return;
    const cleanup = activeCleanup;
    activeCleanup = null;
    cleanup();
  }

  let activationCheckSeq = 0;

  async function syncActivationState(consentValue) {
    const seq = ++activationCheckSeq;
    if (!isConsentGranted(consentValue)) {
      deactivateContent();
      return;
    }
    try {
      const storedConfig = await chrome.storage?.local?.get(['token', 'autoSync']);
      if (seq !== activationCheckSeq) return;
      const hasToken = Boolean(String(storedConfig?.token || '').trim());
      const autoSyncEnabled = storedConfig?.autoSync === true;
      if (hasToken && autoSyncEnabled) activateContent();
      else deactivateContent();
    } catch (_) {
      if (seq === activationCheckSeq) deactivateContent();
    }
  }

  chrome.storage?.onChanged?.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    const hasConsentChange = Object.prototype.hasOwnProperty.call(changes, 'consent');
    const hasTokenChange = Object.prototype.hasOwnProperty.call(changes, 'token');
    const hasAutoSyncChange = Object.prototype.hasOwnProperty.call(changes, 'autoSync');
    if (!hasConsentChange && !hasTokenChange && !hasAutoSyncChange) return;
    if (hasConsentChange) {
      syncActivationState(changes.consent.newValue);
      return;
    }
    chrome.storage?.local?.get(['consent']).then(stored => {
      return syncActivationState(stored?.consent);
    }).catch(() => {
      deactivateContent();
    });
  });

  chrome.storage?.local?.get(['consent']).then(stored => {
    return syncActivationState(stored?.consent);
  }).catch(() => {});
})();
