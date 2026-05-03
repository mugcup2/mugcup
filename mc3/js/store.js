// ════════════════════════════════════════════════
//  Mug Cup — Firebase Store
//  ← أضف بيانات Firebase هنا بعد ما تسجّل
// ════════════════════════════════════════════════

// ─── FIREBASE CONFIG ─────────────────────────────
// روح على console.firebase.google.com
// Project Settings → General → Your apps → Add Web App
// انسخ الـ config هنا:
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyAyRq36hvyRIdOW2w6ljV5nmIJTbRW6UsA",
  authDomain:        "mugcup-5e23b.firebaseapp.com",
  projectId:         "mugcup-5e23b",
  storageBucket:     "mugcup-5e23b.firebasestorage.app",
  messagingSenderId: "702851093892",
  appId:             "1:702851093892:web:500b7f9604ebbf6dbc39d1",
  measurementId:     "G-GR9G5RWXY2"
};


// ─── CLOUDINARY CONFIG (رفع الصور المجاني) ──────
const CLOUDINARY = {
  cloudName:  "dkm6x9pbm",
  apiKey:     "796683368849748",
  apiSecret:  "PHDVd6fs_g8x72Qup9QXo5I1ZQg",
  uploadPreset: "mugcup_unsigned"
};

// رفع صورة على Cloudinary
async function uploadToCloudinary(file){
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY.uploadPreset);
  formData.append('cloud_name', CLOUDINARY.cloudName);
  try {
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/auto/upload`,
      { method: 'POST', body: formData }
    );
    const data = await res.json();
    if(data.secure_url){
      return {
        url:  data.secure_url,
        type: data.resource_type === 'video' ? 'video' : 'image'
      };
    }
    return null;
  } catch(e){
    console.error('Cloudinary upload error:', e);
    return null;
  }
}

// ─── CONSTANTS ───────────────────────────────────
const CURRENCY = '₪';
const STORE_TITLE = 'Mug Cup';

// ─── DEFAULT PRODUCTS (shown before Firebase loads) ──
const DEFAULT_PRODUCTS = [
  {id:'p1',cat:'stickers',name:'ملصق قهوة كلاسيك',price:5,desc:'فينيل مقاوم للماء، أبعاد 8×8 سم.',emoji:'☕',colors:[],images:[],options:[]},
  {id:'p2',cat:'stickers',name:'ملصق لا تكلمني بدون قهوة',price:6,desc:'تصميم حصري لعشاق القهوة.',emoji:'😤',colors:[],images:[],options:[]},
  {id:'p3',cat:'mugs',name:'كاسة سيراميك أبيض',price:18,desc:'300ml — مناسب للقهوة والشاي.',emoji:'☕',colors:[],images:[],options:[]},
  {id:'p4',cat:'mugs',name:'كاسة بمقبض خشبي',price:25,desc:'سيراميك فاخر مع مقبض خشب طبيعي.',emoji:'🫖',colors:[],images:[],options:[]},
];

// ─── STATE ───────────────────────────────────────
let db = null;
let storage = null;
let firebaseReady = false;

let products  = JSON.parse(localStorage.getItem('mc3_products') || '[]');
let cart      = JSON.parse(localStorage.getItem('mc3_cart')     || '[]');
let orders    = JSON.parse(localStorage.getItem('mc3_orders')   || '[]');
let favorites = JSON.parse(localStorage.getItem('mc3_favs')     || '[]');

function saveLocal(){
  localStorage.setItem('mc3_products', JSON.stringify(products));
  localStorage.setItem('mc3_cart',     JSON.stringify(cart));
  localStorage.setItem('mc3_orders',   JSON.stringify(orders));
  localStorage.setItem('mc3_favs',     JSON.stringify(favorites));
}

// ─── FIREBASE INIT ───────────────────────────────
async function initFirebase(){
  if(FIREBASE_CONFIG.apiKey === 'PASTE_YOUR_API_KEY_HERE'){
    console.warn('Firebase not configured — using local storage');
    return false;
  }
  try {
    const { initializeApp }    = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    const { getFirestore, collection, doc, getDocs, addDoc, setDoc, deleteDoc, onSnapshot, query, orderBy }
      = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const { getStorage, ref, uploadBytes, getDownloadURL, deleteObject }
      = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js');

    const app = initializeApp(FIREBASE_CONFIG);
    db      = getFirestore(app);
    storage = getStorage(app);
    firebaseReady = true;

    // Store Firebase functions globally
    window._fb = { collection, doc, getDocs, addDoc, setDoc, deleteDoc, onSnapshot, query, orderBy, ref, uploadBytes, getDownloadURL, deleteObject };

    // Load products from Firestore
    await loadProductsFromFirebase();
    // Listen for new orders in real-time
    listenOrders();

    console.log('✅ Firebase connected');
    return true;
  } catch(e) {
    console.error('Firebase init error:', e);
    return false;
  }
}

// ─── PRODUCTS (Firebase) ─────────────────────────
async function loadProductsFromFirebase(){
  try {
    const { collection, onSnapshot, query, orderBy } = window._fb;
    // Real-time listener for products - updates instantly on all devices
    const q = query(collection(db, 'products'));
    onSnapshot(q, snap => {
      products = snap.docs.map(d => ({...d.data(), id: d.id}));
      saveLocal();
      if(typeof renderProducts==='function') renderProducts();
      if(typeof updateCatCounts==='function') updateCatCounts();
      if(typeof renderProdTab==='function') renderProdTab(typeof curPTab!=='undefined'?curPTab:'stickers');
      if(typeof renderStats==='function') renderStats();
    });
  } catch(e){ console.error('loadProducts error:', e); }
}

async function saveProductToFirebase(p){
  if(!firebaseReady) return;
  const { doc, setDoc } = window._fb;
  const {id, ...data} = p;
  await setDoc(doc(db, 'products', String(id)), data);
}

async function deleteProductFromFirebase(id){
  if(!firebaseReady) return;
  const { doc, deleteDoc } = window._fb;
  await deleteDoc(doc(db, 'products', String(id)));
}

// ─── IMAGE UPLOAD (Firebase Storage) ────────────
async function uploadImageToFirebase(file, productId){
  // استخدام Cloudinary بدل Firebase Storage (مجاني 100%)
  return await uploadToCloudinary(file);
}

// ─── ORDERS (Firebase) ───────────────────────────
async function saveOrderToFirebase(order){
  if(!firebaseReady) return;
  const { collection, addDoc } = window._fb;
  await addDoc(collection(db, 'orders'), order);
}

function listenOrders(){
  if(!firebaseReady) return;
  const { collection, onSnapshot, query, orderBy } = window._fb;
  const q = query(collection(db, 'orders'), orderBy('createdAt','desc'));
  onSnapshot(q, snap => {
    orders = snap.docs.map(d => ({...d.data(), _fbId: d.id}));
    saveLocal();
    if(typeof renderOrders==='function') renderOrders();
    if(typeof renderStats==='function') renderStats();
  });
}

async function updateOrderStatusFirebase(fbId, status){
  if(!firebaseReady || !fbId) return;
  const { doc, setDoc } = window._fb;
  const order = orders.find(o=>o._fbId===fbId);
  if(order){ await setDoc(doc(db,'orders',fbId), {...order, status}, {merge:true}); }
}

// ─── PRODUCT HELPERS ─────────────────────────────
function nextId(){
  return 'p' + Date.now() + Math.floor(Math.random()*1000);
}

async function addProduct(data){
  const id = nextId();
  const p = {id, ...data, createdAt: Date.now()};
  products.push(p);
  saveLocal();
  await saveProductToFirebase(p);
  return p;
}

async function updateProduct(id, data){
  const i = products.findIndex(p=>p.id===id);
  if(i>-1){
    products[i] = {...products[i], ...data};
    saveLocal();
    await saveProductToFirebase(products[i]);
  }
}

async function deleteProduct(id){
  products = products.filter(p=>p.id!==id);
  cart = cart.filter(c=>c.id!==id);
  saveLocal();
  await deleteProductFromFirebase(id);
}

// ─── CART ─────────────────────────────────────────
function addToCart(id, qty=1, selectedOptions={}){
  const p = products.find(x=>x.id===id);
  if(!p) return;
  // Create unique key based on options selected
  const optKey = JSON.stringify(selectedOptions);
  const ex = cart.find(x=>x.id===id && JSON.stringify(x.selectedOptions||{})===optKey);
  const firstImg = p.images && p.images[0] ? p.images[0] : null;
  if(ex) ex.qty += qty;
  else cart.push({id, name:p.name, price:p.price, emoji:p.emoji, firstImg, qty, selectedOptions});
  saveLocal(); updateBadges();
  const optStr = Object.values(selectedOptions).filter(Boolean).join(' · ');
  toast('✓ أُضيف: ' + p.name + (optStr ? ' ('+optStr+')' : ''));
  if(typeof renderCart==='function') renderCart();
}

function removeFromCart(cartIdx){ cart.splice(cartIdx,1); saveLocal(); updateBadges(); if(typeof renderCart==='function') renderCart(); }
function changeQty(cartIdx, d){ if(cart[cartIdx]){ cart[cartIdx].qty = Math.max(1,cart[cartIdx].qty+d); saveLocal(); if(typeof renderCart==='function') renderCart(); } }
function cartTotal(){ return cart.reduce((s,i)=>s+i.price*i.qty, 0); }
function cartCount(){ return cart.reduce((s,i)=>s+i.qty, 0); }
function clearCart(){ cart=[]; saveLocal(); updateBadges(); if(typeof renderCart==='function') renderCart(); }

// ─── ORDERS ───────────────────────────────────────
async function placeOrder(info){
  const order = {
    id: 'MUG-' + Math.floor(10000+Math.random()*90000),
    createdAt: Date.now(),
    date: new Date().toLocaleDateString('ar-EG'),
    time: new Date().toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'}),
    name: info.name,
    phone: info.phone,
    address: info.address,
    notes: info.notes || '',
    items: JSON.parse(JSON.stringify(cart)),
    total: cartTotal(),
    status: 'جديد',
    statusHistory: [{status:'جديد', time: new Date().toLocaleString('ar-EG')}]
  };
  orders.unshift(order);
  saveLocal();
  await saveOrderToFirebase(order);
  return order;
}

// ─── FAVORITES ────────────────────────────────────
function toggleFav(id){
  const p = products.find(x=>x.id===id); if(!p) return;
  if(favorites.includes(id)){ favorites=favorites.filter(x=>x!==id); toast('💔 أُزيل من المفضلة'); }
  else { favorites.push(id); toast('❤️ '+p.name); }
  saveLocal(); updateBadges();
  document.querySelectorAll(`.fav-btn[data-id="${id}"]`).forEach(b=>{
    b.classList.toggle('on', favorites.includes(id));
    b.textContent = favorites.includes(id) ? '❤️' : '🤍';
  });
}

// ─── UI ───────────────────────────────────────────
function updateBadges(){
  document.querySelectorAll('.cart-badge').forEach(b=>b.textContent=cartCount());
  document.querySelectorAll('.fav-badge').forEach(b=>b.textContent=favorites.length);
}

function toast(msg){
  let t = document.getElementById('toast');
  if(!t){ t=document.createElement('div'); t.id='toast'; document.body.appendChild(t); }
  t.textContent=msg; t.classList.add('show');
  clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('show'),2600);
}

// ─── CART SIDEBAR ────────────────────────────────
function buildCartHTML(){
  return `
  <div class="cart-side" id="cart-side">
    <div class="cart-hd">
      <h3>🛒 سلة التسوق</h3>
      <button onclick="closeCart()">✕</button>
    </div>
    <div class="cart-items" id="cart-list"></div>
    <div class="cart-ft" id="cart-ft"></div>
  </div>
  <div class="overlay" id="cart-overlay" onclick="closeCart()"></div>`;
}

function openCart(){ document.getElementById('cart-side').classList.add('open'); document.getElementById('cart-overlay').classList.add('open'); renderCart(); }
function closeCart(){ document.getElementById('cart-side').classList.remove('open'); document.getElementById('cart-overlay').classList.remove('open'); }

function renderCart(){
  const list = document.getElementById('cart-list');
  const ft   = document.getElementById('cart-ft');
  if(!list) return;
  if(cart.length===0){
    list.innerHTML='<div class="c-empty"><div style="font-size:48px;margin-bottom:10px">🛒</div><div>سلتك فارغة</div></div>';
    ft.innerHTML=''; return;
  }
  list.innerHTML = cart.map((c,idx)=>{
    const optStr = c.selectedOptions ? Object.entries(c.selectedOptions).filter(([,v])=>v).map(([k,v])=>`${k}: ${v}`).join(' · ') : '';
    const imgHTML = c.firstImg ? `<img src="${c.firstImg.url}" style="width:100%;height:100%;object-fit:cover">` : c.emoji;
    return `<div class="c-item">
      <div class="c-img">${imgHTML}</div>
      <div class="c-info">
        <div class="c-name">${c.name}</div>
        ${optStr?`<div style="font-size:10px;color:var(--muted);margin-bottom:2px">${optStr}</div>`:''}
        <div class="c-price">${c.price} ${CURRENCY}</div>
        <div class="c-qty">
          <button class="cq" onclick="changeQty(${idx},-1)">−</button>
          <span style="font-weight:700;font-size:13px">${c.qty}</span>
          <button class="cq" onclick="changeQty(${idx},1)">+</button>
        </div>
      </div>
      <button class="c-del" onclick="removeFromCart(${idx})">🗑</button>
    </div>`;
  }).join('');
  ft.innerHTML=`
    <div class="cart-total"><span>الإجمالي</span><span>${cartTotal()} ${CURRENCY}</span></div>
    <button class="btn btn-cream w-full" onclick="closeCart();openCheckout()" style="font-size:16px;padding:13px">تأكيد الطلب ←</button>`;
}

// ─── NAV ─────────────────────────────────────────
function buildNav(active){
  return `<nav>
    <div style="display:flex;align-items:center;gap:8px">
      <a class="nav-logo-btn" href="index.html" title="الرئيسية"><img src="logo.png" alt="Mug Cup"></a>
      <button class="nav-btn nav-behance" onclick="openBehance()" title="Behance">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 7h-7V5h7v2zm1.726 10c-.442 1.297-2.029 3-5.101 3-3.074 0-5.564-1.729-5.564-5.675 0-3.91 2.325-5.92 5.466-5.92 3.082 0 4.964 1.782 5.375 4.426.078.506.109 1.188.095 2.14H15.97c.13 3.211 3.483 3.312 4.588 2.029H23.726zm-7.718-3.967c-.088-2.859-2.547-2.859-2.547-2.859-.912 0-2.41.356-2.418 2.859h4.965zm-5.005-6.099v2H4V17h7.003v2H2V7h7.003zm-.003 0H2V5h7z"/></svg>
      </button>
    </div>
    <div class="nav-actions">
      <button class="nav-btn" onclick="location.href='favorites.html'" title="المفضلة">🤍<span class="badge fav-badge">${favorites.length}</span></button>
      <button class="nav-btn" onclick="openCart()" title="السلة">🛒<span class="badge cart-badge">${cartCount()}</span></button>
    </div>
  </nav>`;
}

// Init Firebase on load
initFirebase();
