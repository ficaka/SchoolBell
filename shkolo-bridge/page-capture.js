/*
 * Runs in the Shkolo page context (MAIN world).
 * It only observes responses on allowlisted diary paths while the user is
 * already logged in. No credentials, no cookies, and no storage are read or transmitted.
 */
(() => {
  if (window.__schoolBellShkoloCaptureInstalled) return;
  window.__schoolBellShkoloCaptureInstalled = true;

  const MAX_BODY = 2_000_000;
  let lastPublished = '';

  // Строг списък от разрешени ключове за контекст на ученика и класа.
  const ALLOWED_CONTEXT_KEYS = {
    pupilId: ['shkolo_pupil_id', 'pupil_id', 'pupilId'],
    classYearId: ['shkolo_class_year_id', 'class_year_id', 'classYearId'],
    className: ['shkolo_class_name', 'class_name', 'className', 'class_year_name'],
    schoolId: ['shkolo_school_id', 'school_id', 'schoolId'],
    schoolName: ['shkolo_school_name', 'school_name', 'schoolName']
  };

  // Разрешени са единствено реално използваните пътища на дневника в Shkolo (без оценки, отсъствия, съобщения и login).
  const ALLOWED_CAPTURE_PATH = /^\/(?:diary\/?(?:(?:pupil\/\d+(?:\/(?:controltests|homework|feedbacks?|schedule))?|controltests|shi(?:\/[^?#]+)?)\/?)?$|pupil\/\d+\/?$|homework(?:\/|$)|ajax\/(?:diary\/(?:getHomeworks(?:ForPupil)?|getFeedbacksForPupil|getFeedbackDataByTypeAndCourse|getControlTests(?:ForPupil|ByCourse)?|getDiaryCalendar|getEvents|getSchedule(?:ForClass|ForPupil)?)|homework\/getHomeworks)(?:\/|$))/i;

  function clean(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function validId(value) {
    return /^\d{4,20}$/.test(clean(value));
  }

  function contextValue(field) {
    const keys = ALLOWED_CONTEXT_KEYS[field];
    if (!keys) return '';
    for (const key of keys) {
      const value = window[key];
      if (value !== undefined && value !== null && clean(value)) return clean(value);
    }
    const objects = [window.shkolo, window.Shkolo];
    for (const object of objects) {
      if (!object || typeof object !== 'object') continue;
      for (const key of keys) {
        const value = object[key];
        if (value !== undefined && value !== null && clean(value)) return clean(value);
      }
    }
    return '';
  }

  function domContextValue(...names) {
    const wanted = new Set(names.map(name => name.toLowerCase()));
    for (const meta of Array.from(document.querySelectorAll('meta[name], meta[property]'))) {
      if (!wanted.has(clean(meta.getAttribute('name') || meta.getAttribute('property')).toLowerCase())) continue;
      const value = clean(meta.getAttribute('content'));
      if (value) return value;
    }
    const body = document.body;
    if (body) {
      for (const name of names) {
        const attr = body.getAttribute(`data-${name.replace(/_/g, '-')}`) || body.getAttribute(`data-${name}`);
        if (clean(attr)) return clean(attr);
      }
    }
    return '';
  }

  function hiddenValue(selectors) {
    for (const selector of selectors) {
      const nodes = Array.from(document.querySelectorAll(selector));
      for (const node of nodes) {
        const value = clean(node.value ?? node.getAttribute('value') ?? node.getAttribute('content'));
        if (value) return value;
      }
    }
    return '';
  }

  function domPupilId() {
    // Официалните скрити полета на Shkolo. Не търсим произволни /pupil линкове.
    const hidden = hiddenValue(['#pupil_id_field', '#pupil-id-hidden', 'input[name="pupil_id"]', 'input[name="pupilId"]']);
    if (validId(hidden)) return hidden;
    // Стабилен профилен линк в шапката на дневника.
    const profile = document.querySelector('body > div.page-container > div.page-content-wrapper > div > div > div > a[href]');
    const href = profile ? clean(profile.getAttribute('href')) : '';
    const match = /\/(\d{4,20})(?:[/?#]|$)/.exec(href);
    return match ? match[1] : '';
  }

  function domClassYearId() {
    const value = hiddenValue(['#class_year_id_field', 'input[name="class_year_id"]', 'input[name="classYearId"]']);
    if (validId(value)) return value;
    const virtual = hiddenValue(['#virtual_class_year_id_field', 'input[name="virtual_class_year_id"]']);
    return validId(virtual) ? virtual : '';
  }

  function classFromText(value) {
    const raw = clean(value);
    if (!raw || raw.length > 500) return '';
    const match = /(?:^|[^\dА-Яа-яA-Za-z])((?:1[0-2]|[1-9]))\s*[.\-–—]?\s*([А-Яа-яA-Za-z])(?![А-Яа-яA-Za-z])/u.exec(raw);
    return match ? `${Number(match[1])}${match[2].toLowerCase()}` : '';
  }

  function domClassName() {
    const explicit = [
      '#class_year_name', '#class-year-name', '#classYearName', '#sc-class-lbl', '#sc-class-name',
      '.class-year-name', '.classYearName', '.sc-class-name', '.class-name',
      '[data-class-name]', '[data-classname]', '[data-class-year-name]'
    ];
    for (const selector of explicit) {
      for (const node of Array.from(document.querySelectorAll(selector))) {
        const value = clean(node.getAttribute?.('data-class-name')
          || node.getAttribute?.('data-classname')
          || node.getAttribute?.('data-class-year-name')
          || node.value
          || node.textContent);
        const found = classFromText(value);
        if (found) return found;
      }
    }
    // Скритото поле за клас често е в общата шапка/форма заедно с името на класа.
    const classField = document.querySelector('#class_year_id_field, input[name="class_year_id"]');
    let node = classField;
    for (let depth = 0; node && depth < 4; depth += 1, node = node.parentElement) {
      const text = clean(node.textContent);
      if (!text || text.length > 260) continue;
      const found = classFromText(text);
      if (found) return found;
    }
    for (const selector of ['h1', 'h2', '.page-title', '.page-header', '.breadcrumb', 'title']) {
      for (const node of Array.from(document.querySelectorAll(selector))) {
        const text = clean(node.textContent);
        if (text.length > 220) continue;
        const found = classFromText(text);
        if (found) return found;
      }
    }
    return classFromText(contextValue('className'));
  }

  function schoolName() {
    const explicit = document.querySelector('#sc-name-lbl');
    if (explicit) {
      const value = clean(explicit.textContent).split('|')[0].trim();
      if (value) return value;
    }
    return clean(contextValue('schoolName'))
      || domContextValue('school-name', 'school_name', 'schoolName');
  }

  function publishContext() {
    const pupilId = contextValue('pupilId') || domPupilId();
    const classYearId = contextValue('classYearId') || domClassYearId();
    const className = domClassName();
    const schoolId = contextValue('schoolId')
      || domContextValue('school-id', 'school_id', 'schoolId');
    const school = schoolName();
    if (!pupilId && !classYearId) return false;
    const payload = {
      __schoolBellShkoloContext: true,
      pupilId: validId(pupilId) ? pupilId : '',
      classYearId: validId(classYearId) ? classYearId : '',
      className: className || '',
      schoolId: /^\d{1,20}$/.test(schoolId) ? schoolId : '',
      schoolName: school || ''
    };
    const signature = `${payload.pupilId}|${payload.classYearId}|${payload.className}|${payload.schoolId}|${payload.schoolName}`;
    if (signature === lastPublished) return !!(payload.pupilId && payload.classYearId && payload.className);
    lastPublished = signature;
    try { window.postMessage(payload, location.origin); } catch (_) {}
    return !!(payload.pupilId && payload.classYearId && payload.className);
  }

  function isAllowedUrl(raw) {
    try {
      const parsed = new URL(String(raw || ''), location.href);
      if (parsed.origin !== location.origin) return false;
      return ALLOWED_CAPTURE_PATH.test(parsed.pathname);
    } catch (_) {
      return false;
    }
  }

  function publish(url, contentType, body) {
    if (!body || body.length > MAX_BODY) return;
    if (!isAllowedUrl(url)) return;
    if (!/(json|text|html|xml)/i.test(contentType || '') && !/^\s*[\[{]/.test(body)) return;
    try {
      window.postMessage({
        __schoolBellShkoloCapture: true,
        url: String(url || ''),
        contentType: String(contentType || ''),
        body
      }, location.origin);
    } catch (_) {}
  }

  const originalFetch = window.fetch;
  const xhrOpen = XMLHttpRequest.prototype.open;
  const xhrSend = XMLHttpRequest.prototype.send;

  let active = false;
  let activeNonce = '';
  let pollIntervalId = null;
  let mutationTimer = null;
  let observer = null;

  function onDomReady() {
    publishContext();
  }

  function onMutation() {
    if (mutationTimer) return;
    mutationTimer = setTimeout(() => {
      mutationTimer = null;
      publishContext();
    }, 700);
  }

  function activateCapture(nonce) {
    if (active) return;
    active = true;
    activeNonce = nonce;

    if (typeof originalFetch === 'function') {
      window.fetch = function schoolBellFetch(...args) {
        const inputUrl = typeof args[0] === 'string' ? args[0] : args[0]?.url;
        const request = originalFetch.apply(this, args);
        if (!isAllowedUrl(inputUrl)) return request;
        try {
          request.then(response => {
            try {
              const finalUrl = response.url || inputUrl;
              if (!isAllowedUrl(finalUrl)) return;
              const type = response.headers.get('content-type') || '';
              if (!/(json|text|html|xml)/i.test(type)) return;
              const clone = response.clone();
              clone.text().then(text => {
                publish(finalUrl, type, text);
              }).catch(() => {});
            } catch (_) {}
          }).catch(() => {});
        } catch (_) {}
        return request;
      };
    }

    XMLHttpRequest.prototype.open = function schoolBellOpen(method, url, ...rest) {
      try { this.__schoolBellUrl = url; } catch (_) {}
      return xhrOpen.call(this, method, url, ...rest);
    };
    XMLHttpRequest.prototype.send = function schoolBellSend(...args) {
      try {
        if (isAllowedUrl(this.__schoolBellUrl)) {
          this.addEventListener('load', function onLoad() {
            try {
              const targetUrl = this.responseURL || this.__schoolBellUrl;
              if (!isAllowedUrl(targetUrl)) return;
              const type = this.getResponseHeader('content-type') || '';
              if (!/(json|text|html|xml)/i.test(type)) return;
              if (this.responseType && this.responseType !== 'text' && this.responseType !== 'json') return;
              const body = this.responseType === 'json' ? JSON.stringify(this.response) : this.responseText;
              publish(targetUrl, type, body);
            } catch (_) {}
          });
        }
      } catch (_) {}
      return xhrSend.apply(this, args);
    };

    window.addEventListener('load', publishContext, { once: true });
    window.addEventListener('hashchange', publishContext);
    window.addEventListener('popstate', publishContext);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', onDomReady, { once: true });
    } else {
      publishContext();
    }
    pollIntervalId = setInterval(publishContext, 2000);
    try {
      observer = new MutationObserver(onMutation);
      observer.observe(document.documentElement, { childList: true, subtree: true });
    } catch (_) {}
  }

  function deactivateCapture() {
    if (!active) return;
    active = false;
    activeNonce = '';
    lastPublished = '';
    if (typeof originalFetch === 'function') window.fetch = originalFetch;
    XMLHttpRequest.prototype.open = xhrOpen;
    XMLHttpRequest.prototype.send = xhrSend;
    window.removeEventListener('load', publishContext);
    window.removeEventListener('hashchange', publishContext);
    window.removeEventListener('popstate', publishContext);
    document.removeEventListener('DOMContentLoaded', onDomReady);
    if (pollIntervalId !== null) {
      clearInterval(pollIntervalId);
      pollIntervalId = null;
    }
    if (mutationTimer !== null) {
      clearTimeout(mutationTimer);
      mutationTimer = null;
    }
    if (observer) {
      try { observer.disconnect(); } catch (_) {}
      observer = null;
    }
  }

  function validNonce(value) {
    return typeof value === 'string' && value.length >= 32 && value.length <= 128;
  }

  window.addEventListener('message', event => {
    if (!event || event.source !== window || event.origin !== location.origin) return;
    const data = event.data;
    if (!data || data.version !== 1 || !validNonce(data.nonce)) return;
    if (data.type === 'school-bell:activate-shkolo-capture') {
      activateCapture(data.nonce);
    } else if (data.type === 'school-bell:deactivate-shkolo-capture' && active && data.nonce === activeNonce) {
      deactivateCapture();
    }
  });
})();
