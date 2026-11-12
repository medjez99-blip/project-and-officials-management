# OPERATIONS — دليل التشغيل والصيانة

دليل موحد لكل ما يلزم لتشغيل، نسخ، صيانة، وإصلاح بوابة متابعة مشاريع البنية التحتية.
الغرض: أن يتمكن مطور جديد من إعادة بناء النظام من الصفر خلال ساعة، وأن
يتمكن مشغّل النظام من حل المشاكل اليومية دون الرجوع إلى تاريخ التطوير.

---

## 0. TL;DR — لمحة سريعة

| العنصر | القيمة |
|---|---|
| نوع التطبيق | موقع ويب ثابت (HTML/CSS/JS) + طبقة مزامنة Supabase |
| الاستضافة | Netlify (static) |
| قاعدة البيانات | Supabase Postgres |
| المصادقة | Supabase Auth (email/password) |
| الصور | Supabase Storage (bucket `visit-photos` خاص) |
| Edge Function | `admin-users` (إنشاء/حذف/تعديل مستخدمين) |
| المتصفح | local-first: localStorage + IndexedDB + قائمة انتظار |
| صلاحيات | `admin` (كل المشاريع) · `user` (مشاريعه فقط) |
| SW الحالي | `v25` |

**بدء سريع لأول مرة:**
1. أنشئ مشروع Supabase.
2. نفّذ SQL (§2.3) ثم SQL التخزين (§2.4).
3. اضبط Auth (§2.5)، انشر Edge Function (§2.6)، أنشئ أول مسؤول متابعة المشاريع (§2.7).
4. الصق URL + anon key في `config.js` (§2.8).
5. ارفع إلى Netlify (§2.9). سجّل الدخول.

---

## 1. المعمارية

```
┌─────────────────────────────────────────────────────┐
│ Browser                                             │
│  ┌──────────────┐    ┌────────────────────┐         │
│  │ localStorage │    │ IndexedDB          │         │
│  │  projects    │    │  photos (blobs)    │         │
│  │  tombstones  │    │  sync_queue        │         │
│  └──────────────┘    └────────────────────┘         │
│           │                    │                    │
│           ▼                    ▼                    │
│  ┌─────────────────────────────────────────┐        │
│  │ App logic (core.js / ui.js / app.js)    │        │
│  │  · render() → saveWithSync()            │        │
│  │  · flushQueue() every 30s / focus / online │     │
│  │  · pullFromSupabase() on boot / focus   │        │
│  └─────────────────────────────────────────┘        │
└────────────────────┬────────────────────────────────┘
                     │ HTTPS
                     ▼
┌─────────────────────────────────────────────────────┐
│ Supabase                                            │
│  · Auth: email/password, sessions                   │
│  · Postgres: projects, profiles (RLS enforced)      │
│  · Storage: visit-photos (private, 4 RLS policies) │
│  · Edge Function: admin-users (service_role side)   │
└─────────────────────────────────────────────────────┘
```

**مبدأ العمل:**
- كل كتابة تُحفظ فوراً محلياً ثم تُدرج في `sync_queue`.
- Flusher يدفع القائمة إلى Supabase (كل 30 ثانية + عند العودة للاتصال + عند التركيز).
- `pullFromSupabase` يُنزّل المشاريع البعيدة ويدمجها بـ **Last-Write-Wins** حسب `updatedAt`.
- أي عنصر في الطابور له `projectId` لا يُدهس أثناء الدمج (يكسب المحلي).
- الحذف يُسجَّل كـ **tombstone** في localStorage قبل الإدراج في الطابور، فحتى لو أعيد التحميل في منتصف العملية لا يعود المشروع.

---

## 2. تنصيب مشروع Supabase من الصفر

### 2.1 المتطلبات
- حساب على <https://supabase.com/dashboard>.
- المتصفح (لا حاجة لـ CLI — كل شيء عبر لوحة التحكم).
- مشروع موجود على Netlify (أو GitHub Pages).

### 2.2 إنشاء المشروع
1. **New project** → اسم `project-and-officials-management`.
2. **Database Password** → احفظها في مدير كلمات مرور.
3. **Region** → الأقرب للمستخدمين.
4. انتظر ~2 دقيقة حتى يجهز.

احفظ من **Settings → API**:
- `Project URL` (مثل `https://xxxxxxxx.supabase.co`)
- `anon / public` key
- `service_role` key (لا يوضع في الواجهة أبداً — Edge Function تحصل عليه تلقائياً)

### 2.3 الجداول + سياسات RLS (SQL النهائي)

**SQL Editor → + New query → الصق → Run:**

```sql
-- ════════════════════════════════════════════════════════════
-- 1. الجداول
-- ════════════════════════════════════════════════════════════
create table public.projects (
  id text primary key,
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text,
  role text not null default 'user' check (role in ('admin','user')),
  created_at timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════
-- 2. دوال مساعدة
-- ════════════════════════════════════════════════════════════
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.prevent_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Only admins can change roles';
  end if;
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    'user'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ════════════════════════════════════════════════════════════
-- 3. Triggers
-- ════════════════════════════════════════════════════════════
create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

create trigger profiles_prevent_role_change
before update on public.profiles
for each row execute function public.prevent_role_change();

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ════════════════════════════════════════════════════════════
-- 4. RLS — projects
-- ════════════════════════════════════════════════════════════
alter table public.projects enable row level security;

create policy "projects_select_own_or_admin"
on public.projects for select to authenticated
using (owner_id = auth.uid() or public.is_admin());

create policy "projects_insert_own"
on public.projects for insert to authenticated
with check (owner_id = auth.uid() or public.is_admin());

create policy "projects_update_own_or_admin"
on public.projects for update to authenticated
using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

create policy "projects_delete_own_or_admin"
on public.projects for delete to authenticated
using (owner_id = auth.uid() or public.is_admin());

-- ════════════════════════════════════════════════════════════
-- 5. RLS — profiles
-- ════════════════════════════════════════════════════════════
alter table public.profiles enable row level security;

create policy "profiles_select_authenticated"
on public.profiles for select to authenticated using (true);

create policy "profiles_update_self"
on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

create policy "profiles_delete_admin"
on public.profiles for delete to authenticated
using (public.is_admin());
```

### 2.4 Storage bucket + سياساته

**Storage → New bucket → `visit-photos` (private, file size limit 15 MB).**

**ثم SQL Editor:**

```sql
-- Helper: صلاحية الوصول إلى مسار ضمن مشروع
create or replace function public.user_owns_project_path(path text)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.projects
    where id = split_part(path, '/', 1)
      and owner_id = auth.uid()
  );
$$;

-- Helper: المالك أو المدير
create or replace function public.user_can_access_project_path(path text)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.projects
    where id = split_part(path, '/', 1)
      and (owner_id = auth.uid() or public.is_admin())
  );
$$;

create policy "visit_photos_select"
on storage.objects for select to authenticated
using (bucket_id = 'visit-photos' and public.user_can_access_project_path(name));

create policy "visit_photos_insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'visit-photos' and public.user_can_access_project_path(name));

create policy "visit_photos_update"
on storage.objects for update to authenticated
using (bucket_id = 'visit-photos' and public.user_can_access_project_path(name))
with check (bucket_id = 'visit-photos' and public.user_can_access_project_path(name));

create policy "visit_photos_delete"
on storage.objects for delete to authenticated
using (bucket_id = 'visit-photos' and public.user_can_access_project_path(name));
```

> ⚠️ **لا تنفّذ** `alter table storage.objects enable row level security;` — الجدول مملوك لـ Supabase ودائماً RLS مُفعّل عليه. أي محاولة تعديل ترمي `42501: must be owner of table objects`.

### 2.5 إعدادات Auth

**Authentication → Settings:**
- **Allow new users to sign up** → **OFF** (لا تسجيل عام).
- **Confirm email** → **OFF** (المدير يُنشئ المستخدمين بـ `email_confirm: true`).

**Site URL** (تحت Authentication → URL Configuration):
- `https://project-and-officials-management.netlify.app`

### 2.6 نشر Edge Function `admin-users`

**Edge Functions → Deploy a new function → Via Editor.**
- Name: `admin-users`
- الصق هذا الكود بالكامل، ثم Deploy:

```typescript
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization' }, 401);

    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userSb = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userSb.auth.getUser();
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401);

    const adminSb = createClient(url, serviceKey);
    const { data: profile } = await adminSb
      .from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (!profile || profile.role !== 'admin') return json({ error: 'Forbidden: admin only' }, 403);

    const body = await req.json();
    const action = body?.action;

    if (action === 'create') {
      const { name, email, password, role } = body;
      if (!name || !email || !password) return json({ error: 'Missing name, email, or password' }, 400);
      if (String(password).length < 6) return json({ error: 'Password must be at least 6 characters' }, 400);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Invalid email' }, 400);

      const { data: created, error: cErr } = await adminSb.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { name },
      });
      if (cErr) return json({ error: cErr.message }, 400);

      if (role === 'admin') {
        await adminSb.from('profiles').update({ role: 'admin' }).eq('id', created.user.id);
      }
      return json({ ok: true, id: created.user.id });
    }

    if (action === 'reset-password') {
      const { userId, password } = body;
      if (!userId || !password) return json({ error: 'Missing userId or password' }, 400);
      if (String(password).length < 6) return json({ error: 'Password must be at least 6 characters' }, 400);

      const { error: rErr } = await adminSb.auth.admin.updateUserById(userId, { password });
      if (rErr) return json({ error: rErr.message }, 400);
      return json({ ok: true });
    }

    if (action === 'delete-user') {
      const { userId } = body;
      if (!userId) return json({ error: 'Missing userId' }, 400);
      if (userId === user.id) return json({ error: 'Cannot delete yourself' }, 400);

      const { error: dErr } = await adminSb.auth.admin.deleteUser(userId);
      if (dErr) return json({ error: dErr.message }, 400);
      return json({ ok: true });
    }

    if (action === 'change-role') {
      const { userId, role } = body;
      if (!userId || !['admin', 'user'].includes(role)) return json({ error: 'Missing userId or role' }, 400);
      if (userId === user.id) return json({ error: 'Cannot change your own role' }, 400);

      const { error: rErr } = await adminSb.from('profiles').update({ role }).eq('id', userId);
      if (rErr) return json({ error: rErr.message }, 400);
      return json({ ok: true });
    }

    return json({ error: 'Unknown action: ' + action }, 400);
  } catch (e) {
    return json({ error: (e as Error).message || String(e) }, 500);
  }
});
```

> **لا تضع** `service_role` في أي ملف يُنزَّل للمتصفح. Supabase تُمرّرها تلقائياً كمتغيّر بيئة داخل الدالة فقط.

### 2.7 إنشاء أول تقني admin

**Authentication → Users → Add user → Create new user:**
- Email: `you@yourdomain.com`
- Password: (قوية)
- ☑ Auto Confirm User

**احصل على `UUID` الخاص به** (انسخه من الجدول).

**SQL Editor:**

```sql
insert into public.profiles (id, name, email, role) values
  ('PASTE_UUID_HERE', 'المدير', 'you@yourdomain.com', 'admin');
```

هذا هو **الوحيد** الذي يجب إدخاله يدوياً — البقية يُنشئها المدير من واجهة المستخدمين.

### 2.8 ربط التطبيق

حرّر `config.js`:

```javascript
window.APP_CONFIG = {
  SUPABASE_URL:      'https://YOUR-PROJECT-REF.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
};
```

⚠️ لا تستخدم `service_role` هنا.

### 2.9 النشر على Netlify

1. ارفع المجلد إلى المستودع.
2. Netlify → Import from Git → اختر المستودع.
3. Build command: (فارغ) — Publish directory: `.`.
4. Deploy.

بعد النشر: افتح الموقع → Ctrl+Shift+R → سجّل الدخول بمستخدم المدير.

---

## 3. العمليات اليومية

### 3.1 إنشاء تقني
1. سجّل الدخول كمدير.
2. **التقنيون** → **تقني جديد**.
3. أدخل الاسم، البريد، كلمة المرور (6+ أحرف)، الصلاحية.
4. **إنشاء المستخدم**.

خلف الكواليس: `callAdminUsers({ action: 'create', ... })` → Edge Function → `auth.admin.createUser` → trigger ينشئ صف `profiles` تلقائياً.

### 3.2 إعادة تعيين كلمة مرور
**التقنيون** → أيقونة المفتاح بجانب المستخدم → أدخل كلمة المرور الجديدة مرتين → **حفظ**.

### 3.3 تغيير الصلاحية
**التقنيون** → القائمة المنسدلة بجانب المستخدم → مسؤول متابعة المشاريع / تقني.

المستخدم يلاحظ التغيير في المرة القادمة التي يسجّل فيها الدخول (الدور يُقرأ عند sign-in).

### 3.4 حذف تقني
**التقنيون** → أيقونة سلة المهملات → تأكيد.

تحذير: مشاريعه تبقى في قاعدة البيانات لكن `owner_id` يصبح بلا تقني (orphan). لا يوجد حذف تلقائي.

### 3.5 استعادة كلمة مرور مسؤول متابعة المشاريع مفقودة

**الطريقة 1 — عبر Supabase Dashboard:**
1. **Authentication → Users** → اختر حساب المدير.
2. من قائمة النقاط الثلاث → **Send password recovery** أو **Reset password**.

**الطريقة 2 — من Console كمدير آخر موجود:**

```javascript
await callAdminUsers({
  action: 'reset-password',
  userId: '<uuid>',
  password: 'NewPass@123'
});
```

### 3.6 تدوير `anon` key

1. **Settings → API → Rotate anon key**.
2. حدّث `config.js` في المستودع.
3. ارفع إلى Netlify.
4. في `sw.js`، ارفع `VERSION`.
5. التقنيون سيحصلون على المفتاح الجديد عند إعادة التحميل التالية.

> السبب في رفع `sw.js` VERSION: الملفات الثابتة (بما فيها `config.js` والجافاسكربت) مربوطة بإصدار الـ Service Worker. بمجرد رفع الإصدار يُعاد تنزيل الكل من `cache: 'reload'`.

---

## 4. المرجع

### 4.1 قاعدة البيانات

**`public.projects`**
| العمود | النوع | ملاحظة |
|---|---|---|
| `id` | `text` PK | ليس uuid — يبدأ بـ `p_` أو `p_seed_`. سبب: تطابق تام مع JS |
| `owner_id` | `uuid` FK → `auth.users` | ON DELETE CASCADE |
| `name` | `text` not null | denormalized من `data.name` |
| `data` | `jsonb` | كل حقول المشروع (زيارات، صور، إلخ) |
| `updated_at` | `timestamptz` | يُحدَّث تلقائياً بـ trigger |

**`public.profiles`**
| العمود | النوع | ملاحظة |
|---|---|---|
| `id` | `uuid` PK → `auth.users` | ON DELETE CASCADE |
| `name` | `text` not null | |
| `email` | `text` | denormalized |
| `role` | `text` CHECK | `'admin'` أو `'user'` |
| `created_at` | `timestamptz` | |

**Triggers:**
- `projects_set_updated_at` — يحدّث `updated_at` عند كل UPDATE.
- `profiles_prevent_role_change` — يمنع غير المدير من تعديل `role`.
- `on_auth_user_created` — ينشئ صف `profiles` تلقائياً عند إنشاء `auth.users` جديد.

### 4.2 Storage
- Bucket: `visit-photos` — **private**.
- المسار: `{projectId}/{photoId}.jpg`
- الحد الأقصى: 15 MB لكل ملف.
- العرض للمستخدمين: عبر `createSignedUrl(path, 3600)` — صلاحية ساعة.
- سياسات RLS على `storage.objects` تستخدم `public.user_can_access_project_path(name)`.

### 4.3 Edge Function `admin-users`
المدخل: `POST` بـ JSON body. المتغيّر `Authorization: Bearer <session_jwt>` إلزامي (يُضاف تلقائياً بواسطة `sb.functions.invoke`).

| Action | الحقول | يتحقق |
|---|---|---|
| `create` | `name, email, password, role` | بصيغة البريد + طول كلمة المرور |
| `reset-password` | `userId, password` | الطول |
| `delete-user` | `userId` | ليس نفس المستدعي |
| `change-role` | `userId, role` | ليس نفسه + role صالح |

### 4.4 localStorage + IndexedDB

**localStorage:**
| المفتاح | المحتوى | **قاعدة ذهبية** |
|---|---|---|
| `edu_projects_v25_ar` | كل المشاريع (JSON array) | **لا تغيّر هذا الاسم أبداً** |
| `edu_users_v18` | (legacy — غير تقني فعلياً) | اتركه |
| `edu_session_v18` | (legacy — غير مستخدم) | اتركه |
| `edu_deleted_ids_v1` | قائمة projectIds محذوفة محلياً (tombstones) | اتركه |
| `sb-<project-ref>-auth-token` | جلسة Supabase (تديرها المكتبة) | اتركه |

**IndexedDB `edu_photos_db` (v2):**
| Store | keyPath | محتوى |
|---|---|---|
| `photos` | `id` | `{ id, projectId, userId, userName, blob, thumbDataUrl, capturedAt, location }` |
| `sync_queue` | autoIncrement | `{ entity, op, payload, projectId, createdAt, retries }` |

### 4.5 خريطة الملفات
| الملف | الدور |
|---|---|
| `index.html` | الهياكل (auth, topbar, جدول، مودالات) |
| `main.css` | التنسيقات RTL + مكوّنات + بادج المزامنة |
| `config.js` | URL + anon key |
| `supabase.js` | عميل Supabase (ES module) |
| `core.js` | الحالة، IndexedDB، المصادقة، المزامنة (flush/pull/tombstones)، معالجة الصور |
| `ui.js` | كل رسم + فتح/غلق المودالات + منطق الأزرار |
| `app.js` | الإجراءات العامة، التصدير/الاستيراد، PWA install |
| `sw.js` | Service Worker (cache shell + VERSION) |
| `manifest.json` | PWA manifest |
| `netlify.toml` | headers + SPA fallback |
| `assets/icons/` | أيقونات PWA |

---

## 5. اختبارات وصيانة

### 5.1 فحص صحة سريع (Console، أي تقني مسجّل)

```javascript
(async () => {
  console.log('%c=== HEALTH CHECK ===', 'font-weight:bold;font-size:14px');
  console.log('Signed in:', (await window.sb.auth.getUser()).data.user?.email);
  console.log('Is admin  :', isAdmin() ? '✅' : '❌');
  console.log('Queue     :', await countSyncQueue());
  console.log('Tombs     :', getDeletedIds().size);
  console.log('Badge     :', document.querySelector('#syncBadge')?.textContent);
  const { count } = await window.sb.from('projects').select('*', { count:'exact', head:true });
  console.log('Remote    :', count);
  console.log('Local     :', projects.length);
})();
```

**المتوقع:** Queue=0، Tombs=0، Badge=متزامن، Remote=Local (بعد انتظار 3 ثوانٍ).

### 5.2 أدوات تصحيح المزامنة

**عرض الطابور:**
```javascript
listSyncQueue().then(q => console.table(q.map(x => ({
  id: x._key, entity: x.entity, op: x.op, projectId: x.projectId
}))));
```

**إجبار flush فوري:**
```javascript
await flushQueue();
console.log('Queue now:', await countSyncQueue());
```

**إجبار pull فوري:**
```javascript
await pullFromSupabase();
```

**عرض الـ tombstones:**
```javascript
console.log([...getDeletedIds()]);
```

**مسح الطابور (عند التصحيح فقط):**
```javascript
await clearSyncQueue();
```

### 5.3 فحص البيانات

**كل المشاريع البعيدة:**
```javascript
(async () => {
  const { data } = await window.sb.from('projects').select('id, name, owner_id, updated_at').order('updated_at', { ascending: false });
  console.table(data);
})();
```

**الملفات في bucket:**
```javascript
(async () => {
  for(const p of projects){
    const { data } = await window.sb.storage.from('visit-photos').list(p.id);
    if(data?.length) console.log(p.name, '→', data.length, 'file(s)');
  }
})();
```

**التقنيون:**
```javascript
(async () => {
  const { data } = await window.sb.from('profiles').select('*').order('created_at');
  console.table(data);
})();
```

### 5.4 Supabase SQL Editor — تشخيصات

**عرض كل السياسات:**
```sql
select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname in ('public','storage')
order by tablename, cmd, policyname;
```

**التأكد أن RLS مُفعّل:**
```sql
select relname as table, relrowsecurity as rls_enabled
from pg_class
where relname in ('projects','profiles') and relnamespace = 'public'::regnamespace;
```

**التحقق من نوع الأعمدة:**
```sql
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name in ('projects','profiles')
order by table_name, ordinal_position;
```

**عرض كل الـ triggers:**
```sql
select tgname as trigger, tgrelid::regclass as table, proname as function
from pg_trigger t
join pg_proc p on p.oid = t.tgfoid
where not t.tgisinternal
order by tgrelid::regclass::text, tgname;
```

**عدد الصفوف لكل جدول:**
```sql
select 'projects' as t, count(*) from public.projects
union all
select 'profiles', count(*) from public.profiles;
```

**التقنيون في auth.users بدون profile (خلل):**
```sql
select u.id, u.email
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
```

---

## 6. استكشاف الأخطاء

| العَرَض | السبب | الحل |
|---|---|---|
| شاشة الدخول تعرض "Invalid login credentials" دائماً | كلمة المرور خاطئة أو المستخدم محذوف | تحقّق من Users في Supabase |
| البادج عالق على "قيد الانتظار (N)" | فشل flush متكرر | Console → ابحث عن `[sync] item failed`. اقرأ السبب |
| `new row violates row-level security policy` | يحاول تقني رفع مشروع لا يملكه | طبيعي إذا الـ owner_id لشخص آخر. الطابور يُفرغ العنصر تلقائياً |
| الصور لا تظهر على جهاز آخر | مسار التخزين خاطئ أو RLS | Console → `[signed-url] failed` — أعد فحص سياسات التخزين |
| مشروع محذوف يعود بعد reload | tombstone مفقود | تحقق من `getDeletedIds().size` بعد الحذف — يجب أن يكون 1 مؤقتاً |
| Edge Function ترجع 403 | المستدعي ليس admin | تحقق من `profiles.role` في Supabase |
| Edge Function ترجع 500 | خطأ داخلي | **Edge Functions → admin-users → Logs** — الرسالة هناك |
| `service_role` key في الكود | تسريب | **دوّر المفتاح فوراً** من Settings → API |
| Service Worker لا يُحدّث الكود | VERSION لم يُرفع | ارفع `sw.js` VERSION + hard-reload |
| `sw.js` error على GitHub Pages (subpath) | scope `/` غير صالح | عدّل `navigator.serviceWorker.register('/sw.js', { scope: '/' })` إلى `'./sw.js'` مع `scope: './'` |

---

## 7. ملحق A — سجل SQL (للمرجع فقط)

> هذا سجل تاريخي. **لا تنفّذ** شيئاً من هنا على قاعدة بيانات سليمة. استخدم §2.3 و§2.4 فقط.

### A.1 النسخة الأولى من `projects` (استُبدلت)
```sql
create table public.projects (
  id uuid primary key default gen_random_uuid(),   -- ← كان uuid في البداية
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
```

### A.2 Patch: تغيير `projects.id` من uuid إلى text
```sql
alter table public.projects alter column id drop default;
alter table public.projects alter column id type text;
```

### A.3 Patch: توسيع سياسة insert (لتسمح للمدير برفع مشاريع لغيره)
```sql
drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own"
on public.projects for insert to authenticated
with check (owner_id = auth.uid() or public.is_admin());
```
هذا هو **التعريف النهائي** المضمّن في §2.3.

### A.4 محاولة فاشلة: `alter table storage.objects`
```sql
-- ❌ لا تنفّذ. يرمي 42501 (Supabase role ليس المالك)
alter table storage.objects enable row level security;
```
جدول `storage.objects` دائماً RLS مفعّل. أنشئ السياسات فقط.

### A.5 `handle_new_user` الأولي (نفس الحالي، استُبدل بـ create or replace في تحديثات لاحقة — لا فرق وظيفي)

---

## 8. ملحق B — سجل Console snippets التطويرية

للمرجع عند إعادة عرض مشكلة مشابهة. هذه استُخدمت أثناء بناء النظام.

### B.1 فحص تحميل الدوال
```javascript
['sbSignIn','sbSignOut','callAdminUsers','flushQueue','pullFromSupabase',
 'enqueueSync','markDeletedLocally','getDeletedIds','sbSignedPhotoUrl']
.forEach(n => console.log((typeof window[n]==='function'?'✅ ':'❌ ')+n));
```

### B.2 فحص أن service_role لم يتسرب
```javascript
const k = window.APP_CONFIG.SUPABASE_ANON_KEY;
console.log('Is anon key:', k.split('.')[1]
  ? JSON.parse(atob(k.split('.')[1])).role
  : 'unknown');
// يجب أن يطبع: anon
```

### B.3 فحص عزل RLS (زهراء تصل إلى مشروع مسؤول متابعة المشاريع)
```javascript
(async () => {
  const { data: foreign } = await window.sb.from('projects')
    .select('id').neq('owner_id', (await window.sb.auth.getUser()).data.user.id)
    .limit(1).maybeSingle();
  console.log('Foreign project visible to regular user:',
    foreign ? '❌ breach' : '✅ hidden');
})();
```

### B.4 فحص عزل RLS للتخزين
```javascript
(async () => {
  const { data: foreign } = await window.sb.from('projects')
    .select('id').neq('owner_id', (await window.sb.auth.getUser()).data.user.id)
    .limit(1).maybeSingle();
  if(!foreign){ console.log('No foreign project visible'); return; }
  const { data, error } = await window.sb.storage.from('visit-photos').list(foreign.id);
  console.log('Storage access:',
    error ? '✅ blocked ('+error.message+')' :
    (data && data.length===0) ? '✅ blocked (empty)' :
    '❌ leaked '+data.length);
})();
```

### B.5 فحص مزامنة end-to-end
```javascript
(async () => {
  const id = 'sync_probe_' + Date.now();
  projects.push({
    id, name:'SYNC-PROBE', email:'', responsible:'', entityType:'School',
    entityName:'', role:'', phone:'', status:'planned', priority:'medium',
    startDate:'', endDate:'', progress:0, notes:'', visits:[],
    createdAt:new Date().toISOString(), updatedAt:new Date().toISOString()
  });
  render();
  await new Promise(r=>setTimeout(r,200));
  await flushQueue();
  await new Promise(r=>setTimeout(r,300));
  const { data } = await window.sb.from('projects').select('id').eq('id', id).maybeSingle();
  console.log('Upsert reached remote:', data ? '✅' : '❌');
  projects = projects.filter(x=>x.id!==id);
  render();
  await new Promise(r=>setTimeout(r,200));
  await flushQueue();
  await new Promise(r=>setTimeout(r,300));
  const { data: after } = await window.sb.from('projects').select('id').eq('id', id).maybeSingle();
  console.log('Delete reached remote:', after ? '❌' : '✅');
})();
```

---

## 9. ملحق C — نموذج الأمان

**على مستوى الجداول:**
- `auth.users` — يديره Supabase كلياً.
- `profiles` — كل مصادَق يقرأ الجميع (لعرض القائمة)، يعدّل نفسه فقط. المدير يقرر الأدوار.
- `projects` — كل تقني يقرأ/يكتب مشاريعه فقط. المدير كل شيء.

**على مستوى التخزين:**
- ملف في `{projectId}/...` مرئي لمالك المشروع أو المدير.
- التحقق عبر `user_can_access_project_path` الذي يستعلم عن `projects` (security definer لتجاوز RLS الداخلي).

**على مستوى Edge Function:**
- كل استدعاء يتحقق من JWT، ثم يستعلم `profiles.role`.
- أي محاولة لغير admin ترجع 403 قبل تنفيذ أي عملية.
- `service_role` لا يظهر في المستودع — Supabase تُمرّره في بيئة Deno.

**نقاط تحتاج انتباه:**
- إذا سُرِّب `anon key` (وهو عام بطبيعته)، لا ضرر — RLS يحمي.
- إذا سُرِّب `service_role`: **دوّره فوراً** (Settings → API → Rotate).
- كلمات المرور لا تظهر أبداً في أي مكان.

---

## 10. ملحق D — سجل الإصدارات

| `sw.js` | التغيير الجوهري |
|---|---|
| v8  | قبل الترحيل |
| v9-v16 | تجارب المزامنة، إصلاح RLS، tombstones |
| v17 | إصلاح ترتيب flush-before-pull |
| v18 | نمط مصادقة موحّد |
| v19 | إزالة تكرار `cleanupLegacyAuth` |
| v20 | ربط صور Supabase Storage |
| v21 | إصلاح قائمة الانتظار: drop failed items + scope per-user |
| v22 | ربط UI بـ Edge Function |
| v23 | إزالة بيانات الدخول التجريبية |
| **v25** | **تنظيف نهائي + تثبيت المفاتيح** |

**قاعدة:** عند كل تعديل على JS أو CSS أو HTML، ارفع VERSION في `sw.js`. عند تغيير المفاتيح في `config.js` فقط، ارفع أيضاً.

---

## 11. قائمة التحقق قبل تسليم المشروع

- [ ] نسخت `config.js` وأضفت URL + anon key.
- [ ] نفّذت §2.3 (SQL الجداول + السياسات) بنجاح.
- [ ] أنشأت bucket `visit-photos` (private).
- [ ] نفّذت §2.4 (SQL سياسات التخزين) بنجاح.
- [ ] عطّلت تسجيل الدخول العام في Auth Settings.
- [ ] نشرت Edge Function `admin-users` بنجاح.
- [ ] أنشأت أول تقني admin وأضفت صفّه في `profiles` يدوياً.
- [ ] النشر على Netlify يعمل، والدخول ناجح.
- [ ] `SW_VERSION` الحالي `v25`.
- [ ] جميع اختبارات §5.1 و §5.2 تنجح.
- [ ] لا توجد كلمات مرور في المستودع (تحقّق: `grep -r "Admin@123\|User@123" .`).
- [ ] `todo.txt` محدَّث (راجع §2 من الرسالة التالية).

---

© وزارة التربية والتعليم — للاستخدام الداخلي.