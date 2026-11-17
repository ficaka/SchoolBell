(() => {
  const CONSENT_VERSION = 1;
  let active = false;

  function isConsentGranted(consent) {
    return Boolean(consent && consent.consent === true && Number(consent.version) === CONSENT_VERSION);
  }

  async function onWindowMessage(event) {
    if (event.source !== window || event.origin !== location.origin || !event.data) return;
    if (event.data.type === 'school-bell-sync-shkolo') {
      const requestId = event.data.requestId || '';
      try {
        // Разширението чете Shkolo във фонов режим чрез offscreen документ.
        const response = await chrome.runtime.sendMessage({ type: 'trigger-shkolo-sync', auto: event.data.auto === true });
        window.postMessage({ type: 'school-bell-sync-result', requestId, response }, location.origin);
      } catch (error) {
        window.postMessage({ type: 'school-bell-sync-result', requestId, response: { ok: false, error: error.message } }, location.origin);
      }
    }
  }

  function activate() {
    if (active) return;
    active = true;
    document.documentElement.setAttribute('data-shkolo-bridge-active', 'true');
    document.documentElement.setAttribute('data-shkolo-bridge-version', chrome.runtime.getManifest?.().version || '');
    window.__schoolBellBridgeActive = true;
    window.addEventListener('message', onWindowMessage);
  }

  function deactivate() {
    if (!active) return;
    active = false;
    document.documentElement.removeAttribute('data-shkolo-bridge-active');
    document.documentElement.removeAttribute('data-shkolo-bridge-version');
    window.__schoolBellBridgeActive = false;
    window.removeEventListener('message', onWindowMessage);
  }

  async function syncConsentState() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'get-consent' });
      if (isConsentGranted(response?.consent)) activate();
      else deactivate();
    } catch (_) {
      deactivate();
    }
  }

  chrome.storage?.onChanged?.addListener((changes, area) => {
    if (area !== 'local' || !Object.hasOwn(changes, 'consent')) return;
    if (isConsentGranted(changes.consent?.newValue)) activate();
    else deactivate();
  });

  syncConsentState();
})();
