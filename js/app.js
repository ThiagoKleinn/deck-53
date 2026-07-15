/* ═══════════════════════════════════════════════
   Deck 53 · app.js
   Estado de navegação
════════════════════════════════════════════════ */
let currentPeriod   = "hoje";
let currentTableId  = null;   // mesa aberta na comanda
let addItemSearch   = "";     // filtro de busca ao adicionar item

function fmt(n){ return (n||0).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}); }
function escapeHtml(str){ const d=document.createElement('div'); d.textContent=str; return d.innerHTML; }
function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2200);
}

/* ─── Auth ─────────────────────────────────── */
let authMode = "signin";
document.querySelectorAll('.auth-tab').forEach(tab=>{
  tab.addEventListener('click',()=>{
    authMode=tab.dataset.mode;
    document.querySelectorAll('.auth-tab').forEach(t=>t.classList.toggle('active',t===tab));
    document.getElementById('auth-submit').textContent=authMode==='signin'?'Entrar':'Criar conta';
    document.getElementById('auth-error').classList.remove('show');
  });
});
async function handleAuthSubmit(){
  const email=document.getElementById('auth-email').value.trim();
  const password=document.getElementById('auth-password').value;
  const errEl=document.getElementById('auth-error');
  errEl.classList.remove('show');
  if(!email||!password){ errEl.textContent='Preencha e-mail e senha.'; errEl.classList.add('show'); return; }
  try{
    if(authMode==='signin') await window.SupabaseAuth.signIn(email,password);
    else await window.SupabaseAuth.signUp(email,password);
    await bootApp();
  }catch(e){
    errEl.textContent=e.message||'Não foi possível conectar.';
    errEl.classList.add('show');
  }
}
function continueOffline(){
  const session=window.SupabaseAuth.getSession();
  if(!session){
    const errEl=document.getElementById('auth-error');
    errEl.textContent='Ainda não há dados salvos neste aparelho.';
    errEl.classList.add('show'); return;
  }
  bootApp();
}
function logout(){
  if(!confirm('Sair da conta neste aparelho?')) return;
  window.SupabaseAuth.signOut();
  document.getElementById('app-root').style.display='none';
  document.getElementById('login-screen').style.display='flex';
}

async function bootApp(){
  document.getElementById('login-screen').style.display='none';
  document.getElementById('app-root').style.display='flex';
  Deck53DB.init();
  renderAll();
  updateSyncStatus();
  Deck53DB.trySync(()=>{ renderAll(); updateSyncStatus(); });
  window.addEventListener('online',  updateSyncStatus);
  window.addEventListener('offline', updateSyncStatus);
  window.addEventListener('deck53:synced',()=>{ renderAll(); updateSyncStatus(); });
}

function updateSyncStatus(){
  const dot=document.getElementById('sync-dot');
  const text=document.getElementById('sync-text');
  const pending=Deck53DB.pendingCount();
  if(!Deck53DB.isOnline()){
    dot.className='sync-dot';
    text.textContent=pending>0?`Offline · ${pending} alteração(ões) pendente(s)`:'Offline · usando dados salvos no aparelho';
  } else if(pending>0){
    dot.className='sync-dot pending';
    text.textContent=`Sincronizando ${pending} alteração(ões)…`;
  } else {
    dot.className='sync-dot online';
    text.textContent='Tudo sincronizado';
  }
}

window.addEventListener('load',()=>{
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
  const session=window.SupabaseAuth.getSession();
  if(session) bootApp();
});

/* ─── Tabs ──────────────────────────────────── */
function switchTab(tab){
  document.querySelectorAll('.tab-panel').forEach(el=>el.classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(el=>el.classList.toggle('active',el.dataset.tab===tab));
  if(tab==='mesas')   renderMesasTab();
  if(tab==='painel')  renderDashboard();
}

function renderAll(){
  renderProductList();
  const activeTab=document.querySelector('.nav-btn.active')?.dataset.tab||'cardapio';
  if(activeTab==='mesas')  renderMesasTab();
  if(activeTab==='painel') renderDashboard();
}

/* ─── Cardápio ──────────────────────────────── */
function groupProductsByCategory(products){
  const groups={};
  products.forEach(p=>{ const cat=(p.categoria||'').trim()||'Sem categoria'; if(!groups[cat]) groups[cat]=[]; groups[cat].push(p); });
  return Object.keys(groups).sort((a,b)=>a.localeCompare(b,'pt-BR')).map(cat=>({cat,items:groups[cat]}));
}
function openProductModal(id){
  document.getElementById('product-id').value=id||'';
  if(id){
    const p=Deck53DB.getState().products.find(x=>x.id===id);
    document.getElementById('product-modal-title').textContent='Editar item';
    document.getElementById('p-nome').value=p.nome;
    document.getElementById('p-categoria').value=p.categoria||'';
    document.getElementById('p-venda').value=p.preco;
  } else {
    document.getElementById('product-modal-title').textContent='Novo item';
    ['p-nome','p-categoria','p-venda'].forEach(id=>document.getElementById(id).value='');
  }
  document.getElementById('product-overlay').classList.add('active');
}
function closeProductModal(){ document.getElementById('product-overlay').classList.remove('active'); }
document.getElementById('product-overlay').addEventListener('click',e=>{
  if(e.target.id==='product-overlay') closeProductModal();
});
function saveProduct(){
  const id=document.getElementById('product-id').value;
  const nome=document.getElementById('p-nome').value.trim();
  const categoria=document.getElementById('p-categoria').value.trim();
  const preco=parseFloat(document.getElementById('p-venda').value)||0;
  if(!nome){ showToast('Dá um nome pro item antes de salvar.'); return; }
  if(id) Deck53DB.updateProduct(id,{nome,categoria,preco});
  else Deck53DB.newProduct({nome,categoria,preco});
  closeProductModal(); renderAll(); updateSyncStatus(); showToast('Item salvo.');
}
function deleteProduct(id){
  if(!confirm('Remover este item do cardápio?')) return;
  Deck53DB.removeProduct(id); renderAll(); updateSyncStatus();
}
function renderProductList(){
  const el=document.getElementById('product-list');
  const products=Deck53DB.getState().products;
  if(products.length===0){
    el.innerHTML=`<div class="empty"><div class="empty-title">Nenhum item ainda</div>Adicione o primeiro item do cardápio.</div>`;
    return;
  }
  el.innerHTML=groupProductsByCategory(products).map(({cat,items})=>`
    <div class="category-group">
      <div class="category-heading">${escapeHtml(cat)}</div>
      ${items.map(p=>`
        <div class="card">
          <div class="product-row">
            <div><div class="product-name">${escapeHtml(p.nome)}</div></div>
            <div class="price-pill">R$ ${fmt(p.preco)}</div>
          </div>
          <div class="row-actions">
            <button class="btn btn-ghost btn-sm" onclick="openProductModal('${p.id}')">Editar</button>
            <button class="btn btn-danger btn-sm" onclick="deleteProduct('${p.id}')">Remover</button>
          </div>
        </div>`).join('')}
    </div>`).join('');
}

/* ═══════════════════════════════════════════════
   MESAS
════════════════════════════════════════════════ */
function renderMesasTab(){
  const el=document.getElementById('mesas-grid');
  const { tables, tableItems } = Deck53DB.getState();

  if(tables.length===0){
    el.innerHTML=`<div class="empty" style="grid-column:1/-1"><div class="empty-title">Nenhuma mesa</div>Adicione uma mesa para começar.</div>`;
    return;
  }

  el.innerHTML=tables.map(t=>{
    const items=tableItems.filter(i=>i.table_id===t.id);
    const total=items.reduce((s,i)=>s+i.total,0);
    const qtdItens=items.reduce((s,i)=>s+i.quantidade,0);
    const aberta=items.length>0;
    return `
      <div class="mesa-card ${aberta?'mesa-aberta':''}" onclick="openComanda('${t.id}')">
        <div class="mesa-header">
          <span class="mesa-nome">${escapeHtml(t.nome)}</span>
          <span class="mesa-status-dot ${aberta?'dot-aberta':'dot-livre'}"></span>
        </div>
        ${aberta
        ? `<div class="mesa-total">R$ ${fmt(total)}</div>
             <div class="mesa-info">${qtdItens} item${qtdItens===1?'':'s'} na comanda</div>`
        : `<div class="mesa-livre-label">Livre</div>`}
      </div>`;
  }).join('');
}

/* ─── Comanda (modal) ───────────────────────── */
function openComanda(tableId){
  currentTableId=tableId;
  addItemSearch='';
  renderComanda();
  document.getElementById('comanda-overlay').classList.add('active');
}
function closeComanda(){
  document.getElementById('comanda-overlay').classList.remove('active');
  currentTableId=null;
  renderMesasTab();
}
document.getElementById('comanda-overlay').addEventListener('click',e=>{
  if(e.target.id==='comanda-overlay') closeComanda();
});

function renderComanda(){
  if(!currentTableId) return;
  const table=Deck53DB.getState().tables.find(t=>t.id===currentTableId);
  if(!table) return;
  const items=Deck53DB.getTableItems(currentTableId);
  const total=items.reduce((s,i)=>s+i.total,0);

  document.getElementById('comanda-title').innerHTML=`
    <span>${escapeHtml(table.nome)}</span>
    <button class="btn-rename" onclick="promptRenameTable('${table.id}')" title="Renomear mesa">✏️</button>
  `;

  const itemsEl=document.getElementById('comanda-items');
  if(items.length===0){
    itemsEl.innerHTML=`<div class="empty" style="padding:18px 0; font-size:13px;">Nenhum item adicionado ainda.</div>`;
  } else {
    itemsEl.innerHTML=items.map(i=>`
      <div class="comanda-item">
        <div class="ci-info">
          <div class="ci-nome">${escapeHtml(i.nome)}</div>
          <div class="ci-preco">R$ ${fmt(i.preco_unit)} × ${i.quantidade} = <b>R$ ${fmt(i.total)}</b></div>
        </div>
        <div class="ci-actions">
          <button class="qty-btn-sm" onclick="changeQtyItem('${i.id}',-1)">−</button>
          <span class="ci-qty">${i.quantidade}</span>
          <button class="qty-btn-sm" onclick="changeQtyItem('${i.id}',1)">+</button>
          <button class="ci-del" onclick="removeComandaItem('${i.id}')">🗑</button>
        </div>
      </div>`).join('');
  }

  document.getElementById('comanda-total').textContent=`R$ ${fmt(total)}`;

  const hasItems=items.length>0;
  document.getElementById('btn-fechar-comanda').style.display=hasItems?'':'none';

  // Renderiza picker de produtos
  renderAddItemPicker();
}

function renderAddItemPicker(){
  const products=Deck53DB.getState().products;
  const query=addItemSearch.toLowerCase();
  const filtered=query
      ? products.filter(p=>p.nome.toLowerCase().includes(query)||p.categoria.toLowerCase().includes(query))
      : products;

  const el=document.getElementById('add-item-list');
  if(filtered.length===0){
    el.innerHTML=`<div style="color:var(--text-faint); font-size:13px; padding:8px 0;">Nenhum item encontrado.</div>`;
    return;
  }

  // Agrupa por categoria
  const groups={};
  filtered.forEach(p=>{ const cat=(p.categoria||'').trim()||'Sem categoria'; if(!groups[cat]) groups[cat]=[]; groups[cat].push(p); });
  const cats=Object.keys(groups).sort((a,b)=>a.localeCompare(b,'pt-BR'));

  el.innerHTML=cats.map(cat=>`
    <div class="picker-cat">${escapeHtml(cat)}</div>
    ${groups[cat].map(p=>`
      <div class="picker-item" onclick="addItemToComanda('${p.id}')">
        <span class="picker-nome">${escapeHtml(p.nome)}</span>
        <span class="picker-price">R$ ${fmt(p.preco)}</span>
      </div>`).join('')}
  `).join('');
}

function addItemToComanda(productId){
  if(!currentTableId) return;
  const product=Deck53DB.getState().products.find(p=>p.id===productId);
  if(!product) return;
  Deck53DB.addItemToTable(currentTableId, product, 1);
  renderComanda();
  renderMesasTab();
  updateSyncStatus();
  showToast(`${product.nome} adicionado.`);
}

function changeQtyItem(itemId, delta){
  Deck53DB.changeItemQty(itemId, delta);
  renderComanda();
  renderMesasTab();
  updateSyncStatus();
}

function removeComandaItem(itemId){
  Deck53DB.removeItemFromTable(itemId);
  renderComanda();
  renderMesasTab();
  updateSyncStatus();
}

function promptRenameTable(tableId){
  const table=Deck53DB.getState().tables.find(t=>t.id===tableId);
  if(!table) return;
  const novoNome=prompt('Novo nome da mesa:', table.nome);
  if(!novoNome||!novoNome.trim()) return;
  Deck53DB.renameTable(tableId, novoNome.trim());
  renderComanda();
  renderMesasTab();
  updateSyncStatus();
  showToast('Mesa renomeada.');
}

/* ─── Fechar comanda ────────────────────────── */
function openPaymentModal(){
  document.getElementById('payment-overlay').classList.add('active');
  const total=Deck53DB.getTableTotal(currentTableId);
  document.getElementById('payment-total').textContent=`R$ ${fmt(total)}`;
  // Reset seleção
  document.querySelectorAll('.pay-btn').forEach(b=>b.classList.remove('active'));
}
function closePaymentModal(){
  document.getElementById('payment-overlay').classList.remove('active');
}
document.getElementById('payment-overlay').addEventListener('click',e=>{
  if(e.target.id==='payment-overlay') closePaymentModal();
});

let selectedPayment=null;
function selectPayment(method){
  selectedPayment=method;
  document.querySelectorAll('.pay-btn').forEach(b=>b.classList.toggle('active',b.dataset.method===method));
}

function confirmCloseComanda(){
  if(!selectedPayment){ showToast('Selecione a forma de pagamento.'); return; }
  const total=Deck53DB.closeTable(currentTableId, selectedPayment);
  closePaymentModal();
  closeComanda();
  renderAll();
  updateSyncStatus();
  showToast(`Comanda fechada · R$ ${fmt(total)}`);
  selectedPayment=null;
}

/* ─── Gerenciar mesas ───────────────────────── */
function addNewTable(){
  Deck53DB.newTable();
  renderMesasTab();
  updateSyncStatus();
  showToast('Mesa adicionada.');
}
function openManageTablesModal(){
  renderManageTablesList();
  document.getElementById('manage-tables-overlay').classList.add('active');
}
function closeManageTablesModal(){
  document.getElementById('manage-tables-overlay').classList.remove('active');
}
document.getElementById('manage-tables-overlay').addEventListener('click',e=>{
  if(e.target.id==='manage-tables-overlay') closeManageTablesModal();
});
function renderManageTablesList(){
  const el=document.getElementById('manage-tables-list');
  const tables=Deck53DB.getState().tables;
  if(tables.length===0){ el.innerHTML=`<div class="empty" style="padding:10px 0">Nenhuma mesa cadastrada.</div>`; return; }
  el.innerHTML=tables.map(t=>`
    <div class="manage-table-row">
      <span class="manage-table-nome">${escapeHtml(t.nome)}</span>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-ghost btn-sm" onclick="manageRename('${t.id}')">Renomear</button>
        <button class="btn btn-danger btn-sm" onclick="manageDelete('${t.id}')">Remover</button>
      </div>
    </div>`).join('');
}
function manageRename(id){
  const table=Deck53DB.getState().tables.find(t=>t.id===id);
  const novoNome=prompt('Novo nome:', table.nome);
  if(!novoNome||!novoNome.trim()) return;
  Deck53DB.renameTable(id, novoNome.trim());
  renderManageTablesList(); renderMesasTab(); updateSyncStatus(); showToast('Mesa renomeada.');
}
function manageDelete(id){
  const items=Deck53DB.getTableItems(id);
  if(items.length>0 && !confirm('Esta mesa tem itens na comanda. Remover mesmo assim?')) return;
  Deck53DB.removeTable(id);
  renderManageTablesList(); renderMesasTab(); updateSyncStatus(); showToast('Mesa removida.');
}

/* ═══════════════════════════════════════════════
   PAINEL
════════════════════════════════════════════════ */
document.getElementById('period-tabs').addEventListener('click',e=>{
  const btn=e.target.closest('.period-tab'); if(!btn) return;
  currentPeriod=btn.dataset.period;
  document.querySelectorAll('#period-tabs .period-tab').forEach(t=>t.classList.toggle('active',t===btn));
  renderDashboard();
});

function salesForPeriod(period){
  const now=new Date();
  return Deck53DB.getState().sales.filter(s=>{
    const d=new Date(s.data);
    if(period==='hoje') return d.toDateString()===now.toDateString();
    if(period==='semana') return (now-d)/(1000*60*60*24)<=7;
    if(period==='mes') return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
    return true;
  });
}

function renderDashboard(){
  const el=document.getElementById('dashboard-content');
  // Exclui vendas-resumo de fechamento do ranking (evita dupla contagem)
  const allSales=salesForPeriod(currentPeriod);
  const itemSales=allSales.filter(s=>!s.nome.startsWith('[Fechamento]'));
  const receita=itemSales.reduce((a,s)=>a+s.total,0);
  const totalItens=itemSales.reduce((a,s)=>a+s.quantidade,0);

  // Ranking por item
  const ranking={};
  itemSales.forEach(s=>{
    if(!ranking[s.nome]) ranking[s.nome]={qtd:0,total:0};
    ranking[s.nome].qtd+=s.quantidade;
    ranking[s.nome].total+=s.total;
  });
  const top=Object.entries(ranking).sort((a,b)=>b[1].total-a[1].total).slice(0,5);

  // Formas de pagamento
  const payments={};
  allSales.filter(s=>s.nome.startsWith('[Fechamento]')).forEach(s=>{
    const m=s.payment_method||'Não informado';
    payments[m]=(payments[m]||0)+s.total;
  });
  const payEntries=Object.entries(payments).sort((a,b)=>b[1]-a[1]);

  el.innerHTML=`
    <div class="stat-grid">
      <div class="stat-card full">
        <div class="stat-label">FATURAMENTO</div>
        <div class="stat-value lime">R$ ${fmt(receita)}</div>
        <div class="stat-sub">${itemSales.length} venda${itemSales.length===1?'':'s'} · ${totalItens} item${totalItens===1?'':'s'} no período</div>
      </div>
    </div>

    ${payEntries.length>0?`
    <div class="card" style="margin-bottom:10px;">
      <div class="section-title" style="font-size:16px; margin-bottom:8px;">Formas de pagamento</div>
      ${payEntries.map(([m,v])=>`
        <div class="rank-row">
          <div class="rank-name">${escapeHtml(payLabel(m))}</div>
          <div class="rank-value">R$ ${fmt(v)}</div>
        </div>`).join('')}
    </div>`:''}

    <div class="plank-divider"></div>
    <div class="card">
      <div class="section-title" style="font-size:16px; margin-bottom:8px;">Top itens (por faturamento)</div>
      ${top.length===0?'<div class="empty" style="padding:10px 0;">Sem vendas neste período.</div>':
      top.map(([nome,v])=>`
          <div class="rank-row">
            <div class="rank-name">${escapeHtml(nome)} <span style="color:var(--text-faint);font-weight:400;">× ${v.qtd}</span></div>
            <div class="rank-value">R$ ${fmt(v.total)}</div>
          </div>`).join('')}
    </div>

    <div style="text-align:center;margin-top:22px;display:flex;flex-direction:column;gap:10px;align-items:center;">
      <button class="link-plain" onclick="exportSalesCSV()">Exportar vendas (CSV)</button>
      <button class="link-plain" onclick="logout()">Sair da conta</button>
      <button class="link-danger" onclick="resetAllData()">Apagar todos os dados</button>
    </div>`;
}

function payLabel(method){
  const labels={ dinheiro:'Dinheiro', credito:'Cartão de crédito', debito:'Cartão de débito', pix:'Pix' };
  return labels[method]||method;
}

function exportSalesCSV(){
  const sales=Deck53DB.getState().sales.filter(s=>!s.nome.startsWith('[Fechamento]'));
  if(sales.length===0){ showToast('Não há vendas para exportar.'); return; }
  const header='data,mesa,nome,quantidade,preco_unit,total,pagamento\n';
  const rows=sales.map(s=>{
    const d=new Date(s.data).toLocaleString('pt-BR');
    const n=(s.nome||'').replace(/"/g,'""');
    const m=(s.mesa||'').replace(/"/g,'""');
    return `"${d}","${m}","${n}",${s.quantidade},${s.preco_unit},${s.total},"${s.payment_method||''}"`;
  }).join('\n');
  const blob=new Blob([header+rows],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=`deck53-vendas-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url); showToast('CSV exportado.');
}

async function resetAllData(){
  const sales=Deck53DB.getState().sales.filter(s=>!s.nome.startsWith('[Fechamento]'));
  if(sales.length>0) exportSalesCSV();
  const digitado=prompt('Isso vai apagar TODOS os dados.'+(sales.length>0?' Um CSV foi baixado como backup.':'')+'\n\nPara confirmar, digite APAGAR:');
  if(digitado!=='APAGAR'){ showToast('Operação cancelada.'); return; }
  await Deck53DB.wipeRemote(); Deck53DB.wipeAll();
  renderAll(); updateSyncStatus(); showToast('Dados apagados.');
}