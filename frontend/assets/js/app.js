/**
 * app.js — page behaviour for the connection-test page.
 * The ID token is kept only in memory: closing or reloading the tab signs you out.
 */
(function () {
  const cfg = window.AGRI_CONFIG;
  let idToken = null;
  let pendingNoteRequestId = null; // reused if the same note is re-submitted after a failure

  const el = function (id) { return document.getElementById(id); };

  function showResult(result) {
    const banner = el('result-banner');
    banner.className = 'banner ' + (result.success ? 'ok' : 'fail');
    banner.textContent = result.success
      ? '✔ ' + result.message
      : '✖ ' + (result.error ? result.error.code + ': ' + result.error.message : result.message);
    el('result-detail').textContent = JSON.stringify(result, null, 2); // textContent: never interpreted as HTML
  }

  function showLoading(label) {
    const banner = el('result-banner');
    banner.className = 'banner loading';
    banner.textContent = '… ' + label;
    el('result-detail').textContent = '';
  }

  function setBusy(busy) {
    document.querySelectorAll('button').forEach(function (b) { b.disabled = busy; });
  }

  async function run(label, action, payload, options) {
    setBusy(true);
    showLoading(label);
    try {
      const result = await AgriApi.call(action, payload, options);
      showResult(result);
      return result;
    } finally {
      setBusy(false);
    }
  }

  const tests = {
    ping: function () { return run('Pinging backend', 'ping'); },
    whoami: function () { return run('Checking identity', 'whoami', {}, { idToken: idToken }); },
    listNotes: function () { return run('Reading notes', 'listNotes', {}, { idToken: idToken }); },
    noToken: function () { return run('Calling without sign-in', 'whoami', {}, {}); },
    badUrl: function () {
      return run('Calling unreachable server', 'ping', {}, {
        fetchFn: function (url, init) { return fetch('https://invalid.invalid/', init); }
      });
    }
  };

  document.querySelectorAll('[data-test]').forEach(function (btn) {
    btn.addEventListener('click', function () { tests[btn.dataset.test](); });
  });

  el('note-form').addEventListener('submit', async function (event) {
    event.preventDefault();
    const text = el('note-text').value.trim();
    if (!text) {
      showResult({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Note text is required.' }, message: '' });
      el('note-text').focus();
      return;
    }
    if (!pendingNoteRequestId) pendingNoteRequestId = AgriApi.newRequestId();
    const result = await run('Saving note', 'createNote', { text: text },
      { idToken: idToken, requestId: pendingNoteRequestId });
    if (result.success) {
      pendingNoteRequestId = null; // next note is a new submission
      el('note-text').value = '';
    }
  });

  el('note-text').addEventListener('input', function () { pendingNoteRequestId = null; });

  el('btn-signout').addEventListener('click', function () {
    idToken = null;
    if (window.google) google.accounts.id.disableAutoSelect();
    el('signin-status').textContent = 'Not signed in.';
    el('btn-signout').hidden = true;
  });

  function onCredential(response) {
    idToken = response.credential;
    el('signin-status').textContent = 'Signed in. Click "Who am I?" to confirm with the backend.';
    el('btn-signout').hidden = false;
  }

  window.AgriApp = {
    initGoogleSignIn: function () {
      if (!cfg.GOOGLE_CLIENT_ID || cfg.GOOGLE_CLIENT_ID.indexOf('PASTE_') === 0) {
        el('signin-status').textContent = 'Sign-in not configured: set GOOGLE_CLIENT_ID in assets/js/config.js.';
        return;
      }
      google.accounts.id.initialize({ client_id: cfg.GOOGLE_CLIENT_ID, callback: onCredential });
      google.accounts.id.renderButton(el('signin-button'), { theme: 'outline', size: 'large' });
    }
  };
})();
