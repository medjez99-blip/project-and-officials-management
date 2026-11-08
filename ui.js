/* ===================== ui.js =====================
   يقدّم:  كل ما يرسم أو يفتح/يغلق نوافذ —
            التذكيرات، الإحصاءات، الجدول، الفلاتر،
            شاشة الدخول، مودالات المشروع/التقدم/الزيارات/المستخدمين.
   يعتمد على: core.js
   ==================================================== */

/* ===================== التذكيرات ===================== */
function reminderInfo(p){
  if(isClosed(p)) return { cls:'ok', text:'—', days:null };
  if(!p.endDate)  return { cls:'ok', text:'بدون تاريخ استحقاق', days:null };
  const d = daysUntil(p.endDate);
  if(d === null)  return { cls:'ok', text:'تاريخ غير صالح', days:null };
  if(d < 0)       return { cls:'overdue', text:'متأخر ' + daysLabel(d), days:d };
  if(d === 0)     return { cls:'soon', text:'يستحق اليوم', days:d };
  if(d <= 7)      return { cls:'soon', text:'خلال ' + daysLabel(d), days:d };
  return { cls:'ok', text:fmtDate(p.endDate), days:d };
}
function attentionList(){
  return visibleProjects()
    .filter(p => !isClosed(p) && p.endDate)
    .map(p => ({ p, d: daysUntil(p.endDate) }))
    .filter(x => x.d !== null && x.d <= 7)
    .sort((a,b) => a.d - b.d);
}
/* ===================== نافذة تأكيد مخصّصة ===================== */
function confirmDialog(opts){
  const {
    title   = 'تأكيد',
    message = '',
    okText  = 'تأكيد',
    cancelText = 'إلغاء',
    danger  = false
  } = opts || {};

  const m = $('#confirmModal');
  // safe fallback if the modal markup hasn't landed yet
  if(!m) return Promise.resolve(window.confirm(message));

  return new Promise(resolve => {
    const titleEl  = $('#confirmTitle');
    const msgEl    = $('#confirmMessage');
    const okEl     = $('#confirmOk');
    const cancelEl = $('#confirmCancel');
    const closeEl  = $('#confirmClose');

    titleEl.textContent = title;
    msgEl.textContent   = message;
    okEl.textContent     = okText;
    cancelEl.textContent = cancelText;
    okEl.className = 'btn ' + (danger ? 'btn-danger' : 'btn-primary');

    let done = false;
    const finish = v => {
      if(done) return; done = true;
      m.classList.remove('open');
      m.setAttribute('aria-hidden','true');
      okEl.removeEventListener('click', onOk);
      cancelEl.removeEventListener('click', onCancel);
      closeEl.removeEventListener('click', onCancel);
      m.removeEventListener('click', onBackdrop);
      document.removeEventListener('keydown', onKey, true);
      resolve(v);
    };
    const onOk       = () => finish(true);
    const onCancel   = () => finish(false);
    const onBackdrop = e => { if(e.target === m) finish(false); };
    // capture + stopPropagation so Escape closes only the confirm dialog
    const onKey      = e => { if(e.key === 'Escape'){ e.stopPropagation(); finish(false); } };

    okEl.addEventListener('click', onOk);
    cancelEl.addEventListener('click', onCancel);
    closeEl.addEventListener('click', onCancel);
    m.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onKey, true);

    m.classList.add('open');
    m.setAttribute('aria-hidden','false');
    setTimeout(() => okEl.focus(), 50);
  });
}
/* ===================== الإحصاءات ===================== */
function renderStats(){
  const vis = visibleProjects();
  const total = vis.length;
  const active = vis.filter(p => p.status === 'active').length;
  const completed = vis.filter(p => p.status === 'completed').length;
  const att = attentionList();
  const overdue = att.filter(x => x.d < 0).length;
  const soon = att.filter(x => x.d >= 0).length;
  const open = vis.filter(p => !isClosed(p));
  const avg = open.length ? Math.round(open.reduce((s,p)=>s+(Number(p.progress)||0),0)/open.length) : 0;

  const cards = [
    { label: isAdmin() ? 'إجمالي المشاريع' : 'مشاريعي', value: total, sub: active + ' نشطة حالياً',
      icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
      bg:'#EEF2FF', fg:'#4338CA' },
    { label:'متأخرة', value: overdue, sub:'تجاوزت تاريخ الانتهاء',
      icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      bg:'#FEE2E2', fg:'#B91C1C' },
    { label:'مستحقة هذا الأسبوع', value: soon, sub:'خلال الـ 7 أيام القادمة',
      icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
      bg:'#FEF3C7', fg:'#B45309' },
    { label:'مكتملة', value: completed, sub:'مغلقة بنجاح',
      icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      bg:'#DCFCE7', fg:'#15803D' },
    { label:'متوسط التقدم', value: avg + '%', sub:'عبر المشاريع المفتوحة',
      icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
      bg:'#DBEAFE', fg:'#1D4ED8' }
  ];

  $('#stats').innerHTML = cards.map(c =>
    '<div class="stat">' +
      '<div class="stat-icon" style="background:' + c.bg + ';color:' + c.fg + '">' + c.icon + '</div>' +
      '<div class="stat-info">' +
        '<span class="stat-label">' + esc(c.label) + '</span>' +
        '<span class="stat-value">' + esc(c.value) + '</span>' +
        '<span class="stat-sub">' + esc(c.sub) + '</span>' +
      '</div>' +
    '</div>'
  ).join('');
}

/* ===================== التذكيرات (رسم) ===================== */
function renderReminders(){
  const att = attentionList();
  const panel = $('#reminderPanel');
  const list = $('#remindersList');
  const bell = $('#bellCount');
  const title = $('#reminderTitle');
  const count = $('#remindersCount');

  bell.textContent = att.length;
  bell.className = 'bell-badge' + (att.length === 0 ? ' zero' : '');

  if(!att.length){
    panel.classList.remove('alert');
    panel.classList.add('clear');
    title.textContent = 'لا توجد مواعيد متأخرة أو قادمة';
    list.innerHTML =
      '<div class="all-clear">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' +
        'كل المشاريع تحت السيطرة — لا حاجة إلى إجراء الآن.' +
      '</div>';
    return;
  }

  panel.classList.remove('clear');
  panel.classList.add('alert');
  title.textContent = 'تذكيرات — ' + att.length + ' مشروع' + (att.length === 1 ? '' : 'ات') + ' تحتاج متابعة';
  count.textContent = att.length;

  const act = isAdmin() ? 'edit' : 'progress';
  const actLabel = isAdmin() ? 'تعديل' : 'تحديث';

  list.innerHTML = att.map(({p, d}) => {
    const cls = d < 0 ? 'overdue' : 'soon';
    const tag = d < 0
      ? 'متأخر ' + daysLabel(d)
      : (d === 0 ? 'يستحق اليوم' : 'خلال ' + daysLabel(d));
    const who = [p.entityName, p.responsible].filter(Boolean).join(' · ');
    return '<div class="reminder-row ' + cls + '">' +
      '<span class="reminder-name">' + esc(p.name) + '</span>' +
      '<span class="reminder-meta">' + esc(who || '—') + '</span>' +
      '<span class="reminder-tag">' + esc(tag) + '</span>' +
      '<button class="btn btn-ghost btn-sm" data-act="' + act + '" data-id="' + p.id + '">' + actLabel + '</button>' +
    '</div>';
  }).join('');
}

/* ===================== الفلاتر والترتيب ===================== */
function filteredSorted(){
  const q = $('#search').value.trim().toLowerCase();
  const st = $('#filterStatus').value;
  const pr = $('#filterPriority').value;
  const en = $('#filterEntity').value;
  const sort = $('#filterSort').value;

  let list = visibleProjects().filter(p => {
    if(st && p.status !== st) return false;
    if(pr && p.priority !== pr) return false;
    if(en && p.entityType !== en) return false;
    if(!q) return true;
    const hay = [p.name,p.code,p.entityName,p.responsible,p.role,p.email,p.phone,p.notes]
      .filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  });

  list = list.slice();
  if(sort === 'due'){
    list.sort((a,b) => {
      const ca = isClosed(a), cb = isClosed(b);
      if(ca !== cb) return ca ? 1 : -1;
      return (a.endDate||'9999-12-31').localeCompare(b.endDate||'9999-12-31');
    });
  } else if(sort === 'priority'){
    list.sort((a,b) => prioRank(a.priority) - prioRank(b.priority));
  } else if(sort === 'name'){
    list.sort((a,b) => a.name.localeCompare(b.name,'ar'));
  } else if(sort === 'progress'){
    list.sort((a,b) => (Number(b.progress)||0) - (Number(a.progress)||0));
  } else if(sort === 'updated'){
    list.sort((a,b) => (b.updatedAt||'').localeCompare(a.updatedAt||''));
  }
  return list;
}

/* ===================== الجدول ===================== */
const CAMERA_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>';

function renderTable(){
  const tbody = $('#tbody');
  const vis = visibleProjects();
  const list = filteredSorted();

  if(!vis.length){
    const m = isAdmin()
      ? { title:'لا توجد مشاريع بعد', text:'اضغط على «مشروع جديد» لإضافة أول مشروع.' }
      : { title:'لا توجد مشاريع مسندة إليك', text:'سيظهر هنا أي مشروع يتم تعيينك مسؤولاً عنه.' };
    tbody.innerHTML = '<tr><td colspan="9" class="empty">' +
      '<div class="empty-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg></div>' +
      '<div class="empty-title">' + esc(m.title) + '</div>' +
      '<div class="empty-text">' + esc(m.text) + '</div>' +
      '</td></tr>';
    return;
  }

  if(!list.length){
    tbody.innerHTML = '<tr><td colspan="9" class="empty">' +
      '<div class="empty-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg></div>' +
      '<div class="empty-title">لا نتائج مطابقة</div>' +
      '<div class="empty-text">جرّب تغيير كلمات البحث أو الفلاتر.</div>' +
      '</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(p => {
    const r = reminderInfo(p);
    const prog = Math.max(0, Math.min(100, Number(p.progress)||0));
    const period = (p.startDate || p.endDate)
      ? '<span class="period">' + esc(fmtDate(p.startDate)) +
        '<span class="arrow">←</span>' + esc(fmtDate(p.endDate)) + '</span>'
      : '<span class="muted">—</span>';
    const meta = [p.code, p.notes ? p.notes.slice(0,60) : ''].filter(Boolean).join(' · ');
    const visitCount = (p.visits || []).length;
    const visitsBtn =
      '<button class="icon-btn visits-btn" data-act="visits" data-id="' + p.id + '" title="سجل الزيارات">' +
        CAMERA_ICON +
        (visitCount ? '<span class="badge-count">' + visitCount + '</span>' : '') +
      '</button>';

    const actions = isAdmin()
      ? visitsBtn +
        '<button class="icon-btn" data-act="edit" data-id="' + p.id + '" title="تعديل">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>' +
        '</button>' +
        '<button class="icon-btn" data-act="copy" data-id="' + p.id + '" title="نسخ">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>' +
        '</button>' +
        '<button class="icon-btn del" data-act="del" data-id="' + p.id + '" title="حذف">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>' +
        '</button>'
      : visitsBtn +
        '<button class="icon-btn prog-edit" data-act="progress" data-id="' + p.id + '" title="تحديث نسبة التقدم">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>' +
        '</button>';

    return '<tr data-id="' + p.id + '">' +
      '<td>' +
        '<div class="p-name"><button class="p-name-btn" data-act="visits" data-id="' + p.id + '" title="عرض سجل الزيارات">' + esc(p.name) + '</button></div>' +
        (meta ? '<div class="p-meta">' + esc(meta) + '</div>' : '') +
      '</td>' +
      '<td><div>' + esc(p.entityName || '—') + '</div>' +
        '<div class="cell-sub">' + esc(ENTITY_AR[p.entityType] || '') + '</div></td>' +
      '<td><div style="font-weight:600">' + esc(p.responsible || '—') + '</div>' +
        '<div class="cell-sub">' + esc([p.role, p.phone].filter(Boolean).join(' · ') || '—') + '</div></td>' +
      '<td><span class="badge ' + esc(p.status) + '">' + esc(STATUS_AR[p.status] || p.status) + '</span></td>' +
      '<td><span class="badge ' + esc(p.priority) + '">' + esc(PRIORITY_AR[p.priority] || p.priority) + '</span></td>' +
      '<td>' + period + '</td>' +
      '<td><div class="prog ' + (prog >= 100 ? 'done' : '') + '">' +
        '<div class="prog-bar"><div class="prog-fill" style="width:' + prog + '%"></div></div>' +
        '<div class="prog-txt">' + prog + '%</div></div></td>' +
      '<td><span class="rem ' + r.cls + '">' + esc(r.text) + '</span></td>' +
      '<td class="actions">' + actions + '</td></tr>';
  }).join('');
}
async function updateSyncBadge(){
  const el = $('#syncBadge');
  if(!el) return;
  const n = await countSyncQueue();
  let state, text;
  if(!navigator.onLine)         { state = 'offline'; text = 'غير متصل'; }
  else if(_flushing)            { state = 'syncing'; text = 'مزامنة…'; }
  else if(n > 0)                { state = 'pending'; text = 'قيد الانتظار (' + n + ')'; }
  else                          { state = 'synced';  text = 'متزامن'; }
  el.className = 'sync-badge ' + state;
  el.textContent = text;
  el.style.display = '';
}

function render(){
  renderStats();
  renderReminders();
  renderTable();
  saveWithSync();
}

/* ===================== واجهة المصادقة (رسم) ===================== */
function showAuthErr(id, msg){
  const el = $('#' + id);
  if(!el) return;
  el.textContent = msg;
  el.classList.add('show');
}
function hideAuthErr(){ $$('.auth-err').forEach(el => { el.classList.remove('show'); el.textContent = ''; }); }

function showAuth(){
  currentUser = null;
  projects = [];
  document.body.dataset.role = '';
  $('#authScreen').classList.remove('hidden');
  $('#siPw').value = '';
  hideAuthErr();
  setTimeout(() => $('#siEmail').focus(), 100);
}

function startApp(){
  $('#authScreen').classList.add('hidden');
  document.body.dataset.role = currentUser.role;
  $('#userName').textContent = currentUser.name;
  $('#userRole').textContent = currentUser.role === 'admin' ? 'مدير النظام' : 'مستخدم';
  $('#userAvatar').textContent = (currentUser.name || '?').trim().charAt(0);
  const stored = load();
  projects = stored || seed();
  render();

  startSyncLoop();
  seedUnpushedProjects().then(() => flushQueue()).catch(() => {});
}

/* $$('.auth-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.auth-tab').forEach(b => b.classList.toggle('active', b === btn));
    const isIn = btn.dataset.tab === 'in';
    $('#signinForm').classList.toggle('hidden', !isIn);
    $('#signupForm').classList.toggle('hidden', isIn);
    hideAuthErr();
  });
}); */

$('#signinForm').addEventListener('submit', async e => {
  e.preventDefault();
  hideAuthErr();
  const email = $('#siEmail').value.trim();
  const pw = $('#siPw').value;
  if(!email || !pw){ showAuthErr('siErr', 'يرجى إدخال البريد وكلمة المرور.'); return; }
  const btn = e.target.querySelector('button[type=submit]');
  const old = btn.textContent;
  btn.disabled = true; btn.textContent = 'جارٍ الدخول…';
  try{
        const u = await sbSignIn(email, pw);
    currentUser = u;
    $('#siPw').value = '';
    startApp();
    toast('مرحباً ' + u.name, 'ok');
  }catch(err){
    showAuthErr('siErr', err.message || 'تعذّر تسجيل الدخول.');
  }finally{
    btn.disabled = false; btn.textContent = old;
  }
});

/* $('#signupForm').addEventListener('submit', async e => {
  e.preventDefault();
  hideAuthErr();
  const name = $('#suName').value.trim();
  const email = $('#suEmail').value.trim();
  const pw = $('#suPw').value;
  const pw2 = $('#suPw2').value;
  if(pw !== pw2){ showAuthErr('suErr', 'كلمتا المرور غير متطابقتين.'); return; }
  const btn = e.target.querySelector('button[type=submit]');
  const old = btn.textContent;
  btn.disabled = true; btn.textContent = 'جارٍ الإنشاء…';
  try{
    const u = await createUser({ name, email, password: pw, role: 'user' });
    currentUser = u;
    saveSession(u);
    $('#suName').value = ''; $('#suEmail').value = ''; $('#suPw').value = ''; $('#suPw2').value = '';
    startApp();
    toast('تم إنشاء الحساب — مرحباً ' + u.name, 'ok');
  }catch(err){
    showAuthErr('suErr', err.message || 'تعذّر إنشاء الحساب.');
  }finally{
    btn.disabled = false; btn.textContent = old;
  }
}); */

$('#btnLogout').addEventListener('click', async () => {
  const ok = await confirmDialog({
    title: 'تسجيل الخروج',
    message: 'هل تريد تسجيل الخروج؟',
    okText: 'خروج'
  });
    if(!ok) return;
  await sbSignOut();
  showAuth();
  toast('تم تسجيل الخروج', 'info');
});

/* ===================== مودال المشروع (إداري) ===================== */
const modal = $('#modal');

function openModal(p){
  if(!isAdmin()){ toast('هذه العملية متاحة لمدير النظام فقط', 'bad'); return; }
  editingId = p ? p.id : null;
  $('#modalTitle').textContent = p ? 'تعديل المشروع' : 'مشروع جديد';
  $('#btnSave').textContent = p ? 'حفظ التغييرات' : 'حفظ المشروع';

  $('#usersDatalist').innerHTML = users.map(u => '<option value="' + esc(u.name) + '"></option>').join('');

  const d = p || blank();
  $('#pName').value = d.name || '';
  $('#pCode').value = d.code || '';
  $('#pEntityType').value = d.entityType || 'School';
  $('#pEntityName').value = d.entityName || '';
  $('#pResponsible').value = d.responsible || '';
  $('#pRole').value = d.role || '';
  $('#pEmail').value = d.email || '';
  $('#pPhone').value = d.phone || '';
  $('#pStatus').value = d.status || 'planned';
  $('#pPriority').value = d.priority || 'medium';
  $('#pStart').value = d.startDate || '';
  $('#pEnd').value = d.endDate || '';
  $('#pProgress').value = Number(d.progress) || 0;
  $('#pProgressVal').textContent = (Number(d.progress)||0) + '%';
  $('#pNotes').value = d.notes || '';

  $$('.field.invalid').forEach(f => f.classList.remove('invalid'));
  modal.classList.add('open');
  modal.setAttribute('aria-hidden','false');
  setTimeout(() => $('#pName').focus(), 60);
}
function closeModal(){
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden','true');
  editingId = null;
}
function readForm(){
  return {
    name: $('#pName').value.trim(),
    code: $('#pCode').value.trim(),
    entityType: $('#pEntityType').value,
    entityName: $('#pEntityName').value.trim(),
    responsible: $('#pResponsible').value.trim(),
    role: $('#pRole').value.trim(),
    email: $('#pEmail').value.trim(),
    phone: $('#pPhone').value.trim(),
    status: $('#pStatus').value,
    priority: $('#pPriority').value,
    startDate: $('#pStart').value,
    endDate: $('#pEnd').value,
    progress: Number($('#pProgress').value) || 0,
    notes: $('#pNotes').value.trim()
  };
}
function validate(d){
  let ok = true;
  $$('.field.invalid').forEach(f => f.classList.remove('invalid'));
  if(!d.name){ $('#wrapName').classList.add('invalid'); ok = false; }
  if(!d.responsible){ $('#wrapResp').classList.add('invalid'); ok = false; }
  if(d.startDate && d.endDate && d.endDate < d.startDate){
    $('#wrapEnd').classList.add('invalid'); ok = false;
  }
  if(!ok) toast('يرجى تصحيح الحقول المطلوبة','bad');
  return ok;
}

$('#projectForm').addEventListener('submit', e => {
  e.preventDefault();
  if(!isAdmin()){ toast('لا تملك صلاحية تنفيذ هذه العملية','bad'); return; }
  const data = readForm();
  if(!validate(data)) return;
  const now = new Date().toISOString();
  if(editingId){
    const i = projects.findIndex(p => p.id === editingId);
    if(i > -1) projects[i] = Object.assign({}, projects[i], data, { updatedAt: now });
    toast('تم تحديث المشروع','ok');
  } else {
    projects.unshift(Object.assign({ id: uid(), createdAt: now, updatedAt: now, visits: [] }, data));
    toast('تمت إضافة المشروع','ok');
  }
  closeModal();
  render();
});

$('#pProgress').addEventListener('input', e => {
  $('#pProgressVal').textContent = e.target.value + '%';
});
$('#pResponsible').addEventListener('input', e => {
  const name = e.target.value.trim().toLowerCase();
  const u = users.find(x => x.name.trim().toLowerCase() === name);
  if(u && !$('#pEmail').value.trim()) $('#pEmail').value = u.email;
});
$('#btnCancel').addEventListener('click', closeModal);
$('#btnClose').addEventListener('click', closeModal);
$('#btnNew').addEventListener('click', () => openModal(null));
modal.addEventListener('click', e => { if(e.target === modal) closeModal(); });

/* ===================== مودال التقدم (مستخدم) ===================== */
const progressModal = $('#progressModal');
function openProgressModal(p){
  if(!(isAdmin() || isOwner(p))){ toast('لا تملك صلاحية تعديل هذا المشروع','bad'); return; }
  progressId = p.id;
  $('#pmProject').innerHTML =
    '<div class="p-name">' + esc(p.name) + '</div>' +
    '<div class="cell-sub">' + esc([p.entityName, p.responsible].filter(Boolean).join(' · ') || '—') + '</div>';
  const v = Math.max(0, Math.min(100, Number(p.progress)||0));
  $('#pmProgress').value = v;
  $('#pmProgressVal').textContent = v + '%';
  progressModal.classList.add('open');
  progressModal.setAttribute('aria-hidden','false');
}
function closeProgress(){
  progressModal.classList.remove('open');
  progressModal.setAttribute('aria-hidden','true');
  progressId = null;
}
$('#pmProgress').addEventListener('input', e => {
  $('#pmProgressVal').textContent = e.target.value + '%';
});
$('#pmSave').addEventListener('click', () => {
  const p = projects.find(x => x.id === progressId);
  if(!p){ closeProgress(); return; }
  if(!(isAdmin() || isOwner(p))){ toast('لا تملك صلاحية تعديل هذا المشروع','bad'); closeProgress(); return; }
  const val = Math.max(0, Math.min(100, Number($('#pmProgress').value)||0));
  p.progress = val;
  p.updatedAt = new Date().toISOString();
  closeProgress();
  render();
  toast('تم تحديث نسبة التقدم','ok');
});
$('#pmCancel').addEventListener('click', closeProgress);
$('#pmClose').addEventListener('click', closeProgress);
progressModal.addEventListener('click', e => { if(e.target === progressModal) closeProgress(); });

/* ===================== الزيارات ===================== */
const visitsModal = $('#visitsModal');
const newVisitModal = $('#newVisitModal');
let visitsModalProjectId = null;
let currentThumbs = {};

function closeVisitsModal(){
  visitsModal.classList.remove('open');
  visitsModal.setAttribute('aria-hidden','true');
  visitsModalProjectId = null;
}
$$('[data-close-visits]').forEach(el => el.addEventListener('click', closeVisitsModal));
visitsModal.addEventListener('click', e => { if(e.target === visitsModal) closeVisitsModal(); });

async function openVisitsModal(projectId){
  const p = projects.find(x => x.id === projectId);
  if(!p){ toast('المشروع غير موجود','bad'); return; }
  if(!(isAdmin() || isOwner(p))){ toast('لا تملك صلاحية عرض زيارات هذا المشروع','bad'); return; }

  visitsModalProjectId = projectId;
  $('#visitsTitle').textContent = 'سجل الزيارات — ' + p.name;
  $('#visitsProject').innerHTML =
    '<div class="p-name">' + esc(p.name) + '</div>' +
    '<div class="cell-sub">' + esc([p.entityName, p.responsible].filter(Boolean).join(' · ') || '—') + '</div>';

  $('#visitsNewSection').innerHTML =
    '<div class="new-visit-cta">' +
      '<div class="cta-text">سجّل زيارة جديدة — سيتم ختم الصور بالتاريخ والموقع تلقائياً.</div>' +
      '<button class="btn btn-primary btn-sm" id="btnAddVisit">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>' +
        'تسجيل زيارة' +
      '</button>' +
    '</div>';
  $('#btnAddVisit').addEventListener('click', () => openNewVisit(p.id));

  visitsModal.classList.add('open');
  visitsModal.setAttribute('aria-hidden','false');
  await loadAndRenderVisits(p);
}

async function loadAndRenderVisits(project){
  $('#visitsList').innerHTML = '<div class="photo-processing">جارٍ تحميل الزيارات…</div>';
  const allPhotoIds = (project.visits || []).flatMap(v => v.photoIds || []);
  const photosMap = allPhotoIds.length ? await getPhotosFromDB(allPhotoIds) : {};
  currentThumbs = {};
  Object.keys(photosMap).forEach(id => { currentThumbs[id] = photosMap[id].thumbDataUrl; });
  $('#visitsList').innerHTML = renderVisits(project, currentThumbs);
}

function renderVisits(project, thumbs){
  const visits = (project.visits || []).slice().sort((a,b) => (b.timestamp||'').localeCompare(a.timestamp||''));
  if(!visits.length){
    return '<div class="visit-empty">' +
      '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>' +
        '<circle cx="12" cy="13" r="4"/>' +
      '</svg>' +
      'لم تُسجَّل زيارات لهذا المشروع بعد.' +
    '</div>';
  }
  return visits.map(v => {
    const dateStr = fmtDateTime(v.timestamp);
    const loc = v.location
      ? '<a class="visit-loc" href="https://www.google.com/maps?q=' + v.location.lat + ',' + v.location.lng + '" target="_blank" rel="noopener">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>' +
          v.location.lat.toFixed(5) + ', ' + v.location.lng.toFixed(5) + ' (±' + Math.round(v.location.accuracy) + 'م)' +
        '</a>'
      : '<span class="visit-loc missing">📍 الموقع غير متاح</span>';

    const photos = (v.photoIds || []).map(id => {
      const t = thumbs[id];
      if(!t) return '';
      return '<a class="photo-thumb" data-photo="' + esc(id) + '" title="عرض الصورة"><img src="' + t + '" alt=""></a>';
    }).join('');

    const canDelete = isAdmin() || (currentUser && v.userId === currentUser.id);
    const delBtn = canDelete
      ? '<button class="icon-btn del" data-act="del-visit" data-project="' + project.id + '" data-visit="' + v.id + '" title="حذف الزيارة">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>' +
        '</button>'
      : '';

    return '<div class="visit-card">' +
      '<div class="visit-head">' +
        '<div class="visit-avatar">' + esc((v.userName || '?').charAt(0)) + '</div>' +
        '<div class="visit-meta">' +
          '<strong>' + esc(v.userName || '—') + '</strong>' +
          '<span>' + esc(dateStr) + '</span>' +
        '</div>' +
        delBtn +
      '</div>' +
      loc +
      (v.notes ? '<div class="visit-notes">' + esc(v.notes) + '</div>' : '') +
      (photos ? '<div class="photo-grid">' + photos + '</div>' : '') +
    '</div>';
  }).join('');
}

$('#visitsList').addEventListener('click', async e => {
  const thumb = e.target.closest('[data-photo]');
  if(thumb){
    const id = thumb.dataset.photo;
    try{
      const photo = await getPhotoFromDB(id);
      if(photo && photo.blob){
        const url = URL.createObjectURL(photo.blob);
        const img = $('#lightboxImg');
        if(img.dataset.url) URL.revokeObjectURL(img.dataset.url);
        img.src = url;
        img.dataset.url = url;
        const dl = $('#lightboxDownload');
        dl.href = url;
        dl.download = 'visit-' + id + '.jpg';
        $('#lightbox').classList.add('open');
        $('#lightbox').setAttribute('aria-hidden','false');
      }
    }catch(err){ toast('تعذّر تحميل الصورة','bad'); }
    return;
  }

  const delBtn = e.target.closest('[data-act="del-visit"]');
  if(delBtn){
    await deleteVisit(delBtn.dataset.project, delBtn.dataset.visit);
  }
});

async function deleteVisit(projectId, visitId){
  const p = projects.find(x => x.id === projectId);
  if(!p) return;
  const v = (p.visits || []).find(x => x.id === visitId);
  if(!v) return;
  if(!(isAdmin() || (currentUser && v.userId === currentUser.id))){ toast('لا تملك صلاحية حذف هذه الزيارة','bad'); return; }
const ok = await confirmDialog({
  title: 'حذف الزيارة',
  message: 'حذف هذه الزيارة وجميع صورها؟',
  okText: 'حذف',
  danger: true
});
if(!ok) return;

  await deletePhotosFromDB(v.photoIds || []);
  p.visits = (p.visits || []).filter(x => x.id !== visitId);
  p.updatedAt = new Date().toISOString();
  save();
  await loadAndRenderVisits(p);
  render();
  toast('تم حذف الزيارة','bad');
}

/* ===================== زيارة جديدة ===================== */
let visitModalProjectId = null;
let visitLocation = null;
let visitPhotoQueue = [];
let processingCount = 0;

async function closeNewVisit(force){
  if(!force){
    const hasData = visitPhotoQueue.length > 0 || $('#visitNotes').value.trim() || visitLocation;
    if(hasData){
      const ok = await confirmDialog({
        title: 'زيارة غير محفوظة',
        message: 'لديك زيارة غير محفوظة. هل تريد إغلاقها دون حفظ؟',
        okText: 'إغلاق دون حفظ',
        danger: true
      });
      if(!ok) return;
    }
  }
  newVisitModal.classList.remove('open');
  newVisitModal.setAttribute('aria-hidden','true');
  visitModalProjectId = null;
  visitLocation = null;
  visitPhotoQueue = [];
  processingCount = 0;
}
$$('[data-close-new-visit]').forEach(el => el.addEventListener('click', () => closeNewVisit(false)));
newVisitModal.addEventListener('click', e => { if(e.target === newVisitModal) closeNewVisit(false); });

function openNewVisit(projectId){
  const p = projects.find(x => x.id === projectId);
  if(!p){ toast('المشروع غير موجود','bad'); return; }
  if(!(isAdmin() || isOwner(p))){ toast('لا تملك صلاحية تسجيل زيارة','bad'); return; }

  visitModalProjectId = projectId;
  visitLocation = null;
  visitPhotoQueue = [];
  processingCount = 0;

  $('#visitProject').innerHTML =
    '<div class="p-name">' + esc(p.name) + '</div>' +
    '<div class="cell-sub">' + esc([p.entityName, p.responsible].filter(Boolean).join(' · ') || '—') + '</div>';
  $('#visitNotes').value = '';
  $('#visitPhotoPreview').innerHTML = '';
  $('#visitLocationBox').className = 'location-box pending';
  $('#visitLocationBox').innerHTML = 'جارٍ تحديد الموقع…';
  updateVisitSaveButton();

  newVisitModal.classList.add('open');
  newVisitModal.setAttribute('aria-hidden','false');
  requestVisitLocation();
}

function requestVisitLocation(){
  const box = $('#visitLocationBox');
  if(!navigator.geolocation){
    visitLocation = null;
    box.className = 'location-box err';
    box.innerHTML = '<span>⚠️ المتصفح لا يدعم تحديد الموقع — يمكنك المتابعة بدونه</span>';
    return;
  }
  box.className = 'location-box pending';
  box.innerHTML = 'جارٍ تحديد الموقع… (قد يستغرق لحظات)';

  navigator.geolocation.getCurrentPosition(
    pos => {
      visitLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
      box.className = 'location-box ok';
      box.innerHTML =
        '<span>📍 ' + visitLocation.lat.toFixed(5) + ', ' + visitLocation.lng.toFixed(5) + ' (±' + Math.round(visitLocation.accuracy) + 'م)</span>' +
        '<a href="https://www.google.com/maps?q=' + visitLocation.lat + ',' + visitLocation.lng + '" target="_blank" rel="noopener">فتح في الخريطة</a>';
    },
    err => {
      visitLocation = null;
      const msg = err.code === 1 ? 'تم رفض إذن الموقع'
                : err.code === 2 ? 'الموقع غير متاح'
                : 'انتهت مهلة تحديد الموقع';
      box.className = 'location-box err';
      box.innerHTML = '<span>⚠️ ' + msg + ' — يمكنك المتابعة بدون موقع</span>';
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
  );
}

function updateVisitSaveButton(){
  const btn = $('#btnSaveVisit');
  if(!btn) return;
  if(processingCount > 0){
    btn.disabled = true;
    btn.textContent = 'جارٍ معالجة الصور…';
  } else {
    btn.disabled = false;
    btn.textContent = 'حفظ الزيارة';
  }
}

async function handlePhotoFiles(files){
  if(!files || !files.length) return;
  const p = projects.find(x => x.id === visitModalProjectId);
  if(!p) return;

  const remaining = MAX_PHOTOS_PER_VISIT - visitPhotoQueue.length;
  if(remaining <= 0){ toast('الحد الأقصى ' + MAX_PHOTOS_PER_VISIT + ' صور لكل زيارة','bad'); return; }

  const arr = Array.from(files).filter(f => f.type && f.type.startsWith('image/'));
  const toProcess = arr.slice(0, remaining);
  if(toProcess.length < arr.length){
    toast('سيتم رفع ' + toProcess.length + ' صورة (الحد ' + MAX_PHOTOS_PER_VISIT + ')','info');
  }

  for(const file of toProcess){
    if(file.size > 15 * 1024 * 1024){
      toast('صورة كبيرة جداً (>15MB) تم تجاهلها','bad');
      continue;
    }
    processingCount++;
    updateVisitSaveButton();
    try{
      const processed = await processPhoto(file, {
        location: visitLocation,
        userName: currentUser.name,
        projectName: p.name
      });
      visitPhotoQueue.push(processed);
      renderVisitPreview();
    }catch(err){
      toast('تعذّرت معالجة صورة','bad');
    }finally{
      processingCount--;
      updateVisitSaveButton();
    }
  }
}

function renderVisitPreview(){
  const wrap = $('#visitPhotoPreview');
  wrap.innerHTML = visitPhotoQueue.map((item, idx) =>
    '<div class="photo-thumb-wrap">' +
      '<div class="photo-thumb"><img src="' + item.thumbDataUrl + '" alt=""></div>' +
      '<button type="button" class="photo-remove" data-idx="' + idx + '" title="إزالة">×</button>' +
    '</div>'
  ).join('');
}

$('#visitPhotoPreview').addEventListener('click', e => {
  const btn = e.target.closest('[data-idx]');
  if(!btn) return;
  const idx = Number(btn.dataset.idx);
  if(idx >= 0 && idx < visitPhotoQueue.length){
    visitPhotoQueue.splice(idx, 1);
    renderVisitPreview();
  }
});

$('#btnTakePhoto').addEventListener('click', () => $('#visitCamInput').click());
$('#btnChoosePhotos').addEventListener('click', () => $('#visitFileInput').click());
$('#visitCamInput').addEventListener('change', async e => {
  await handlePhotoFiles(e.target.files);
  e.target.value = '';
});
$('#visitFileInput').addEventListener('change', async e => {
  await handlePhotoFiles(e.target.files);
  e.target.value = '';
});
$('#btnRetryLoc').addEventListener('click', requestVisitLocation);

$('#btnSaveVisit').addEventListener('click', async () => {
  const p = projects.find(x => x.id === visitModalProjectId);
  if(!p){ closeNewVisit(true); return; }
  if(!(isAdmin() || isOwner(p))){ toast('لا تملك صلاحية','bad'); closeNewVisit(true); return; }
  if(processingCount > 0){ toast('انتظر انتهاء معالجة الصور','info'); return; }

  const notes = $('#visitNotes').value.trim();
  const photos = visitPhotoQueue.slice();
  if(!visitLocation && !photos.length && !notes){
    toast('أضف موقعاً أو صورة أو ملاحظة على الأقل','bad');
    return;
  }

  const btn = $('#btnSaveVisit');
  btn.disabled = true;
  btn.textContent = 'جارٍ الحفظ…';

  try{
    const photoIds = [];
    for(const ph of photos){
      const id = photoUid();
      try{
        await savePhotoInDB({
          id,
          projectId: p.id,
          userId: currentUser.id,
          userName: currentUser.name,
          blob: ph.blob,
          thumbDataUrl: ph.thumbDataUrl,
          capturedAt: new Date().toISOString(),
          location: visitLocation
        });
        photoIds.push(id);
      }catch(e){
        console.error('photo save failed', e);
      }
    }

    const visit = {
      id: visitUid(),
      userId: currentUser.id,
      userName: currentUser.name,
      timestamp: new Date().toISOString(),
      notes,
      location: visitLocation,
      photoIds
    };

    if(!Array.isArray(p.visits)) p.visits = [];
    p.visits.push(visit);
    p.updatedAt = new Date().toISOString();

    save();
    closeNewVisit(true);
    toast('تم حفظ الزيارة','ok');

    if(visitsModalProjectId === p.id){
      await loadAndRenderVisits(p);
    }
    render();
  }catch(err){
    console.error(err);
    toast('تعذّر حفظ الزيارة','bad');
  }finally{
    btn.disabled = false;
    btn.textContent = 'حفظ الزيارة';
  }
});

/* ===================== Lightbox ===================== */
function closeLightbox(){
  const img = $('#lightboxImg');
  if(img.dataset.url){ URL.revokeObjectURL(img.dataset.url); img.dataset.url = ''; }
  img.src = '';
  $('#lightbox').classList.remove('open');
  $('#lightbox').setAttribute('aria-hidden','true');
}
$('#lightboxClose').addEventListener('click', closeLightbox);
$('#lightbox').addEventListener('click', e => { if(e.target.id === 'lightbox') closeLightbox(); });

/* ===================== مودال المستخدمين ===================== */
const usersModal = $('#usersModal');

function renderUsersModal(){
  const list = $('#usersList');
  if(!list) return;
  const admin = isAdmin();

  const note = $('#usersModalNote');
  if(note){
    note.textContent = admin
      ? 'يمكنك إنشاء مستخدمين جدد، ترقية الصلاحيات، إعادة تعيين كلمات المرور، وحذف الحسابات. لا يمكنك تعديل صلاحيتك أو حذف حسابك الحالي.'
      : 'قائمة المستخدمين — للعرض فقط. لإنشاء حساب أو تغيير كلمة المرور، يرجى التواصل مع مدير النظام.';
  }

  if(!users.length){
    list.innerHTML = '<div class="visit-empty">لا يوجد مستخدمون.</div>';
    return;
  }

  list.innerHTML = users.map(u => {
    const isMe = currentUser && u.id === currentUser.id;
    const roleLabel = u.role === 'admin' ? 'مدير' : 'مستخدم';
    const roleBadge = u.role === 'admin' ? 'high' : 'planned';

    const main =
      '<div class="u-avatar">' + esc((u.name||'?').trim().charAt(0)) + '</div>' +
      '<div class="u-main">' +
        '<strong>' + esc(u.name) + (isMe ? ' (أنت)' : '') + '</strong>' +
        '<span>' + esc(u.email) + '</span>' +
      '</div>';

    if(!admin){
      return '<div class="user-row">' + main +
        '<span class="badge ' + roleBadge + '">' + roleLabel + '</span>' +
      '</div>';
    }

    const pwBtn =
      '<button class="icon-btn" data-pw-user="' + u.id + '" title="تغيير كلمة المرور">' +
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<circle cx="8" cy="15" r="4"/><path d="M10.85 12.15L19 4"/><path d="M18 5l2 2"/><path d="M15 8l2 2"/>' +
        '</svg>' +
      '</button>';

    const delBtn =
      '<button class="icon-btn del" data-del-user="' + u.id + '"' + (isMe ? ' disabled' : '') + ' title="حذف">' +
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>' +
      '</button>';

    return '<div class="user-row">' + main +
      '<select class="filter" data-role-for="' + u.id + '"' + (isMe ? ' disabled' : '') + '>' +
        '<option value="user"' + (u.role === 'user' ? ' selected' : '') + '>مستخدم</option>' +
        '<option value="admin"' + (u.role === 'admin' ? ' selected' : '') + '>مدير</option>' +
      '</select>' +
      pwBtn +
      delBtn +
    '</div>';
  }).join('');
}

const btnUsersEl = $('#btnUsers');
if(btnUsersEl){
  btnUsersEl.addEventListener('click', async () => {
    if(!currentUser){ toast('يرجى تسجيل الدخول أولاً','bad'); return; }  // ← was isAdmin()
    users = await sbFetchAllProfiles();
    renderUsersModal();
    usersModal.classList.add('open');
    usersModal.setAttribute('aria-hidden','false');
  });
}

const usersListEl = $('#usersList');
if(usersListEl){
  usersListEl.addEventListener('change', e => {
    const sel = e.target.closest('select[data-role-for]');
    if(!sel) return;
    if(!isAdmin()){ toast('متاح لمدير النظام فقط','bad'); renderUsersModal(); return; }
    const u = users.find(x => x.id === sel.dataset.roleFor);
    if(!u || (currentUser && u.id === currentUser.id)) return;
    u.role = sel.value === 'admin' ? 'admin' : 'user';
    saveUsers();
    toast('تم تحديث صلاحية ' + u.name, 'ok');
  });

  usersListEl.addEventListener('click', async e => {
  const pwBtn = e.target.closest('button[data-pw-user]');
  if(pwBtn){
    const u = users.find(x => x.id === pwBtn.dataset.pwUser);
    if(u) openPwModal(u);
    return;
  }

  const btn = e.target.closest('button[data-del-user]');
  if(!btn) return;
  if(!isAdmin()){ toast('متاح لمدير النظام فقط','bad'); return; }
  const u = users.find(x => x.id === btn.dataset.delUser);
  if(!u) return;
  if(currentUser && u.id === currentUser.id) return;

  const ok = await confirmDialog({
    title: 'حذف المستخدم',
    message: 'حذف المستخدم «' + u.name + '»؟\n\nلن تُحذف مشاريعه، لكنه لن يستطيع الدخول بعد الآن.',
    okText: 'حذف',
    danger: true
  });
  if(!ok) return;

  users = users.filter(x => x.id !== u.id);
  saveUsers();
  renderUsersModal();
  toast('تم حذف المستخدم', 'bad');
});
}

/* ===================== إنشاء مستخدم (مدير) ===================== */
const btnShowNewUserEl = $('#btnShowNewUser');
if(btnShowNewUserEl){
  btnShowNewUserEl.addEventListener('click', () => {
    if(!isAdmin()) return;
    const f = $('#newUserForm');
    if(!f) return;
    f.classList.toggle('hidden');
    if(!f.classList.contains('hidden')){
      $('#nuName').value = '';
      $('#nuEmail').value = '';
      $('#nuPw').value = '';
      $('#nuRole').value = 'user';
      $('#nuErr').classList.remove('show');
      $('#nuErr').textContent = '';
      setTimeout(() => $('#nuName').focus(), 60);
    }
  });
}

const btnCancelNewUserEl = $('#btnCancelNewUser');
if(btnCancelNewUserEl){
  btnCancelNewUserEl.addEventListener('click', () => {
    const f = $('#newUserForm');
    if(f) f.classList.add('hidden');
  });
}

const newUserFormEl = $('#newUserForm');
if(newUserFormEl){
  newUserFormEl.addEventListener('submit', async e => {
    e.preventDefault();
    if(!isAdmin()){ toast('متاح لمدير النظام فقط','bad'); return; }
    const name = $('#nuName').value.trim();
    const email = $('#nuEmail').value.trim();
    const password = $('#nuPw').value;
    const role = $('#nuRole').value;
    const err = $('#nuErr');
    err.classList.remove('show'); err.textContent = '';

    if(!name){ err.textContent = 'الاسم مطلوب.'; err.classList.add('show'); return; }
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ err.textContent = 'البريد الإلكتروني غير صالح.'; err.classList.add('show'); return; }
    if(password.length < 6){ err.textContent = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.'; err.classList.add('show'); return; }

    const btn = $('#btnSaveNewUser');
    const old = btn.textContent;
    btn.disabled = true; btn.textContent = 'جارٍ الإنشاء…';
    try{
      await createUser({ name, email, password, role });
      $('#newUserForm').classList.add('hidden');
      renderUsersModal();
      toast('تم إنشاء المستخدم', 'ok');
    }catch(err2){
      err.textContent = err2.message || 'تعذّر إنشاء المستخدم.';
      err.classList.add('show');
    }finally{
      btn.disabled = false; btn.textContent = old;
    }
  });
}

/* ===================== تغيير كلمة المرور (مدير) ===================== */
const pwModal = $('#pwModal');
let pwUserId = null;

function openPwModal(u){
  if(!isAdmin()){ toast('متاح لمدير النظام فقط','bad'); return; }
  if(!u || !pwModal) return;
  pwUserId = u.id;
  $('#pwUserInfo').innerHTML =
    '<div class="p-name">' + esc(u.name) + '</div>' +
    '<div class="cell-sub">' + esc(u.email) + '</div>';
  const unField = $('#pwUsername');
  if(unField) unField.value = u.email || '';
  $('#pwNew').value = '';
  $('#pwNew2').value = '';
  $('#pwErr').classList.remove('show'); $('#pwErr').textContent = '';
  pwModal.classList.add('open');
  pwModal.setAttribute('aria-hidden','false');
  setTimeout(() => $('#pwNew').focus(), 60);
}
function closePwModal(){
  if(!pwModal) return;
  pwModal.classList.remove('open');
  pwModal.setAttribute('aria-hidden','true');
  pwUserId = null;
}

const pwCloseEl  = $('#pwClose');  if(pwCloseEl)  pwCloseEl.addEventListener('click', closePwModal);
const pwCancelEl = $('#pwCancel'); if(pwCancelEl) pwCancelEl.addEventListener('click', closePwModal);

if(pwModal){
  pwModal.addEventListener('click', e => { if(e.target === pwModal) closePwModal(); });
}

async function savePw(){
  if(!isAdmin()){ toast('متاح لمدير النظام فقط','bad'); return; }
  const u = users.find(x => x.id === pwUserId);
  if(!u){ closePwModal(); return; }
  const pw  = $('#pwNew').value;
  const pw2 = $('#pwNew2').value;
  const err = $('#pwErr');
  err.classList.remove('show'); err.textContent = '';
  if(pw.length < 6){ err.textContent = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.'; err.classList.add('show'); return; }
  if(pw !== pw2){ err.textContent = 'كلمتا المرور غير متطابقتين.'; err.classList.add('show'); return; }

  const btn = $('#pwSave');
  const old = btn.textContent;
  btn.disabled = true; btn.textContent = 'جارٍ الحفظ…';
  try{
    const salt = randomSalt();
    const hash = await hashPw(pw, salt);
    u.salt = salt;
    u.hash = hash;
    saveUsers();
    closePwModal();
    toast('تم تحديث كلمة المرور', 'ok');
  }catch(_){
    err.textContent = 'تعذّر تحديث كلمة المرور.';
    err.classList.add('show');
  }finally{
    btn.disabled = false; btn.textContent = old;
  }
}

const pwFormEl = $('#pwForm');
if(pwFormEl){
  pwFormEl.addEventListener('submit', e => { e.preventDefault(); savePw(); });
} else {
  const pwSaveEl = $('#pwSave');
  if(pwSaveEl) pwSaveEl.addEventListener('click', savePw);
}

$$('[data-close-users]').forEach(el => {
  el.addEventListener('click', () => {
    if(!usersModal) return;
    usersModal.classList.remove('open');
    usersModal.setAttribute('aria-hidden','true');
  });
});
if(usersModal){
  usersModal.addEventListener('click', e => {
    if(e.target === usersModal){
      usersModal.classList.remove('open');
      usersModal.setAttribute('aria-hidden','true');
    }
  });
}