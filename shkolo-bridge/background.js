const OFFICIAL_APP_URL = 'https://schoolbell.duckdns.org';
const CONSENT_VERSION = 1;

const DEFAULTS = {
  appUrl: OFFICIAL_APP_URL,
  token: '',
  autoSync: false,
  shareWithClass: false
};

function isConsentGranted(consent) {
  return Boolean(consent && consent.consent === true && Number(consent.version) === CONSENT_VERSION);
}

async function getConsentRecord() {
  const { consent } = await chrome.storage.local.get(['consent']);
  return consent || null;
}

async function hasConsent() {
  return isConsentGranted(await getConsentRecord());
}

function consentRequiredResult() {
  return {
    ok: false,
    consentRequired: true,
    error: 'Необходимо е първо да дадете съгласие в прозореца на разширението.'
  };
}

function normalizeBaseUrl() {
  return OFFICIAL_APP_URL;
}

async function getConfig() {
  if (!(await hasConsent())) return null;
  const stored = await chrome.storage.local.get(['appUrl', 'token', 'autoSync', 'shareWithClass']);
  if (stored.appUrl !== OFFICIAL_APP_URL) {
    await chrome.storage.local.set({ appUrl: OFFICIAL_APP_URL });
  }
  return {
    appUrl: OFFICIAL_APP_URL,
    token: stored.token || '',
    autoSync: stored.autoSync === true,
    shareWithClass: stored.shareWithClass === true
  };
}

function examSortKey(exam) {
  const date = String(exam?.date || '9999-12-31').slice(0, 10);
  const tm = /^(\d{1,2}):(\d{2})/.exec(String(exam?.time || ''));
  const hhmm = tm ? `${tm[1].padStart(2, '0')}:${tm[2]}` : '23:59';
  return `${date}T${hhmm}`;
}

function sortExamsChronological(items) {
  return (Array.isArray(items) ? items.slice() : []).sort((a, b) => {
    const byTime = examSortKey(a).localeCompare(examSortKey(b));
    if (byTime) return byTime;
    return String(a?.title || a?.subject || '').localeCompare(String(b?.title || b?.subject || ''), 'bg');
  });
}

// Изпраща всичко на части (сървърът приема до 200/200/100 на заявка), за да не
// се губят забележки/похвали при голям брой записи. Изпитите се подреждат от
// най-близката дата/час към най-далечната.
async function syncHomework(items, remarks, exams, version, context, reason = 'auto', schedule = null) {
  const allHomework = Array.isArray(items) ? items : [];
  const allRemarks = Array.isArray(remarks) ? remarks : [];
  const allExams = sortExamsChronological(exams);
  const chunks = Math.max(1, Math.ceil(allHomework.length / 200), Math.ceil(allRemarks.length / 200), Math.ceil(allExams.length / 100));
  const totals = { added: 0, updated: 0, notesAdded: 0, notesUpdated: 0, examsAdded: 0, examsUpdated: 0, ignoredOld: 0, invalidItems: 0, expiredRemoved: 0 };
  let scheduleUpdated = false;
  let scheduleSubjects = 0;
  let last = null;
  for (let i = 0; i < chunks; i += 1) {
    const result = await syncChunk(
      allHomework.slice(i * 200, (i + 1) * 200),
      allRemarks.slice(i * 200, (i + 1) * 200),
      allExams.slice(i * 100, (i + 1) * 100),
      version, context, reason, i === 0 ? schedule : null
    );
    if (!result.ok) return result;
    for (const key of Object.keys(totals)) totals[key] += Number(result[key] || 0);
    if (result.scheduleUpdated) scheduleUpdated = true;
    if (Number(result.scheduleSubjects) > scheduleSubjects) scheduleSubjects = Number(result.scheduleSubjects);
    last = result;
  }
  if (chunks > 1) {
    await chrome.storage.local.set({
      lastAdded: totals.added,
      lastUpdated: totals.updated,
      lastNotesAdded: totals.notesAdded,
      lastNotesUpdated: totals.notesUpdated,
      lastExamsAdded: totals.examsAdded,
      lastExamsUpdated: totals.examsUpdated,
      lastScheduleUpdated: scheduleUpdated,
      lastScheduleSubjects: scheduleSubjects
    });
  }
  return { ...(last || {}), ...totals, scheduleUpdated, scheduleSubjects, ok: true };
}

async function syncChunk(items, remarks, exams, version, context, reason, schedule = null) {
  const config = await getConfig();
  if (!config) return consentRequiredResult();
  if (!config.token) return { ok: false, error: 'Липсва код за връзка. Генерирай код от училищното приложение.' };
  const homeworkItems = Array.isArray(items) ? items.slice(0, 200) : [];
  const remarkItems = Array.isArray(remarks) ? remarks.slice(0, 200) : [];
  const examItems = Array.isArray(exams) ? exams.slice(0, 100) : [];
  const hasSchedule = Boolean(schedule && typeof schedule === 'object' && schedule.days);
  // Ръчната/фоновата синхронизация винаги пита сървъра, за да обнови
  // „последно синхронизиране“ и да изчисти изтеклите домашни и изпити.
  if (!homeworkItems.length && !remarkItems.length && !examItems.length && !hasSchedule && reason !== 'manual') {
    return { ok: true, added: 0, updated: 0, notesAdded: 0, notesUpdated: 0, examsAdded: 0, examsUpdated: 0, total: 0, notesTotal: 0, examsTotal: 0, scheduleUpdated: false, message: 'Няма нови домашни, забележки, изпити или програма.' };
  }
  const base = normalizeBaseUrl();
  const extensionVersion = String(version || chrome.runtime.getManifest().version);
  const safeContext = context && typeof context === 'object' ? {
    pupilId: String(context.pupilId || '').slice(0, 30),
    classYearId: String(context.classYearId || '').slice(0, 30),
    className: String(context.className || '').slice(0, 40),
    schoolId: String(context.schoolId || '').slice(0, 30),
    schoolName: String(context.schoolName || '').slice(0, 160)
  } : {};
  const payload = {
    items: homeworkItems,
    remarks: remarkItems,
    exams: examItems,
    context: safeContext,
    shareWithClass: config.shareWithClass === true,
    client: 'shkolo-bridge',
    version: extensionVersion
  };
  if (hasSchedule) payload.schedule = schedule;
  let response;
  try {
    response = await fetch(`${base}/api/shkolo/homework`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.token}`
      },
      body: JSON.stringify(payload)
    });
  } catch (_) {
    return { ok: false, error: 'Не може да се свърже с училищното приложение. Провери интернет връзката си.' };
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const rateLimited = response.status === 403 || response.status === 429;
    const error = response.status === 401
      ? 'Кодът за връзка е невалиден или е заменен. Генерирай нов код от приложението.'
      : (data.error || `Сървърът върна грешка ${response.status}.`);
    await chrome.storage.local.set({ lastError: error });
    return { ok: false, status: response.status, rateLimited, error };
  }
  await chrome.storage.local.set({
    lastSyncAt: data.lastSyncAt || new Date().toISOString(),
    lastAdded: data.added || 0,
    lastUpdated: data.updated || 0,
    lastTotal: data.total || 0,
    lastNotesAdded: data.notesAdded || 0,
    lastNotesUpdated: data.notesUpdated || 0,
    lastNotesTotal: data.notesTotal || 0,
    lastExamsAdded: data.examsAdded || 0,
    lastExamsUpdated: data.examsUpdated || 0,
    lastExamsTotal: data.examsTotal || 0,
    lastScheduleUpdated: Boolean(data.scheduleUpdated),
    lastScheduleSubjects: Number(data.scheduleSubjects || 0),
    lastBoundClassName: data.boundClassName || '',
    lastIgnoredOld: data.ignoredOld || 0,
    lastInvalidItems: data.invalidItems || 0,
    lastError: ''
  });
  return { ok: true, ...data };
}

async function testConnection() {
  const config = await getConfig();
  if (!config) return consentRequiredResult();
  if (!config.token) return { ok: false, error: 'Липсва код за връзка. Генерирай код от училищното приложение.' };
  const base = normalizeBaseUrl();
  try {
    const response = await fetch(`${base}/api/shkolo/homework`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.token}`
      },
      body: JSON.stringify({
        items: [],
        remarks: [],
        exams: [],
        client: 'shkolo-bridge-test',
        version: chrome.runtime.getManifest().version
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = response.status === 401
        ? 'Кодът за връзка е невалиден или е заменен. Генерирай нов код от приложението.'
        : (data.error || `Сървърът върна грешка ${response.status}.`);
      await chrome.storage.local.set({ lastError: error });
      return { ok: false, error };
    }
    await chrome.storage.local.set({ lastSyncAt: data.lastSyncAt || new Date().toISOString(), lastError: '' });
    return { ok: true, total: data.total || 0, notesTotal: data.notesTotal || 0, examsTotal: data.examsTotal || 0, boundClassName: data.boundClassName || '' };
  } catch (_) {
    const error = 'Не може да се свърже с училищното приложение.';
    await chrome.storage.local.set({ lastError: error }).catch(() => {});
    return { ok: false, error };
  }
}

const AUTO_SYNC_ALARM = 'shkolo-auto-sync';
const AUTO_SYNC_MINUTES = 60;
const AUTO_SYNC_MIN_GAP_MS = 60 * 60 * 1000;
const SYNC_TIMEOUT_MS = 120 * 1000;
let activeSync = null;

async function runShkoloSync({ auto = false } = {}) {
  const config = await getConfig();
  if (!config) return consentRequiredResult();
  if (!config.token) return { ok: false, error: 'Разширението още не е свързано. Постави кода за връзка от приложението в разширението.' };
  if (auto) {
    if (!config.autoSync) return { ok: true, skipped: true, message: 'Автоматичната синхронизация е изключена.' };
    const { lastAutoAttemptAt = 0 } = await chrome.storage.local.get(['lastAutoAttemptAt']);
    if (Date.now() - Number(lastAutoAttemptAt || 0) < AUTO_SYNC_MIN_GAP_MS) return { ok: true, skipped: true, message: 'Синхронизирано наскоро.' };
  }
  await chrome.storage.local.set({ lastAutoAttemptAt: Date.now() });
  const keepAlive = setInterval(() => { try { chrome.runtime.getPlatformInfo(() => {}); } catch (_) {} }, 20000);
  try {
    return await runShkoloSyncInner(auto);
  } finally {
    clearInterval(keepAlive);
  }
}

async function ensureOffscreen() {
  const url = chrome.runtime.getURL('offscreen.html');
  try {
    const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [url] });
    if (contexts.length) return;
  } catch (_) {}
  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['DOM_PARSER'],
      justification: 'Разчитане на данни от Shkolo във фонов режим, без отваряне на страница.'
    });
  } catch (error) {
    if (!/single offscreen|already exists/i.test(String(error?.message))) throw error;
  }
}

function collectViaOffscreen(stored = {}) {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve({ ok: false, error: 'Shkolo не отговори навреме.' }), SYNC_TIMEOUT_MS);
    chrome.runtime.sendMessage({ type: 'offscreen-collect', stored }, response => {
      clearTimeout(timer);
      const error = chrome.runtime.lastError;
      resolve(error ? { ok: false, error: error.message } : (response || { ok: false, error: 'Няма отговор от Shkolo.' }));
    });
  });
}

// Цялата синхронизация е във фонов режим: без таб, без прозорец.
async function runShkoloSyncInner(auto = false) {
  let collected;
  try {
    await ensureOffscreen();
    const stored = await chrome.storage.local.get(['lastPupilId', 'lastClassYearId', 'lastClassName', 'lastSchoolId', 'lastSchoolName']);
    collected = await collectViaOffscreen(stored);
  } finally {
    try { await chrome.offscreen.closeDocument(); } catch (_) {}
  }
  if (!collected?.ok) {
    await chrome.storage.local.set({ lastError: collected?.error || 'Синхронизацията не беше успешна.' });
    return collected || { ok: false, error: 'Синхронизацията не беше успешна.' };
  }
  if (collected.context?.pupilId || collected.diagnostics) {
    await chrome.storage.local.set({
      ...(collected.context?.pupilId ? {
        lastPupilId: collected.context.pupilId,
        lastClassYearId: collected.context.classYearId,
        lastClassName: collected.context.className,
        lastSchoolId: collected.context.schoolId,
        lastSchoolName: collected.context.schoolName
      } : {}),
      ...(collected.diagnostics ? { shkoloLastDiagnostics: collected.diagnostics } : {})
    });
  }
  const result = await syncHomework(
    collected.homework,
    collected.remarks,
    collected.exams,
    undefined,
    collected.context,
    auto ? 'auto' : 'manual',
    collected.schedule || null
  );
  if (!result?.ok && result?.error) await chrome.storage.local.set({ lastError: result.error });
  return result;
}

function triggerShkoloSync(options = {}) {
  // Една синхронизация в даден момент — повторните натискания чакат същия резултат.
  if (!activeSync) {
    activeSync = runShkoloSync(options)
      .catch(error => ({ ok: false, error: error.message || 'Грешка при синхронизация.' }))
      .finally(() => { activeSync = null; });
  }
  return activeSync;
}

async function ensureAutoSyncAlarm(enabled = null) {
  try {
    if (!(await hasConsent())) {
      await chrome.alarms?.clear?.(AUTO_SYNC_ALARM);
      return;
    }
    let shouldEnable = enabled;
    if (shouldEnable === null) {
      const { autoSync } = await chrome.storage.local.get(['autoSync']);
      shouldEnable = autoSync === true;
    }
    if (!shouldEnable) {
      await chrome.alarms?.clear?.(AUTO_SYNC_ALARM);
      return;
    }
    const existing = await chrome.alarms.get(AUTO_SYNC_ALARM);
    if (!existing) await chrome.alarms.create(AUTO_SYNC_ALARM, { delayInMinutes: 2, periodInMinutes: AUTO_SYNC_MINUTES });
  } catch (_) {}
}

async function stopBackgroundTasks() {
  try { await chrome.alarms?.clearAll?.(); } catch (_) {}
  try { await chrome.offscreen?.closeDocument?.(); } catch (_) {}
}

chrome.alarms?.onAlarm.addListener(alarm => {
  if (alarm.name === AUTO_SYNC_ALARM) triggerShkoloSync({ auto: true }).catch(() => {});
});

chrome.storage?.onChanged?.addListener((changes, area) => {
  if (area !== 'local' || !Object.hasOwn(changes, 'consent')) return;
  if (!isConsentGranted(changes.consent?.newValue)) {
    stopBackgroundTasks();
  }
});

chrome.runtime.onStartup.addListener(async () => {
  if (!(await hasConsent())) return;
  await ensureAutoSyncAlarm();
});

chrome.runtime.onInstalled.addListener(async details => {
  const consented = await hasConsent();
  if (details?.reason === 'install' && !consented) {
    try {
      const onboardingUrl = chrome.runtime?.getURL?.('popup.html');
      if (onboardingUrl) await chrome.tabs?.create?.({ url: onboardingUrl });
    } catch (_) {}
    return;
  }
  if (!consented) return;
  const stored = await chrome.storage.local.get(null);
  await chrome.storage.local.set({
    ...DEFAULTS,
    ...stored,
    appUrl: OFFICIAL_APP_URL,
    autoSync: stored.autoSync === true,
    shareWithClass: stored.shareWithClass === true
  });
  await ensureAutoSyncAlarm(stored.autoSync === true);
});

const SHKOLO_ORIGIN = 'https://app.shkolo.bg';

function isExtensionPageSender(sender) {
  return !sender?.tab && Boolean(sender?.id) && sender.id === chrome?.runtime?.id;
}

function isAllowedContentSender(sender, allowedOrigin) {
  if (isExtensionPageSender(sender)) return true;
  if (sender.origin && sender.origin === allowedOrigin) return true;
  const senderUrl = String(sender.url || sender.tab?.url || '');
  return senderUrl.startsWith(`${allowedOrigin}/`) || senderUrl === allowedOrigin;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'get-consent') {
    if (!isAllowedContentSender(sender, OFFICIAL_APP_URL) && !isAllowedContentSender(sender, SHKOLO_ORIGIN)) return false;
    getConsentRecord()
      .then(consent => sendResponse({ ok: true, consent }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === 'revoke-consent') {
    if (!isExtensionPageSender(sender)) return false;
    (async () => {
      try {
        await stopBackgroundTasks();
        const stored = await chrome.storage.local.get(['token']);
        const token = String(stored?.token || '').trim();
        let serverDeleted = false;
        let serverStatus = 0;
        let serverError = '';
        if (token) {
          try {
            const response = await fetch(`${OFFICIAL_APP_URL}/api/shkolo/data`, {
              method: 'DELETE',
              cache: 'no-store',
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            serverStatus = response.status;
            const data = await response.json().catch(() => ({}));
            if (response.ok) {
              serverDeleted = true;
            } else if (response.status === 401) {
              serverError = 'Кодът за връзка вече е невалиден или изтрит на сървъра; локалните данни в браузъра бяха изчистени.';
            } else {
              serverError = data.error || `Сървърът върна грешка ${response.status} при изтриване на Shkolo данните.`;
            }
          } catch (_) {
            serverError = 'Няма връзка със сървъра при изтриване на Shkolo данните — проверете интернет връзката или изтрийте данните от „👤 Моят профил“ в приложението.';
          }
        }
        await chrome.storage.local.clear();
        sendResponse({ ok: true, hadToken: Boolean(token), serverDeleted, serverStatus, serverError });
      } catch (error) {
        sendResponse({ ok: false, error: error.message });
      }
    })();
    return true;
  }
  if (message?.type === 'trigger-shkolo-sync') {
    if (!isAllowedContentSender(sender, OFFICIAL_APP_URL)) return false;
    triggerShkoloSync({ auto: message.auto === true }).then(sendResponse).catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === 'sync-homework') {
    if (!isAllowedContentSender(sender, SHKOLO_ORIGIN)) return false;
    hasConsent().then(granted => {
      if (!granted) return consentRequiredResult();
      return syncHomework(message.items, message.remarks, message.exams, message.version, message.context, message.reason, message.schedule || null);
    }).then(sendResponse).catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === 'test-connection') {
    if (!isExtensionPageSender(sender)) return false;
    testConnection().then(sendResponse).catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === 'get-state') {
    if (!isExtensionPageSender(sender)) return false;
    hasConsent().then(async granted => {
      if (!granted) return consentRequiredResult();
      const state = await chrome.storage.local.get(null);
      const { token: _removedToken, ...safeState } = state || {};
      return { ok: true, state: { ...safeState, appUrl: OFFICIAL_APP_URL } };
    }).then(sendResponse).catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === 'save-config') {
    if (!isExtensionPageSender(sender)) return false;
    (async () => {
      try {
        if (!(await hasConsent())) {
          sendResponse(consentRequiredResult());
          return;
        }
        const appUrl = OFFICIAL_APP_URL;
        const token = String(message.token || '').trim();
        const autoSync = message.autoSync === true;
        const shareWithClass = message.shareWithClass === true;
        const current = await chrome.storage.local.get(['token', 'appUrl']);
        const updates = { appUrl, token, autoSync, shareWithClass, lastError: '' };
        if (current.token && current.token !== token) {
          updates.sentHomeworkKeys = [];
          updates.sentRemarkKeys = [];
          updates.sentExamKeys = [];
          updates.sentScheduleSignature = '';
          updates.lastAdded = 0;
          updates.lastUpdated = 0;
          updates.lastNotesAdded = 0;
          updates.lastNotesUpdated = 0;
          updates.lastExamsAdded = 0;
          updates.lastExamsUpdated = 0;
          updates.lastScheduleUpdated = false;
          updates.lastScheduleSubjects = 0;
          updates.lastBoundClassName = '';
          updates.lastPupilId = '';
          updates.lastClassYearId = '';
          updates.lastClassName = '';
          updates.lastSchoolId = '';
          updates.lastSchoolName = '';
        }
        await chrome.storage.local.set(updates);
        await ensureAutoSyncAlarm(autoSync);
        const tokenChanged = !!token && current.token !== token;
        const syncStarted = tokenChanged && message.skipSync !== true;
        sendResponse({ ok: true, appUrl, token, autoSync, shareWithClass, syncStarted });
        // Веднъж поставен кодът — първата синхронизация тръгва сама.
        if (syncStarted) {
          await chrome.storage.local.set({ lastAutoAttemptAt: 0 });
          triggerShkoloSync({ auto: false }).catch(() => {});
        }
      } catch (error) {
        sendResponse({ ok: false, error: error.message });
      }
    })();
    return true;
  }
  return false;
});
