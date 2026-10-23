(() => {
  'use strict';
  const config = window.CARTEIRA_FIREBASE_CONFIG || {};
  const enabled = Boolean(config.apiKey && config.projectId);
  const sessionKey = 'carteira_firebase_session_v1';
  const api = 'https://identitytoolkit.googleapis.com/v1';
  const authError = 'Perfil ou senha incorretos.';

  function readSession() {
    try { return JSON.parse(sessionStorage.getItem(sessionKey) || 'null'); }
    catch { return null; }
  }
  function writeSession(value) { sessionStorage.setItem(sessionKey, JSON.stringify(value)); }
  function loginEmail(username) {
    const normalized = String(username || '').trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, '-');
    if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(normalized)) throw new Error(authError);
    return { normalized, email: `${normalized}@carteira.app` };
  }
  function displayName(normalized, entered) {
    if (normalized === 'vitor-samuel') return 'Vitor Samuel';
    if (normalized === 'teste') return 'Teste';
    return String(entered || normalized).trim();
  }
  async function jsonRequest(url, options = {}) {
    const response = await fetch(url, options);
    let body = {};
    try { body = await response.json(); } catch {}
    if (!response.ok) throw new Error(body.error?.message || 'Não foi possível conectar à nuvem.');
    return body;
  }
  async function login(username, password) {
    if (!enabled) throw new Error('A autenticação na nuvem ainda não foi configurada.');
    const { normalized, email } = loginEmail(username);
    let result;
    try {
      result = await jsonRequest(`${api}/accounts:signInWithPassword?key=${encodeURIComponent(config.apiKey)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: String(password || ''), returnSecureToken: true })
      });
    } catch { throw new Error(authError); }
    const session = {
      idToken: result.idToken, refreshToken: result.refreshToken,
      expiresAt: Date.now() + Number(result.expiresIn || 3600) * 1000,
      user: { id: normalized, firebaseUid: result.localId, name: displayName(normalized, username) }
    };
    writeSession(session);
    return session.user;
  }
  async function freshSession() {
    let session = readSession();
    if (!session?.refreshToken) return null;
    if (session.expiresAt > Date.now() + 60000) return session;
    try {
      const response = await jsonRequest(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(config.apiKey)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: session.refreshToken })
      });
      session = {
        idToken: response.id_token, refreshToken: response.refresh_token || session.refreshToken,
        expiresAt: Date.now() + Number(response.expires_in || 3600) * 1000,
        user: session.user
      };
      writeSession(session);
      return session;
    } catch { sessionStorage.removeItem(sessionKey); return null; }
  }
  async function session() {
    const current = await freshSession();
    return current ? { authenticated: true, user: current.user } : null;
  }
  function documentUrl(uid) {
    return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/databases/(default)/documents/portfolioStates/${encodeURIComponent(uid)}`;
  }
  function mergeState(current, incoming) {
    const merged = { ...current, ...incoming };
    const collections = ['assets','transactions','quotes','snapshots','dividends','plans','fixedIncome','fixedIncomeObservations','dailyMarketSnapshots','marketCaptureReports','historicalSnapshots','dailyReportRecords','sourceLogs','research','portfolioAllocationSnapshots','dailyAssetImpacts','contributionHistory','withinClassWeights','positionHistory','importedRules','importReports','rawHistoryImports'];
    for (const key of collections) {
      const oldRows = Array.isArray(current[key]) ? current[key] : [];
      const newRows = Array.isArray(incoming[key]) ? incoming[key] : [];
      const idFor = row => key === 'assets' ? String(row.ticker || row.id) : String(row.id || row.importKey || JSON.stringify(row));
      const rows = new Map(oldRows.map(row => [idFor(row), row]));
      for (const row of newRows) rows.set(idFor(row), { ...rows.get(idFor(row)), ...row });
      merged[key] = [...rows.values()];
    }
    merged.importedFiles = [...new Set([...(current.importedFiles || []), ...(incoming.importedFiles || [])])];
    merged.settings = { ...(current.settings || {}), ...(incoming.settings || {}) };
    return merged;
  }
  async function readDocument(uid, token) {
    const response = await fetch(documentUrl(uid), { headers: { Authorization: `Bearer ${token}` } });
    if (response.status === 404) return { state: null, updateTime: null };
    let body = {};
    try { body = await response.json(); } catch {}
    if (!response.ok) throw new Error(body.error?.message || 'Não foi possível carregar os dados da nuvem.');
    try { return { state: JSON.parse(body.fields?.stateJson?.stringValue || 'null'), updateTime: body.updateTime || null }; }
    catch { throw new Error('O registro na nuvem está inválido; ele foi preservado para recuperação.'); }
  }
  async function getState() {
    const current = await freshSession();
    if (!current) throw new Error('Sua sessão expirou. Entre novamente.');
    const document = await readDocument(current.user.firebaseUid, current.idToken);
    return { state: document.state };
  }
  async function putState(state) {
    const current = await freshSession();
    if (!current) throw new Error('Sua sessão expirou. Entre novamente.');
    const uid = current.user.firebaseUid;
    const root = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/databases/(default)/documents`;
    const name = `projects/${config.projectId}/databases/(default)/documents/portfolioStates/${uid}`;
    for (let attempt = 0; attempt < 3; attempt++) {
      const previous = await readDocument(uid, current.idToken);
      const next = mergeState(previous.state || {}, state);
      const write = {
        update: { name, fields: { stateJson: { stringValue: JSON.stringify(next) } } },
        currentDocument: previous.updateTime ? { updateTime: previous.updateTime } : { exists: false }
      };
      const response = await fetch(`${root}:commit`, {
        method: 'POST', headers: { Authorization: `Bearer ${current.idToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ writes: [write] })
      });
      if (response.ok) return;
      let error = {};
      try { error = await response.json(); } catch {}
      if (attempt < 2 && (response.status === 409 || error.error?.status === 'FAILED_PRECONDITION')) continue;
      throw new Error(error.error?.message || 'Não foi possível salvar os dados na nuvem.');
    }
  }
  window.FirebaseCloud = { enabled, login, session, getState, putState };
})();
