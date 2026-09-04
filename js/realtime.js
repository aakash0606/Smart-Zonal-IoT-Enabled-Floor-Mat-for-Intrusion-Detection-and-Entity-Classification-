// ------------------ Firebase config ------------------
  const firebaseConfig = {
    apiKey: "AIzaSyBnH9HWVaNvy1N8tg86QwC0ajwt1VYlrS4",
    authDomain: "anti-theft-flooring-mat.firebaseapp.com",
    databaseURL: "https://anti-theft-flooring-mat-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "anti-theft-flooring-mat",
    storageBucket: "anti-theft-flooring-mat.firebasestorage.app",
    messagingSenderId: "3148433465",
    appId: "1:3148433465:web:9e69d98c1e03046f9725e8",
    measurementId: "G-XFB5F8CWL2"
  };

  // ------------------ imports ------------------
  import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js';
  import { getAnalytics } from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-analytics.js';
  import { getDatabase, ref, get, onValue } from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-database.js';
  import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js';

  const app = initializeApp(firebaseConfig);
  try { getAnalytics(app); } catch(e){ /* ignore analytics in some environments */ }
  const db = getDatabase(app);
  const auth = getAuth(app);

  // ------------------ UI refs ------------------
  const statusEl = document.getElementById('status');
  const lastActionEl = document.getElementById('lastAction');
  const rawJsonEl = document.getElementById('rawJson');
  const debugLogEl = document.getElementById('debugLog');
  const numericTable = document.getElementById('numericTable');
  const authStatusEl = document.getElementById('authStatus');
  const diagOutputEl = document.getElementById('diagOutput');
  const manualPathEl = document.getElementById('manualPath');
  const manualResultEl = document.getElementById('manualResult');

  // buttons
  const retryAuthBtn = document.getElementById('retryAuthBtn');
  const runDiagBtn = document.getElementById('runDiagBtn');
  const testGetAllBtn = document.getElementById('testGetAllBtn');
  const testPathsBtn = document.getElementById('testPathsBtn');
  const manualGetBtn = document.getElementById('manualGetBtn');
  const manualListenBtn = document.getElementById('manualListenBtn');
  const stopListenerBtn = document.getElementById('stopListenerBtn');
  const exportSnapshotBtn = document.getElementById('exportSnapshotBtn');
  const clearOutputBtn = document.getElementById('clearOutputBtn');

  // state
  let listenerUnsubscribe = null;
  let latestSnapshot = null;
  let debugLines = [];

  // helpers
  function logDebug(...args){
    const txt = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a, null, 2))).join(' ');
    debugLines.push(new Date().toISOString() + ' — ' + txt);
    if (debugLines.length > 200) debugLines.shift();
    debugLogEl.textContent = debugLines.join('\n');
    console.log(...args);
  }
  function setStatus(txt){ statusEl.textContent = txt; lastActionEl.textContent = new Date().toLocaleString(); }
  function setAuthStatus(txt){ authStatusEl.textContent = txt; }

  // flatten function
  function flatten(obj, prefix=''){
    const rows = [];
    if (obj === null || obj === undefined) { rows.push({path: prefix || '/', value: obj}); return rows; }
    if (typeof obj !== 'object') { rows.push({path: prefix || '/', value: obj}); return rows; }
    for (const k of Object.keys(obj)){
      const v = obj[k];
      const p = prefix ? `${prefix}/${k}` : k;
      if (v !== null && typeof v === 'object' && !Array.isArray(v)){
        rows.push(...flatten(v, p));
      } else if (Array.isArray(v)){
        v.forEach((item, i) => {
          if (item !== null && typeof item === 'object') rows.push(...flatten(item, `${p}[${i}]`));
          else rows.push({path:`${p}[${i}]`, value:item});
        });
        if (v.length === 0) rows.push({path:p, value:'[]'});
      } else {
        rows.push({path:p, value:v});
      }
    }
    return rows;
  }

  // detect numeric keys & populate table
  function detectAndDisplayNumerics(snapshotObj){
    numericTable.innerHTML = '';
    if (!snapshotObj){ numericTable.innerHTML = '<tr><td colspan="3" class="muted">No snapshot available</td></tr>'; return; }
    const rows = flatten(snapshotObj);
    const numeric = [];
    for (const r of rows){
      if (r.value === null || r.value === undefined) continue;
      const num = Number(r.value);
      if (!Number.isNaN(num)) {
        let group = 'other';
        const lp = r.path.toLowerCase();
        if (lp.includes('fsr')) group = 'FSR';
        else if (lp.includes('piezo')) group = 'Piezo';
        numeric.push({path:r.path, value:num, group});
      }
    }
    if (numeric.length === 0){
      numericTable.innerHTML = '<tr><td colspan="3" class="muted">No numeric keys found (either DB is empty or values are non-numeric)</td></tr>';
      return;
    }
    numeric.sort((a,b)=>a.path.localeCompare(b.path));
    for (const n of numeric){
      const tr = document.createElement('tr');
      const td1 = document.createElement('td'); td1.textContent = n.path;
      const td2 = document.createElement('td'); td2.textContent = n.group;
      const td3 = document.createElement('td'); td3.textContent = n.value;
      tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3);
      numericTable.appendChild(tr);
    }
  }

  // ------------------ Firebase actions ------------------
  async function tryAnonymousSignIn(){
    setStatus('Attempting anonymous sign-in...');
    try {
      await signInAnonymously(auth);
      setAuthStatus('Signed in (anonymous)');
      logDebug('Anonymous sign-in: success');
    } catch (err){
      setAuthStatus('Sign-in failed: ' + (err && err.message ? err.message : String(err)));
      logDebug('Anonymous sign-in failed', err);
    }
  }

  onAuthStateChanged(auth, user => {
    if (user) {
      setAuthStatus('Signed in: ' + (user.isAnonymous ? 'anonymous' : user.uid));
      logDebug('Auth state changed: signed in', user.uid || 'anonymous');
    } else {
      setAuthStatus('Not authenticated');
      logDebug('Auth state: signed out');
    }
  });

  // one-time get path
  async function oneTimeGet(path){
    const p = (path || '/').replace(/^\/+/, '');
    setStatus('GET ' + (p || '/') + ' ...');
    try {
      const dbRef = ref(db, p || '/');
      const snap = await get(dbRef);
      if (!snap.exists()){
        logDebug('GET', p || '/', '-> empty (no data)');
        return {exists:false, val:null, raw:null};
      }
      const val = snap.val();
      logDebug('GET', p || '/', '-> snapshot received');
      return {exists:true, val, raw: val};
    } catch (err){
      logDebug('GET failed', p || '/', err);
      throw err;
    }
  }

  // listen on path (onValue)
  function startListener(path='/'){
    const p = (path || '/').replace(/^\/+/, '');
    setStatus('Starting onValue listener at "' + (p || '/') + '" ...');
    try {
      // if already have one, remove page (reload safer)
      if (listenerUnsubscribe) { logDebug('Listener already running; reloading page to restart'); location.reload(); return; }
      const dbRef = ref(db, p || '/');
      listenerUnsubscribe = onValue(dbRef, snap => {
        latestSnapshot = snap.val();
        rawJsonEl.textContent = JSON.stringify(latestSnapshot, null, 2);
        detectAndDisplayNumerics(latestSnapshot);
        setStatus('Listener: snapshot received (' + new Date().toLocaleString() + ')');
        logDebug('onValue snapshot', { path: p||'/', exists: snap.exists(), keys: Object.keys(latestSnapshot || {}) });
      }, err => {
        latestSnapshot = null;
        rawJsonEl.textContent = JSON.stringify({ error: (err && err.message) ? err.message : String(err) }, null, 2);
        detectAndDisplayNumerics(null);
        setStatus('Listener error: ' + (err && err.message ? err.message : 'unknown'));
        logDebug('onValue error', err);
      });
    } catch (err) {
      logDebug('startListener exception', err);
      setStatus('startListener exception: ' + (err && err.message ? err.message : String(err)));
    }
  }

  function stopListener(){
    // modular onValue returns unsubscribe (listenerUnsubscribe is that), but easiest to reload to cleanly stop
    if (listenerUnsubscribe) {
      logDebug('Stopping listener by reloading page');
      location.reload();
    } else {
      logDebug('No listener to stop');
      setStatus('No listener running');
    }
  }

  // run multiple common path checks
  async function testCommonPaths(){
    const paths = ['/', 'sensors', 'data', 'zones', 'devices', 'readings', 'piezo', 'fsr'];
    diagOutputEl.innerHTML = '';
    setStatus('Testing common paths ...');
    for (const p of paths){
      try {
        const res = await oneTimeGet(p);
        const div = document.createElement('div');
        if (!res.exists){
          div.innerHTML = `<div class="small" style="color:#94a3b8">GET /${p} — empty</div>`;
        } else {
          // count numeric keys
          const rows = flatten(res.val);
          const numeric = rows.filter(r => { const num = Number(r.value); return !Number.isNaN(num); });
          div.innerHTML = `<div style="color:#cfe6ff">GET /${p} — keys: ${rows.length}, numeric: ${numeric.length}</div>`;
        }
        diagOutputEl.appendChild(div);
      } catch (err){
        const div = document.createElement('div');
        div.innerHTML = `<div class="err">GET /${p} — ERROR: ${err && err.code ? err.code : (err && err.message ? err.message : String(err))}</div>`;
        diagOutputEl.appendChild(div);
      }
    }
    setStatus('Common path tests complete');
  }

  // run a full "diagnostics" automatically
  async function runDiagnostics(){
    debugLines = [];
    logDebug('Starting diagnostics');
    setStatus('Diagnostics running...');
    // step 1: try anon sign-in
    try {
      await signInAnonymously(auth);
      logDebug('Anonymous sign-in attempted (no error)');
    } catch (e){
      logDebug('Anonymous sign-in error', e);
    }
    // step 2: try GET on root
    try {
      const rootRes = await oneTimeGet('/');
      if (!rootRes.exists) logDebug('Root is empty');
      else logDebug('Root has data; flattening keys count:', flatten(rootRes.val).length);
    } catch (e){
      logDebug('Root GET failed', e);
    }
    // step 3: test common paths
    await testCommonPaths();
    // step 4: start listener
    startListener('/');
    setStatus('Diagnostics finished — listener started');
  }

  // wire up buttons
  retryAuthBtn.addEventListener('click', async () => { await tryAnonymousSignIn(); });
  runDiagBtn.addEventListener('click', async () => { await runDiagnostics(); });
  testGetAllBtn.addEventListener('click', async () => {
    try {
      const res = await oneTimeGet('/');
      if (!res.exists) {
        rawJsonEl.textContent = '{ "exists": false }';
        detectAndDisplayNumerics(null);
        setStatus('GET root: empty');
      } else {
        rawJsonEl.textContent = JSON.stringify(res.val, null, 2);
        detectAndDisplayNumerics(res.val);
        setStatus('GET root: success');
      }
    } catch (err){
      rawJsonEl.textContent = JSON.stringify({ error: err && err.message ? err.message : String(err) }, null, 2);
      logDebug('GET root error', err);
      setStatus('GET root failed');
    }
  });
  testPathsBtn.addEventListener('click', async () => { await testCommonPaths(); });

  manualGetBtn.addEventListener('click', async () => {
    const p = manualPathEl.value || '/';
    try {
      const res = await oneTimeGet(p);
      if (!res.exists) manualResultEl.textContent = '{ "exists": false }';
      else manualResultEl.textContent = JSON.stringify(res.val, null, 2);
    } catch (err){
      manualResultEl.textContent = JSON.stringify({ error: err && err.message ? err.message : String(err) }, null, 2);
      logDebug('manualGet error', err);
    }
  });

  manualListenBtn.addEventListener('click', () => {
    const p = manualPathEl.value || '/';
    startListener(p);
  });

  stopListenerBtn.addEventListener('click', () => stopListener());

  exportSnapshotBtn.addEventListener('click', () => {
    if (!latestSnapshot) { alert('No snapshot to export'); return; }
    const blob = new Blob([JSON.stringify(latestSnapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'intru-mat-snapshot.json'; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  });

  clearOutputBtn.addEventListener('click', () => {
    rawJsonEl.textContent = '{ }';
    numericTable.innerHTML = '<tr><td colspan="3" class="muted">Cleared</td></tr>';
  });

  // automatically run diagnostics on load (best-effort)
  (async function initAuto(){
    setStatus('Auto-diagnostics starting...');
    await runDiagnostics();
  })();

  // expose a short helper in console for you
  window._intru_debug = {
    oneTimeGet: oneTimeGet,
    startListener: startListener,
    stopListener: stopListener,
    latestSnapshot: () => latestSnapshot,
    flatten: flatten
  };

  // ------------------ PREDICTION BOX HANDLER ------------------
  // call window.updatePredictedNote(value, opts) from anywhere to update the box
  window.updatePredictedNote = function(value, opts = {}) {
    try {
      const el = document.getElementById('predValue');
      const hint = document.getElementById('predHint');
      if (!el) return console.warn('predBox element not found.');

      // Format value
      const decimals = (opts.decimals !== undefined) ? opts.decimals : 3;
      const text = (value === null || value === undefined) ? '—' : Number(value).toFixed(decimals);

      el.textContent = text;
      hint.textContent = 'last updated: ' + new Date().toLocaleString();

      // small attention animation
      try {
        el.animate(
          [
            { transform: 'scale(1)', opacity: 1 },
            { transform: 'scale(1.06)', opacity: 0.92 },
            { transform: 'scale(1)', opacity: 1 }
          ],
          { duration: 360, easing: 'ease-out' }
        );
      } catch(e){ /* animation may not be supported */ }

      // optional color based on thresholds
      if (opts.thresholds) {
        const v = Number(value);
        if (!Number.isNaN(v)) {
          if (opts.thresholds.high !== undefined && v >= opts.thresholds.high) {
            el.style.color = '#ffb4b4';
          } else if (opts.thresholds.med !== undefined && v >= opts.thresholds.med) {
            el.style.color = '#ffd27a';
          } else {
            el.style.color = '#bfffd6';
          }
        }
      }

      // save last
      window._lastPredictedNote = value;
      logDebug('Predicted note updated', value);
    } catch (e) {
      console.error('updatePredictedNote error', e);
    }
  };

  // OPTIONAL: If you prefer the page to automatically reflect a DB-stored predicted value,
  // you can uncomment the following snippet. It will listen to the path "/predicted/note"
  // and update the box whenever a value appears there.
  //
  // NOTE: leave commented unless you want DB-driven updates.
  //
  // import { ref as dbRefLocal, onValue as onValueLocal } from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-database.js';
  // (function autoListenPredicted(){
  //   try {
  //     const r = dbRefLocal(db, '/predicted/note');
  //     onValueLocal(r, snap => {
  //       if (!snap.exists()) return;
  //       const v = snap.val();
  //       window.updatePredictedNote(v);
  //     }, err => {
  //       logDebug('predicted/note listener error', err);
  //     });
  //   } catch(e){
  //     logDebug('autoListenPredicted setup failed', e);
  //   }
  // })();

  // helpful console hint
  console.log('Loaded realtime debug + predBox. To update the predicted note live call: window.updatePredictedNote(72.5);');