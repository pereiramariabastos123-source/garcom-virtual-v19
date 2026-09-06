
const STORAGE_PRODUCTS="gv11_products";
const STORAGE_TABLES="gv11_tables";

function storageGet(key){
  try{return localStorage.getItem(key)}catch(e){return null}
}
function storageSet(key,value){
  try{localStorage.setItem(key,value);return true}catch(e){return false}
}
let products=[...DEFAULT_PRODUCTS];
let mesas=JSON.parse(storageGet(STORAGE_TABLES)||"null")||[1,2,3,4,5,6];
let activeMesa=1;
let publicBaseUrl="";
let adminPassword=sessionStorage.getItem("gv19_admin_password")||"";
let conversation={
  lastProduct:null,
  lastRecommendation:null,
  awaitingPhoto:false,
  awaitingDrink:false
};
let cart=[];
const ORDER_KEY="gv14_orders";
let lastConfirmedOrder=null;

function adminHeaders(extra={}){
  return {"x-admin-password":adminPassword,...extra};
}
async function apiLoadMenu(){
  const r=await fetch("/api/menu",{cache:"no-store"});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.error||"Falha ao carregar cardápio");
  return Array.isArray(data.products)?data.products:[];
}
async function apiSaveMenu(){
  const r=await fetch("/api/menu",{
    method:"PUT",
    headers:adminHeaders({"Content-Type":"application/json"}),
    body:JSON.stringify({products})
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.error||"Falha ao salvar cardápio");
  return data.products;
}
async function loadSharedMenu(){
  try{
    const remote=await apiLoadMenu();
    if(remote.length)products=remote;
    storageSet(STORAGE_PRODUCTS,JSON.stringify(products));
  }catch{
    products=JSON.parse(storageGet(STORAGE_PRODUCTS)||"null")||[...DEFAULT_PRODUCTS];
  }
}
async function loadPublicConfig(){
  try{
    const r=await fetch("/api/config",{cache:"no-store"});
    const data=await r.json();
    publicBaseUrl=String(data.publicBaseUrl||"").trim();
  }catch{}
}
async function ensureAdminAccess(){
  for(let tries=0;tries<3;tries++){
    const r=await fetch("/api/admin/check",{headers:adminHeaders(),cache:"no-store"});
    if(r.ok)return true;
    if(r.status!==401)return false;
    const pwd=prompt("Senha do painel administrativo:");
    if(pwd===null)return false;
    adminPassword=pwd;
    sessionStorage.setItem("gv19_admin_password",pwd);
  }
  alert("Senha do painel incorreta.");
  return false;
}

function orderLoad(){try{return JSON.parse(localStorage.getItem(ORDER_KEY)||"[]")}catch{return []}}
function orderSave(v){try{localStorage.setItem(ORDER_KEY,JSON.stringify(v))}catch{}}
async function apiCreateOrder(order){
  const r=await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(order)});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.error||"Falha ao registrar pedido");
  return data.order;
}
async function apiListOrders(){
  const r=await fetch("/api/orders",{headers:adminHeaders(),cache:"no-store"});
  const data=await r.json().catch(()=>({orders:[]}));
  if(!r.ok)throw new Error(data.error||"Falha ao carregar pedidos");
  return Array.isArray(data.orders)?data.orders:[];
}
async function apiUpdateOrderStatus(id,status){
  const r=await fetch(`/api/orders/${id}/status`,{method:"PATCH",headers:adminHeaders({"Content-Type":"application/json"}),body:JSON.stringify({status})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.error||"Falha ao atualizar status");
  return data.order;
}

let clientOrderWatchTimer=null;
async function apiGetOrder(id){
  const r=await fetch(`/api/orders/${id}`);
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.error||"Falha ao carregar pedido");
  return data.order;
}
function clientStatusMessage(status){
  return status==="novo"?"Pedido recebido pelo restaurante.":
         status==="preparo"?"Seu pedido está em preparo.":
         status==="pronto"?"Seu pedido está pronto!":
         status==="finalizado"?"Pedido finalizado.":"Pedido atualizado.";
}
function startClientOrderStatusWatch(id){
  if(clientOrderWatchTimer)clearInterval(clientOrderWatchTimer);
  const update=async()=>{
    try{
      const order=await apiGetOrder(id);
      const box=document.getElementById(`clientOrderStatus-${id}`);
      if(!box)return;
      box.innerHTML=`${statusStepsHTML(order.status)}<div class="confirmedstatus">${clientStatusMessage(order.status)}</div>`;
      if(order.status==="finalizado" && clientOrderWatchTimer){
        clearInterval(clientOrderWatchTimer);
        clientOrderWatchTimer=null;
      }
    }catch{}
  };
  update();
  clientOrderWatchTimer=setInterval(update,4000);
}

function cartTotal(){return cart.reduce((s,x)=>s+(x.price*x.qty),0)}
function cartAddByName(name,qty=1){
  const p=findProductByName(name);
  if(!p||p.status!=="disponivel")return false;
  const x=cart.find(i=>i.id===p.id);
  if(x)x.qty+=Math.max(1,Number(qty)||1);
  else cart.push({id:p.id,name:p.name,price:p.price,qty:Math.max(1,Number(qty)||1)});
  updateCartBadge();
  return true;
}
function cartCount(){return cart.reduce((s,x)=>s+x.qty,0)}
function updateCartBadge(){
  const n=cartCount();
  const total=cartTotal();
  const badge=document.getElementById("cartBadge");
  const totalEl=document.getElementById("cartTotalTop");
  if(badge)badge.textContent=n;
  if(totalEl)totalEl.textContent=money(total);
}
function cartHTML(){
  if(!cart.length)return `<div class="emptycart">Seu pedido ainda está vazio.</div>`;
  return `<div class="cartitems">${cart.map(x=>`
    <div class="cartitem">
      <div class="cartitem-main">
        <b>${x.name}</b>
        <span>${money(x.price)}</span>
      </div>
      <div class="qtyrow">
        <button onclick="changeQty(${x.id},-1)">−</button>
        <span>${x.qty}</span>
        <button onclick="changeQty(${x.id},1)">+</button>
        <button class="trashbtn" onclick="removeFromCart(${x.id})">🗑️</button>
      </div>
    </div>`).join("")}</div>
    <div class="cartsummary"><span>Total</span><b>${money(cartTotal())}</b></div>
    <button class="confirmbtn" onclick="confirmOrder()">✓ Confirmar pedido</button>
    <button class="clearbtn" onclick="clearCart()">🗑 Limpar pedido</button>`;
}
function renderCartPanel(){
  updateCartBadge();
  const body=document.getElementById("cartPanelBody");
  if(body)body.innerHTML=cartHTML();
}
function openCart(){
  renderCartPanel();
  const p=document.getElementById("cartPanel");
  const o=document.getElementById("cartOverlay");
  if(p)p.classList.add("open");
  if(o)o.classList.add("open");
}
function closeCart(){
  document.getElementById("cartPanel")?.classList.remove("open");
  document.getElementById("cartOverlay")?.classList.remove("open");
}
function changeQty(id,delta){
  const x=cart.find(i=>i.id===id);
  if(!x)return;
  x.qty+=delta;
  if(x.qty<=0)cart=cart.filter(i=>i.id!==id);
  renderCartPanel();
}
function removeFromCart(id){
  cart=cart.filter(i=>i.id!==id);
  renderCartPanel();
}
function showCart(msg=""){
  if(msg)addBot(msg);
  openCart();
}
function clearCart(){
  cart=[];
  renderCartPanel();
  addBot("Pedido limpo.");
}
async function confirmOrder(){
  if(!cart.length){addBot("Seu pedido está vazio.");openCart();return}
  const draft={mesa:String(activeMesa).padStart(2,"0"),items:cart.map(x=>({...x})),total:cartTotal()};
  try{
    const order=await apiCreateOrder(draft);
    lastConfirmedOrder=order;
    cart=[];
    renderCartPanel();
    closeCart();
    showConfirmedOrder(order);
  }catch(err){
    console.warn(err);
    addBot("Não consegui enviar o pedido agora. Tente novamente.");
  }
}
function statusStepsHTML(status){
  const order=["novo","preparo","pronto","finalizado"];
  const labels={novo:"Recebido",preparo:"Em preparo",pronto:"Pronto",finalizado:"Finalizado"};
  const current=Math.max(0,order.indexOf(status));
  return `<div class="client-status-steps">${order.slice(0,3).map((s,i)=>`
    <div class="client-step ${i<=current?"active":""}">
      <span>${i<current?"✓":i+1}</span><small>${labels[s]}</small>
    </div>`).join("")}</div>`;
}
function showConfirmedOrder(order){
  const code=String(order.id).slice(-4);
  const html=`<div class="confirmedbox">
    <div class="confirmedcheck">✓</div>
    <b>Pedido confirmado!</b>
    <div>Mesa ${order.mesa} • Pedido #${code}</div>
    <div class="confirmeditems">${order.items.map(x=>`${x.qty}x ${x.name}`).join("<br>")}</div>
    <div class="confirmedtotal">Total: <b>${money(order.total)}</b></div>
    <div id="clientOrderStatus-${order.id}" class="client-order-status">
      ${statusStepsHTML(order.status||"novo")}
      <div class="confirmedstatus">Pedido recebido pelo restaurante.</div>
    </div>
  </div>`;
  addBot(html);
  startClientOrderStatusWatch(order.id);
}

let aiHistory=[];
let aiBusy=false;

function escapeHTML(s){
  return String(s||"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]));
}
function menuForAI(){
  return products.map(p=>({
    id:p.id,
    name:p.name,
    category:p.category,
    price:p.price,
    description:p.description||"",
    ingredients:p.ingredients||"",
    status:p.status
  }));
}
function findProductByName(name){
  const n=normalize(name||"");
  return products.find(p=>normalize(p.name)===n) || products.find(p=>n && (normalize(p.name).includes(n)||n.includes(normalize(p.name))));
}
async function askAI(text){
  const r=await fetch("/api/chat",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      message:text,
      history:aiHistory.slice(-10),
      menu:menuForAI(),
      cart:cart.map(x=>({name:x.name,qty:x.qty,price:x.price}))
    })
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.error||"Falha ao falar com a IA");
  return data;
}
async function respond(text){
  if(aiBusy)return;
  aiBusy=true;
  const input=document.getElementById("chatInput");
  if(input)input.disabled=true;
  try{
    const data=await askAI(text);
    const reply=String(data.reply||"Ok.").trim();
    aiHistory.push({role:"user",content:text});
    aiHistory.push({role:"assistant",content:reply});
    if(Array.isArray(data.add_items)){
      data.add_items.forEach(x=>cartAddByName(x.name,x.qty));
    }
    let html=escapeHTML(reply);
    if(data.show_cart)setTimeout(openCart,50);
    if(data.show_product){
      const p=findProductByName(data.show_product);
      if(p && p.status!=="oculto")html+=pcard(p);
    }
    addBot(html);
  }catch(err){
    console.warn("IA indisponível; usando modo local.",err);
    respondLocal(text);
  }finally{
    aiBusy=false;
    if(input){input.disabled=false;input.focus()}
  }
}

async function saveProducts(){
  storageSet(STORAGE_PRODUCTS,JSON.stringify(products));
  try{await apiSaveMenu()}
  catch(err){console.warn(err);alert("Não consegui salvar o cardápio no servidor.")}
}
function saveMesas(){storageSet(STORAGE_TABLES,JSON.stringify(mesas))}
function money(v){return Number(v).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
function statusMeta(s){
  if(s==="esgotado") return {label:"🟡 Esgotado hoje",cls:"status-esgotado",next:"oculto"};
  if(s==="oculto") return {label:"🔴 Oculto",cls:"status-oculto",next:"disponivel"};
  return {label:"🟢 Disponível",cls:"status-disponivel",next:"esgotado"};
}

function page(id){
  document.querySelectorAll(".page").forEach(x=>x.classList.toggle("active",x.id===id));
  document.querySelectorAll("nav button").forEach(x=>x.classList.toggle("active",x.dataset.page===id));
  const titles={inicio:"Visão geral",cardapio:"Cardápio",categorias:"Categorias",promocoes:"Promoções",mesas:"Mesas",configuracoes:"Configurações"};
  document.getElementById("pageTitle").textContent=titles[id]||"Painel";
}

function renderStats(){
  document.getElementById("prodCount").textContent=products.length;
  document.getElementById("availableCount").textContent=products.filter(p=>p.status==="disponivel").length;
  document.getElementById("soldOutCount").textContent=products.filter(p=>p.status==="esgotado").length;
  document.getElementById("hiddenCount").textContent=products.filter(p=>p.status==="oculto").length;
}

function renderProducts(){
  const box=document.getElementById("productsList");
  box.innerHTML=products.map(p=>{
    const sm=statusMeta(p.status);
    return `<div class="admin-row">
      ${p.image?`<img src="${p.image}" alt="${p.name}">`:`<div style="width:72px;height:58px;display:grid;place-items:center;background:#eef1ef;border-radius:10px">📷</div>`}
      <div class="admin-main"><strong>${p.name}</strong><small>${p.description||""}</small></div>
      <div class="admin-category">${p.category}</div>
      <div class="admin-price">${money(p.price)}</div>
      <div class="admin-actions">
        <button class="status-btn ${sm.cls}" data-status="${p.id}">${sm.label}</button>
        <button class="icon-btn" data-edit="${p.id}" title="Editar">✏️</button>
        <button class="icon-btn danger" data-delete="${p.id}" title="Excluir">🗑️</button>
      </div>
    </div>`;
  }).join("");
}

function renderCategories(){
  const cats={}; products.forEach(p=>cats[p.category]=(cats[p.category]||0)+1);
  document.getElementById("categoriesGrid").innerHTML=Object.entries(cats).map(([c,n])=>`<div class="card"><h3>${c}</h3><p>${n} produto${n===1?"":"s"}</p></div>`).join("");
}

function customerUrl(n){
  const base=publicBaseUrl || window.location.href;
  const u=new URL(base,window.location.href);
  u.search="";
  u.searchParams.set("modo","cliente");
  u.searchParams.set("mesa",String(n).padStart(2,"0"));
  return u.href;
}

function renderMesas(){
  document.getElementById("mesasGrid").innerHTML=mesas.map(n=>`<div class="card mesaCard"><span>🪑</span><div><small>MESA</small><div class="num">${String(n).padStart(2,"0")}</div></div><button class="primary" data-qr="${n}">▦ QR Code</button></div>`).join("");
}


function setPhotoPreview(src){
  const img=document.getElementById("photoPreview");
  const ph=document.getElementById("photoPlaceholder");
  if(src){
    img.src=src; img.style.display="block"; ph.style.display="none";
  }else{
    img.removeAttribute("src"); img.style.display="none"; ph.style.display="grid";
  }
}
function imageFileToDataURL(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=reject;
    reader.readAsDataURL(file);
  });
}

function openProductModal(p=null){
  const form=document.getElementById("productForm");
  form.reset();
  document.getElementById("productModalTitle").textContent=p?"Editar produto":"Novo produto";
  form.elements.id.value=p?p.id:"";
  form.elements.name.value=p?p.name:"";
  form.elements.category.value=p?p.category:"Pratos";
  form.elements.price.value=p?String(p.price).replace(".",","):"";
  form.elements.description.value=p?p.description||"":"";
  form.elements.ingredients.value=p?p.ingredients||"":"";
  form.elements.image.value=p?p.image||"":"";
  setPhotoPreview(form.elements.image.value);
  document.getElementById("photoFile").value="";
  form.elements.status.value=p?p.status:"disponivel";
  document.getElementById("productModal").classList.add("open");
}
function closeProductModal(){document.getElementById("productModal").classList.remove("open")}

function openQr(n){
  activeMesa=n;
  document.getElementById("qrTitle").textContent="Mesa "+String(n).padStart(2,"0");
  const u=customerUrl(n);
  document.getElementById("mlink").textContent=u;
  const box=document.getElementById("qrcode"); box.innerHTML="";
  if(window.QRCode)new QRCode(box,{text:u,width:220,height:220});
  else box.innerHTML="<b>QR precisa de internet neste teste</b>";
  document.getElementById("qrModal").classList.add("open");
}
function closeQr(){document.getElementById("qrModal").classList.remove("open")}

function refreshAdmin(){renderStats();renderProducts();renderCategories();renderMesas()}

document.addEventListener("click",e=>{
  const nav=e.target.closest("[data-page]"); if(nav){page(nav.dataset.page);return}
  const status=e.target.closest("[data-status]"); if(status){
    const p=products.find(x=>x.id===Number(status.dataset.status)); if(p){p.status=statusMeta(p.status).next;saveProducts();refreshAdmin()} return
  }
  const edit=e.target.closest("[data-edit]"); if(edit){const p=products.find(x=>x.id===Number(edit.dataset.edit));if(p)openProductModal(p);return}
  const del=e.target.closest("[data-delete]"); if(del){
    const id=Number(del.dataset.delete), p=products.find(x=>x.id===id);
    if(p && confirm(`Excluir "${p.name}"?`)){products=products.filter(x=>x.id!==id);saveProducts();refreshAdmin()} return
  }
  const qr=e.target.closest("[data-qr]"); if(qr){openQr(Number(qr.dataset.qr));return}
});

document.getElementById("addProductBtn").addEventListener("click",()=>openProductModal());
document.getElementById("closeProductModal").addEventListener("click",closeProductModal);
document.getElementById("cancelProduct").addEventListener("click",closeProductModal);

document.getElementById("choosePhotoBtn").addEventListener("click",()=>document.getElementById("photoFile").click());
document.getElementById("photoFile").addEventListener("change",async e=>{
  const file=e.target.files && e.target.files[0];
  if(!file)return;
  if(!file.type.startsWith("image/")){alert("Escolha um arquivo de imagem.");return}
  if(file.size>4*1024*1024){alert("Escolha uma imagem com até 4 MB para este protótipo.");e.target.value="";return}
  try{
    const data=await imageFileToDataURL(file);
    document.getElementById("productForm").elements.image.value=data;
    setPhotoPreview(data);
  }catch(err){alert("Não foi possível carregar essa imagem.")}
});
document.getElementById("removePhotoBtn").addEventListener("click",()=>{
  const f=document.getElementById("productForm");
  f.elements.image.value="";
  document.getElementById("photoFile").value="";
  setPhotoPreview("");
});

document.getElementById("productForm").addEventListener("submit",e=>{
  e.preventDefault(); const f=e.currentTarget;
  const id=Number(f.elements.id.value)||Date.now();
  const raw=String(f.elements.price.value).replace(/\./g,"").replace(",",".");
  const price=Number(raw);
  if(!Number.isFinite(price)){alert("Digite um preço válido.");return}
  const data={id,name:f.elements.name.value.trim(),category:f.elements.category.value,price,description:f.elements.description.value.trim(),ingredients:f.elements.ingredients.value.trim(),image:f.elements.image.value.trim(),status:f.elements.status.value};
  const i=products.findIndex(x=>x.id===id);
  if(i>=0)products[i]=data; else products.unshift(data);
  saveProducts();closeProductModal();refreshAdmin();
});
document.getElementById("addMesa").addEventListener("click",()=>{const n=Math.max(0,...mesas)+1;mesas.push(n);saveMesas();renderMesas()});
document.getElementById("closeQr").addEventListener("click",closeQr);
document.getElementById("testarCliente").addEventListener("click",()=>window.open(customerUrl(activeMesa),"_blank"));

/* Cliente */
function normalize(s){return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim()}
function available(){return products.filter(p=>p.status==="disponivel")}
function addUser(t){const d=document.createElement("div");d.className="msg user";d.textContent=t;document.getElementById("chatThread").appendChild(d);d.scrollIntoView({block:"nearest"})}
function addBot(h){const d=document.createElement("div");d.className="msg bot";d.innerHTML=h;document.getElementById("chatThread").appendChild(d);d.scrollIntoView({block:"nearest"})}
function pcard(p){return `<div class="product-card">${p.image?`<img src="${p.image}" alt="${p.name}">`:""}<div class="product-info"><h3>${p.name}</h3><div class="price">${money(p.price)}</div><div class="desc">${p.description||""}</div></div></div>`}
function findProduct(q){
  const nq=normalize(q); let best=null,score=0;
  for(const p of products){
    const terms=[p.name,...String(p.ingredients||"").split(",")].map(normalize).filter(Boolean); let s=0;
    terms.forEach(t=>{if(nq.includes(t))s=Math.max(s,t.length+5);else s+=t.split(" ").filter(w=>w.length>3&&nq.includes(w)).length*2});
    if(s>score){score=s;best=p}
  }
  return score>=3?best:null
}
function listCategory(cat){
  const list=available().filter(p=>p.category===cat);
  return `<b>${cat} disponíveis:</b><div class="options">${list.map(p=>`<div class="option"><b>${p.name} — ${money(p.price)}</b><span>${p.description||""}</span></div>`).join("")}</div>`;
}
function extractBudget(q){const m=q.match(/(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)/);return m?Number(m[1].replace(",",".")):null}
function recommendBudget(v){
  const list=available().filter(p=>p.price<=v), meals=list.filter(p=>p.category!=="Bebidas"), drinks=list.filter(p=>p.category==="Bebidas"); let combos=[];
  for(const m of meals)for(const d of drinks){const total=m.price+d.price;if(total<=v)combos.push({m,d,total})}
  combos.sort((a,b)=>b.total-a.total);
  if(combos.length){const c=combos[0];return `Uma combinação dentro do seu orçamento é <b>${c.m.name}</b> + <b>${c.d.name}</b>. Total: <b>${money(c.total)}</b>.`}
  if(list.length){const p=list.sort((a,b)=>b.price-a.price)[0];return `Uma opção é <b>${p.name}</b> por <b>${money(p.price)}</b>.`}
  return `Não encontrei opções disponíveis até <b>${money(v)}</b>.`;
}
function drinkOptions(){
  const drinks=available().filter(p=>p.category==="Bebidas").sort((a,b)=>a.price-b.price);
  if(!drinks.length)return "No momento não tenho bebidas disponíveis.";
  return `<b>Claro! 🥤 Temos:</b><div class="options">${drinks.map(p=>`<div class="option"><b>${p.name} — ${money(p.price)}</b></div>`).join("")}</div>Qual você prefere?`;
}
function alternativeTo(last){
  const choices=available().filter(p=>p.category!=="Bebidas" && (!last || p.id!==last.id)).sort((a,b)=>a.price-b.price);
  return choices[0]||null;
}
function naturalRecommendation(){
  const meals=available().filter(p=>p.category==="Pratos");
  const p=meals[0]||available().find(p=>p.category!=="Bebidas");
  if(!p)return "No momento não encontrei uma opção disponível para recomendar.";
  conversation.lastProduct=p; conversation.lastRecommendation=p; conversation.awaitingPhoto=true;
  return `Uma boa pedida é o <b>${p.name}</b> por <b>${money(p.price)}</b>. 😋 ${p.description||""}<br><br>Quer que eu mostre a foto?`;
}
function respondLocal(text){
  const q=normalize(text);

  if(/quem descobriu|futebol|politica|presidente|capital do/.test(q)){
    addBot("Posso ajudar com o cardápio, pratos, bebidas, preços, fotos e sugestões do Sabor da Casa. 😊");return
  }

  // Respostas curtas que dependem da conversa anterior.
  if(/^(sim|pode|quero|claro|mostra|mostrar|manda|pode ser)$/.test(q) && conversation.awaitingPhoto && conversation.lastProduct){
    const p=conversation.lastProduct;
    conversation.awaitingPhoto=false;
    addBot(`Claro! Aqui está o <b>${p.name}</b>.${pcard(p)}<br>Se quiser, também posso sugerir uma bebida para acompanhar.`);return
  }
  if(/^(sim|pode|quero|claro|pode ser)$/.test(q) && conversation.awaitingDrink){
    conversation.awaitingDrink=false; addBot(drinkOptions()); return
  }
  if(/nao gostei|outra coisa|outra opcao|tem outro|tem outra|prefiro outro/.test(q)){
    const p=alternativeTo(conversation.lastProduct);
    if(p){
      conversation.lastProduct=p;conversation.lastRecommendation=p;conversation.awaitingPhoto=true;
      addBot(`Sem problema 😊 Outra opção é o <b>${p.name}</b> por <b>${money(p.price)}</b>. ${p.description||""}<br><br>Quer ver a foto?`);
    }else addBot("No momento não encontrei outra opção disponível.");
    return
  }

  if(/ver pratos|quais pratos|mostrar pratos/.test(q)){addBot(listCategory("Pratos"));return}
  if(/ver lanches|quais lanches|mostrar lanches/.test(q)){addBot(listCategory("Lanches"));return}
  if(/ver bebidas|quais bebidas|mostrar bebidas/.test(q)){addBot(listCategory("Bebidas"));return}

  const budget=extractBudget(q);
  if(budget!==null && /(tenho|ate|orcamento|reais|r\$|gastar)/.test(q)){
    addBot(recommendBudget(budget));return
  }

  if(/muita fome|bastante fome|estou com fome|to com fome/.test(q)){
    const meals=available().filter(p=>p.category==="Pratos").sort((a,b)=>b.price-a.price);
    const p=budget!==null ? meals.filter(x=>x.price<=budget)[0] : meals[0];
    if(p){
      conversation.lastProduct=p;conversation.lastRecommendation=p;conversation.awaitingPhoto=true;
      const drink=available().filter(x=>x.category==="Bebidas" && (!budget || x.price+p.price<=budget)).sort((a,b)=>a.price-b.price)[0];
      let extra=drink?` Se quiser, pode acompanhar com <b>${drink.name}</b> por ${money(drink.price)}.`:"";
      addBot(`Para quem está com bastante fome, eu sugiro o <b>${p.name}</b> por <b>${money(p.price)}</b>. ${p.description||""}${extra}<br><br>Quer ver a foto?`);return
    }
  }

  if(/recomenda|recomendacao|sugestao|sugere|nao sei o que/.test(q)){addBot(naturalRecommendation());return}

  const p=findProduct(q);
  if(p){
    conversation.lastProduct=p;
    if(p.status==="oculto"){addBot("Esse item não faz parte das opções disponíveis no momento. Posso mostrar outras opções.");return}
    if(p.status==="esgotado"){
      const alt=alternativeTo(p);
      addBot(`Hoje o <b>${p.name}</b> está esgotado.${alt?` Posso sugerir o <b>${alt.name}</b> por <b>${money(alt.price)}</b>.`:" Posso procurar outra opção."}`);return
    }
    if(/foto|mostra|mostrar|como e|ver/.test(q)){conversation.awaitingPhoto=false;addBot(`Claro! Este é o <b>${p.name}</b>, por <b>${money(p.price)}</b>.${pcard(p)}`);return}
    if(/preco|quanto custa|valor/.test(q)){addBot(`<b>${p.name}</b> custa <b>${money(p.price)}</b>.`);return}
    if(p.category!=="Bebidas"){
      conversation.awaitingDrink=true;
      addBot(`<b>${p.name}</b> está disponível por <b>${money(p.price)}</b>. ${p.description||""}<br><br>Quer acrescentar uma bebida? 🥤`);return
    }
    addBot(`<b>${p.name}</b> está disponível por <b>${money(p.price)}</b>. ${p.description||""}`);return
  }

  if(/bebida|beber|acompanhar/.test(q)){addBot(drinkOptions());return}

  addBot('Posso ajudar você a escolher 😊 Diga, por exemplo: <b>“estou com bastante fome”</b>, <b>“tenho R$ 40”</b>, <b>“quero algo com frango”</b> ou <b>“me recomenda um prato”</b>.');
}
function handleSend(){const i=document.getElementById("chatInput"),t=i.value.trim();if(!t||aiBusy)return;addUser(t);i.value="";respond(t)}

function visibleProducts(category){
  return products.filter(p=>p.category===category && p.status!=="oculto");
}
function productVisualCard(p){
  const disabled=p.status!=="disponivel";
  const badge=p.status==="esgotado"?"Esgotado":"Disponível";
  const badgeClass=p.status==="esgotado"?"soldout":"available";
  return `<article class="menuvisual-card">
    <div class="menuvisual-imgwrap">
      <img src="${p.image||""}" alt="${p.name}" class="menuvisual-img" onerror="this.parentElement.classList.add('no-photo');this.remove()">
      <span class="statusbadge ${badgeClass}">${badge}</span>
    </div>
    <div class="menuvisual-body">
      <div class="menuvisual-titleline"><h3>${p.name}</h3><b>${money(p.price)}</b></div>
      <p>${p.description||""}</p>
      <button ${disabled?"disabled":""} onclick="quickAddProduct(${p.id})">${disabled?"Indisponível":"+ Adicionar"}</button>
    </div>
  </article>`;
}
function openVisualMenu(category){
  const items=visibleProducts(category);
  const title=category==="Pratos"?"🍛 Pratos":category==="Lanches"?"🍔 Lanches":"🥤 Bebidas";
  closeVisualMenu();
  const wrap=document.createElement("div");
  wrap.id="menuVisualOverlay";
  wrap.className="menuvisual-overlay open";
  wrap.innerHTML=`<section class="menuvisual-panel">
    <div class="menuvisual-head">
      <div><small>Cardápio</small><h2>${title}</h2></div>
      <button onclick="closeVisualMenu()">✕</button>
    </div>
    <div class="menuvisual-grid">${items.length?items.map(productVisualCard).join(""):'<div class="emptycart">Nenhum item nesta categoria.</div>'}</div>
  </section>`;
  document.body.appendChild(wrap);
}
function closeVisualMenu(){document.getElementById("menuVisualOverlay")?.remove()}
function quickAddProduct(id){
  const p=products.find(x=>x.id===id);
  if(!p||p.status!=="disponivel")return;
  cartAddByName(p.name,1);
  renderCartPanel();
  addBot(`${p.name} adicionado ao pedido.`);
}
function visualRecommendation(){
  const p=available().filter(x=>x.category!=="Bebidas").sort((a,b)=>a.price-b.price).find(x=>x.price<=30) || available().find(x=>x.category!=="Bebidas");
  if(!p){addBot("Não encontrei uma opção disponível.");return}
  conversation.lastProduct=p;
  addBot(`Recomendo ${p.name} por ${money(p.price)}.${pcard(p)}<button class="inlineadd" onclick="quickAddProduct(${p.id})">+ Adicionar ao pedido</button>`);
}

function sendQuick(t){
  if(aiBusy)return;
  const q=normalize(t);
  if(q.includes("pratos")){openVisualMenu("Pratos");return}
  if(q.includes("lanches")){openVisualMenu("Lanches");return}
  if(q.includes("bebidas")){openVisualMenu("Bebidas");return}
  if(q.includes("recomenda")){addUser(t);visualRecommendation();return}
  addUser(t);respond(t)
}

async function boot(){
  await Promise.all([loadSharedMenu(),loadPublicConfig()]);
  const p=new URLSearchParams(location.search);
  if(p.get("modo")==="cliente"){
    const mesaParam=String(p.get("mesa")||"01").replace(/\D/g,"").slice(-2)||"01";
    activeMesa=Math.max(1,Number(mesaParam)||1);
    document.getElementById("adminApp").hidden=true;
    document.getElementById("clientApp").hidden=false;
    document.getElementById("clientMesa").textContent="Mesa "+String(activeMesa).padStart(2,"0");
    document.getElementById("chatInput").addEventListener("keydown",e=>{if(e.key==="Enter")handleSend()});
  }else{
    const allowed=await ensureAdminAccess();
    if(!allowed){
      document.getElementById("adminApp").hidden=true;
      document.body.innerHTML=`<main style="font-family:Arial;padding:40px;text-align:center"><h2>Acesso não autorizado</h2><p>Recarregue a página para tentar novamente.</p></main>`;
      return;
    }
    document.getElementById("adminApp").hidden=false;
    document.getElementById("clientApp").hidden=true;
    document.querySelectorAll("nav button").forEach(b=>b.addEventListener("click",()=>page(b.dataset.page)));
    refreshAdmin(); page("inicio");
  }
}
boot();


let restaurantOrdersTimer=null;
let lastSeenNewOrderIds=new Set();
let restaurantNotificationsReady=false;

function orderStatusLabel(status){return status==="novo"?"Novo":status==="preparo"?"Em preparo":status==="pronto"?"Pronto":status==="finalizado"?"Finalizado":"Novo"}
function orderStatusClass(status){return ["novo","preparo","pronto","finalizado"].includes(status)?status:"novo"}
function formatOrderTime(iso){try{return new Date(iso).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}catch{return ""}}
function restaurantOrderCard(o){
  const items=(o.items||[]).map(x=>`<div>${x.qty}x ${x.name}</div>`).join("");
  const nextButtons=o.status==="novo"?`<button onclick="setOrderStatus('${o.id}','preparo')">Iniciar preparo</button>`:o.status==="preparo"?`<button onclick="setOrderStatus('${o.id}','pronto')">Marcar pronto</button>`:o.status==="pronto"?`<button onclick="setOrderStatus('${o.id}','finalizado')">Finalizar</button>`:`<span class="donecheck">✓ Finalizado</span>`;
  return `<article class="restaurant-order-card status-${orderStatusClass(o.status)}"><div class="restaurant-order-head"><div><small>Mesa ${o.mesa||"--"} • ${formatOrderTime(o.createdAt)}</small><h3>Pedido #${String(o.id).slice(-4)}</h3></div><span class="order-status-pill ${orderStatusClass(o.status)}">${orderStatusLabel(o.status)}</span></div><div class="restaurant-order-items">${items}</div><div class="restaurant-order-total">Total <b>${money(Number(o.total)||0)}</b></div><div class="restaurant-order-actions">${nextButtons}</div></article>`;
}
async function loadRestaurantOrders(){
  const grid=document.getElementById("restaurantOrdersGrid");
  const empty=document.getElementById("restaurantOrdersEmpty");
  try{
    const orders=await apiListOrders();
    const rank={novo:0,preparo:1,pronto:2,finalizado:3};
    const sorted=[...orders].sort((a,b)=>{
      const rs=(rank[a.status]??9)-(rank[b.status]??9);
      if(rs!==0)return rs;
      return new Date(b.createdAt)-new Date(a.createdAt);
    });

    if(grid){
      grid.innerHTML=sorted.map(restaurantOrderCard).join("");
      if(empty)empty.hidden=sorted.length>0;
    }

    updateOrderCounters(orders);
    updateOrdersSidebarBadge(orders);
    detectNewOrders(orders);
  }catch(err){
    if(grid)grid.innerHTML=`<div class="orders-error">Não consegui carregar os pedidos.</div>`;
  }
}

function updateOrdersSidebarBadge(orders){
  const count=orders.filter(o=>o.status==="novo").length;
  const badge=document.getElementById("ordersMenuBadge");
  if(badge){
    badge.textContent=count;
    badge.hidden=count===0;
  }
}
function playNewOrderSound(){
  try{
    const ctx=new (window.AudioContext||window.webkitAudioContext)();
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();
    osc.type="sine";
    osc.frequency.setValueAtTime(880,ctx.currentTime);
    gain.gain.setValueAtTime(.06,ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.22);
    osc.connect(gain);gain.connect(ctx.destination);
    osc.start();osc.stop(ctx.currentTime+.22);
  }catch{}
}
function showOrderToast(order){
  let toast=document.getElementById("newOrderToast");
  if(!toast){
    toast=document.createElement("div");
    toast.id="newOrderToast";
    toast.className="new-order-toast";
    document.body.appendChild(toast);
  }
  toast.innerHTML=`<b>🔔 Novo pedido</b><span>Mesa ${order.mesa} • Pedido #${String(order.id).slice(-4)}</span>`;
  toast.classList.add("show");
  setTimeout(()=>toast.classList.remove("show"),4200);
}
function detectNewOrders(orders){
  const newOrders=orders.filter(o=>o.status==="novo");
  const currentIds=new Set(newOrders.map(o=>String(o.id)));
  if(!restaurantNotificationsReady){
    lastSeenNewOrderIds=currentIds;
    restaurantNotificationsReady=true;
    return;
  }
  const fresh=newOrders.filter(o=>!lastSeenNewOrderIds.has(String(o.id)));
  if(fresh.length){
    playNewOrderSound();
    showOrderToast(fresh[0]);
  }
  lastSeenNewOrderIds=currentIds;
}

function updateOrderCounters(orders){
  const counts={novo:orders.filter(o=>o.status==="novo").length,preparo:orders.filter(o=>o.status==="preparo").length,pronto:orders.filter(o=>o.status==="pronto").length};
  const a=document.getElementById("countNovo"),b=document.getElementById("countPreparo"),c=document.getElementById("countPronto");if(a)a.textContent=counts.novo;if(b)b.textContent=counts.preparo;if(c)c.textContent=counts.pronto;
}
async function setOrderStatus(id,status){try{await apiUpdateOrderStatus(id,status);await loadRestaurantOrders()}catch(err){alert("Não consegui atualizar o pedido.")}}
function openRestaurantOrders(){
  const admin=document.getElementById("adminApp"),main=document.querySelector(".main");if(!admin||!main)return;
  let section=document.getElementById("restaurantOrdersSection");
  if(!section){section=document.createElement("section");section.id="restaurantOrdersSection";section.className="restaurant-orders-section";section.innerHTML=`<div class="orders-title-row"><div><small>Operação</small><h2>Pedidos do restaurante</h2></div><button class="refreshorders" onclick="loadRestaurantOrders()">↻ Atualizar</button></div><div class="orders-counters"><div><span id="countNovo">0</span><small>Novos</small></div><div><span id="countPreparo">0</span><small>Em preparo</small></div><div><span id="countPronto">0</span><small>Prontos</small></div></div><div id="restaurantOrdersEmpty" class="orders-empty">Nenhum pedido recebido ainda.</div><div id="restaurantOrdersGrid" class="restaurant-orders-grid"></div>`;main.prepend(section)}
  section.scrollIntoView({behavior:"smooth",block:"start"});loadRestaurantOrders();if(!restaurantOrdersTimer)restaurantOrdersTimer=setInterval(loadRestaurantOrders,5000);
}

document.addEventListener("DOMContentLoaded",()=>{
  const sidebar=document.querySelector(".sidebar");
  if(sidebar && !document.getElementById("ordersNavButton")){
    const btn=document.createElement("button");btn.id="ordersNavButton";btn.className="nav-item orders-nav-btn";btn.innerHTML="🧾 <span>Pedidos</span><span id=\"ordersMenuBadge\" class=\"orders-menu-badge\" hidden>0</span>";btn.onclick=openRestaurantOrders;
    const config=[...sidebar.querySelectorAll(".nav-item")].find(x=>x.textContent.includes("Configura"));if(config)sidebar.insertBefore(btn,config);else sidebar.appendChild(btn);
  }

  const client=document.getElementById("clientApp");
  const params=new URLSearchParams(location.search);
  if(!client || params.get("modo")!=="cliente")return;
  const shell=document.createElement("div");
  shell.innerHTML=`
    <button id="cartTopButton" class="carttop" onclick="openCart()" title="Abrir meu pedido">
      <span class="carticon">🛒</span>
      <span class="carttoptext"><b>Meu pedido</b><small id="cartTotalTop">R$ 0,00</small></span>
      <span id="cartBadge" class="cartbadge">0</span>
    </button>
    <div id="cartOverlay" class="cartoverlay" onclick="closeCart()"></div>
    <aside id="cartPanel" class="cartpanel">
      <div class="cartpanel-head">
        <div><b>🛒 Meu pedido</b><small>Mesa <span id="cartMesa">${String(activeMesa).padStart(2,"0")}</span></small></div>
        <button onclick="closeCart()">✕</button>
      </div>
      <div id="cartPanelBody" class="cartpanel-body"></div>
    </aside>`;
  while(shell.firstChild)document.body.appendChild(shell.firstChild);
  renderCartPanel();
});
