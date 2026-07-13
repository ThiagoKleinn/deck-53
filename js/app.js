let authMode = "signin";
let currentPeriod = "hoje";
let sellSelection = { productId: null, qty: 1 };
let sellMode = "item"; // item ou avulsa
let quickSale = { valor: "", obs: "" };

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

function groupProductsByCategory(products){
  const groups = {};
  products.forEach(p=>{
    const cat = (p.categoria || '').trim() || 'Sem categoria';
    if(!groups[cat]) groups[cat] = [];
    groups[cat].push(p);
  });
  const categorias = Object.keys(groups).sort((a,b)=> a.localeCompare(b, 'pt-BR'));
  return categorias.map(cat=>({ cat, items: groups[cat] }));
}

function openProductModal(id){
  document.getElementById('product-id').value = id || '';
  if(id){
    const p = Deck53DB.getState().products.find(x=>x.id===id);
    document.getElementById('product-modal-title').textContent = 'Editar item';
    document.getElementById('p-nome').value = p.nome;
    document.getElementById('p-categoria').value = p.categoria || '';
    document.getElementById('p-venda').value = p.preco;
  } else {
    document.getElementById('product-modal-title').textContent = 'Novo item';
    ['p-nome','p-categoria','p-venda'].forEach(id=>document.getElementById(id).value='');
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
  const preco = parseFloat(document.getElementById('p-venda').value) || 0;

  if(!nome){ showToast('Dá um nome pro item antes de salvar.'); return; }

  if(id) Deck53DB.updateProduct(id, {nome, categoria, preco});
  else Deck53DB.newProduct({nome, categoria, preco});

  closeProductModal();
  renderAll();
  updateSyncStatus();
  showToast('Item salvo.');
}

function deleteProduct(id){
  if(!confirm('Remover este item do cardápio?')) return;
  Deck53DB.removeProduct(id);
  renderAll();
  updateSyncStatus();
}

function renderProductList(){
  const el = document.getElementById('product-list');
  const products = Deck53DB.getState().products;
  if(products.length===0){
    el.innerHTML = `<div class="empty">
      <div class="empty-title">Nenhum item ainda</div>
      Adicione o primeiro item do cardápio do Deck 53.
    </div>`;
    return;
  }

  el.innerHTML = groupProductsByCategory(products).map(({cat, items})=>{
    return `
      <div class="category-group">
        <div class="category-heading">${escapeHtml(cat)}</div>
        ${items.map(p=>{
      return `
          <div class="card">
            <div class="product-row">
              <div>
                <div class="product-name">${escapeHtml(p.nome)}</div>
              </div>
              <div class="price-pill">R$ ${fmt(p.preco)}</div>
            </div>
            <div class="row-actions">
              <button class="btn btn-ghost btn-sm" onclick="openProductModal('${p.id}')">Editar</button>
              <button class="btn btn-danger btn-sm" onclick="deleteProduct('${p.id}')">Remover</button>
            </div>
          </div>`;
    }).join('')}
      </div>
    `;
  }).join('');
}

function setSellMode(mode){
  sellMode = mode;
  renderSellTab();
}

function renderSellTab(){
  const el = document.getElementById('sell-card');
  const products = Deck53DB.getState().products;

  const modeToggle = `
    <div class="period-tabs" style="margin-bottom:16px;">
      <div class="period-tab ${sellMode==='item'?'active':''}" onclick="setSellMode('item')">Por item</div>
      <div class="period-tab ${sellMode==='avulsa'?'active':''}" onclick="setSellMode('avulsa')">Venda avulsa</div>
    </div>
  `;

  if(sellMode==='avulsa'){
    el.innerHTML = modeToggle + `
      <div class="field">
        <label>Valor total da venda (R$)</label>
        <input type="number" step="0.01" id="quick-valor" placeholder="0,00" value="${quickSale.valor}" oninput="quickSale.valor=this.value">
      </div>
      <div class="field">
        <label>Observação (opcional)</label>
        <input type="text" id="quick-obs" placeholder="Ex: Mesa 5, 5 cervejas + 1 porção" value="${escapeHtml(quickSale.obs)}" oninput="quickSale.obs=this.value">
      </div>
      <button class="btn btn-primary btn-block" style="margin-top:6px;" onclick="registerQuickSale()">Registrar venda</button>
    `;
    renderTodaySales();
    return;
  }

  if(products.length===0){
    el.innerHTML = modeToggle + `<div class="empty" style="padding:20px 0;">Cadastre itens no cardápio antes de vender por item.</div>`;
    document.getElementById('today-sales').innerHTML = '';
    return;
  }
  if(!sellSelection.productId || !products.find(p=>p.id===sellSelection.productId)){
    sellSelection.productId = products[0].id;
    sellSelection.qty = 1;
  }
  const p = products.find(x=>x.id===sellSelection.productId);
  const total = p.preco * sellSelection.qty;
  el.innerHTML = modeToggle + `
    <div class="field">
      <label>Item</label>
      <select id="sell-product-select" onchange="onSellProductChange(this.value)">
        ${groupProductsByCategory(products).map(({cat, items})=>`
          <optgroup label="${escapeHtml(cat)}">
            ${items.map(pr=>`<option value="${pr.id}" ${pr.id===p.id?'selected':''}>${escapeHtml(pr.nome)}</option>`).join('')}
          </optgroup>
        `).join('')}
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
    <button class="btn btn-primary btn-block" style="margin-top:14px;" onclick="registerSale()">Registrar venda</button>
  `;
  renderTodaySales();
}
function onSellProductChange(id){ sellSelection.productId = id; sellSelection.qty = 1; renderSellTab(); }
function changeQty(delta){
  const next = sellSelection.qty + delta;
  if(next < 1) return;
  sellSelection.qty = next;
  renderSellTab();
}
function registerSale(){
  const p = Deck53DB.getState().products.find(x=>x.id===sellSelection.productId);
  Deck53DB.registerSale(p, sellSelection.qty);
  sellSelection.qty = 1;
  renderAll();
  renderSellTab();
  updateSyncStatus();
  showToast('Venda registrada.');
}
function registerQuickSale(){
  const valor = parseFloat(quickSale.valor) || 0;
  if(valor<=0){ showToast('Informe um valor válido.'); return; }
  const nome = quickSale.obs.trim() || 'Venda avulsa';
  Deck53DB.registerRawSale(nome, valor);
  quickSale = { valor: '', obs: '' };
  renderAll();
  renderSellTab();
  updateSyncStatus();
  showToast('Venda registrada.');
}

function deleteSale(id){
  if(!confirm('Apagar esta venda? Isso não pode ser desfeito.')) return;
  Deck53DB.removeSale(id);
  renderAll();
  updateSyncStatus();
  showToast('Venda apagada.');
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
        </div>
      </div>
      <div class="row-actions">
        <button class="btn btn-danger btn-sm" onclick="deleteSale('${s.id}')">Apagar</button>
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
  const totalItens = list.reduce((a,s)=>a+s.quantidade,0);

  const ranking = {};
  list.forEach(s=>{
    if(!ranking[s.nome]) ranking[s.nome] = {qtd:0, total:0};
    ranking[s.nome].qtd += s.quantidade;
    ranking[s.nome].total += s.total;
  });
  const top = Object.entries(ranking).sort((a,b)=>b[1].total-a[1].total).slice(0,5);

  el.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card full">
        <div class="stat-label">FATURAMENTO</div>
        <div class="stat-value lime">R$ ${fmt(receita)}</div>
        <div class="stat-sub">${list.length} venda${list.length===1?'':'s'} · ${totalItens} item${totalItens===1?'':'s'} no período</div>
      </div>
    </div>

    <div class="plank-divider"></div>
    <div class="card">
      <div class="section-title" style="font-size:16px; margin-bottom:8px;">Top itens (por faturamento)</div>
      ${top.length===0 ? '<div class="empty" style="padding:10px 0;">Sem vendas neste período.</div>' :
      top.map(([nome,v])=>`
          <div class="rank-row">
            <div class="rank-name">${escapeHtml(nome)} <span style="color:var(--text-faint); font-weight:400;">× ${v.qtd}</span></div>
            <div class="rank-value">R$ ${fmt(v.total)}</div>
          </div>`).join('')}
    </div>

    <div style="text-align:center; margin-top:22px; display:flex; flex-direction:column; gap:10px; align-items:center;">
      <button class="link-plain" onclick="exportSalesCSV()">Exportar vendas (CSV)</button>
      <button class="link-plain" onclick="logout()">Sair da conta</button>
      <button class="link-danger" onclick="resetAllData()">Apagar todos os dados</button>
    </div>
  `;
}

function exportSalesCSV(){
  const sales = Deck53DB.getState().sales;
  if(sales.length===0){ showToast('Não há vendas para exportar.'); return; }
  const header = 'data,nome,quantidade,preco_unit,total\n';
  const rows = sales.map(s=>{
    const dataFmt = new Date(s.data).toLocaleString('pt-BR');
    const nomeEscapado = (s.nome || '').replace(/"/g, '""');
    return `"${dataFmt}","${nomeEscapado}",${s.quantidade},${s.preco_unit},${s.total}`;
  }).join('\n');
  const csv = header + rows;
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `deck53-vendas-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('CSV exportado.');
}

async function resetAllData(){
  const sales = Deck53DB.getState().sales;
  if(sales.length>0) exportSalesCSV();

  const digitado = prompt('Isso vai apagar TODOS os itens do cardápio e vendas, neste aparelho e na nuvem — sem volta.' + (sales.length>0 ? ' Um CSV das vendas foi baixado como backup.' : '') + '\n\nPara confirmar, digite APAGAR:');
  if(digitado !== 'APAGAR'){
    showToast('Operação cancelada.');
    return;
  }

  await Deck53DB.wipeRemote();
  Deck53DB.wipeAll();
  renderAll();
  updateSyncStatus();
  showToast('Dados apagados.');
}