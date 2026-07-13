const CACHE_PRODUCTS = "deck53_cache_products";
const CACHE_SALES = "deck53_cache_sales";
const QUEUE_KEY = "deck53_pending_queue";

let state = { products: [], sales: [] };
let syncing = false;

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function readLocal(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}
function writeLocal(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
function getQueue() {
  return readLocal(QUEUE_KEY);
}
function setQueue(q) {
  writeLocal(QUEUE_KEY, q);
}
function enqueue(op) {
  const q = getQueue();
  q.push(op);
  setQueue(q);
}

function pendingCount() {
  return getQueue().length;
}

function isOnline() {
  return navigator.onLine;
}

function init() {
  state.products = readLocal(CACHE_PRODUCTS);
  state.sales = readLocal(CACHE_SALES);
  return state;
}

function persistCache() {
  writeLocal(CACHE_PRODUCTS, state.products);
  writeLocal(CACHE_SALES, state.sales);
}

function upsertProductLocal(product, queueIt = true) {
  const idx = state.products.findIndex(p => p.id === product.id);
  if (idx >= 0) state.products[idx] = product;
  else state.products.push(product);
  persistCache();
  if (queueIt) enqueue({ id: uuid(), action: "upsert", table: "products", payload: product });
}

function deleteProductLocal(id, queueIt = true) {
  state.products = state.products.filter(p => p.id !== id);
  persistCache();
  if (queueIt) enqueue({ id: uuid(), action: "delete", table: "products", targetId: id });
}

function insertSaleLocal(sale, queueIt = true) {
  state.sales.push(sale);
  persistCache();
  if (queueIt) enqueue({ id: uuid(), action: "upsert", table: "sales", payload: sale });
}

function newProduct(fields) {
  const product = {
    id: uuid(),
    nome: fields.nome,
    categoria: fields.categoria || "",
    preco: fields.preco || 0,
    user_id: window.SupabaseAuth.getSession()?.user_id
  };
  upsertProductLocal(product);
  trySync();
  return product;
}

function updateProduct(id, fields) {
  const p = state.products.find(x => x.id === id);
  if (!p) return null;
  const updated = { ...p, ...fields };
  upsertProductLocal(updated);
  trySync();
  return updated;
}

function removeProduct(id) {
  deleteProductLocal(id);
  trySync();
}

function registerSale(product, quantidade) {
  const total = product.preco * quantidade;
  const sale = {
    id: uuid(),
    produto_id: product.id,
    nome: product.nome,
    quantidade,
    preco_unit: product.preco,
    total,
    data: new Date().toISOString(),
    user_id: window.SupabaseAuth.getSession()?.user_id
  };
  insertSaleLocal(sale);
  trySync();
  return sale;
}

function wipeAll() {
  state.products = [];
  state.sales = [];
  persistCache();
  setQueue([]);
}

async function wipeRemote() {
  try {
    await window.sbRequest(`products?user_id=eq.${window.SupabaseAuth.getSession().user_id}`, "DELETE");
    await window.sbRequest(`sales?user_id=eq.${window.SupabaseAuth.getSession().user_id}`, "DELETE");
  } catch (e) {
  }
}

// ---------- sincronização ----------
async function flushQueue() {
  if (!isOnline()) return { ok: false, reason: "offline" };
  const session = window.SupabaseAuth.getSession();
  if (!session) return { ok: false, reason: "no-session" };

  let queue = getQueue();
  while (queue.length > 0) {
    const op = queue[0];
    try {
      if (op.action === "upsert") {
        await window.sbRequest(`${op.table}?on_conflict=id`, "POST", op.payload, {
          Prefer: "resolution=merge-duplicates,return=representation"
        });
      } else if (op.action === "delete") {
        await window.sbRequest(`${op.table}?id=eq.${op.targetId}`, "DELETE");
      }
      queue.shift();
      setQueue(queue);
    } catch (e) {
      return { ok: false, reason: "error", error: e };
    }
  }
  return { ok: true };
}

async function fetchRemoteAndMerge() {
  const session = window.SupabaseAuth.getSession();
  if (!session || !isOnline()) return { ok: false };
  try {
    const [products, sales] = await Promise.all([
      window.sbRequest(`products?select=*&order=created_at.asc`, "GET"),
      window.sbRequest(`sales?select=*&order=data.asc`, "GET")
    ]);
    state.products = products || [];
    state.sales = sales || [];
    persistCache();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e };
  }
}

async function trySync(onDone) {
  if (syncing || !isOnline()) return;
  syncing = true;
  const result = await flushQueue();
  if (result.ok) {
    await fetchRemoteAndMerge();
  }
  syncing = false;
  if (onDone) onDone(result);
}

window.addEventListener("online", () => trySync(() => window.dispatchEvent(new Event("deck53:synced"))));

window.Deck53DB = {
  init,
  getState: () => state,
  newProduct,
  updateProduct,
  removeProduct,
  registerSale,
  wipeAll,
  wipeRemote,
  trySync,
  fetchRemoteAndMerge,
  pendingCount,
  isOnline
};