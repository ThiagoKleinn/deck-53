let authMode = "signin";
let currentPeriod = "hoje";
let sellSelection = { productId: null, qty: 1 };

function fmt(n){ return (n||0).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}); }
function escapeHtml(str){ const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(()=> t.classList.remove('show'), 2000);
}

document.querySelectorAll('.auth-tab').forEach(tab=>{
  tab.addEventListener('click', ()=>{
    authMode = tab.dataset.mode;
    document.querySelectorAll('.auth-tab').forEach(t=>t.classList.toggle('active', t===tab));
    document.getElementById('auth-submit').textContent = authMode==='signin' ? 'Entrar' : 'Criar conta';
    document.getElementById('auth-error').classList.remove('show');
  });
});

async function handleAuthSubmit(){
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const errEl = document.getElementById('auth-error');
  errEl.classList.remove('show');

  if(!email || !password){
    errEl.textContent = 'Preencha e-mail e senha.';
    errEl.classList.add('show');
    return;
  }
  try{
    if(authMode==='signin') await window.SupabaseAuth.signIn(email, password);
    else await window.SupabaseAuth.signUp(email, password);
    await bootApp();
  }catch(e){
    errEl.textContent = e.message || 'Não foi possível conectar. Verifique sua internet.';
    errEl.classList.add('show');
  }
}

function continueOffline(){
  const session = window.SupabaseAuth.getSession();
  if(!session){
    const errEl = document.getElementById('auth-error');
    errEl.textContent = 'Ainda não há dados salvos neste aparelho. É preciso entrar pela primeira vez com internet.';
    errEl.classList.add('show');
    return;
  }
  bootApp();
}

function logout(){
  if(!confirm('Sair da conta neste aparelho?')) return;
  window.SupabaseAuth.signOut();
  document.getElementById('app-root').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
}

async function bootApp(){
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-root').style.display = 'flex';

  Deck53DB.init();
  renderAll();
  updateSyncStatus();

  Deck53DB.trySync(()=>{ renderAll(); updateSyncStatus(); });
  window.addEventListener('online', updateSyncStatus);
  window.addEventListener('offline', updateSyncStatus);
  window.addEventListener('deck53:synced', ()=>{ renderAll(); updateSyncStatus(); });
}

function updateSyncStatus(){
  const dot = document.getElementById('sync-dot');
  const text = document.getElementById('sync-text');
  const pending = Deck53DB.pendingCount();
  if(!Deck53DB.isOnline()){
    dot.className = 'sync-dot';
    text.textContent = pending>0 ? `Offline · ${pending} alteração(ões) pendente(s)` : 'Offline · usando dados salvos no aparelho';
  } else if(pending>0){
    dot.className = 'sync-dot pending';
    text.textContent = `Sincronizando ${pending} alteração(ões)…`;
  } else {
    dot.className = 'sync-dot online';
    text.textContent = 'Tudo sincronizado';
  }
}

window.addEventListener('load', ()=>{
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  }
  const session = window.SupabaseAuth.getSession();
  if(session){
    bootApp();
  }
});

function switchTab(tab){
  document.querySelectorAll('.tab-panel').forEach(el=>el.classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(el=>el.classList.toggle('active', el.dataset.tab===tab));
  if(tab==='vender') renderSellTab();
  if(tab==='painel') renderDashboard();
}

function renderAll(){
  renderProductList();
  const activeTab = document.querySelector('.nav-btn.active').dataset.tab;
  if(activeTab==='vender') renderSellTab();
  if(activeTab==='painel') renderDashboard();
}

function openProductModal(id){
  document.getElementById('product-id').value = id || '';
  if(id){
    const p = Deck53DB.getState().products.find(x=>x.id===id);
    document.getElementById('product-modal-title').textContent = 'Editar produto';
    document.getElementById('p-nome').value = p.nome;
    document.getElementById('p-categoria').value = p.categoria || '';
    document.getElementById('p-custo').value = p.custo;
    document.getElementById('p-venda').value = p.venda;
    document.getElementById('p-estoque').value = p.estoque;
    document.getElementById('p-minimo').value = p.minimo;
  } else {
    document.getElementById('product-modal-title').textContent = 'Novo produto';
    ['p-nome','p-categoria','p-custo','p-venda','p-estoque'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('p-minimo').value = 5;
  }
  document.getElementById('product-overlay').classList.add('active');
}
function closeProductModal(){ document.getElementById('product-overlay').classList.remove('active'); }
document.getElementById('product-overlay').addEventListener('click', e=>{
  if(e.target.id==='product-overlay') closeProductModal();
});

function saveProduct(){
  const id = document.getElementById('product-id').value;
  const nome = document.getElementById('p-nome').value.trim();
  const categoria = document.getElementById('p-categoria').value.trim();
  const custo = parseFloat(document.getElementById('p-custo').value) || 0;
  const venda = parseFloat(document.getElementById('p-venda').value) || 0;
  const estoque = parseInt(document.getElementById('p-estoque').value) || 0;
  const minimo = parseInt(document.getElementById('p-minimo').value) || 5;

  if(!nome){ showToast('Dá um nome pro produto antes de salvar.'); return; }

  if(id) Deck53DB.updateProduct(id, {nome, categoria, custo, venda, estoque, minimo});
  else Deck53DB.newProduct({nome, categoria, custo, venda, estoque, minimo});

  closeProductModal();
  renderAll();
  updateSyncStatus();
  showToast('Produto salvo.');
}

function deleteProduct(id){
  if(!confirm('Remover este produto do estoque?')) return;
  Deck53DB.removeProduct(id);
  renderAll();
  updateSyncStatus();
}

function openRestock(id){
  const p = Deck53DB.getState().products.find(x=>x.id===id);
  document.getElementById('restock-id').value = id;
  document.getElementById('restock-product-name').textContent = p.nome;
  document.getElementById('restock-qty').value = '';
  document.getElementById('restock-overlay').classList.add('active');
}
document.getElementById('restock-overlay').addEventListener('click', e=>{
  if(e.target.id==='restock-overlay') document.getElementById('restock-overlay').classList.remove('active');
});
function confirmRestock(){
  const id = document.getElementById('restock-id').value;
  const qty = parseInt(document.getElementById('restock-qty').value) || 0;
  if(qty<=0){ showToast('Informe uma quantidade válida.'); return; }
  Deck53DB.restockProduct(id, qty);
  document.getElementById('restock-overlay').classList.remove('active');
  renderAll();
  updateSyncStatus();
  showToast('Estoque atualizado.');
}

function renderProductList(){
  const el = document.getElementById('product-list');
  const products = Deck53DB.getState().products;
  if(products.length===0){
    el.innerHTML = `<div class="empty">
      <div class="empty-title">Nenhum produto ainda</div>
      Adicione o primeiro produto do Deck 53 para começar a controlar o estoque.
    </div>`;
    return;
  }
  const groups = {};
  products.forEach(p=>{
    const cat = (p.categoria || '').trim() || 'Sem categoria';
    if(!groups[cat]) groups[cat] = [];
    groups[cat].push(p);
  });
  const categorias = Object.keys(groups).sort((a,b)=> a.localeCompare(b, 'pt-BR'));

  el.innerHTML = categorias.map(cat=>{
    const items = groups[cat];
    return `
      <div class="category-group">
        <div class="category-heading">${escapeHtml(cat)}</div>
        ${items.map(p=>{
      const margem = p.venda>0 ? (((p.venda-p.custo)/p.venda)*100).toFixed(0) : '0';
      const low = p.estoque <= p.minimo;
      return `
          <div class="card">
            <div class="product-row">
              <div>
                <div class="product-name">${escapeHtml(p.nome)}</div>
              </div>
              <div class="stock-pill ${low?'low':''}">${p.estoque} un.</div>
            </div>
            <div class="product-meta">
              <span>Custo: R$ ${fmt(p.custo)}</span>
              <span>Venda: R$ ${fmt(p.venda)}</span>
              <span>Margem: ${margem}%</span>
            </div>
            <div class="row-actions">
              <button class="btn btn-ghost btn-sm" onclick="openRestock('${p.id}')">+ Repor</button>
              <button class="btn btn-ghost btn-sm" onclick="openProductModal('${p.id}')">Editar</button>
              <button class="btn btn-danger btn-sm" onclick="deleteProduct('${p.id}')">Remover</button>
            </div>
          </div>`;
    }).join('')}
      </div>
    `;
  }).join('');
}

/* ================= VENDER ================= */
function renderSellTab(){
  const el = document.getElementById('sell-card');
  const products = Deck53DB.getState().products;
  if(products.length===0){
    el.innerHTML = `<div class="empty" style="padding:20px 0;">Cadastre produtos no estoque antes de vender.</div>`;
    document.getElementById('today-sales').innerHTML = '';
    return;
  }
  if(!sellSelection.productId || !products.find(p=>p.id===sellSelection.productId)){
    sellSelection.productId = products[0].id;
    sellSelection.qty = 1;
  }
  const p = products.find(x=>x.id===sellSelection.productId);
  const total = p.venda * sellSelection.qty;
  const lucro = (p.venda - p.custo) * sellSelection.qty;
  el.innerHTML = `
    <div class="field">
      <label>Produto</label>
      <select id="sell-product-select" onchange="onSellProductChange(this.value)">
        ${products.map(pr=>`<option value="${pr.id}" ${pr.id===p.id?'selected':''}>${escapeHtml(pr.nome)} (${pr.estoque} un.)</option>`).join('')}
      </select>
    </div>
    <div class="field">
      <label>Quantidade</label>
      <div class="qty-stepper">
        <button class="qty-btn" onclick="changeQty(-1)">–</button>
        <div class="qty-value">${sellSelection.qty}</div>
        <button class="qty-btn" onclick="changeQty(1)">+</button>
      </div>
    </div>
    <div class="sell-preview"><span>Total da venda</span><b>R$ ${fmt(total)}</b></div>
    <div class="sell-preview"><span>Lucro estimado</span><b style="color:var(--lime)">R$ ${fmt(lucro)}</b></div>
    <button class="btn btn-primary btn-block" style="margin-top:14px;" onclick="registerSale()">Registrar venda</button>
  `;
  renderTodaySales();
}
function onSellProductChange(id){ sellSelection.productId = id; sellSelection.qty = 1; renderSellTab(); }
function changeQty(delta){
  const p = Deck53DB.getState().products.find(x=>x.id===sellSelection.productId);
  const next = sellSelection.qty + delta;
  if(next < 1) return;
  if(next > p.estoque){ showToast('Estoque insuficiente.'); return; }
  sellSelection.qty = next;
  renderSellTab();
}
function registerSale(){
  const p = Deck53DB.getState().products.find(x=>x.id===sellSelection.productId);
  if(sellSelection.qty > p.estoque){ showToast('Estoque insuficiente para essa venda.'); return; }
  Deck53DB.registerSale(p, sellSelection.qty);
  sellSelection.qty = 1;
  renderAll();
  renderSellTab();
  updateSyncStatus();
  showToast('Venda registrada.');
}
function renderTodaySales(){
  const el = document.getElementById('today-sales');
  const todayStr = new Date().toDateString();
  const todaySales = Deck53DB.getState().sales
      .filter(s => new Date(s.data).toDateString() === todayStr)
      .slice().reverse();
  if(todaySales.length===0){
    el.innerHTML = `<div class="empty" style="padding:24px 0;">Nenhuma venda registrada hoje.</div>`;
    return;
  }
  el.innerHTML = todaySales.map(s=>`
    <div class="card" style="margin-bottom:8px;">
      <div class="rank-row" style="border:none; padding:0;">
        <div>
          <div style="font-weight:600; font-size:14px;">${escapeHtml(s.nome)} × ${s.quantidade}</div>
          <div style="font-size:11.5px; color:var(--text-faint); margin-top:2px;">${new Date(s.data).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-family:'IBM Plex Mono'; font-size:14px;">R$ ${fmt(s.total)}</div>
          <div style="font-family:'IBM Plex Mono'; font-size:11.5px; color:var(--lime);">+R$ ${fmt(s.lucro)}</div>
        </div>
      </div>
    </div>
  `).join('');
}

document.getElementById('period-tabs').addEventListener('click', e=>{
  const btn = e.target.closest('.period-tab');
  if(!btn) return;
  currentPeriod = btn.dataset.period;
  document.querySelectorAll('.period-tab').forEach(t=>t.classList.toggle('active', t===btn));
  renderDashboard();
});

function salesForPeriod(period){
  const now = new Date();
  return Deck53DB.getState().sales.filter(s=>{
    const d = new Date(s.data);
    if(period==='hoje') return d.toDateString()===now.toDateString();
    if(period==='semana') return (now - d) / (1000*60*60*24) <= 7;
    if(period==='mes') return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
    return true;
  });
}

function renderDashboard(){
  const el = document.getElementById('dashboard-content');
  const list = salesForPeriod(currentPeriod);
  const receita = list.reduce((a,s)=>a+s.total,0);
  const custoTotal = list.reduce((a,s)=>a+s.custo_unit*s.quantidade,0);
  const lucro = list.reduce((a,s)=>a+s.lucro,0);
  const margem = receita>0 ? ((lucro/receita)*100).toFixed(0) : '0';

  const ranking = {};
  list.forEach(s=>{
    if(!ranking[s.nome]) ranking[s.nome] = {qtd:0, lucro:0};
    ranking[s.nome].qtd += s.quantidade;
    ranking[s.nome].lucro += s.lucro;
  });
  const top = Object.entries(ranking).sort((a,b)=>b[1].lucro-a[1].lucro).slice(0,5);
  const lowStock = Deck53DB.getState().products.filter(p=>p.estoque <= p.minimo);

  el.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-label">RECEITA</div><div class="stat-value">R$ ${fmt(receita)}</div></div>
      <div class="stat-card"><div class="stat-label">CUSTO</div><div class="stat-value">R$ ${fmt(custoTotal)}</div></div>
      <div class="stat-card full">
        <div class="stat-label">LUCRO ${list.length? '· margem '+margem+'%' : ''}</div>
        <div class="stat-value lime">R$ ${fmt(lucro)}</div>
        <div class="stat-sub">${list.length} venda${list.length===1?'':'s'} no período</div>
      </div>
    </div>

    <div class="plank-divider"></div>
    <div class="card">
      <div class="section-title" style="font-size:16px; margin-bottom:8px;">Top produtos (por lucro)</div>
      ${top.length===0 ? '<div class="empty" style="padding:10px 0;">Sem vendas neste período.</div>' :
      top.map(([nome,v])=>`
          <div class="rank-row">
            <div class="rank-name">${escapeHtml(nome)} <span style="color:var(--text-faint); font-weight:400;">× ${v.qtd}</span></div>
            <div class="rank-value">+R$ ${fmt(v.lucro)}</div>
          </div>`).join('')}
    </div>

    <div class="card">
      <div class="section-title" style="font-size:16px; margin-bottom:8px;">Estoque baixo</div>
      ${lowStock.length===0 ? '<div class="empty" style="padding:10px 0;">Tudo certo por aqui.</div>' :
      lowStock.map(p=>`
          <div class="alert-row"><span>${escapeHtml(p.nome)}</span><span>${p.estoque} un. (mín. ${p.minimo})</span></div>
        `).join('')}
    </div>

    <div style="text-align:center; margin-top:22px; display:flex; flex-direction:column; gap:10px; align-items:center;">
      <button class="link-plain" onclick="logout()">Sair da conta</button>
      <button class="link-danger" onclick="resetAllData()">Apagar todos os dados</button>
    </div>
  `;
}

async function resetAllData(){
  if(!confirm('Isso vai apagar todos os produtos e vendas, neste aparelho e na nuvem. Tem certeza?')) return;
  await Deck53DB.wipeRemote();
  Deck53DB.wipeAll();
  renderAll();
  updateSyncStatus();
  showToast('Dados apagados.');
}