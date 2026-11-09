/* ===================== app.js =====================
   يقدّم:  كل ما يستجيب لحدث — الإجراءات، تصدير/استيراد/مسح،
            لوحة المفاتيح، والإقلاع النهائي.
   يعتمد على: core.js, ui.js (يجب أن يأتي أخيراً).
   ==================================================== */

/* ===================== الإجراءات على المشاريع ===================== */
async function deleteProjectPhotos(project){
  const ids = (project.visits || []).flatMap(v => v.photoIds || []);
  await deletePhotosFromDB(ids);
}

async function handleAction(act, id){
  const p = projects.find(x => x.id === id);
  if(!p) return;

  if(act === 'visits'){ openVisitsModal(p.id); return; }
  if(act === 'progress'){ openProgressModal(p); return; }

  if(!isAdmin()){
    toast('هذه العملية متاحة لمدير النظام فقط','bad');
    return;
  }

  if(act === 'edit'){ openModal(p); }
  else if(act === 'copy'){
    const now = new Date().toISOString();
    const copy = Object.assign({}, p, {
      id: uid(),
      name: p.name + ' (نسخة)',
      visits: [],
      createdAt: now, updatedAt: now
    });
    const i = projects.findIndex(x => x.id === id);
    projects.splice(i + 1, 0, copy);
    render();
    toast('تم نسخ المشروع','info');
  }
    else if(act === 'del'){
    const ok = await confirmDialog({
      title: 'حذف المشروع',
      message: 'هل تريد حذف المشروع «' + p.name + '»؟\n\nسيتم أيضاً حذف جميع زياراته وصوره. لا يمكن التراجع.',
      okText: 'حذف',
      danger: true
    });
    if(!ok) return;
    for(const v of (p.visits || [])){
      for(const photoId of (v.photoIds || [])){
        await enqueueSync('photo', 'delete', { projectId: p.id, photoId }, p.id);
      }
    }
    await deleteProjectPhotos(p);
    projects = projects.filter(x => x.id !== id);
    render();
    toast('تم حذف المشروع','bad');
  }
}

document.addEventListener('click', e => {
  const btn = e.target.closest('button[data-act]');
  if(!btn) return;
  // أزرار data-act="del-visit" تُعالجها ui.js؛ هنا نتجاهلها بحذر:
  if(btn.dataset.act === 'del-visit') return;
  handleAction(btn.dataset.act, btn.dataset.id);
});

/* ===================== الفلاتر ===================== */
['#search','#filterStatus','#filterPriority','#filterEntity','#filterSort'].forEach(sel => {
  const el = $(sel);
  el.addEventListener(sel === '#search' ? 'input' : 'change', () => {
    renderTable();
    renderStats();
  });
});

/* ===================== زر التذكيرات ===================== */
$('#btnRemind').addEventListener('click', () => {
  const panel = $('#reminderPanel');
  panel.scrollIntoView({ behavior:'smooth', block:'center' });
  panel.style.transition = 'box-shadow .3s';
  panel.style.boxShadow = '0 0 0 4px rgba(20,80,122,.25)';
  setTimeout(() => { panel.style.boxShadow = ''; }, 1200);
  if(!attentionList().length) toast('لا توجد مواعيد بحاجة إلى متابعة','ok');
});

/* ===================== تصدير / استيراد / مسح ===================== */
function download(filename, content, type){
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

$('#btnJson').addEventListener('click', () => {
  if(!isAdmin()) return;
  if(!projects.length) return toast('لا توجد مشاريع للتصدير','bad');
  download('projects-' + todayISO() + '.json', JSON.stringify(projects, null, 2), 'application/json');
  toast('تم تنزيل النسخة الاحتياطية','ok');
});

$('#btnCsv').addEventListener('click', () => {
  if(!isAdmin()) return;
  if(!projects.length) return toast('لا توجد مشاريع للتصدير','bad');
  const cols = ['name','code','entityType','entityName','responsible','role','email','phone','status','priority','startDate','endDate','progress','notes'];
  const head = cols.join(',');
  const rows = projects.map(p => cols.map(c => {
    const v = p[c] == null ? '' : String(p[c]);
    return '"' + v.replace(/"/g,'""') + '"';
  }).join(','));
  download('projects-' + todayISO() + '.csv', '\ufeff' + head + '\n' + rows.join('\n'), 'text/csv;charset=utf-8');
  toast('تم تصدير CSV','ok');
});

$('#btnImport').addEventListener('click', () => {
  if(!isAdmin()) return;
  $('#fileImport').click();
});

$('#fileImport').addEventListener('change', e => {
  if(!isAdmin()) return;
  const file = e.target.files && e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try{
      const arr = JSON.parse(reader.result);
      if(!Array.isArray(arr)) throw new Error('الملف يجب أن يحتوي على مصفوفة JSON');
      const clean = arr
        .filter(x => x && typeof x.name === 'string' && x.name.trim())
        .map(x => Object.assign(blank(), x, { id: x.id || uid(), visits: Array.isArray(x.visits) ? x.visits : [] }));
      if(!clean.length) throw new Error('لا توجد مشاريع صالحة في الملف');
      const ok = await confirmDialog({
        title: 'استيراد البيانات',
        message: 'سيتم استيراد ' + clean.length + ' مشروع واستبدال ' + projects.length + ' مشروع حالي. هل تريد المتابعة؟',
        okText: 'استيراد'
      });
      if(!ok) return;
      projects = clean;
      render();
      toast('تم استيراد ' + clean.length + ' مشروع','ok');
    }catch(err){
      toast('فشل الاستيراد: ' + err.message,'bad');
    }finally{
      e.target.value = '';
    }
  };
  reader.readAsText(file);
});

$('#btnClear').addEventListener('click', async () => {
  if(!isAdmin()) return;
  if(!projects.length) return toast('القائمة فارغة بالفعل','info');
  const ok = await confirmDialog({
    title: 'حذف جميع المشاريع',
    message: 'سيتم حذف جميع المشاريع (' + projects.length + ') بما فيها الزيارات والصور. هل أنت متأكد؟\n\nلا يمكن التراجع.',
    okText: 'حذف الكل',
    danger: true
  });
  if(!ok) return;
  for(const p of projects){ await deleteProjectPhotos(p); }
  projects = [];
  render();
  toast('تم حذف جميع المشاريع','bad');
});

/* ===================== لوحة المفاتيح ===================== */
document.addEventListener('keydown', e => {
  if(e.key !== 'Escape') return;
  if($('#confirmModal') && $('#confirmModal').classList.contains('open')) return;
  if($('#lightbox').classList.contains('open')){ closeLightbox(); return; }
  if(newVisitModal.classList.contains('open')){ closeNewVisit(false); return; }
  if(visitsModal.classList.contains('open')){ closeVisitsModal(); return; }
  if(modal.classList.contains('open')){ closeModal(); }
  if(progressModal.classList.contains('open')) closeProgress();
  if($('#pwModal').classList.contains('open')){ closePwModal(); return; }
  if(usersModal.classList.contains('open')){
    usersModal.classList.remove('open');
    usersModal.setAttribute('aria-hidden','true');
  }
});

/* ===================== الإقلاع ===================== */
(async function init(){
  try{ await openDB(); }catch(e){ /* photos will fail; app still works */ }
  await bootAuth();
  if(currentUser){ startApp(); }
  else { showAuth(); }
})();
/* ===================== PWA install ===================== */
const btnInstall = document.getElementById('btnInstall');

function isStandalone(){
  return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
}
function isIOS(){
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
function showInstallBtn(){ if(btnInstall) btnInstall.style.display = ''; }
function hideInstallBtn(){ if(btnInstall) btnInstall.style.display = 'none'; }

/* Use the early-captured event from <head>, or a fresh one */
function getDeferredPrompt(){
  return window.__pwaDeferredPrompt || null;
}
window.addEventListener('pwa-prompt-ready', () => {
  console.log('[PWA] prompt ready (early capture) ✅');
  showInstallBtn();
});
window.addEventListener('beforeinstallprompt', e => {
  /* fallback if <head> capture didn't run */
  e.preventDefault();
  window.__pwaDeferredPrompt = e;
  showInstallBtn();
});
window.addEventListener('appinstalled', () => {
  window.__pwaDeferredPrompt = null;
  hideInstallBtn();
  toast('تم تثبيت التطبيق — يمكنك فتحه من الشاشة الرئيسية', 'ok');
});

if (isStandalone()) {
  /* already installed — nothing to do */
} else if (isIOS()) {
  /* iOS never fires the event — show manual guide */
  showInstallBtn();
} else {
  /* Always show the button shortly after load, regardless of the event.
     Desktop Chrome increasingly doesn't fire beforeinstallprompt; the
     button still works via the manual fallback path below. */
  setTimeout(showInstallBtn, 800);
}

if (btnInstall) {
  btnInstall.addEventListener('click', async () => {
    const dp = getDeferredPrompt();
    if (dp) {
      dp.prompt();
      const { outcome } = await dp.userChoice;
      window.__pwaDeferredPrompt = null;
      hideInstallBtn();
      if (outcome !== 'accepted') {
        toast('يمكنك التثبيت لاحقاً من قائمة المتصفح (⋮ → تثبيت التطبيق)', 'info');
      }
      return;
    }
    if (isIOS()) { showIOSInstallGuide(); return; }
    toast('افتح قائمة المتصفح (⋮) واختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»', 'info');
  });
}

function showIOSInstallGuide(){
  if (document.querySelector('.ios-install-guide')) return;
  const div = document.createElement('div');
  div.className = 'ios-install-guide';
  div.innerHTML =
    '<strong>تثبيت التطبيق على iPhone / iPad</strong>' +
    '<ol>' +
      '<li>افتح القائمة من زر المشاركة <code>⬆️</code> في Safari</li>' +
      '<li>اختر <strong>«إضافة إلى الشاشة الرئيسية»</strong></li>' +
      '<li>اضغط <strong>«إضافة»</strong> في الأعلى</li>' +
    '</ol>' +
    '<button class="btn btn-primary btn-sm" type="button">فهمت</button>';
  document.body.appendChild(div);
  div.querySelector('button').onclick = () => div.remove();
}