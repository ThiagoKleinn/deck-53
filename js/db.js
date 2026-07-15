const CACHE_PRODUCTS = "deck53_cache_products";
const CACHE_SALES    = "deck53_cache_sales";
const CACHE_TABLES   = "deck53_cache_tables";
const CACHE_TITEMS   = "deck53_cache_table_items";
const QUEUE_KEY      = "deck53_pending_queue";
const CACHE_DEBTORS = "deck53_cache_debtors";

let state = { products: [], sales: [], tables: [], tableItems: [], debtors: [] };
let syncing = false;

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function readLocal(key) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : []; }
  catch (e) { return []; }
}
function writeLocal(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function getQueue()  { return readLocal(QUEUE_KEY); }
function setQueue(q) { writeLocal(QUEUE_KEY, q); }
function enqueue(op) { const q = getQueue(); q.push(op); setQueue(q); }
function pendingCount() { return getQueue().length; }
function isOnline()  { return navigator.onLine; }

function init() {
  state.products   = readLocal(CACHE_PRODUCTS);
  state.sales      = readLocal(CACHE_SALES);
  state.tables     = readLocal(CACHE_TABLES);
  state.tableItems = readLocal(CACHE_TITEMS);
  state.debtors = readLocal(CACHE_DEBTORS);

  // Cria 10 mesas padrão se não existir nenhuma
  if (state.tables.length === 0) {
    const uid = window.SupabaseAuth.getSession()?.user_id;
    for (let i = 1; i <= 10; i++) {
      const t = { id: uuid(), user_id: uid, nome: `Mesa ${i}`, ordem: i, created_at: new Date().toISOString() };
      state.tables.push(t);
      enqueue({ id: uuid(), action: "upsert", table: "tables", payload: t });
    }
    writeLocal(CACHE_TABLES, state.tables);
  }
  return state;
}

function persistCache() {
  writeLocal(CACHE_PRODUCTS, state.products);
  writeLocal(CACHE_SALES,    state.sales);
  writeLocal(CACHE_TABLES,   state.tables);
  writeLocal(CACHE_TITEMS,   state.tableItems);
  writeLocal(CACHE_DEBTORS, state.debtors);
}

/* ── products ── */
function upsertProductLocal(product, q=true) {
  const idx = state.products.findIndex(p => p.id === product.id);
  if (idx >= 0) state.products[idx] = product; else state.products.push(product);
  persistCache();
  if (q) enqueue({ id: uuid(), action: "upsert", table: "products", payload: product });
}
function deleteProductLocal(id, q=true) {
  state.products = state.products.filter(p => p.id !== id);
  persistCache();
  if (q) enqueue({ id: uuid(), action: "delete", table: "products", targetId: id });
}
function newProduct(fields) {
  const p = { id: uuid(), nome: fields.nome, categoria: fields.categoria||"", preco: fields.preco||0,
    user_id: window.SupabaseAuth.getSession()?.user_id };
  upsertProductLocal(p); trySync(); return p;
}
function updateProduct(id, fields) {
  const p = state.products.find(x => x.id === id); if (!p) return null;
  const u = { ...p, ...fields }; upsertProductLocal(u); trySync(); return u;
}
function removeProduct(id) { deleteProductLocal(id); trySync(); }

/* ── sales ── */
function insertSaleLocal(sale, q=true) {
  state.sales.push(sale); persistCache();
  if (q) enqueue({ id: uuid(), action: "upsert", table: "sales", payload: sale });
}
function deleteSaleLocal(id, q=true) {
  state.sales = state.sales.filter(s => s.id !== id); persistCache();
  if (q) enqueue({ id: uuid(), action: "delete", table: "sales", targetId: id });
}
function removeSale(id) { deleteSaleLocal(id); trySync(); }

function registerSale(product, quantidade) {
  const sale = { id: uuid(), produto_id: product.id, nome: product.nome, quantidade,
    preco_unit: product.preco, total: product.preco * quantidade,
    data: new Date().toISOString(), user_id: window.SupabaseAuth.getSession()?.user_id };
  insertSaleLocal(sale); trySync(); return sale;
}
function registerRawSale(nome, total, dataISO) {
  const sale = { id: uuid(), produto_id: null, nome: nome||"Venda do dia", quantidade: 1,
    preco_unit: total, total, data: dataISO||new Date().toISOString(),
    user_id: window.SupabaseAuth.getSession()?.user_id };
  insertSaleLocal(sale); trySync(); return sale;
}

/* ── tables (mesas) ── */
function upsertTableLocal(table, q=true) {
  const idx = state.tables.findIndex(t => t.id === table.id);
  if (idx >= 0) state.tables[idx] = table; else state.tables.push(table);
  persistCache();
  if (q) enqueue({ id: uuid(), action: "upsert", table: "tables", payload: table });
}
function deleteTableLocal(id, q=true) {
  state.tables     = state.tables.filter(t => t.id !== id);
  state.tableItems = state.tableItems.filter(i => i.table_id !== id);
  persistCache();
  if (q) enqueue({ id: uuid(), action: "delete", table: "tables", targetId: id });
}

function newTable() {
  const maxOrdem = state.tables.reduce((m, t) => Math.max(m, t.ordem||0), 0);
  const t = { id: uuid(), user_id: window.SupabaseAuth.getSession()?.user_id,
    nome: `Mesa ${maxOrdem + 1}`, ordem: maxOrdem + 1,
    created_at: new Date().toISOString() };
  upsertTableLocal(t); trySync(); return t;
}
function renameTable(id, nome) {
  const t = state.tables.find(x => x.id === id); if (!t) return;
  const u = { ...t, nome }; upsertTableLocal(u); trySync();
}
function removeTable(id) { deleteTableLocal(id); trySync(); }

/* ── table items (itens da comanda) ── */
function upsertTableItemLocal(item, q=true) {
  const idx = state.tableItems.findIndex(i => i.id === item.id);
  if (idx >= 0) state.tableItems[idx] = item; else state.tableItems.push(item);
  persistCache();
  if (q) enqueue({ id: uuid(), action: "upsert", table: "table_items", payload: item });
}
function deleteTableItemLocal(id, q=true) {
  state.tableItems = state.tableItems.filter(i => i.id !== id);
  persistCache();
  if (q) enqueue({ id: uuid(), action: "delete", table: "table_items", targetId: id });
}

function addItemToTable(tableId, product, qty=1) {
  // Se já existe o mesmo produto nesta mesa, incrementa
  const existing = state.tableItems.find(i => i.table_id === tableId && i.produto_id === product.id);
  if (existing) {
    const updated = { ...existing, quantidade: existing.quantidade + qty,
      total: existing.preco_unit * (existing.quantidade + qty) };
    upsertTableItemLocal(updated); trySync(); return updated;
  }
  const item = { id: uuid(), table_id: tableId, produto_id: product.id, nome: product.nome,
    quantidade: qty, preco_unit: product.preco, total: product.preco * qty,
    user_id: window.SupabaseAuth.getSession()?.user_id,
    created_at: new Date().toISOString() };
  upsertTableItemLocal(item); trySync(); return item;
}

function removeItemFromTable(itemId) { deleteTableItemLocal(itemId); trySync(); }

function changeItemQty(itemId, delta) {
  const item = state.tableItems.find(i => i.id === itemId); if (!item) return;
  const newQty = item.quantidade + delta;
  if (newQty <= 0) { deleteTableItemLocal(itemId); trySync(); return; }
  const updated = { ...item, quantidade: newQty, total: item.preco_unit * newQty };
  upsertTableItemLocal(updated); trySync();
}

function getTableItems(tableId) {
  return state.tableItems.filter(i => i.table_id === tableId);
}

function getTableTotal(tableId) {
  return getTableItems(tableId).reduce((s, i) => s + i.total, 0);
}

/**
 * Fecha a comanda: salva cada item como venda no histórico
 * + uma venda-resumo da mesa, zera os itens da mesa.
 */
function closeTable(tableId, paymentMethod) {
  const table = state.tables.find(t => t.id === tableId); if (!table) return;
  const items = getTableItems(tableId);
  if (items.length === 0) return;
  const uid   = window.SupabaseAuth.getSession()?.user_id;
  const dataISO = new Date().toISOString();
  const total = items.reduce((s, i) => s + i.total, 0);

  // Salva cada item individualmente
  items.forEach(item => {
    const sale = { id: uuid(), produto_id: item.produto_id, nome: item.nome,
      quantidade: item.quantidade, preco_unit: item.preco_unit, total: item.total,
      data: dataISO, user_id: uid,
      mesa: table.nome, payment_method: paymentMethod };
    insertSaleLocal(sale);
  });

  // Salva venda-resumo da mesa
  const summary = { id: uuid(), produto_id: null,
    nome: `[Fechamento] ${table.nome}`,
    quantidade: 1, preco_unit: total, total,
    data: dataISO, user_id: uid,
    mesa: table.nome, payment_method: paymentMethod };
  insertSaleLocal(summary);

  // Remove itens da comanda
  items.forEach(i => deleteTableItemLocal(i.id));
  trySync();
  return total;
}

/* ── death note (fiado) ── */
function upsertDebtorLocal(debtor, q=true) {
  const idx = state.debtors.findIndex(d => d.id === debtor.id);
  if (idx >= 0) state.debtors[idx] = debtor; else state.debtors.push(debtor);
  persistCache();
  if (q) enqueue({ id: uuid(), action: "upsert", table: "debtors", payload: debtor });
}
function deleteDebtorLocal(id, q=true) {
  state.debtors = state.debtors.filter(d => d.id !== id);
  persistCache();
  if (q) enqueue({ id: uuid(), action: "delete", table: "debtors", targetId: id });
}
function newDebtor(nome, valor) {
  const d = { id: uuid(), user_id: window.SupabaseAuth.getSession()?.user_id,
    nome, valor: valor||0, created_at: new Date().toISOString() };
  upsertDebtorLocal(d); trySync(); return d;
}
function adjustDebtorValue(id, delta) {
  const d = state.debtors.find(x => x.id === id); if (!d) return;
  const novoValor = Math.max(0, (d.valor||0) + delta);
  const u = { ...d, valor: novoValor };
  upsertDebtorLocal(u); trySync(); return u;
}
function renameDebtor(id, nome) {
  const d = state.debtors.find(x => x.id === id); if (!d) return;
  const u = { ...d, nome }; upsertDebtorLocal(u); trySync();
}
function removeDebtor(id) { deleteDebtorLocal(id); trySync(); }

/* ── wipe ── */
function wipeAll() {
  state = { products: [], sales: [], tables: [], tableItems: [], debtors: [] };
  persistCache(); setQueue([]);
}
async function wipeRemote() {
  try {
    const uid = window.SupabaseAuth.getSession().user_id;
    await window.sbRequest(`table_items?user_id=eq.${uid}`, "DELETE");
    await window.sbRequest(`tables?user_id=eq.${uid}`, "DELETE");
    await window.sbRequest(`products?user_id=eq.${uid}`, "DELETE");
    await window.sbRequest(`sales?user_id=eq.${uid}`, "DELETE");
    await window.sbRequest(`debtors?user_id=eq.${uid}`, "DELETE");
  } catch(e) {}
}

/* ── sync ── */
async function flushQueue() {
  if (!isOnline()) return { ok: false, reason: "offline" };
  const session = window.SupabaseAuth.getSession();
  if (!session) return { ok: false, reason: "no-session" };
  let queue = getQueue();
  while (queue.length > 0) {
    const op = queue[0];
    try {
      if (op.action === "upsert") {
        await window.sbRequest(`${op.table}?on_conflict=id`, "POST", op.payload,
            { Prefer: "resolution=merge-duplicates,return=representation" });
      } else if (op.action === "delete") {
        await window.sbRequest(`${op.table}?id=eq.${op.targetId}`, "DELETE");
      }
      queue.shift(); setQueue(queue);
    } catch(e) { return { ok: false, reason: "error", error: e }; }
  }
  return { ok: true };
}

async function fetchRemoteAndMerge() {
  const session = window.SupabaseAuth.getSession();
  if (!session || !isOnline()) return { ok: false };
  try {
    const [products, sales, tables, tableItems] = await Promise.all([
      window.sbRequest(`products?select=*&order=created_at.asc`, "GET"),
      window.sbRequest(`sales?select=*&order=data.asc`, "GET"),
      window.sbRequest(`tables?select=*&order=ordem.asc`, "GET"),
      window.sbRequest(`table_items?select=*&order=created_at.asc`, "GET"),
      window.sbRequest(`debtors?select=*&order=created_at.asc`, "GET"),
    ]);
    state.products   = products   || [];
    state.sales      = sales      || [];
    state.tables     = tables     || [];
    state.tableItems = tableItems || [];
    state.debtors = debtors || [];
    persistCache();
    return { ok: true };
  } catch(e) { return { ok: false, error: e }; }
}

async function trySync(onDone) {
  if (syncing || !isOnline()) return;
  syncing = true;
  const result = await flushQueue();
  if (result.ok) await fetchRemoteAndMerge();
  syncing = false;
  if (onDone) onDone(result);
}

window.addEventListener("online", () => trySync(() => window.dispatchEvent(new Event("deck53:synced"))));

window.Deck53DB = {
  init, getState: () => state,
  newProduct, updateProduct, removeProduct,
  registerSale, registerRawSale, removeSale,
  newTable, renameTable, removeTable,
  addItemToTable, removeItemFromTable, changeItemQty,
  getTableItems, getTableTotal, closeTable,
  wipeAll, wipeRemote,
  trySync, fetchRemoteAndMerge,
  pendingCount, isOnline,
  newDebtor, adjustDebtorValue, renameDebtor, removeDebtor
};