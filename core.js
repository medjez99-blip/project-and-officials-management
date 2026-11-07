/* ===================== core.js =====================
   يقدّم:  الثوابت، الحالة العامة، الأدوات ($, esc, تواريخ, uid),
            الأدوار، toast، IndexedDB، تخزين المشاريع، معالجة الصور،
            منطق المصادقة (تجزئة، مستخدمون، جلسات، بذر).
   يعتمد على: لا شيء (يجب أن يُحمَّل أولاً).
   لا يلمس DOM عند التحميل — فقط دوال تُستدعى لاحقاً.
   ==================================================== */

/* --- ثوابت --- */
const STORE_KEY = 'edu_projects_v2_ar';
const USERS_KEY = 'edu_users_v1';
const SESSION_KEY = 'edu_session_v1';
const SESSION_DAYS = 30;
const DAY = 86400000;
const MAX_PHOTOS_PER_VISIT = 10;

/* --- الحالة العامة (مشتركة) --- */
let projects = [];
let users = [];
let currentUser = null;
let editingId = null;
let progressId = null;

/* --- مساعدات --- */
const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
const uid = () => 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const userUid = () => 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const visitUid = () => 'v_' + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const photoUid = () => 'ph_' + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const STATUS_AR = {planned:'مخطط',active:'نشط',onhold:'معلّق',completed:'مكتمل',cancelled:'ملغى'};
const PRIORITY_AR = {critical:'حرج',high:'عالي',medium:'متوسط',low:'منخفض'};
const ENTITY_AR = {School:'مدرسة',Office:'مكتب',Directorate:'مديرية',Other:'أخرى'};
const MONTHS_AR = ['جانفي','فيفري','مارس','أفريل','ماي','جوان','جويلية','أوت','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

const isClosed = p => p.status === 'completed' || p.status === 'cancelled';
const prioRank = pr => ({critical:0,high:1,medium:2,low:3}[pr] ?? 9);
const pad2 = n => String(n).padStart(2,'0');
const isoLocal = d => d.getFullYear() + '-' + pad2(d.getMonth()+1) + '-' + pad2(d.getDate());
const todayISO = () => isoLocal(new Date());
function shiftISO(days){ const d = new Date(); d.setDate(d.getDate()+days); return isoLocal(d); }

function fmtDate(iso){
  if(!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  if(isNaN(d)) return '—';
  return d.getDate() + ' ' + MONTHS_AR[d.getMonth()] + ' ' + d.getFullYear();
}
function fmtDateTime(iso){
  if(!iso) return '—';
  const d = new Date(iso);
  if(isNaN(d)) return '—';
  return d.getDate() + ' ' + MONTHS_AR[d.getMonth()] + ' ' + d.getFullYear() + ' · ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}
function daysUntil(iso){
  if(!iso) return null;
  const t = Date.parse(iso + 'T00:00:00');
  if(isNaN(t)) return null;
  const n = Date.parse(todayISO() + 'T00:00:00');
  return Math.round((t-n)/DAY);
}
function daysLabel(n){
  n = Math.abs(n);
  if(n === 1) return 'يوم واحد';
  if(n === 2) return 'يومان';
  if(n >= 3 && n <= 10) return n + ' أيام';
  return n + ' يومًا';
}

/* --- الأدوار --- */
const isAdmin = () => !!currentUser && currentUser.role === 'admin';
function isOwner(p){
  if(!currentUser) return false;
  if(isAdmin()) return true;
  const email = (currentUser.email || '').toLowerCase();
  const name = (currentUser.name || '').trim().toLowerCase();
  if(p.email && email && String(p.email).toLowerCase() === email) return true;
  if(p.responsible && name && String(p.responsible).trim().toLowerCase() === name) return true;
  return false;
}
function visibleProjects(){
  return isAdmin() ? projects : projects.filter(isOwner);
}

/* --- الإشعارات العائمة --- */
function toast(msg, kind){
  const el = document.createElement('div');
  el.className = 'toast ' + (kind || '');
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => {
    el.style.transition = '.25s';
    el.style.opacity = '0';
    el.style.transform = 'translateY(10px)';
    setTimeout(() => el.remove(), 260);
  }, 2600);
}

/* ===================== IndexedDB (الصور) ===================== */
const DB_NAME = 'edu_photos_db';
const DB_VERSION = 1;
const PHOTOS_STORE = 'photos';
let _dbPromise = null;

function openDB(){
  if(_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    if(!('indexedDB' in window)){ reject(new Error('IndexedDB غير مدعوم')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if(!db.objectStoreNames.contains(PHOTOS_STORE)) db.createObjectStore(PHOTOS_STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}
async function savePhotoInDB(photo){
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTOS_STORE, 'readwrite');
    tx.objectStore(PHOTOS_STORE).put(photo);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function getPhotoFromDB(id){
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTOS_STORE, 'readonly');
    const req = tx.objectStore(PHOTOS_STORE).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function getPhotosFromDB(ids){
  if(!ids || !ids.length) return {};
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(PHOTOS_STORE, 'readonly');
    const store = tx.objectStore(PHOTOS_STORE);
    const result = {};
    let pending = ids.length;
    ids.forEach(id => {
      const req = store.get(id);
      req.onsuccess = () => {
        if(req.result) result[id] = req.result;
        if(--pending === 0) resolve(result);
      };
      req.onerror = () => { if(--pending === 0) resolve(result); };
    });
  });
}
async function deletePhotoFromDB(id){
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(PHOTOS_STORE, 'readwrite');
    tx.objectStore(PHOTOS_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}
async function deletePhotosFromDB(ids){
  for(const id of (ids || [])) await deletePhotoFromDB(id);
}

/* ===================== تخزين المشاريع ===================== */
function save(){
  try{ localStorage.setItem(STORE_KEY, JSON.stringify(projects)); }
  catch(e){ toast('تعذّر الحفظ — قد تكون مساحة التخزين ممتلئة','bad'); }
}
function normalizeProject(p){
  if(!p || typeof p !== 'object') return p;
  if(!Array.isArray(p.visits)) p.visits = [];
  return p;
}
function load(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(!raw) return null;
    const arr = JSON.parse(raw);
    if(!Array.isArray(arr)) return null;
    return arr.map(normalizeProject);
  }catch(e){ return null; }
}
function blank(){
  return {
    name:'', code:'', entityType:'School', entityName:'',
    responsible:'', role:'', email:'', phone:'',
    status:'planned', priority:'medium',
    startDate:'', endDate:'', progress:0, notes:'',
    visits: []
  };
}
function seed(){
  const now = new Date().toISOString();
  return [
    { name:'تطوير مختبرات العلوم', code:'EDU-2026-014', entityType:'School',
      entityName:'ثانوية النور', responsible:'فاطمة الزهراء',
      role:'منسقة المشروع', email:'f.zahra@ministry.gov', phone:'+212 600 112 334',
      status:'active', priority:'high', startDate: shiftISO(-40), endDate: shiftISO(5),
      progress:70, notes:'تمت الموافقة على مناقصة المعدات. مرحلة التركيب قيد الانتظار.' },
    { name:'تفعيل الحضور الرقمي', code:'EDU-2026-021', entityType:'Office',
      entityName:'المديرية الإقليمية الشمالية', responsible:'عمر حداد',
      role:'مسؤول تقنية المعلومات', email:'o.haddad@ministry.gov', phone:'+212 661 908 220',
      status:'active', priority:'critical', startDate: shiftISO(-70), endDate: shiftISO(-3),
      progress:45, notes:'مدرستان لم تفعّلا النظام بعد — يجب التصعيد إلى المكتب الإقليمي.' },
    { name:'برنامج تدريب المعلمين', code:'EDU-2026-008', entityType:'Office',
      entityName:'مكتب الموارد البشرية', responsible:'ليلى منصور',
      role:'مديرة التدريب', email:'l.mansour@ministry.gov', phone:'+212 655 447 118',
      status:'active', priority:'medium', startDate: shiftISO(-20), endDate: shiftISO(25),
      progress:60, notes:'اكتملت 3 دفعات، بقيت دفعتان.' },
    { name:'تجديد المكتبة', code:'EDU-2026-031', entityType:'School',
      entityName:'مدرسة ابن سينا الابتدائية', responsible:'يوسف كريم',
      role:'مسؤول المرافق', email:'y.karim@ministry.gov', phone:'+212 677 331 905',
      status:'planned', priority:'low', startDate: shiftISO(10), endDate: shiftISO(90),
      progress:0, notes:'بانتظار تأكيد بند الميزانية من الإدارة المالية.' },
    { name:'تدقيق مسارات النقل', code:'EDU-2026-019', entityType:'Directorate',
      entityName:'المديرية المركزية', responsible:'حسن علي',
      role:'مدقق', email:'h.ali@ministry.gov', phone:'+212 690 552 741',
      status:'onhold', priority:'high', startDate: shiftISO(-15), endDate: shiftISO(3),
      progress:20, notes:'بانتظار بيانات شركة النقل.' },
    { name:'نظام جدولة الامتحانات', code:'EDU-2025-102', entityType:'Office',
      entityName:'مكتب تقنية المعلومات', responsible:'سارة نبيل',
      role:'محللة نظم', email:'s.nabil@ministry.gov', phone:'+212 611 220 480',
      status:'completed', priority:'medium', startDate: shiftISO(-120), endDate: shiftISO(-20),
      progress:100, notes:'تم التسليم وتحويله إلى فريق التشغيل.' }
  ].map(p => ({ id: uid(), ...p, visits: [], createdAt: now, updatedAt: now }));
}

/* ===================== معالجة الصور والختم ===================== */
function loadImageFromFile(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function drawStamp(ctx, w, h, meta){
  const d = new Date();
  const dateStr = `${d.getDate()} ${MONTHS_AR[d.getMonth()]} ${d.getFullYear()} · ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const locStr = meta.location
    ? `📍 ${meta.location.lat.toFixed(5)}, ${meta.location.lng.toFixed(5)} (±${Math.round(meta.location.accuracy)}م)`
    : '📍 الموقع غير متاح';
  const whoStr = `👤 ${meta.userName}${meta.projectName ? ' · ' + meta.projectName : ''}`;
  const lines = [dateStr, locStr, whoStr];

  const fontSize = Math.max(11, Math.round(w / 55));
  const padding = Math.round(fontSize * 0.95);
  const lineHeight = Math.round(fontSize * 1.5);
  const boxHeight = padding * 2 + lineHeight * lines.length;
  const boxY = h - boxHeight;

  ctx.fillStyle = 'rgba(8, 20, 35, 0.74)';
  ctx.fillRect(0, boxY, w, boxHeight);
  ctx.fillStyle = '#E8B84B';
  ctx.fillRect(0, boxY, w, 3);

  ctx.textBaseline = 'top';
  ctx.textAlign = 'right';
  if('direction' in ctx) ctx.direction = 'rtl';

  lines.forEach((line, i) => {
    ctx.font = `${i === 0 ? 'bold ' : ''}${fontSize}px Tajawal, Arial, sans-serif`;
    ctx.fillStyle = i === 0 ? '#ffffff' : 'rgba(255,255,255,0.88)';
    ctx.fillText(line, w - padding, boxY + padding + i * lineHeight);
  });
}
async function processPhoto(file, meta){
  const img = await loadImageFromFile(file);
  const MAX = 1200;
  let w = img.width, h = img.height;
  const scale = Math.min(1, MAX / Math.max(w, h));
  w = Math.max(1, Math.round(w * scale));
  h = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  drawStamp(ctx, w, h, meta);

  const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.78));

  const TMAX = 220;
  const tscale = Math.min(1, TMAX / Math.max(w, h));
  const tw = Math.max(1, Math.round(w * tscale));
  const th = Math.max(1, Math.round(h * tscale));
  const tcanvas = document.createElement('canvas');
  tcanvas.width = tw; tcanvas.height = th;
  tcanvas.getContext('2d').drawImage(canvas, 0, 0, tw, th);
  const thumbDataUrl = tcanvas.toDataURL('image/jpeg', 0.65);

  return { blob, thumbDataUrl, width: w, height: h };
}

/* ===================== المصادقة (منطق) ===================== */
function randomSalt(){
  try{
    const a = new Uint8Array(16);
    crypto.getRandomValues(a);
    return Array.from(a, b => b.toString(16).padStart(2,'0')).join('');
  }catch(e){
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}
function cyrb53(str, seed=0){
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for(let i=0;i<str.length;i++){
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1>>>16), 2246822507) ^ Math.imul(h2 ^ (h2>>>13), 3266489909);
  h2 = Math.imul(h2 ^ (h2>>>16), 2246822507) ^ Math.imul(h1 ^ (h1>>>13), 3266489909);
  return (h2>>>0).toString(16).padStart(8,'0') + (h1>>>0).toString(16).padStart(8,'0');
}
async function hashPw(pw, salt){
  const input = salt + '::' + pw;
  if(window.crypto && crypto.subtle && window.isSecureContext){
    try{
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
      return 'sha256:' + Array.from(new Uint8Array(buf), b=>b.toString(16).padStart(2,'0')).join('');
    }catch(e){ /* fall through */ }
  }
  let h = input;
  for(let i=0;i<120;i++) h = cyrb53(h, i);
  return 'fb:' + h;
}
function loadUsers(){
  try{
    const raw = localStorage.getItem(USERS_KEY);
    const arr = raw ? JSON.parse(raw) : null;
    return Array.isArray(arr) ? arr : [];
  }catch(e){ return []; }
}
function saveUsers(){
  try{ localStorage.setItem(USERS_KEY, JSON.stringify(users)); }
  catch(e){ toast('تعذّر حفظ المستخدمين','bad'); }
}
function findUserByEmail(email){
  const e = String(email||'').trim().toLowerCase();
  return users.find(u => u.email.toLowerCase() === e) || null;
}
async function createUser({ name, email, password, role }){
  name = String(name||'').trim();
  email = String(email||'').trim().toLowerCase();
  if(!name) throw new Error('الاسم مطلوب.');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('البريد الإلكتروني غير صالح.');
  if(String(password||'').length < 6) throw new Error('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
  if(findUserByEmail(email)) throw new Error('هذا البريد مسجل بالفعل.');
  const salt = randomSalt();
  const hash = await hashPw(password, salt);
  const u = { id: userUid(), name, email, role: role === 'admin' ? 'admin' : 'user', salt, hash, createdAt: new Date().toISOString() };
  users.push(u);
  saveUsers();
  return u;
}
async function verifyUser(email, password){
  const u = findUserByEmail(email);
  if(!u) return null;
  const h = await hashPw(password, u.salt);
  return h === u.hash ? u : null;
}
function saveSession(u){
  try{ localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: u.id, exp: Date.now() + SESSION_DAYS*DAY })); }catch(e){}
}
function loadSession(){
  try{
    const raw = localStorage.getItem(SESSION_KEY);
    if(!raw) return null;
    const s = JSON.parse(raw);
    if(!s || !s.userId) return null;
    if(s.exp && Date.now() > s.exp){ localStorage.removeItem(SESSION_KEY); return null; }
    return s;
  }catch(e){ return null; }
}
function clearSession(){ try{ localStorage.removeItem(SESSION_KEY); }catch(e){} }

async function seedUsers(){
  const demo = [
    { name:'مدير النظام',      email:'admin@ministry.gov',    password:'Admin@123', role:'admin' },
    { name:'فاطمة الزهراء',    email:'f.zahra@ministry.gov',  password:'User@123',  role:'user' },
    { name:'عمر حداد',         email:'o.haddad@ministry.gov', password:'User@123',  role:'user' },
    { name:'ليلى منصور',       email:'l.mansour@ministry.gov',password:'User@123',  role:'user' },
    { name:'يوسف كريم',        email:'y.karim@ministry.gov',  password:'User@123',  role:'user' },
    { name:'حسن علي',          email:'h.ali@ministry.gov',    password:'User@123',  role:'user' },
    { name:'سارة نبيل',        email:'s.nabil@ministry.gov',  password:'User@123',  role:'user' }
  ];
  users = [];
  for(const d of demo){ await createUser(d); }
}
async function bootAuth(){
  users = loadUsers();
  if(!users.length){ await seedUsers(); }
  const s = loadSession();
  if(s){
    const u = users.find(x => x.id === s.userId);
    if(u) currentUser = u;
  }
}