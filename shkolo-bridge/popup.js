const OFFICIAL_APP_URL = 'https://schoolbell.duckdns.org';
const CONSENT_VERSION = 1;
const ENABLE_SUPPORT_DONATION = false;
const $ = id => document.getElementById(id);

let currentLang = 'bg';

const POPUP_I18N = {
  bg: {
    headTitle: 'Училищен Будилник Bridge',
    headSubtitle: 'Лични домашни, забележки, похвали и изпити, без парола за Shkolo.',
    consentHeading: 'Разкриване и съгласие',
    consentIntro: 'За да работи, <strong>Училищен Будилник Bridge</strong> чете от вашата вече отворена сесия в <strong>https://app.shkolo.bg</strong> само:',
    consentItem1: 'предстоящи домашни работи, контролни/изпити за текущата учебна година (подредени хронологично) и седмична учебна програма;',
    consentItem2: 'лични забележки и похвали за ученика;',
    consentItem3: 'учебен контекст (<code>pupilId</code>, клас и училище).',
    consentTransport: 'Данните се изпращат по HTTPS към <strong>https://schoolbell.duckdns.org</strong> чрез вашия личен код за връзка. Разширението <strong>не съхранява и не изпраща</strong> вашата парола, бисквитки, оценки, отсъствия или лични съобщения. Автоматичната почасова синхронизация е изключена по подразбиране.',
    consentSharing: '<strong>Споделяне и обхват:</strong> по подразбиране опцията <strong>„Споделяй с класа“ е изключена</strong> — домашните, изпитите за текущата учебна година (с предмет, учител, дата и час) и седмичната учебна програма остават видими <strong>само за вашия профил</strong>, докато изрично не включите споделянето с другите потребители на същия клас в Училищен Будилник. Забележките и похвалите (свободен текст от учители) винаги остават строго лични само за вашия профил.',
    consentDeletion: '<strong>Какво се изтрива при оттегляне:</strong> ако има въведен код за връзка, разширението първо извиква <code>DELETE /api/shkolo/data</code> на сървъра (трие личните ви Shkolo забележки/похвали, личните Shkolo домашни/изпити и кода за връзка) и след това чисти локалното хранилище на браузъра. Профилът ви в приложението и домашните/изпитите/програмата, вече споделени с класа (когато има други потребители в същия клас), остават на сървъра до пълно изтриване на профила.',
    consentParent: 'Съгласието се дава от <strong>родител или настойник</strong>. Ако ученикът е под 14 години, не давайте съгласие вместо него без знанието на родител.',
    consentUnofficial: '<strong>Важно:</strong> Неофициален инструмент, несвързан със и неодобрен от Shkolo (Школо ООД). Автоматизираният достъп може да нарушава условията на Shkolo и платформата може да ограничи или прекрати профила ви. Разширението се ползва изцяло на отговорност на потребителя.',
    linkPrivacy: 'Политика за поверителност',
    linkTerms: 'Условия за ползване',
    btnAccept: 'Съгласен съм и продължавам',
    btnDecline: 'Отказвам',
    declineNotice: 'Без вашето съгласие разширението не чете и не изпраща данни от Shkolo. Можете да приемете по всяко време или да го премахнете от <code>chrome://extensions</code>. Данните, вече синхронизирани на сървъра, се изтриват от приложението чрез „👤 Моят профил“ → „Изтрий моя профил“ в <a href="https://schoolbell.duckdns.org/" target="_blank" rel="noopener noreferrer">Училищен Будилник</a>.',
    revokedTitle: '<strong>Съгласието е оттеглено и локалните данни в браузъра са изтрити.</strong>',
    revokedDeleted: 'Изтрито: локалните настройки, кодът за връзка, личните Shkolo забележки/похвали, несподелените (лични) Shkolo домашни/изпити и активната Shkolo връзка на сървъра (при наличен токен и интернет връзка).',
    revokedRemains: 'Остава на сървъра: самият ви уеб профил в Училищен Будилник, както и домашните/изпитите/учебната програма, споделени с класа, ако в класа има други потребители. За пълно заличаване влезте в <a href="https://schoolbell.duckdns.org/" target="_blank" rel="noopener noreferrer">Училищен Будилник</a> → „👤 Моят профил“ → „Изтрий моя профил завинаги“.',
    appIntro: 'Разширението чете дневника в <strong>app.shkolo.bg</strong> във фонов режим с вече влезлия потребител и изпраща домашни, забележки, похвали, изпити и седмичната програма към <strong>Училищен Будилник</strong> (<code>https://schoolbell.duckdns.org</code>).',
    labelAppUrl: 'Адрес на приложението (фиксиран)',
    labelToken: 'Код за връзка',
    tokenPlaceholder: 'Постави кода от „Домашни от Shkolo“ в приложението',
    labelAutoSync: 'Автоматична синхронизация на всеки час във фонов режим (по подразбиране изключена — включи я по желание)',
    labelShareWithClass: 'Споделяй домашните, изпитите и програмата с класа (по подразбиране изключено — само в твоя профил, докато не го включиш)',
    btnSave: 'Запази',
    btnTest: 'Тествай',
    btnSyncNow: 'Синхронизирай сега',
    btnOpenShkolo: 'Отвори Shkolo',
    howTitle: 'Как работи?',
    howStep1: 'Влез веднъж в Shkolo в този браузър (с „Запомни ме“).',
    howStep2: 'Постави кода и натисни „Запази“ — първата синхронизация тръгва веднага във фонов режим, без да отваряш таб на Shkolo.',
    howStep3: 'Ако включиш отметката за автоматична синхронизация, данните се обновяват сами на всеки час. Можеш да синхронизираш и ръчно по всяко време.',
    howStep4: 'Разширението изпраща предметите, описания, учители, срокове, забележки, похвали, изпити и седмичната програма, свързани с ученика и класа.',
    howStep5: 'Паролата и бисквитките за Shkolo остават само в браузъра.',
    howDisclaimer: '<strong>Важно:</strong> Неофициален инструмент, несвързан със и неодобрен от Shkolo (Школо ООД). Използването за четене от Shkolo може да наруши техните условия и да доведе до ограничаване на профила ви; ползва се на отговорност на потребителя.',
    btnRevoke: 'Оттегли съгласието и изтрий данните',
    revokeConfirmText: 'При потвърждение разширението ще: (1) изпрати <code>DELETE /api/shkolo/data</code> към сървъра (ако има код за връзка), с което трие синхронизираните Shkolo забележки/похвали, личните Shkolo домашни/изпити и кода за връзка; и (2) изтрие локалните данни и настройки в браузъра. На сървъра остават вашият уеб профил и домашните/изпитите/програмата, споделени с класа (докато има други ученици в класа). За пълно изтриване използвайте „👤 Моят профил“ → „Изтрий моя профил завинаги“ в <a href="https://schoolbell.duckdns.org/" target="_blank" rel="noopener noreferrer">Училищен Будилник</a>.',
    btnRevokeYes: 'Да, оттегли и изтрий',
    btnRevokeCancel: 'Отказ',
    footerNote: 'Личен код · не го споделяй',
    footerPrivacy: 'Поверителност',
    footerTerms: 'Условия'
  },
  en: {
    headTitle: 'School Bell Bridge',
    headSubtitle: 'Personal homework, remarks, praises & exams without your Shkolo password.',
    consentHeading: 'Data Disclosure & Consent',
    consentIntro: 'To operate, <strong>School Bell Bridge</strong> reads from your already-opened session on <strong>https://app.shkolo.bg</strong> only:',
    consentItem1: 'upcoming homework assignments, scheduled control tests/exams for the current school year (ordered chronologically), and weekly class timetable;',
    consentItem2: 'personal student remarks and praises;',
    consentItem3: 'student diary context (<code>pupilId</code>, class, and school).',
    consentTransport: 'Data is sent over HTTPS to <strong>https://schoolbell.duckdns.org</strong> using your personal connection code. The extension <strong>never reads, stores, or transmits</strong> your Shkolo password, cookies, grades, absences, or private chat messages. Background hourly auto-sync is OFF by default.',
    consentSharing: '<strong>Class sharing & scope:</strong> by default, <strong>“Share with class” is OFF</strong> — synced homework, exams for the current school year (subject, teacher, date, and time), and weekly timetable remain visible <strong>only to your own profile</strong> unless you explicitly enable sharing with classmates in School Bell. Remarks and praises (teacher free text) always remain strictly private to your profile.',
    consentDeletion: '<strong>What is deleted upon withdrawal:</strong> if a connection code is saved, the extension first calls <code>DELETE /api/shkolo/data</code> on the server (erasing your personal Shkolo remarks/praises, unshared Shkolo homework/exams, and connection token) before clearing local browser storage. Your web account and items already shared with the class (if other classmates are registered) remain on the server until full account deletion.',
    consentParent: 'Consent must be granted by a <strong>parent or legal guardian</strong>. If the student is under 14, do not grant consent without parental knowledge.',
    consentUnofficial: '<strong>Important:</strong> Unofficial tool, not affiliated with or endorsed by Shkolo (Shkolo Ltd.). Automated access may conflict with Shkolo’s Terms and may lead to account restriction; used strictly at the user’s own responsibility.',
    linkPrivacy: 'Privacy Policy',
    linkTerms: 'Terms of Service',
    btnAccept: 'I agree and continue',
    btnDecline: 'Decline',
    declineNotice: 'Without your consent, the extension does not read or transmit data from Shkolo. You can accept at any time or remove it via <code>chrome://extensions</code>. Any data already synced on the server can be deleted via “👤 My Profile” → “Delete my account forever” in <a href="https://schoolbell.duckdns.org/?lang=en" target="_blank" rel="noopener noreferrer">School Bell</a>.',
    revokedTitle: '<strong>Consent has been withdrawn and local browser data has been cleared.</strong>',
    revokedDeleted: 'Deleted: local extension settings, connection token, personal Shkolo remarks/praises, unshared (private) Shkolo homework/exams, and active Shkolo binding on the server (when token & internet connection were available).',
    revokedRemains: 'Remaining on server: your School Bell web account and homework/exams/timetable already shared with the class if other classmates remain in that class. For complete erasure, sign in to <a href="https://schoolbell.duckdns.org/?lang=en" target="_blank" rel="noopener noreferrer">School Bell</a> → “👤 My Profile” → “Delete my account forever”.',
    appIntro: 'The extension reads your diary on <strong>app.shkolo.bg</strong> in the background using your already-signed-in session and sends homework, remarks, praises, exams, and weekly timetable to <strong>School Bell</strong> (<code>https://schoolbell.duckdns.org</code>).',
    labelAppUrl: 'Application URL (fixed)',
    labelToken: 'Connection code (Bearer token)',
    tokenPlaceholder: 'Paste the code from “Shkolo Homework” in the web app',
    labelAutoSync: 'Automatic hourly sync in the background (OFF by default — enable optionally)',
    labelShareWithClass: 'Share homework, exams, and timetable with the class (OFF by default — kept private to your profile unless enabled)',
    btnSave: 'Save',
    btnTest: 'Test',
    btnSyncNow: 'Sync now',
    btnOpenShkolo: 'Open Shkolo',
    howTitle: 'How does it work?',
    howStep1: 'Sign in once to Shkolo in this browser (with “Remember me”).',
    howStep2: 'Paste your connection code and click “Save” — the initial sync starts in the background without opening a Shkolo tab.',
    howStep3: 'If you enable automatic sync, data refreshes once per hour. You can also sync manually at any time.',
    howStep4: 'The extension sends subjects, descriptions, teachers, due dates, remarks, praises, exams, and the weekly timetable bound to the student and class.',
    howStep5: 'Your Shkolo password and cookies never leave your browser.',
    howDisclaimer: '<strong>Important:</strong> Unofficial tool, not affiliated with or endorsed by Shkolo (Shkolo Ltd.). Reading from Shkolo may conflict with their Terms and result in account restriction; used at the user’s own risk.',
    btnRevoke: 'Withdraw consent & delete data',
    revokeConfirmText: 'Upon confirmation, the extension will: (1) send <code>DELETE /api/shkolo/data</code> to the server (if a token is saved), erasing synced Shkolo remarks/praises, private Shkolo homework/exams, and the token binding; and (2) clear local browser data and settings. Your web account and class-shared items remain on the server (while other classmates use the class). For full account deletion use “👤 My Profile” → “Delete my account forever” in <a href="https://schoolbell.duckdns.org/?lang=en" target="_blank" rel="noopener noreferrer">School Bell</a>.',
    btnRevokeYes: 'Yes, withdraw & delete',
    btnRevokeCancel: 'Cancel',
    footerNote: 'Personal token · do not share',
    footerPrivacy: 'Privacy',
    footerTerms: 'Terms'
  }
};

function applyPopupLanguage(lang) {
  currentLang = lang === 'en' ? 'en' : 'bg';
  const dict = POPUP_I18N[currentLang];
  const langBtn = $('popupLangBtn');
  if (langBtn) langBtn.textContent = currentLang === 'en' ? 'BG' : 'EN';
  if (typeof document?.querySelectorAll !== 'function') return;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key && dict[key]) el.textContent = dict[key];
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.getAttribute('data-i18n-html');
    if (key && dict[key]) el.innerHTML = dict[key];
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key && dict[key]) el.setAttribute('placeholder', dict[key]);
  });
  document.querySelectorAll('[data-legal-link="privacy"]').forEach(el => {
    el.setAttribute('href', currentLang === 'en' ? 'https://schoolbell.duckdns.org/privacy#en' : 'https://schoolbell.duckdns.org/privacy');
  });
  document.querySelectorAll('[data-legal-link="terms"]').forEach(el => {
    el.setAttribute('href', currentLang === 'en' ? 'https://schoolbell.duckdns.org/terms#en' : 'https://schoolbell.duckdns.org/terms');
  });
}

function applySupportDonationFlag() {
  if (ENABLE_SUPPORT_DONATION || typeof document?.querySelectorAll !== 'function') return;
  document.querySelectorAll('[data-support-block]').forEach(el => {
    el.hidden = true;
  });
}

function isConsentGranted(consent) {
  return Boolean(consent && consent.consent === true && Number(consent.version) === CONSENT_VERSION);
}

function showConsentScreen(showDeclineNotice = false, showRevokedNotice = false, revokeInfo = null) {
  const consentScreen = $('consentScreen');
  const appScreen = $('appScreen');
  const declineNotice = $('consentDeclineNotice');
  const revokedNotice = $('consentRevokedNotice');
  const serverStatusEl = $('revokeServerStatus');
  if (consentScreen) consentScreen.hidden = false;
  if (appScreen) appScreen.hidden = true;
  if (declineNotice) declineNotice.hidden = !showDeclineNotice;
  if (revokedNotice) revokedNotice.hidden = !showRevokedNotice;
  if (serverStatusEl) {
    if (revokeInfo?.serverError) {
      serverStatusEl.textContent = revokeInfo.serverError;
      serverStatusEl.classList?.toggle?.('error', true);
      serverStatusEl.classList?.toggle?.('success', false);
      serverStatusEl.hidden = false;
    } else if (revokeInfo?.serverDeleted) {
      serverStatusEl.textContent = 'Сървърът потвърди изтриването на личните ви Shkolo забележки/похвали, личните Shkolo домашни/изпити (ако има такива) и кода за връзка.';
      serverStatusEl.classList?.toggle?.('error', false);
      serverStatusEl.classList?.toggle?.('success', true);
      serverStatusEl.hidden = false;
    } else if (showRevokedNotice && revokeInfo && !revokeInfo.hadToken) {
      serverStatusEl.textContent = 'Нямаше запазен код за връзка — локалните данни в разширението са изтрити.';
      serverStatusEl.classList?.toggle?.('error', false);
      serverStatusEl.classList?.toggle?.('success', false);
      serverStatusEl.hidden = false;
    } else {
      serverStatusEl.textContent = '';
      serverStatusEl.hidden = true;
    }
  }
}

function showAppScreen() {
  const consentScreen = $('consentScreen');
  const appScreen = $('appScreen');
  const declineNotice = $('consentDeclineNotice');
  const revokedNotice = $('consentRevokedNotice');
  const revokeBox = $('revokeConfirmBox');
  const revokeBtn = $('revokeConsentBtn');
  if (consentScreen) consentScreen.hidden = true;
  if (appScreen) appScreen.hidden = false;
  if (declineNotice) declineNotice.hidden = true;
  if (revokedNotice) revokedNotice.hidden = true;
  if (revokeBox) revokeBox.hidden = true;
  if (revokeBtn) revokeBtn.hidden = false;
}

function setStatus(message, type = '') {
  const element = $('status');
  if (!element) return;
  element.textContent = message || '';
  element.classList.toggle('success', type === 'success');
  element.classList.toggle('error', type === 'error');
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('bg-BG');
}

function decodeCode(raw) {
  const code = String(raw || '').trim();
  if (!code) return null;
  if (code.startsWith('SB1.')) {
    const base64 = code.slice(4).replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '==='.slice((base64.length + 3) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (!data.t) throw new Error('Кодът е непълен.');
    return { appUrl: OFFICIAL_APP_URL, token: String(data.t).trim() };
  }
  if (code.startsWith('{')) {
    const data = JSON.parse(code);
    if (data.t) return { appUrl: OFFICIAL_APP_URL, token: String(data.t).trim() };
  }
  return { appUrl: OFFICIAL_APP_URL, token: code };
}

async function ensureConsent() {
  const { consent } = await chrome.storage.local.get(['consent']);
  return isConsentGranted(consent);
}

function safeDecodeCode(raw) {
  try {
    return decodeCode(raw);
  } catch (_) {
    throw new Error('Кодът за връзка е повреден. Копирай го отново от приложението.');
  }
}

async function saveConfig(silent = false, options = {}) {
  if (!(await ensureConsent())) {
    showConsentScreen(false);
    throw new Error('Необходимо е първо да приемете съгласието.');
  }
  let token = $('token').value.trim();
  const decoded = safeDecodeCode(token);
  if (decoded) {
    token = decoded.token;
    $('appUrl').value = OFFICIAL_APP_URL;
    $('token').value = token;
  }
  if (!token) throw new Error('Постави кода за връзка от приложението.');
  const autoSync = $('autoSync').checked;
  const shareWithClassEl = $('shareWithClass');
  const shareWithClass = shareWithClassEl?.checked === true;
  const response = await chrome.runtime.sendMessage({
    type: 'save-config',
    appUrl: OFFICIAL_APP_URL,
    token,
    autoSync,
    shareWithClass,
    skipSync: options?.skipSync === true
  });
  if (!response?.ok) throw new Error(response?.error || 'Настройките не бяха запазени.');
  if (!silent) {
    const autoText = autoSync
      ? 'Автоматичната синхронизация е включена (на всеки час във фонов режим).'
      : 'Автоматичната синхронизация е изключена (ползвай бутона „Синхронизирай сега“ или бутона в приложението).';
    setStatus(response.syncStarted
      ? `Запазено. Първата синхронизация започна във фонов режим — не е нужно да отваряш Shkolo. ${autoText}`
      : `Запазено. ${autoText}`, 'success');
  }
  return response;
}

async function loadAppState() {
  const state = await chrome.storage.local.get(['appUrl', 'token', 'autoSync', 'shareWithClass', 'lastSyncAt', 'lastAdded', 'lastUpdated', 'lastNotesAdded', 'lastNotesUpdated', 'lastExamsAdded', 'lastExamsUpdated', 'lastScheduleUpdated', 'lastScheduleSubjects', 'lastBoundClassName', 'lastIgnoredOld', 'lastError']);
  $('appUrl').value = OFFICIAL_APP_URL;
  $('token').value = state.token || '';
  $('autoSync').checked = state.autoSync === true;
  if ($('shareWithClass')) $('shareWithClass').checked = state.shareWithClass === true;
  if (state.lastError) {
    setStatus(state.lastError, 'error');
  } else if (state.lastSyncAt) {
    const schedPart = state.lastScheduleSubjects ? `, програма (${state.lastScheduleSubjects} часа)` : '';
    const counts = `${state.lastAdded || 0} нови домашни, ${state.lastNotesAdded || 0} нови забележки/похвали, ${state.lastExamsAdded || 0} нови изпита${schedPart}`;
    const bound = state.lastBoundClassName ? ` за ${state.lastBoundClassName}` : '';
    setStatus(`Последно синхронизиране${bound}: ${formatDate(state.lastSyncAt)} · ${counts}`, 'success');
  } else if (state.token) {
    setStatus('Кодът е запазен. Натисни „Синхронизирай сега“ за проверка във фонов режим.');
  } else {
    setStatus('Постави кода за връзка от приложението и натисни „Запази“.');
  }
}

async function load() {
  applySupportDonationFlag();
  applyPopupLanguage(currentLang);
  const granted = await ensureConsent();
  if (!granted) {
    showConsentScreen(false);
    return;
  }
  showAppScreen();
  await loadAppState();
}

$('popupLangBtn')?.addEventListener('click', () => {
  applyPopupLanguage(currentLang === 'bg' ? 'en' : 'bg');
});

async function syncNow() {
  const button = $('syncBtn');
  button.disabled = true;
  setStatus('Синхронизиране… Shkolo се чете тихо във фонов режим, без да се отваря страница.');
  try {
    await saveConfig(true, { skipSync: true });
    const result = await chrome.runtime.sendMessage({ type: 'trigger-shkolo-sync' });
    if (!result?.ok) {
      setStatus(result?.error || 'Синхронизацията не беше успешна.', 'error');
      return;
    }
    const schedPart = result.scheduleUpdated ? ', програмата е обновена' : (result.scheduleSubjects ? `, програма (${result.scheduleSubjects} часа)` : '');
    const counts = `${result.added || 0} нови домашни, ${result.notesAdded || 0} нови забележки/похвали, ${result.examsAdded || 0} нови изпита${schedPart}`;
    const skipped = result.ignoredOld ? ` · ${result.ignoredOld} стари записа са пропуснати` : '';
    setStatus(`Готово за ${result.boundClassName || 'класа'}: ${counts}${skipped}.`, 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  } finally {
    button.disabled = false;
  }
}

async function testConnection() {
  const button = $('testBtn');
  button.disabled = true;
  setStatus('Проверка на връзката и на класа…');
  try {
    await saveConfig(true, { skipSync: true });
    const result = await chrome.runtime.sendMessage({ type: 'test-connection' });
    if (!result?.ok) {
      setStatus(result?.error || 'Връзката не е успешна.', 'error');
      return;
    }
    const bound = result.boundClassName ? ` Клас: ${result.boundClassName}.` : ' Класът ще се потвърди при първото синхронизиране.';
    setStatus(`Връзката е успешна.${bound} В класа има ${result.total || 0} домашни и ${result.examsTotal || 0} изпита; в профила — ${result.notesTotal || 0} забележки и похвали.`, 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  } finally {
    button.disabled = false;
  }
}

$('consentAccept')?.addEventListener('click', async () => {
  const button = $('consentAccept');
  button.disabled = true;
  try {
    await chrome.storage.local.set({
      consent: { consent: true, version: CONSENT_VERSION, at: new Date().toISOString() }
    });
    showAppScreen();
    await loadAppState();
  } catch (error) {
    setStatus(error.message, 'error');
  } finally {
    button.disabled = false;
  }
});

$('consentDecline')?.addEventListener('click', () => {
  showConsentScreen(true);
});

async function executeRevokeConsent() {
  const button = $('revokeConfirmYes') || $('revokeConsentBtn');
  if (button) button.disabled = true;
  try {
    const response = await chrome.runtime.sendMessage({ type: 'revoke-consent' });
    if (!response?.ok) {
      throw new Error(response?.error || 'Неуспешно оттегляне на съгласието.');
    }
    if ($('token')) $('token').value = '';
    if ($('autoSync')) $('autoSync').checked = false;
    if ($('shareWithClass')) $('shareWithClass').checked = false;
    if ($('revokeConfirmBox')) $('revokeConfirmBox').hidden = true;
    if ($('revokeConsentBtn')) $('revokeConsentBtn').hidden = false;
    setStatus('');
    showConsentScreen(false, true, response);
  } catch (error) {
    setStatus(error.message, 'error');
  } finally {
    if (button) button.disabled = false;
  }
}

$('revokeConsentBtn')?.addEventListener('click', () => {
  const box = $('revokeConfirmBox');
  if (!box) {
    executeRevokeConsent();
    return;
  }
  box.hidden = false;
  if ($('revokeConsentBtn')) $('revokeConsentBtn').hidden = true;
});

$('revokeConfirmCancel')?.addEventListener('click', () => {
  if ($('revokeConfirmBox')) $('revokeConfirmBox').hidden = true;
  if ($('revokeConsentBtn')) $('revokeConsentBtn').hidden = false;
});

$('revokeConfirmYes')?.addEventListener('click', executeRevokeConsent);

$('saveBtn').addEventListener('click', async () => {
  const button = $('saveBtn');
  button.disabled = true;
  try { await saveConfig(false); } catch (error) { setStatus(error.message, 'error'); } finally { button.disabled = false; }
});

$('testBtn').addEventListener('click', testConnection);
$('syncBtn').addEventListener('click', syncNow);
$('openBtn').addEventListener('click', async () => {
  if (!(await ensureConsent())) {
    showConsentScreen(false);
    return;
  }
  try {
    const { lastPupilId } = await chrome.storage.local.get(['lastPupilId']);
    const url = (lastPupilId && /^\d{4,20}$/.test(String(lastPupilId)))
      ? `https://app.shkolo.bg/diary/pupil/${lastPupilId}`
      : 'https://app.shkolo.bg/';
    chrome.tabs.create({ url });
  } catch (_) {
    chrome.tabs.create({ url: 'https://app.shkolo.bg/' });
  }
});

chrome.storage?.onChanged?.addListener((changes, area) => {
  if (area !== 'local' || !Object.hasOwn(changes, 'consent')) return;
  if (isConsentGranted(changes.consent?.newValue)) {
    showAppScreen();
    loadAppState().catch(() => {});
  } else {
    if ($('token')) $('token').value = '';
    if ($('autoSync')) $('autoSync').checked = false;
    if ($('shareWithClass')) $('shareWithClass').checked = false;
    setStatus('');
    showConsentScreen(false, true);
  }
});

load().catch(error => setStatus(error.message, 'error'));
