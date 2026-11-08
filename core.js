/* ===================== core.js =====================
   يقدّم:  الثوابت، الحالة العامة، الأدوات ($, esc, تواريخ, uid),
            الأدوار، toast، IndexedDB، تخزين المشاريع، معالجة الصور،
            منطق المصادقة (تجزئة، مستخدمون، جلسات، بذر).
   يعتمد على: لا شيء (يجب أن يُحمَّل أولاً).
   لا يلمس DOM عند التحميل — فقط دوال تُستدعى لاحقاً.
   ==================================================== */

/* --- ثوابت --- */
const STORE_KEY = 'edu_projects_v13_ar';
const USERS_KEY = 'edu_users_v13';
const SESSION_KEY = 'edu_session_v13';
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
function cleanupLegacyAuth(){
  try{
    ['edu_session_v1','edu_session_v2','edu_session_v3',
     'edu_session_v4','edu_session_v5','edu_session_v6'].forEach(k => {
      if(localStorage.getItem(k)) localStorage.removeItem(k);
    });
  }catch(_){}
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
const DB_VERSION = 2;
const PHOTOS_STORE = 'photos';
const SYNC_STORE = 'sync_queue';
let _dbPromise = null;

function openDB(){
  if(_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    if(!('indexedDB' in window)){ reject(new Error('IndexedDB غير مدعوم')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if(!db.objectStoreNames.contains(PHOTOS_STORE)){
        db.createObjectStore(PHOTOS_STORE, { keyPath: 'id' });
      }
      if(!db.objectStoreNames.contains(SYNC_STORE)){
        const s = db.createObjectStore(SYNC_STORE, { keyPath: 'id', autoIncrement: true });
        s.createIndex('createdAt', 'createdAt');
        s.createIndex('projectId', 'projectId');
      }
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
/* ===================== Sync queue (Phase 4a) ===================== */
/* Every write we intend to push to Supabase is enqueued here. */
async function enqueueSync(entity, op, payload, projectId){
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_STORE, 'readwrite');
    const store = tx.objectStore(SYNC_STORE);
    const item = {
      entity,                    // 'project' | 'visit' | 'photo'
      op,                        // 'upsert' | 'delete'
      payload,                   // plain object
      projectId: projectId || null,
      createdAt: Date.now(),
      retries: 0
    };
    const req = store.add(item);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function listSyncQueue(){
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_STORE, 'readonly');
    const store = tx.objectStore(SYNC_STORE);
    const out = [];
    store.openCursor().onsuccess = e => {
      const cur = e.target.result;
      if(cur){ out.push({ _key: cur.primaryKey, ...cur.value }); cur.continue(); }
      else resolve(out);
    };
    tx.onerror = () => reject(tx.error);
  });
}

async function removeSyncItem(id){
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(SYNC_STORE, 'readwrite');
    tx.objectStore(SYNC_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => resolve();
  });
}

async function clearSyncQueue(){
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(SYNC_STORE, 'readwrite');
    tx.objectStore(SYNC_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror    = () => resolve();
  });
}
async function countSyncQueue(){
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(SYNC_STORE, 'readonly');
    const req = tx.objectStore(SYNC_STORE).count();
    req.onsuccess = () => resolve(req.result || 0);
    req.onerror   = () => resolve(0);
  });
}
/* ===================== Sync: diff-based enqueue (Phase 4b) ===================== */
let _lastSyncSnapshot = null;   // Map<projectId, JSON string>

async function saveWithSync(){
  // 1) Build the "current" view of all projects
  const currentMap = new Map();
  for(const p of projects){
    currentMap.set(p.id, JSON.stringify(p));
  }

  // 2) Snapshot FIRST so re-entrant renders don't double-queue
  const prev = _lastSyncSnapshot;
  _lastSyncSnapshot = currentMap;

  // 3) Persist to localStorage immediately — never lose data if enqueue fails
  save();

  if(!prev) return; // very first call after boot: nothing to diff against

  // 4) Queue upserts for new or changed projects
  for(const [id, json] of currentMap){
    if(prev.get(id) !== json){
      const proj = projects.find(x => x.id === id);
      if(proj){
        try { await enqueueSync('project', 'upsert', proj, id); }
        catch(e){ console.warn('enqueue upsert failed', e); }
      }
    }
  }
  // 5) Queue deletes for projects that disappeared
  for(const id of prev.keys()){
    if(!currentMap.has(id)){
      try { await enqueueSync('project', 'delete', { id }, id); }
      catch(e){ console.warn('enqueue delete failed', e); }
    }
  }
}
/* ===================== Sync: flusher (Phase 4c) ===================== */
let _flushing = false;
let _flushTimer = null;
let _syncLoopStarted = false;

async function sbUpsertProject(project){
  const ownerId = resolveOwnerId(project);
  const row = {
    id: project.id,
    owner_id: ownerId,
    name: project.name || '(untitled)',
    data: project,
    updated_at: new Date().toISOString()
  };
  const { error } = await window.sb.from('projects').upsert(row);
  if(error) throw error;
}

async function sbDeleteProject(id){
  const { error } = await window.sb.from('projects').delete().eq('id', id);
  if(error) throw error;
}

function resolveOwnerId(project){
  if(!currentUser) return null;
  const email = (project.email || '').trim().toLowerCase();
  if(email){
    const hit = users.find(u => (u.email || '').toLowerCase() === email);
    if(hit) return hit.id;
  }
  const name = (project.responsible || '').trim().toLowerCase();
  if(name){
    const hit = users.find(u => (u.name || '').trim().toLowerCase() === name);
    if(hit) return hit.id;
  }
  return currentUser.id;
}

async function applyQueueItem(item){
  if(item.entity === 'project'){
    if(item.op === 'upsert') return sbUpsertProject(item.payload);
    if(item.op === 'delete') return sbDeleteProject(item.payload.id);
  }
  throw new Error('Unknown entity/op: ' + item.entity + '/' + item.op);
}

async function flushQueue(){
  if(_flushing) return;
  if(!window.sb) return;
  if(!currentUser) return;
  if(!navigator.onLine) return;
  _flushing = true;
  try {
    await updateSyncBadge();
    const items = await listSyncQueue();
    if(!items.length) return;
    for(const item of items){
      if(!navigator.onLine) break;
      try {
        await applyQueueItem(item);
        await removeSyncItem(item._key);
      } catch(e){
        console.warn('[sync] item failed:', item.entity, item.op, item.projectId, e.message || e);
        break; // preserve order; retry next tick
      }
    }
  } finally {
    _flushing = false;
    await updateSyncBadge();
  }
}

async function seedUnpushedProjects(){
  if(!window.sb || !currentUser) return;
  if(!navigator.onLine) return;
  try {
    const { data, error } = await window.sb.from('projects').select('id');
    if(error) throw error;
    const remoteIds = new Set((data || []).map(r => r.id));
    let n = 0;
    for(const p of projects){
      if(!remoteIds.has(p.id)){
        await enqueueSync('project', 'upsert', p, p.id);
        n++;
      }
    }
    if(n) console.log('[sync] seeded', n, 'unpushed project(s)');
  } catch(e){
    console.warn('[sync] seed failed:', e.message || e);
  }
}

function startSyncLoop(){
  if(_syncLoopStarted) return;
  _syncLoopStarted = true;
  _flushTimer = setInterval(() => { flushQueue(); }, 30000);
  window.addEventListener('online',  () => { updateSyncBadge(); flushQueue(); });
  window.addEventListener('offline', () => { updateSyncBadge(); });
  updateSyncBadge();
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
/* ===================== المصادقة — Supabase (Phase 2) ===================== */

async function sbSignIn(email, password){
  if(!window.sb) throw new Error('Supabase غير مهيأ');
  const { data, error } = await window.sb.auth.signInWithPassword({ email, password });
  if(error) throw new Error(error.message || 'بيانات الدخول غير صحيحة');
  const u = data.user;
  const profile = await sbFetchProfile(u.id);
  return {
    id: u.id,
    email: u.email,
    name: (profile && profile.name) || u.email.split('@')[0],
    role: (profile && profile.role) || 'user'
  };
}

async function sbSignOut(){
  if(!window.sb) return;
  try { await window.sb.auth.signOut(); } catch(_){}
}

async function sbGetSession(){
  if(!window.sb) return null;
  const { data } = await window.sb.auth.getSession();
  return (data && data.session) || null;
}

async function sbFetchProfile(userId){
  if(!window.sb) return null;
  const { data, error } = await window.sb
    .from('profiles').select('*').eq('id', userId).maybeSingle();
  if(error){ console.warn('profile fetch failed', error); return null; }
  return data;
}

async function sbFetchAllProfiles(){
  if(!window.sb) return [];
  const { data, error } = await window.sb
    .from('profiles').select('*').order('created_at');
  if(error){ console.warn('profiles fetch failed', error); return []; }
  return data || [];
}

/* Deprecated stubs — kept so existing UI code does not crash.
   These will be removed in Phase 10 cleanup. */
function saveSession(){}
function loadSession(){ return null; }
function clearSession(){}
function randomSalt(){ return ''; }
async function hashPw(){ return ''; }
function loadUsers(){ return []; }
function saveUsers(){}
function findUserByEmail(){ return null; }
async function createUser(){ throw new Error('إنشاء المستخدمين سيُفعَّل في مرحلة لاحقة.'); }
async function verifyUser(){ return null; }
async function seedUsers(){}

function cleanupLegacyAuth(){
  try{
    ['edu_session_v1','edu_session_v2','edu_session_v3',
     'edu_session_v4','edu_session_v5','edu_session_v6','edu_session_v7','edu_session_v8','edu_session_v9'].forEach(k => {
      if(localStorage.getItem(k)) localStorage.removeItem(k);
    });
  }catch(_){}
}

async function bootAuth(){
  cleanupLegacyAuth();
  users = await sbFetchAllProfiles();
  const session = await sbGetSession();
  if(session && session.user){
    const profile = await sbFetchProfile(session.user.id);
    currentUser = {
      id: session.user.id,
      email: session.user.email,
      name: (profile && profile.name) || session.user.email.split('@')[0],
      role: (profile && profile.role) || 'user'
    };
  }
}
