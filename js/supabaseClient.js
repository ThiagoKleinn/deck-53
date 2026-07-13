const SB_URL = window.DECK53_CONFIG.SUPABASE_URL;
const SB_ANON_KEY = window.DECK53_CONFIG.SUPABASE_ANON_KEY;

const SESSION_KEY = "deck53_session";

function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

async function signUp(email, password) {
  const res = await fetch(`${SB_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SB_ANON_KEY },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || data.error_description || "Não foi possível criar a conta.");
  if (data.access_token) {
    saveSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      user_id: data.user?.id,
      email: data.user?.email
    });
  }
  return data;
}

async function signIn(email, password) {
  const res = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SB_ANON_KEY },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || data.error_description || "E-mail ou senha incorretos.");
  saveSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    user_id: data.user?.id,
    email: data.user?.email
  });
  return data;
}

async function refreshSession() {
  const session = getSession();
  if (!session || !session.refresh_token) throw new Error("Sem sessão para renovar.");
  const res = await fetch(`${SB_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SB_ANON_KEY },
    body: JSON.stringify({ refresh_token: session.refresh_token })
  });
  const data = await res.json();
  if (!res.ok) throw new Error("Sessão expirada.");
  saveSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    user_id: data.user?.id || session.user_id,
    email: data.user?.email || session.email
  });
  return data;
}

function signOut() {
  clearSession();
}

async function sbRequest(path, method = "GET", body = null, extraHeaders = {}) {
  const session = getSession();
  if (!session) throw new Error("offline-no-session");

  const doFetch = (token) =>
    fetch(`${SB_URL}/rest/v1/${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        apikey: SB_ANON_KEY,
        Authorization: `Bearer ${token}`,
        Prefer: "return=representation",
        ...extraHeaders
      },
      body: body ? JSON.stringify(body) : undefined
    });

  let res = await doFetch(session.access_token);

  if (res.status === 401) {
    await refreshSession();
    const newSession = getSession();
    res = await doFetch(newSession.access_token);
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Erro na API (${res.status}): ${errText}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

window.SupabaseAuth = { signUp, signIn, signOut, getSession, refreshSession };
window.sbRequest = sbRequest;