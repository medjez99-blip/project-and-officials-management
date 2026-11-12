════════════════════════════════════════════════════════════════════════════════
SECURITY NOTES — project-and-officials-management
Classification: PRIVATE / INTERNAL — DO NOT COMMIT / DO NOT SHARE
Last reviewed: 2026-11-10
Next review due: 2027-02-10 (quarterly)
════════════════════════════════════════════════════════════════════════════════

════════════════════════════════════════════════════════════════════════════════
 0. EMERGENCY PROCEDURES — read this section FIRST if you're in a panic
════════════════════════════════════════════════════════════════════════════════

 If you're here because:

 ┌─────────────────────────────────────────────────────────────────────────┐
 │ "I think my service_role key leaked"                                     │
 │ → Go to §9.1 (Emergency: service_role key compromised)                   │
 └─────────────────────────────────────────────────────────────────────────┘

 ┌─────────────────────────────────────────────────────────────────────────┐
 │ "I think my anon key leaked"                                             │
 │ → Go to §9.2. TL;DR: it's public, but rotate if you suspect abuse.       │
 └─────────────────────────────────────────────────────────────────────────┘

 ┌─────────────────────────────────────────────────────────────────────────┐
 │ "An admin account may be compromised"                                    │
 │ → Go to §9.3 (Emergency: admin account compromised)                      │
 └─────────────────────────────────────────────────────────────────────────┘

 ┌─────────────────────────────────────────────────────────────────────────┐
 │ "A user's password was stolen / guessed"                                 │
 │ → Go to §9.4 (Emergency: user password compromised)                      │
 └─────────────────────────────────────────────────────────────────────────┘

 ┌─────────────────────────────────────────────────────────────────────────┐
 │ "I accidentally committed a secret to git"                               │
 │ → Go to §9.5 (Emergency: secret committed to git)                        │
 └─────────────────────────────────────────────────────────────────────────┘

 ┌─────────────────────────────────────────────────────────────────────────┐
 │ "Data was deleted / corrupted"                                           │
 │ → Go to §9.6 (Emergency: data loss)                                      │
 └─────────────────────────────────────────────────────────────────────────┘

════════════════════════════════════════════════════════════════════════════════
 1. SECRETS INVENTORY — where they live and how to rotate
════════════════════════════════════════════════════════════════════════════════

 ⚠️  I don't have your actual values. Fill in the blanks from your password
     manager. The "Where" column tells you where to look.

 ┌──────────────────────┬──────────────────────┬───────────────┬──────────────┐
 │ Secret               │ Where it lives       │ Sensitivity   │ Rotate if    │
 ├──────────────────────┼──────────────────────┼───────────────┼──────────────┤
 │ SUPABASE_URL         │ config.js (public)   │ Public        │ Never        │
 │                      │ + OPERATIONS.md      │               │              │
 ├──────────────────────┼──────────────────────┼───────────────┼──────────────┤
 │ SUPABASE_ANON_KEY    │ config.js (public)   │ Public        │ Only on abuse│
 │                      │                      │ (RLS-gated)   │ §9.2         │
 ├──────────────────────┼──────────────────────┼───────────────┼──────────────┤
 │ SUPABASE_SERVICE_ROLE│ Supabase-injected    │ ★★★ CRITICAL │ Suspected    │
 │ _KEY                  │ into Edge Function   │ ★★★           │ leak §9.1    │
 │                      │ runtime only         │               │              │
 ├──────────────────────┼──────────────────────┼───────────────┼──────────────┤
 │ Database password    │ Set at project       │ ★★★ CRITICAL │ Quarterly    │
 │ (Postgres)           │ creation; you saved  │ ★★★           │ or suspected │
 │                      │ it in a password mgr │               │ leak         │
 ├──────────────────────┼──────────────────────┼───────────────┼──────────────┤
 │ Admin 1 password     │ <FILL IN>            │ ★★★ CRITICAL │ Suspected    │
 │ (medjez99@gmail.com) │ Knows: only you      │ ★★★           │ leak §9.3    │
 ├──────────────────────┼──────────────────────┼───────────────┼──────────────┤
 │ Admin 2 password     │ Cz&QazZ#,yQ/Fv8      │ ★★★ CRITICAL │ Suspected    │
 │ (admin@ministry.gov) │ Knows: only you      │ ★★★           │ leak §9.3    │
 ├──────────────────────┼──────────────────────┼───────────────┼──────────────┤
 │ Zahra password       │ Cz&QazZ#,yQ/Fv8      │ ★★ HIGH       │ Suspected    │
 │ (f.zahra@ministry...)│ Knows: only you      │ ★★            │ leak §9.4    │
 ├──────────────────────┼──────────────────────┼───────────────┼──────────────┤
 │ Netlify account      │ Email + 2FA          │ ★★ HIGH       │ Compromise   │
 │ (deploy access)      │                      │ ★★            │ §9.5         │
 ├──────────────────────┼──────────────────────┼───────────────┼──────────────┤
 │ GitHub repo admin    │ Email + 2FA          │ ★★ HIGH       │ Compromise   │
 │ (code access)        │                      │ ★★            │ §9.5         │
 ├──────────────────────┼──────────────────────┼───────────────┼──────────────┤
 │ Supabase dashboard   │ Email + password +   │ ★★★ CRITICAL │ Compromise   │
 │ login                │ 2FA (if enabled)     │ ★★★           │ §9.3         │
 └──────────────────────┴──────────────────────┴───────────────┴──────────────┘

 ROTATION QUICK REFERENCE
 ─────────────────────────
 · anon key           → Supabase → Settings → API → Rotate anon key
                         Then update config.js, deploy, bump sw.js VERSION.

 · service_role key   → Supabase → Settings → API → Rotate service_role key
                         Edge Function picks it up automatically at next
                         invocation. No code change needed. But see §9.1 for
                         audit steps.

 · Database password  → Supabase → Settings → Database → Reset database password
                         Only affects direct psql access. App uses the REST API,
                         so it won't break.

 · Any user password  → As admin in the app: التقنيون → 🔑 → set new password.
                         Or from any admin browser console:
                         await callAdminUsers({
                           action: 'reset-password',
                           userId: '<uuid>',
                           password: '<new>'
                         });

 · Admin's own        → If only one admin and password is lost:
   password             Supabase → Authentication → Users → ⋮ → Reset password
                         (sends email; requires the email to be reachable)

 · Netlify account    → netlify.com → User settings → Password / 2FA

 · GitHub repo        → github.com → Settings → Password / Sessions / SSH keys

════════════════════════════════════════════════════════════════════════════════
 2. KNOWN ISSUES — what to fix, in priority order
════════════════════════════════════════════════════════════════════════════════

 Severity key:
   🔴 CRITICAL   → potential full-system compromise
   🟠 HIGH       → potential data loss / unauthorized access to one user's data
   🟡 MEDIUM     → potential abuse / information disclosure / resource drain
   🟢 LOW        → cosmetic / theoretical / cost-only

 ─────────────────────────────────────────────────────────────────────────────
 🔴 ISSUE-01: Password recovery email = single point of failure
 ─────────────────────────────────────────────────────────────────────────────
 Risk:        If an attacker compromises the email account tied to an admin
              (medjez99@gmail.com), they can use "Forgot password" on Supabase
              Auth to reset the admin's password, then log in as admin and do
              anything: delete projects, delete users, exfiltrate data.
 Impact:      Full system compromise via email takeover.
 Cause:       Standard "forgot password" flow. Not a bug — an inherent trust
              boundary. Everyone using email-based auth has this.
 Status:      NOT mitigated. Should be mitigated.

 Mitigation (pick one):
   [ ] A. Turn on 2FA for medjez99@gmail.com (Google account → Security → 2SV).
          This alone raises the bar significantly. DO THIS NOW — 5 minutes.
   [ ] B. Disable password recovery in Supabase:
          Authentication → Settings → Email → toggle OFF "Reset password".
          Trade-off: if you lose the password, only direct DB access recovers it.
          You'd need to reset via the dashboard using the service role.
   [ ] C. Enable Supabase Auth MFA/TOTP for admin accounts (§4).
          This is the "proper" fix and combines well with A.

 Recovery if this happens:
   → Supabase → Authentication → Users → delete the compromised session
     (terminate sessions), then reset password with a new strong one.
   → Delete any new admin accounts the attacker created.
   → Check profiles table for unexpected role='admin' rows:
     select * from public.profiles where role = 'admin';
   → Check projects table for unexpected rows:
     select id, name, owner_id from public.projects
     where updated_at > now() - interval '7 days';

 ─────────────────────────────────────────────────────────────────────────────
 🟠 ISSUE-02: Any admin can delete/demote any other admin
 ─────────────────────────────────────────────────────────────────────────────
 Risk:        The admin-users Edge Function's delete-user and change-role
              actions have NO safeguard against targeting another admin.
              An admin with a stolen session can lock out every other admin,
              then act freely.
 Impact:      Admin-vs-admin lockout; no automatic recovery path.
 Cause:       Edge Function only checks "caller is admin" (§2.6 code), not
              "target is not another admin" nor "target is not the sole admin".
 Status:      NOT mitigated.

 Mitigation:
   [ ] Add to Edge Function delete-user:
         // count how many admins exist
         const { count } = await adminSb
           .from('profiles').select('*', { count: 'exact', head: true })
           .eq('role', 'admin');
         if (count <= 1) return json({ error: 'Cannot delete the last admin' }, 400);
   [ ] Add the same check to change-role when demoting the last admin.
   [ ] Optional: refuse any self-delete or self-demote (already partly done
         — self-delete is blocked but self-demote is not).
   [ ] Add an audit_log table so admin actions are traceable.

 ─────────────────────────────────────────────────────────────────────────────
 🟡 ISSUE-03: No rate limiting on admin-users Edge Function
 ─────────────────────────────────────────────────────────────────────────────
 Risk:        An authenticated admin (or someone who stole an admin session)
              can create/delete users in a tight loop. Fills profiles table,
              burns auth quota, spams rate limits at Supabase level.
 Impact:      Denial-of-service; billing pressure on paid tiers.
 Status:      NOT mitigated.

 Mitigation:
   [ ] Add a simple rate limit in the Edge Function using a `rate_limits`
       table (user_id, action, attempted_at) and reject if > N attempts in T
       seconds. Example: max 20 create-user per minute per admin.
   [ ] Or upgrade to Supabase Pro which provides edge function rate limiting
       as a feature.

 ─────────────────────────────────────────────────────────────────────────────
 🟡 ISSUE-04: Weak password policy (6-char minimum only)
 ─────────────────────────────────────────────────────────────────────────────
 Risk:        Admins can create users with passwords like "123456". Users
              can never change them to stronger ones (no client-side enforcement
              beyond the 6-char minimum in the Edge Function).
 Impact:      Guessable passwords → account takeover → data exfiltration.
 Status:      NOT mitigated.

 Mitigation:
   [ ] Change the check in Edge Function admin-users:
         if (String(password).length < 10) return json({ error: 'Password must be at least 10 characters' }, 400);
         if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) ||
             !/[0-9]/.test(password)) {
           return json({ error: 'Password must include upper, lower, and digit' }, 400);
         }
   [ ] Update the UI hint in index.html pwNew placeholder to match.
   [ ] Consider checking against HaveIBeenPwned via Edge Function (k-anonymity API).

 ─────────────────────────────────────────────────────────────────────────────
 🟡 ISSUE-05: No audit log for admin actions
 ─────────────────────────────────────────────────────────────────────────────
 Risk:        If an admin's account is compromised, there is NO record of:
              which users were created, which were deleted, whose password
              was reset, whose role was changed, and when.
 Impact:      Post-incident forensics impossible. Can't answer "what did the
              attacker do while they had access?".
 Status:      NOT mitigated.

 Mitigation:
   [ ] Create audit_log table:
         create table public.audit_log (
           id bigserial primary key,
           actor_id uuid references auth.users(id),
           action text not null,
           target_id uuid,
           payload jsonb,
           created_at timestamptz default now()
         );
         alter table public.audit_log enable row level security;
         create policy "audit_read_admin" on public.audit_log for select
           to authenticated using (public.is_admin());
   [ ] Write a row before returning from each admin-users action.
   [ ] Consider audit for: sign-in, project-delete, all Edge Function actions.

 ─────────────────────────────────────────────────────────────────────────────
 🟡 ISSUE-06: Orphaned photos in Storage (storage leak)
 ─────────────────────────────────────────────────────────────────────────────
 Risk:        When a project is deleted while a photo-delete is still queued
              (or fails permanently), the storage file survives with NO
              matching project row. It becomes unreachable (RLS blocks access
              because the project doesn't exist), but it occupies storage.
 Impact:      Slow storage growth; eventually hits the 1 GB free-tier cap.
              Not a data breach (files are inaccessible), but a cost leak.
 Status:      PARTIALLY mitigated — the delete flow enqueues photo-deletes
              BEFORE project removal. But if a photo-delete fails permanently
              (or the tab is closed mid-delete), the file lingers.

 Mitigation:
   [ ] Periodic manual cleanup query (run in SQL Editor, as admin):
         -- Find orphaned storage folders (project deleted, files remain)
         -- Run this in the browser console as admin:
         (async () => {
           const { data: projects } = await window.sb.from('projects').select('id');
           const projectIds = new Set((projects||[]).map(p => p.id));
           const { data: folders } = await window.sb.storage.from('visit-photos').list('', { limit: 1000 });
           for (const f of (folders||[])) {
             if (!projectIds.has(f.name)) {
               console.warn('Orphaned folder:', f.name);
               // delete recursively
               const { data: files } = await window.sb.storage.from('visit-photos').list(f.name);
               await window.sb.storage.from('visit-photos').remove(files.map(x => f.name + '/' + x.name));
             }
           }
         })();
   [ ] Or better: enable Supabase's object lifecycle rules (paid tiers).

 ─────────────────────────────────────────────────────────────────────────────
 🟡 ISSUE-07: Session lives 30 days (default) with no inactivity timeout
 ─────────────────────────────────────────────────────────────────────────────
 Risk:        A stolen laptop with a signed-in browser gives an attacker
              admin access for up to 30 days (or until the session is manually
              terminated from the Supabase dashboard).
 Impact:      Extended window of unauthorized access after device theft.
 Status:      NOT mitigated.

 Mitigation:
   [ ] Reduce session lifetime: Supabase → Authentication → Settings →
       JWT expiry → set to e.g. 8 hours. Users re-authenticate daily.
       Trade-off: more password prompts for legitimate users.
   [ ] Optional: use "refresh tokens" with short-lived access tokens
       (Supabase handles this automatically; just adjust the numbers).
   [ ] Optional: implement client-side inactivity timeout in app.js:
         let _lastActivity = Date.now();
         document.addEventListener('mousemove', () => _lastActivity = Date.now());
         setInterval(async () => {
           if (Date.now() - _lastActivity > 8 * 3600 * 1000) {
             await sbSignOut(); showAuth();
           }
         }, 60000);

 ─────────────────────────────────────────────────────────────────────────────
 🟢 ISSUE-08: Photos and projects are NOT encrypted at rest in the browser
 ─────────────────────────────────────────────────────────────────────────────
 Risk:        Anyone with filesystem access to the browser profile (or the
              physical device) can read localStorage + IndexedDB content
              without authenticating. On a shared / stolen computer, this
              exposes project notes, photos, GPS coordinates, and usernames.
 Impact:      Local data disclosure. Does NOT leak passwords (Supabase-js
              stores a session JWT, not the password).
 Status:      Inherent to local-first design. Not a bug, but you must plan
              for it in your operational policy.

 Mitigation:
   [ ] Policy: never use the app on a shared/public computer.
   [ ] Policy: sign out AND clear browser site data when done on a shared device.
   [ ] The app's existing "log out" wipes session but NOT localStorage/IndexedDB.
       If this matters, add a "Delete local data" button that also clears
       edu_projects_* + edu_deleted_ids_* + IndexedDB.
   [ ] Optional: encrypted IndexedDB (complex; skip unless required).

 ─────────────────────────────────────────────────────────────────────────────
 🟢 ISSUE-09: Photos embed PII in pixel data
 ─────────────────────────────────────────────────────────────────────────────
 Risk:        Every visit photo is stamped with:
                · Timestamp (date + time)
                · Exact GPS coordinates + accuracy (±meters)
                · Username (from profiles.name)
                · Project name
              If a photo is leaked, sold, or accidentally shared, it reveals
              where the user was, when, and who they are.
 Impact:      Privacy. The user cannot capture a "sanitized" photo through
              the app (stamping is hardcoded in core.js → drawStamp()).
 Status:      By design. Not a bug — but you must communicate it to users.

 Mitigation:
   [ ] Add a notice in the "تسجيل زيارة" modal: "الصور مختومة بالتاريخ
       والموقع واسمك — ستكون مرئية لمن يمكنه الوصول إلى سجل الزيارات."
   [ ] Or: add a toggle to disable stamping for sensitive visits (requires
       code change in core.js processPhoto()).

 ─────────────────────────────────────────────────────────────────────────────
 🟢 ISSUE-10: Console logs may leak internal IDs
 ─────────────────────────────────────────────────────────────────────────────
 Risk:        In development, we used console.log/warn to debug sync. Some
              of those remain in production and print project IDs, error
              messages, and (potentially) profile names.
 Impact:      Only if a screenshot is shared or someone is watching over the
              user's shoulder.
 Status:      Low priority.

 Mitigation:
   [ ] Optional: wrap the [sync] and [pull] console.warn calls in a DEBUG flag:
         const DEBUG_SYNC = false;
         if (DEBUG_SYNC) console.warn(...);

════════════════════════════════════════════════════════════════════════════════
 3. THINGS THAT LOOK LIKE VULNERABILITIES BUT AREN'T (don't waste time)
════════════════════════════════════════════════════════════════════════════════

 · "The anon key is visible in config.js!"
   → Expected. The anon key is PUBLIC by design. RLS is what protects data.
     If the anon key were secret, the browser couldn't call Supabase at all.

 · "The service_role key is visible to Supabase!"
   → Only inside Edge Function runtime, which Supabase injects at deploy
     time. It never leaves Supabase's infrastructure. Yes, Supabase trusts
     the function code — that's why the function verifies the caller is
     admin before doing anything.

 · "The user's JWT is in localStorage!"
   → Standard for Supabase-js. The JWT is a signed token, not a secret.
     If stolen, it can impersonate the user until it expires — which is
     exactly what session expiry (§ISSUE-07) mitigates against.

 · "Someone can edit the app's JS in DevTools and skip RLS!"
   → RLS is enforced by Postgres, not the app. Modifying client code gains
     nothing — the database will reject unauthorized queries.

 · "There's no rate limit on sign-in!"
   → Supabase Auth has built-in rate limiting on auth endpoints (currently
     30 attempts/hour per IP by default). Check: Authentication → Settings
     → Rate limits. Consider tightening.

 · "A malicious admin can delete everything!"
   → Yes, by design. Admin means admin. The defense is protecting the
     admin's account (§ISSUE-01, §ISSUE-02), not preventing admins from
     using their powers.

 · "SQL injection in the app!"
   → Supabase-js uses PostgREST, which parameterizes everything. The client
     never builds raw SQL. Safe by construction.

 · "The Edge Function uses service_role — isn't that unsafe?"
   → It's the standard pattern. service_role must live somewhere to call
     admin endpoints. The safe place is inside a function that first checks
     the caller's role. The unsafe place would be the browser.

════════════════════════════════════════════════════════════════════════════════
 4. THINGS THAT LOOK SAFE BUT AREN'T (assume worst case)
════════════════════════════════════════════════════════════════════════════════

 · "We use HTTPS, so we're secure."
   → HTTPS protects data in transit. It doesn't stop:
       - RLS misconfiguration
       - Weak passwords
       - Email takeover
       - Compromised admin sessions
       - Local data theft from the device
     HTTPS is one layer, not the whole picture.

 · "It's just a small internal app — who would attack it?"
   → Automated scanners try every exposed Supabase instance they find.
     The anon key is public → bots WILL find and probe the endpoints. RLS
     is what stops them. If RLS breaks, you're exposed regardless of "who
     would attack it".

 · "Only admins can do admin things."
   → Only admins CAN, but anyone with an admin session can. The question
     isn't "who is admin" but "who could become admin" and "who could steal
     an admin session". Both are real. See §ISSUE-01, §ISSUE-03.

 · "I logged out, so my data is safe."
   → Logout clears the session token but NOT localStorage or IndexedDB.
     The next person to open the app on the same browser could:
       - see cached project data (in DevTools → Application)
       - see cached photos (in DevTools → Application → IndexedDB → photos)
     For a shared computer, you must also clear site data.

 · "The backup handles everything."
   → Backups restore the DB, but not:
       - the storage bucket (photos)
       - the auth.users table (unless paid tier)
       - the Edge Function code
       - your config.js
     Keep a manual JSON export (via the app) AND a copy of the storage
     bucket AND the Edge Function source in a safe place.

 · "Netlify / Supabase will never be breached."
   → Both are large targets. Use their security features:
       - 2FA on both accounts
       - Strong, unique passwords
       - Notifications on new API keys / tokens

 · "The user's password is never stored locally."
   → True. But the *session* is, and a session is as good as a password
     until it expires. Protect sessions (§ISSUE-07).

════════════════════════════════════════════════════════════════════════════════
 5. PERIODIC CHECKLIST — run every 3 months
════════════════════════════════════════════════════════════════════════════════

 □ REVIEW: update "Last reviewed" date at the top of this file.
 □ REVIEW: re-read §2 — are any issues now resolved?
 □ CHECK: is 2FA enabled on ALL external accounts?
           · Supabase dashboard
           · Netlify
           · GitHub (repo)
           · Email account(s) tied to admin accounts
           · Password manager itself
 □ CHECK: rotated the database password in the last 90 days?
 □ CHECK: run the admin-account audit (§5.1)
 □ CHECK: run the storage-orphan audit (§5.2)
 □ CHECK: run the RLS regression test (§5.3)
 □ CHECK: are there any new admin accounts you don't recognize?
 □ CHECK: any .env / config.js / *.md file accidentally committed
           with secrets? (search repo for "eyJhbG" and "service_role")
 □ CHECK: verify backups still exist and would actually restore
 □ CHECK: bump all users' passwords if any indicator of compromise
 □ REVIEW: is ISSUE-01 (email 2FA) enforced?
 □ REVIEW: is ISSUE-02 (last-admin protection) implemented?

════════════════════════════════════════════════════════════════════════════════
 5.1 Admin-account audit — run in browser console as admin
════════════════════════════════════════════════════════════════════════════════

 (async () => {
   console.log('=== ADMIN ACCOUNT AUDIT ===');
   const { data: admins } = await window.sb.from('profiles')
     .select('id, name, email, role, created_at').eq('role', 'admin')
     .order('created_at');
   console.log('Total admins:', admins?.length || 0);
   console.table(admins);
   if ((admins?.length || 0) < 2) {
     console.warn('⚠️  Only one admin — a lost password locks the system.');
   }
   if ((admins?.length || 0) > 3) {
     console.warn('⚠️  More than 3 admins — review if all are intentional.');
   }
   // Look for admins created in the last 7 days (unexpected additions)
   const recent = (admins||[]).filter(a =>
     (Date.now() - new Date(a.created_at).getTime()) < 7 * 86400000);
   if (recent.length) console.warn('⚠️  Recent admin(s):', recent);
 })();

════════════════════════════════════════════════════════════════════════════════
 5.2 Storage-orphan audit — run in browser console as admin
════════════════════════════════════════════════════════════════════════════════

 (async () => {
   console.log('=== STORAGE ORPHAN AUDIT ===');
   const { data: projects } = await window.sb.from('projects').select('id');
   const projectIds = new Set((projects||[]).map(p => p.id));
   const { data: folders } = await window.sb.storage.from('visit-photos').list('', { limit: 5000 });
   let orphans = [];
   for (const f of (folders||[])) {
     if (!projectIds.has(f.name)) orphans.push(f.name);
   }
   console.log('Project folders in storage:', folders?.length || 0);
   console.log('Orphaned folders (no matching project):', orphans.length);
   if (orphans.length) {
     console.table(orphans.map(n => ({ folder: n })));
     console.log('To clean: use the code in ISSUE-06.');
   }
 })();

════════════════════════════════════════════════════════════════════════════════
 5.3 RLS regression test — run in browser console as admin
════════════════════════════════════════════════════════════════════════════════

 (async () => {
   console.log('=== RLS REGRESSION TEST ===');
   // 1. Confirm admin sees all projects
   const { data: all } = await window.sb.from('projects').select('id');
   console.log('1. Admin sees:', all?.length, 'project(s)');

   // 2. Confirm admin can insert/delete (self-test)
   const tid = 'rls_probe_' + Date.now();
   const { error: ie } = await window.sb.from('projects').insert({
     id: tid, name: 'RLS PROBE', owner_id: currentUser.id, data: { id: tid, name: 'RLS PROBE' }
   });
   console.log('2. Insert:', ie ? '❌ ' + ie.message : '✅');
   if (!ie) {
     const { error: de } = await window.sb.from('projects').delete().eq('id', tid);
     console.log('3. Delete:', de ? '❌ ' + de.message : '✅');
   }

   // 4. Confirm policies table shape
   console.log('4. Run this in Supabase SQL Editor to verify policies:');
   console.log("   select tablename, policyname, cmd from pg_policies where schemaname in ('public','storage') order by tablename, cmd;");
 })();

════════════════════════════════════════════════════════════════════════════════
 6. THREAT MODEL — what this app protects against, what it doesn't
════════════════════════════════════════════════════════════════════════════════

 PROTECTS AGAINST:
   ✓ Anonymous internet users reading data          → RLS + anon-only key
   ✓ One user reading another's projects            → RLS select policy
   ✓ One user reading another's photos              → storage RLS via path
   ✓ User escalating their own role to admin        → prevent_role_change trigger
   ✓ Non-admin calling user management functions    → Edge Function role check
   ✓ Data loss on network interruption              → local-first + queue
   ✓ Data loss on tab close mid-write               → synchronous localStorage write
   ✓ Deleted projects reappearing                   → tombstones
   ✓ Stale queue blocking forever                   → drop-on-permanent-failure

 DOES NOT PROTECT AGAINST:
   ✗ Compromised admin account (password theft, session theft)
   ✗ Compromised email account that owns admin's recovery
   ✗ Compromised Supabase service_role key
   ✗ Compromised development/hosting accounts (Netlify, GitHub)
   ✗ Malicious browser extension reading localStorage
   ✗ Shared/stolen physical device with signed-in browser
   ✗ Nation-state-level attacks on Supabase infrastructure
   ✗ Insider threat (an admin who goes rogue)

 OUT OF SCOPE (accept risk):
   · Multi-tenancy (one app, one organization)
   · Compliance certifications (no PCI, HIPAA, SOC2)
   · Data residency guarantees
   · Encryption at rest beyond Supabase defaults

════════════════════════════════════════════════════════════════════════════════
 7. HARDENING BACKLOG — pick items that match your risk tolerance
════════════════════════════════════════════════════════════════════════════════

 Priority 1 (do this month):
   [ ] Enable 2FA on: Supabase, Netlify, GitHub, medjez99@gmail.com
   [ ] Decide on ISSUE-01 mitigation (§2)
   [ ] Implement ISSUE-02 (last-admin protection) in Edge Function
   [ ] Verify backups exist AND actually restore (create a throwaway project,
       delete it, verify it's in the backup — if reachable)

 Priority 2 (do this quarter):
   [ ] Implement audit_log (§ISSUE-05)
   [ ] Enforce stronger password policy (§ISSUE-04)
   [ ] Reduce session expiry to 8h for admins (§ISSUE-07)
   [ ] Enable CSP in netlify.toml (uncomment the header; test in browser)
   [ ] Enable HSTS preload (currently just max-age) — after 6 months of uptime

 Priority 3 (nice to have):
   [ ] Rate limiting on admin-users (§ISSUE-03)
   [ ] Periodic orphan-photo cleanup automation (§ISSUE-06)
   [ ] Auth MFA/TOTP for admin accounts (Supabase supports it)
   [ ] Audit failed login attempts (Supabase provides this in Auth → Logs)
   [ ] Backup automation via GitHub Action (monthly JSON export to repo)
   [ ] Consider moving the session token to an httpOnly cookie
       (Supabase-js supports it — but breaks "remember me across tabs" UX)

 Future/optional:
   [ ] Row-level audit on projects (who changed what)
   [ ] Soft-delete / trash for projects (currently hard-delete)
   [ ] Content-Security-Policy-Report-Only for violation monitoring
   [ ] Consider encrypting IndexedDB content (very complex, rarely worth it)

════════════════════════════════════════════════════════════════════════════════
 8. CONTACTS / ESCALATION
════════════════════════════════════════════════════════════════════════════════

 System owner:        <your name>
 Email:               <your email>
 Supabase support:    support@supabase.com
 Netlify support:     support@netlify.com
 GitHub security:     security@github.com

 If you suspect a security incident AND it's business hours, handle it yourself
 using §9. If it's out of hours AND you suspect active compromise, in order:

   1. Rotate the service_role key (breaks the attacker's ability to act via
      Edge Function).
   2. Terminate all Supabase Auth sessions:
      Supabase → Authentication → Users → ⋮ → "Sign out all sessions"
      (this signs everyone out — including legitimate users — on next call)
   3. Rotate the anon key and deploy (breaks all browser sessions).
   4. Then investigate.

════════════════════════════════════════════════════════════════════════════════
 9. INCIDENT RESPONSE PLAYBOOKS
════════════════════════════════════════════════════════════════════════════════

 ─────────────────────────────────────────────────────────────────────────────
 9.1 EMERGENCY: service_role key compromised
 ─────────────────────────────────────────────────────────────────────────────
 Symptoms:
   · You accidentally put it in a public commit, blog post, screenshot
   · Suspected leak through a vulnerability in the Edge Function
   · You don't know HOW, but you have reason to believe it's out

 Impact if true: FULL database access — read, write, delete anything, bypass RLS.

 Steps:
   [ ] 1. IMMEDIATELY: Supabase → Settings → API → Rotate service_role key.
           Supabase rotates it, and the Edge Function picks up the new key
           automatically. Old key is invalidated within seconds.
   [ ] 2. Assume compromise. Audit the database:
           select * from public.projects
           where updated_at > now() - interval '30 days'
           order by updated_at desc;
           -- Look for unrecognized projects
           select * from public.profiles where role = 'admin';
           -- Look for unrecognized admins
           select * from auth.users
           where created_at > now() - interval '30 days';
           -- Look for unrecognized accounts
   [ ] 3. Restore any altered/deleted projects from backup (Supabase →
           Settings → Database → Backups).
   [ ] 4. Sign out all sessions (see §8).
   [ ] 5. If any data exfiltration is confirmed → notify users affected.
   [ ] 6. Rotate the anon key too (in case both leaked).
   [ ] 7. Document the incident + lessons in a new file incident_YYYYMMDD.md.
   [ ] 8. Fix the leak (remove from history: `git filter-repo` or BFG).

 ─────────────────────────────────────────────────────────────────────────────
 9.2 EMERGENCY: anon key compromised
 ─────────────────────────────────────────────────────────────────────────────
 Impact if true: An attacker can call the API as anon — but RLS blocks all
                 reads/writes. Impact = "annoyance" unless RLS has a gap.

 Steps:
   [ ] 1. Rotate: Supabase → Settings → API → Rotate anon key.
   [ ] 2. Update config.js → deploy to Netlify.
   [ ] 3. Bump sw.js VERSION (users get the new key on next reload).
   [ ] 4. Check Supabase logs for unexpected API traffic:
           Supabase → Logs → API → filter by your anon key.
   [ ] 5. If unexplained reads/writes in logs → assume RLS gap → escalate to §9.1.

 ─────────────────────────────────────────────────────────────────────────────
 9.3 EMERGENCY: admin account compromised
 ─────────────────────────────────────────────────────────────────────────────
 Symptoms:
   · You see admin actions you didn't take
   · You receive unexpected "password changed" emails
   · You can't sign in with your password
   · An unfamiliar new admin appeared

 Steps:
   [ ] 1. As soon as possible: Supabase → Authentication → Users → find the
           affected admin → ⋮ → Reset password (to a NEW strong one only you know).
   [ ] 2. Terminate the attacker's session: ⋮ → "Sign out all sessions".
   [ ] 3. Audit what they did:
           select * from public.projects where updated_at > now() - interval '7 days';
           select * from public.profiles where role = 'admin';
           -- Any new admins? Any unexpected deleted users?
   [ ] 4. Restore any deleted projects from backup if needed.
   [ ] 5. If they created new admin accounts: delete them via Supabase
           Authentication → Users.
   [ ] 6. If they exfiltrated user data → notify users per policy.
   [ ] 7. If the compromise was via email password reset (§ISSUE-01):
           secure the email account first, then the admin's Supabase password.

 ─────────────────────────────────────────────────────────────────────────────
 9.4 EMERGENCY: user password compromised (single user)
 ─────────────────────────────────────────────────────────────────────────────
 Steps:
   [ ] 1. As admin: التقنيون → 🔑 on that user → set new password.
   [ ] 2. Sign out all sessions for that user (Supabase dashboard).
   [ ] 3. Verify their projects weren't tampered with:
           select * from public.projects
           where owner_id = '<user-uuid>' and updated_at > now() - interval '7 days';
   [ ] 4. If tampered → restore from backup.
   [ ] 5. Do NOT assume this was an isolated incident — check other users.

 ─────────────────────────────────────────────────────────────────────────────
 9.5 EMERGENCY: secret committed to git
 ─────────────────────────────────────────────────────────────────────────────
 Even if you delete the file and commit again, the secret is STILL in git
 history. Anyone who cloned between the two commits has it.

 Steps:
   [ ] 1. Rotate the secret FIRST. Assume anyone with the repo has it.
           · anon key → §9.2
           · service_role key → §9.1
           · DB password → Settings → Database → Reset password
           · any user password → reset via dashboard
   [ ] 2. THEN clean the repo history:
           · Small repo: use git filter-repo or BFG Repo-Cleaner.
           · Or: GitHub → Settings → Secret scanning → you'll get alerts on
             secrets pushed. GitHub will notify you automatically.
   [ ] 3. Force-push the cleaned history.
   [ ] 4. Everyone with a clone must re-clone (old history is still on their
           local copy until they delete the repo folder).
   [ ] 5. If the repo was ever public → treat as public exposure, notify any
           affected user.

 ─────────────────────────────────────────────────────────────────────────────
 9.6 EMERGENCY: data loss / corruption
 ─────────────────────────────────────────────────────────────────────────────
 Note: "data loss" in this app almost always means:
       · localStorage wiped (browser clean, extension)
       · IndexedDB wiped (browser clean)
       · Supabase table tampered with
       · Someone deleted a project by mistake

 Order of restoration (most local → most global):
   [ ] 1. Try browser restore:
           · Closed tab accidentally? Chrome → Ctrl+Shift+T.
           · Browser storage intact? Open the app → pull succeeds → data returns.
   [ ] 2. Try localStorage backup:
           · In DevTools → Application → Local Storage → find
             edu_projects_v25_ar — if present, data is intact.
   [ ] 3. Try Supabase restore:
           · Supabase → Settings → Database → Backups → pick a date
             (7-day retention on free tier).
           · Restore creates a NEW project — you'll need to re-link config.js
             to the new URL, or point the app to the restored DB.
   [ ] 4. Try manual JSON export:
           · Did anyone export a backup recently? (app's "نسخة احتياطية" button)
           · Import via "استيراد" in the app.
   [ ] 5. Try photo recovery:
           · IndexedDB → photos store: still there? They weren't in the JSON export.
           · Storage bucket: Supabase backups include storage on paid tiers only.
             Free tier: storage is NOT backed up — photos are lost if bucket
             is deleted.
           · LESSON: enable paid backups if photo loss is unacceptable.

════════════════════════════════════════════════════════════════════════════════
 10. PRIVATE OBSERVATIONS / SCRATCH SPACE
════════════════════════════════════════════════════════════════════════════════

 (Notes to self — delete when obsolete)

 · Kept medjez99@gmail.com as an intentional second admin for recovery.
   Trade-off: two admin accounts = two attack surfaces. But one admin = single
   point of failure if the password is lost. Keep both, but harden both.

 · admin@ministry.gov is fictional — recovery email is a dead end.
   If you ever lose admin@ministry.gov's password AND medjez99 is unreachable,
   recovery is via Supabase dashboard with medjez99's login. This is fine
   as long as medjez99 remains accessible.

 · Consider deleting admin@ministry.gov and using only medjez99@gmail.com
   as the sole admin once you're confident. Reduces attack surface.
   (But then: if medjez99 is lost, no recovery. Document it clearly.)

 · The free-tier backup window (7 days) is a real risk if you don't check
   the app often. Consider: set a calendar reminder every 2 weeks to visit
   the app + verify. If everything still works, you're within the window.

 · If you ever add a second user account for testing, make it clearly named
   "TEST_" so you know it's not a real user. Delete after testing.

 · If you ever share the repo with someone, they can see the anon key in
   config.js — that's fine. But they can also see your Supabase project URL.
   That's also fine (RLS protects). But consider: they can now brute-force
   login attempts against the real Supabase Auth endpoint. That's rate-limited
   by Supabase by default (30/hour/IP). If you're not comfortable with that,
   add IP allowlisting.

════════════════════════════════════════════════════════════════════════════════
 11. SECURITY: TODO — future enhancements
════════════════════════════════════════════════════════════════════════════════

 These are hardening items that make the app *more* secure but aren't blocking.
 Order within each category: highest priority first. Ticked items are done.

 Use this list to:
   · Track what you've already hardened
   · Give a successor a clear roadmap
   · Do a "what's left?" pass each quarter


── 11.1 INPUT SANITIZATION & XSS ──────────────────────────────────────────────

 [ ] 11.1.1 — Full HTML-escape audit
     What:  Verify EVERY place that does `.innerHTML = '...' + userData + '...'`
            wraps the user data in `esc()`. Miss one → stored XSS.
     Where: ui.js (all template literals building table cells, modal contents,
            visit cards, user rows, confirm dialog contents, toast messages).
     How:   Search the codebase for `.innerHTML` and `insertAdjacentHTML`.
            For each hit, verify that any variable in the template is either:
              (a) wrapped in `esc(...)`, OR
              (b) a literal string you control, OR
              (c) a number, OR
              (d) inserted via `.textContent =` instead of string concat.
     Tools: Try a Chrome extension like "DOM Invader" (in Burp) or use
            `dangerouslySetInnerHTML` grep equivalent.
     Priority: HIGH — the app is fine today, but a single missed spot is a
               stored-XSS that affects every admin who views the project.

 [ ] 11.1.2 — CSV formula-injection guard
     What:  The CSV export (`app.js` `#btnCsv`) quotes fields but does NOT
            prevent Excel formula injection. A project named
            `=HYPERLINK("https://evil","click")` opens an attack when someone
            opens the CSV in Excel/Sheets.
     Where: `app.js` `#btnCsv` handler.
     How:   Prepend a single quote to any field that begins with
            `=`, `+`, `-`, `@`, TAB (0x09), or CR (0x0D):
              const safe = String(v).replace(/^([=+\-@\t\r])/, "'$1");
              return '"' + safe.replace(/"/g, '""') + '"';
     Priority: HIGH — one click on a poisoned CSV is enough for full account
               takeover via Excel DDE.

 [ ] 11.1.3 — Unicode BiDi override stripping
     What:  Right-to-left override characters (U+202E, U+202D, U+2066-U+2069)
            can make `report.exe` render as `report.txt` in the UI, or reverse
            text to hide malicious content. Rare in this app but possible via
            pasted project names or notes.
     Where: Anywhere user text is stored or displayed.
     How:   In `esc()`, strip or replace BiDi control characters:
              const BIDI = /[\u202A-\u202E\u2066-\u2069]/g;
              v = String(v ?? '').replace(BIDI, '');
            Or replace with U+FFFD (replacement char) so it's visible.
     Priority: MEDIUM — low likelihood, medium impact if it happens.

 [ ] 11.1.4 — Length limits enforced server-side
     What:  The client enforces `maxlength` on form inputs, but the Edge
            Function and PostgREST don't. A malicious admin (or a stolen
            session) can POST a 10 MB project name to the DB.
     Where: Edge Function `admin-users` (create), plus Postgres CHECK
            constraints or triggers on `public.projects`.
     How:   Add to SQL:
              alter table public.projects
                add constraint name_len check (char_length(name) <= 200);
              alter table public.profiles
                add constraint name_len check (char_length(name) <= 100);
            In Edge Function: reject if `name.length > 100` or
            `email.length > 254`.
     Priority: MEDIUM — matters when the session is stolen.

 [ ] 11.1.5 — HTML in project notes / visit notes
     What:  Notes are rendered as plain text today (`esc` + no `white-space`
            mode that would interpret HTML). But if you ever add markdown
            rendering, EVERY note becomes an XSS vector.
     Where: `ui.js` `renderVisits()` and `renderTable()`.
     How:   If you add markdown later, use a **sanitizing** parser (marked +
            DOMPurify), never raw marked.
     Priority: LOW today — becomes HIGH the moment markdown is added.

 [ ] 11.1.6 — Photo preview alt text
     What:  `<img src="..." alt="">` — alt is empty. If you ever add
            alt="${photo.caption}", the caption becomes an XSS vector.
     Where: `ui.js` renderVisits / renderVisitPreview.
     How:   If adding captions: `alt="${esc(caption)}"`. Always escape.
     Priority: LOW — no caption field today.

 [ ] 11.1.7 — Prototype pollution guard in Object.assign
     What:  `Object.assign({}, row.data, {...})` in `pullFromSupabase` and
            `saveWithSync`. If `row.data` contains `{"__proto__": {...}}`
            (imported via JSON), it could pollute Object.prototype.
     Where: `core.js` `pullFromSupabase`, `ui.js` `#projectForm` submit,
            `app.js` import handler.
     How:   Use `structuredClone(row.data)` (supported everywhere now) or
            a shallow clone that strips `__proto__`:
              const safe = Object.fromEntries(
                Object.entries(row.data).filter(([k]) => k !== '__proto__' && k !== 'constructor')
              );
     Priority: LOW — JSON.parse already protects against most cases, but a
               malicious JSON import could sneak through if the app ever
               uses `eval`-like patterns. Guard is cheap; add it.

 [ ] 11.1.8 — JSON import size/count limits
     What:  `app.js` `#fileImport` handler reads any-size JSON and imports
            everything. A 100 MB JSON with 1M projects freezes the browser
            and floods Supabase.
     Where: `app.js` `#fileImport` change handler.
     How:   Before `JSON.parse`:
              if(file.size > 5 * 1024 * 1024) throw 'File > 5 MB';
            After parse:
              if(arr.length > 5000) throw 'Too many projects';
            After cleaning:
              if(JSON.stringify(clean).length > 20 * 1024 * 1024) throw 'Too large';
     Priority: MEDIUM — matters when importing backups from a compromised
               source, or if a user accidentally picks a wrong file.

 [ ] 11.1.9 — Number clamp on `progress` at DB level
     What:  `progress` is `0-100` in the UI, but `data jsonb` has no CHECK.
            A malicious write could set `progress: -999` or `1e10000`.
     Where: Postgres.
     How:   Either add a CHECK on `data->>'progress'`:
              alter table public.projects
                add constraint progress_range
                check ((data->>'progress')::numeric between 0 and 100);
            Or validate in the Edge Function or via a trigger.
     Priority: LOW — UI clamps it, and RLS prevents most abuse.

 [ ] 11.1.10 — Escape `data-project` and `data-visit` attributes
     What:  Already escaped via `esc()`, but verify each `data-*` value is
            wrapped. The attribute value itself could contain `"`, which
            would break out of the attribute context.
     Where: `ui.js` renderVisits, renderTable, reminder rows.
     How:   Grep for `data-*="' + ` in ui.js — verify each ends with `esc(...)`.
     Priority: LOW — already correct, but audit once.


── 11.2 FILE UPLOAD HARDENING ─────────────────────────────────────────────────

 [ ] 11.2.1 — Magic-byte verification
     What:  The app accepts any file where `file.type.startsWith('image/')`.
            `file.type` is set by the browser based on extension (and can be
            spoofed on some systems). A `.exe` renamed to `.jpg` might pass
            the check, then get re-encoded via canvas.
     Where: `ui.js` handlePhotoFiles.
     How:   Read the first 12 bytes and verify magic bytes:
              JPEG: FF D8 FF
              PNG:  89 50 4E 47
              GIF:  47 49 46 38
              WebP: 52 49 46 46 ... 57 45 42 50
            Reject if none match. The canvas re-encode already neutralizes
            most attacks, but explicit rejection is defense-in-depth.
     Priority: MEDIUM — canvas re-encode is the current mitigation; magic
               bytes are belt-and-suspenders.

 [ ] 11.2.2 — Image bomb (decompression) guard
     What:  A tiny JPEG (100 KB) can decompress to 30000×30000 = 900M pixels
            → 3.6 GB of RAM when drawn to canvas. Freezes the tab or crashes
            the browser.
     Where: `core.js` processPhoto.
     How:   After `new Image()` loads, before drawing:
              if(img.naturalWidth * img.naturalHeight > 40_000_000) {
                throw new Error('Image too large (max 40 megapixels)');
              }
            Or check the file size — but magic bytes don't tell you dimensions.
     Priority: MEDIUM — DoS only, no data exposure, but users will hate
               a frozen browser.

 [ ] 11.2.3 — EXIF stripping verification
     What:  `canvas.toBlob('image/jpeg', 0.78)` should strip EXIF (including
            GPS from the source photo), but let's verify.
     Where: `core.js` processPhoto.
     How:   Take a test photo with GPS EXIF, upload, download from storage,
            inspect with `exiftool` or `identify -verbose`. Confirm no GPS
            tags remain.
     Priority: LOW — canvas should strip it, but verify once.

 [ ] 11.2.4 — Filename sanitization at upload
     What:  Path is `${projectId}/${photoId}.jpg` — both IDs are app-generated
            (safe chars). But if the code ever changes to include user input
            in the filename, sanitize it.
     Where: `core.js` sbUploadPhotoItem.
     How:   If adding user filenames later:
              const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
     Priority: LOW today — no user input in path.

 [ ] 11.2.5 — Server-side file size cap (defense in depth)
     What:  Bucket has 15 MB limit, app checks 15 MB client-side. Both layers
            are good — verify the bucket limit is set correctly in the dashboard
            (not "unlimited").
     Where: Supabase → Storage → visit-photos → settings.
     How:   Confirm "File size limit" is set to 15 MB or lower.
     Priority: LOW — already configured; verify once.


── 11.3 NETWORK & THIRD-PARTY ─────────────────────────────────────────────────

 [ ] 11.3.1 — Subresource Integrity (SRI) for Supabase-js CDN
     What:  `supabase.js` imports from `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm`
            without SRI. If jsdelivr is compromised (has happened to other
            CDNs), malicious JS runs on your users' browsers with their session.
     Where: `supabase.js` line 1.
     How:   Options in order of preference:
              (a) Self-host the library: download supabase-js, put in
                  `vendor/supabase.js`, import from `./vendor/supabase.js`.
                  ← STRONGEST: no third party at all.
              (b) Use SRI: get the SHA-384 hash from jsdelivr's docs and
                  add `integrity="sha384-..."` + `crossorigin="anonymous"`.
                  But ES module imports don't support `integrity` directly
                  in browsers reliably — option (a) is better.
              (c) Pin the version: `@supabase/supabase-js@2.45.4` (exact
                  version), so you get security updates on your schedule.
                  This is what you have implicitly via `@2`, but pinning
                  exactly prevents surprise breaking changes.
     Priority: HIGH — this is the only third-party script; self-hosting
               removes the last external trust dependency.

 [ ] 11.3.2 — Google Fonts privacy
     What:  `fonts.googleapis.com` and `fonts.gstatic.com` are loaded on
            every page view. Google sees every user's IP address. For an
            internal Ministry app, that may be a policy violation.
     Where: `index.html` `<link rel="preconnect">` + `<link href="...fonts...">`.
     How:   Download Tajawal WOFF2 files from Google Fonts, host them locally
            under `assets/fonts/`, add `@font-face` declarations in main.css,
            remove the Google URLs. Reduces external requests to zero.
     Priority: MEDIUM — depends on the Ministry's data-handling policy.

 [ ] 11.3.3 — Enable Content-Security-Policy
     What:  `netlify.toml` has CSP commented out. Enable it after verifying
            in browser DevTools that no violations fire.
     Where: `netlify.toml` (uncomment the CSP line).
     How:   Test with `Content-Security-Policy-Report-Only` first (doesn't
            block, just reports to console). Confirm no violations, then
            switch to enforcing `Content-Security-Policy`.
     Priority: MEDIUM — CSP is the single most effective defense against XSS
               after it's enabled.

 [ ] 11.3.4 — CSP violation reporting endpoint
     What:  Once CSP is enabled, add `report-uri` or `report-to` so violations
            are logged even when you're not staring at DevTools.
     Where: `netlify.toml` CSP header.
     How:   Add `report-uri https://YOUR-COLLECTOR` to the CSP directive.
            Options: Sentry, Report URI (report-uri.com), or a small Netlify
            Function that logs to a file.
     Priority: LOW — only useful after CSP is enabled.

 [ ] 11.3.5 — Referrer-Policy tightening
     What:  Currently `strict-origin-when-cross-origin`. When a user clicks
            an external link (e.g. Google Maps from the visit card), the
            browser sends the origin. For a Ministry app, this may be more
            than you want to reveal.
     Where: `netlify.toml` Referrer-Policy header.
     How:   Consider `no-referrer` — nothing leaves the app:
              Referrer-Policy = "no-referrer"
            Trade-off: some sites behave differently without a referrer.
     Priority: LOW.

 [ ] 11.3.6 — External link confirmation
     What:  Clicking a Google Maps link opens `https://www.google.com/maps?q=...`.
            A malicious tab could redirect (rare). Users may want confirmation.
     Where: `ui.js` renderVisits (the `<a href="https://www.google.com/maps...">`).
     How:   Add `onclick` confirm, or a "لم يتم التحقق من الرابط" notice.
            Very low value for this app — external links go to a trusted host.
     Priority: SKIP unless policy requires.

 [ ] 11.3.7 — `rel="noopener noreferrer"` audit
     What:  All external links should have `rel="noopener noreferrer"`.
            Current code has `rel="noopener"` — add `noreferrer` too.
     Where: `ui.js` renderVisits (map link), any future external links.
     How:   Grep for `target="_blank"` — ensure every one has both `noopener`
            and `noreferrer`.
     Priority: LOW — already mostly correct.


── 11.4 SESSION & AUTH ────────────────────────────────────────────────────────

 [ ] 11.4.1 — Client-side inactivity timeout
     What:  A stolen laptop with a signed-in browser gives admin access
            until the JWT expires (30 days default). Add an inactivity timer
            that forces sign-out after N hours idle.
     Where: `app.js` (new code).
     How:
              let _lastActivity = Date.now();
              ['click','keydown','mousemove','touchstart'].forEach(evt =>
                document.addEventListener(evt, () => _lastActivity = Date.now(), { passive: true })
              );
              setInterval(async () => {
                if (currentUser && Date.now() - _lastActivity > 8 * 3600000) {
                  await sbSignOut(); showAuth();
                }
              }, 60000);
     Priority: MEDIUM.

 [ ] 11.4.2 — Verify user still exists before admin actions
     What:  If an admin is deleted from `auth.users`, their JWT remains
            valid until it expires. They can still call the Edge Function
            if the function only checks JWT validity.
     Where: Edge Function `admin-users`.
     How:   Already handled — the function calls `adminSb.auth.getUser()`
            which validates the JWT against the current `auth.users` table.
            Supabase invalidates tokens when the user is deleted. ✅
     Verify: Create a test user, sign in as them in an incognito tab, delete
             the user as admin, then try the Edge Function from the signed-in
             tab. Should return 401.
     Priority: VERIFY once, then close.

 [ ] 11.4.3 — Supabase Auth rate limits tuning
     What:  Supabase defaults to 30 auth requests/hour per IP for sign-in.
            That may be too permissive (or too restrictive) for your user base.
     Where: Supabase → Authentication → Settings → Rate Limits.
     How:   Review and adjust:
              · Sign-in: tighten to 10/hour/IP if only a few users.
              · Sign-up: irrelevant (disabled).
              · Email: tighten to 5/hour/IP.
     Priority: LOW — defaults are reasonable.

 [ ] 11.4.4 — Failed sign-in notification
     What:  No alert if someone tries 100 passwords against your admin account.
            Supabase logs this but doesn't notify.
     Where: A small "last sign-in" record + email check on suspicious activity.
     How:   Store `last_sign_in_at` on each profile. On successful sign-in,
            if the previous `last_sign_in_at` was > 30 days ago, log/warn.
            For real alerts, use a Netlify cron + Supabase Auth Logs API.
     Priority: LOW — useful but requires external infra.

 [ ] 11.4.5 — Two-factor authentication (TOTP)
     What:  Supabase supports TOTP-based MFA. For admin accounts, this is the
            single highest-impact security feature you can add.
     Where: Supabase → Authentication → MFA. Also add UI in `ui.js` for
            enrollment and verification.
     How:   Steps:
              1. Enable MFA in Supabase dashboard.
              2. Add a "Security" section to the users modal (only shown to self).
              3. Provide QR code enrollment via `sb.auth.mfa.enroll()`.
              4. On sign-in, prompt for TOTP via `sb.auth.mfa.challenge()`.
     Priority: HIGH for admins — worth the 4–6 hours of implementation time.
               LOW for regular users.

 [ ] 11.4.6 — Session termination on suspicious events
     What:  If you delete a user or downgrade an admin, their current session
            remains valid until the JWT expires (default 1 hour with refresh).
     Where: Supabase dashboard or Edge Function.
     How:   When deleting/downgrading a user, also call
            `adminSb.auth.admin.signOut(userId, 'global')` to terminate all
            their sessions immediately.
     Priority: MEDIUM — closes a ~1 hour window after downgrade.

 [ ] 11.4.7 — Password history (no reuse)
     What:  A user can currently set the same password they used before.
            Not a critical issue, but for admin accounts, a password history
            (last 5 disallowed) prevents "rotate to same".
     Where: Edge Function `reset-password`.
     How:   Requires an `admin_password_history` table with hashes (bcrypt).
            Complex. Only worth it if policy mandates.
     Priority: LOW.

 [ ] 11.4.8 — Sign-out should clear local cache
     What:  Clicking "خروج" clears the session token but leaves
            `edu_projects_v25_ar` and IndexedDB photos behind. On a shared
            device, the next user can read them in DevTools.
     Where: `ui.js` `#btnLogout` handler.
     How:   After `sbSignOut()`, optionally:
              · Ask "Clear local cache too?" (recommended for shared devices).
              · If yes: delete STORE_KEY from localStorage, clear IndexedDB
                photos store, clear sync queue.
            Or add a separate "Clear local data" button in the users modal.
     Priority: MEDIUM — depends on device-sharing policy.


── 11.5 DATA INTEGRITY & VALIDATION ──────────────────────────────────────────

 [ ] 11.5.1 — Server-side validation for Edge Function inputs
     What:  The Edge Function only validates email format and password length.
            A malicious admin could create a user with `role: 'superadmin'`
            (not in the enum, but Postgres CHECK would fail — good), or with
            a name containing 10 MB of text (no limit).
     Where: Edge Function `admin-users` create action.
     How:   Add explicit validation:
              if (typeof name !== 'string' || name.length > 100) return 400;
              if (typeof email !== 'string' || email.length > 254) return 400;
              if (!['user','admin'].includes(role)) return 400;
     Priority: MEDIUM.

 [ ] 11.5.2 — Tombstone pruning
     What:  `edu_deleted_ids_v1` grows forever. 10,000 deletions = 200 KB of
            tombstones, slowing every `pullFromSupabase`. A malicious local
            script could fill it to the localStorage quota (5 MB).
     Where: `core.js` markDeletedLocally / unmarkDeletedLocally.
     How:   After a successful flush, prune tombstones older than N days
            (add `{ id, deletedAt }` instead of just `[id]`). Or cap at 500
            with FIFO eviction.
     Priority: LOW — takes years of abuse to matter.

 [ ] 11.5.3 — Sync queue cap
     What:  If offline for a very long time (e.g. device in airplane mode for
            weeks with continuous edits), the queue grows unbounded and
            eventually fills IndexedDB.
     Where: `core.js` enqueueSync.
     How:   If `countSyncQueue() > 500`, warn the user to go online and
            flush; block new writes if `> 1000`.
     Priority: LOW.

 [ ] 11.5.4 — Validate photos count against server
     What:  Client caps at `MAX_PHOTOS_PER_VISIT = 10`. Server doesn't
            enforce this. A malicious write could add a visit with 1000
            photoIds in `data.visits[].photoIds`.
     Where: Postgres trigger on `projects.data`.
     How:   Either CHECK constraint on jsonb, or a trigger:
              if (jsonb_array_length(...) > 10) raise exception 'Too many photos';
     Priority: LOW.

 [ ] 11.5.5 — Verify owner_id matches on every remote update
     What:  `sbUpsertProject` sets `owner_id: resolveOwnerId(project)`. If
            the client is manipulated, it could set `owner_id` to someone else
            (RLS insert allows admin to set any owner).
     Where: `core.js` sbUpsertProject.
     How:   Server-side trigger: verify `owner_id` is one of:
              (a) the current user, OR
              (b) if current user is admin, someone else (allowed).
            Actually RLS already permits admin to set any owner — that's
            intentional for reassignment. So this is fine as-is.
     Priority: NONE — working as designed. Listed for clarity.

 [ ] 11.5.6 — Reject invalid dates at DB level
     What:  `data.startDate` and `data.endDate` are free-form strings in
            jsonb. A malformed date doesn't break anything visible but could
            cause issues in report generation later.
     Where: Postgres CHECK constraint on `data jsonb`.
     How:   `check (data->>'startDate' IS NULL OR data->>'startDate' ~ '^\d{4}-\d{2}-\d{2}$')`.
            Or a trigger that validates with `::date` cast.
     Priority: LOW.

 [ ] 11.5.7 — Multi-tab consistency
     What:  Two tabs open → both write to localStorage + IndexedDB. The
            second tab may overwrite the first's unsaved changes (IndexedDB
            handles transactions but localStorage doesn't).
     Where: `core.js` save().
     How:   Use `window.addEventListener('storage', ...)` to sync between tabs.
            On storage event, reload `projects` and `render()`. For sync
            queue, IndexedDB transactions handle it correctly already.
     Priority: LOW — most users have one tab open.

 [ ] 11.5.8 — Sync queue payload encryption (at rest in browser)
     What:  The sync queue stores full project JSON in IndexedDB. Anyone
            with DevTools can read it. Same as localStorage exposure but
            IndexedDB is often overlooked.
     Where: Browser storage design.
     How:   Not practical without a lot of work. The exposure is identical
            to `edu_projects_v25_ar`. Both are protected only by browser
            same-origin policy.
     Priority: SKIP — same threat model as ISSUE-08.


── 11.6 MONITORING & DETECTION ───────────────────────────────────────────────

 [ ] 11.6.1 — Enable Supabase API logs
     What:  Supabase keeps logs of every API call for a limited retention
            (1 day on free tier, 7 on Pro). Confirm they're available and
            you know how to read them.
     Where: Supabase dashboard → Logs → API / Auth / Storage.
     How:   After a suspicious event, filter by date + user ID. Confirm logs
            exist for the last 24 hours.
     Priority: MEDIUM — critical for post-incident forensics.

 [ ] 11.6.2 — Auth anomaly detection
     What:  Supabase provides basic auth anomaly alerts (unusual locations,
            excessive failed logins). Enable them.
     Where: Supabase → Authentication → Settings → Security.
     How:   Turn on email notifications for:
              · New device sign-in
              · Excessive failed attempts
              · Multiple concurrent sessions from different IPs
     Priority: MEDIUM.

 [ ] 11.6.3 — Daily automated check (Netlify scheduled function)
     What:  A small Netlify Function that runs daily, hits Supabase, and
            emails you a one-line health summary:
              · Number of admins
              · Number of projects + photos
              · Any unexpected changes in the last 24h
     Where: New Netlify Function + Netlify cron.
     How:   ~50 lines of Node. Sends via Resend or SMTP. Worth it once you
            go live with real users.
     Priority: LOW.

 [ ] 11.6.4 — WAF / DDoS protection
     What:  Netlify has basic DDoS protection. For an internal app with a
            handful of users, this is more than enough. But if your Supabase
            project gets popular (unlikely), consider Cloudflare in front.
     Where: N/A (Netlify).
     How:   No action needed unless traffic spikes.
     Priority: SKIP.

 [ ] 11.6.5 — Fail2ban equivalent for auth
     What:  After N failed sign-ins from the same IP, temporarily block.
            Supabase Auth rate limits handle this at the platform level.
     Where: Supabase (already doing this).
     How:   No action needed.
     Priority: SKIP — Supabase covers it.

 [ ] 11.6.6 — Full page-load audit trail
     What:  Every page load could log: user_id, IP, user_agent, timestamp.
            Helps answer "who was logged in on 2026-11-10 at 14:00?".
     Where: A new `login_events` table + a trigger on Supabase Auth.
     How:   Supabase Auth doesn't expose a native trigger for this. Requires
            a database webhook or a Supabase Auth Hook (Pro tier feature).
     Priority: LOW — nice to have.


── 11.7 PRIVACY & COMPLIANCE ─────────────────────────────────────────────────

 [ ] 11.7.1 — Privacy notice on sign-in
     What:  The app stores geolocation, photos, names, notes. Users should
            be told before signing in.
     Where: `index.html` auth screen.
     How:   Add a short paragraph: "بالدخول أنت توافق على تخزين بيانات
            المشاريع التي تُدخلها، والصور والمواقع الجغرافية التي تُلتقط
            خلال الزيارات، ومزامنتها مع خوادم الوزارة."
            Link to a full policy if one exists.
     Priority: MEDIUM — depends on Ministry policy.

 [ ] 11.7.2 — Photo stamp consent
     What:  Photos are stamped with exact GPS + username + timestamp. Users
            may not realize the photos are this revealing.
     Where: `index.html` newVisitModal.
     How:   Add a small notice under the photo button:
            "ستُختم كل صورة بالتاريخ والموقع واسمك تلقائياً. لا تلتقط صوراً
            في مواقع حساسة."
     Priority: MEDIUM.

 [ ] 11.7.3 — Data retention policy
     What:  How long do you keep old visits? Old projects? Currently: forever.
     Where: Operational decision + (optional) a cleanup Edge Function.
     How:   Define a policy. E.g. "archive projects older than 2 years".
            Then either:
              (a) A cron job that exports + deletes old rows.
              (b) Manual monthly cleanup.
     Priority: LOW today — will become important as data grows.

 [ ] 11.7.4 — Right to erasure (delete a user's data)
     What:  If a user leaves the Ministry, their projects should be
            reassigned or deleted, and their auth account removed.
     Where: Supabase Authentication → Users → delete + manual reassignment.
     How:   Documented procedure:
              1. Reassign their projects (update owner_id via admin UI).
              2. Delete their account via Users modal.
              3. Verify their projects now belong to someone else.
              4. Their photos are now accessible only to the new owner.
     Priority: LOW — add to OPERATIONS.md as a procedure.

 [ ] 11.7.5 — No third-party analytics
     What:  The app has no analytics, no cookies beyond session, no tracking.
            Good. Keep it that way.
     Where: N/A.
     How:   If you ever add analytics, use self-hosted (Plausible, Umami) or
            ensure no PII is collected and no cross-site tracking.
     Priority: N/A — this is a standing principle.

 [ ] 11.7.6 — WCAG accessibility for sign-in (security-relevant)
     What:  Screen-reader users must be able to sign in and use the app.
            Inaccessible auth = users picking weak passwords or reusing them.
     Where: `index.html`, `main.css`.
     How:   Audit with axe DevTools. Fix aria issues. Add labels to all inputs.
     Priority: LOW (security-adjacent).


── 11.8 EDGE CASES & FUTURE-PROOFING ─────────────────────────────────────────

 [ ] 11.8.1 — Handle JWT expiry mid-session gracefully
     What:  If a session expires while the user is filling a form, the next
            save will fail. Currently the app shows a generic sync error.
     Where: `core.js` flushQueue catch block.
     How:   Detect `401` / `JWT expired` in the error message, then:
              await sbSignOut();
              showAuth();
              toast('انتهت الجلسة — يرجى تسجيل الدخول مجدداً', 'bad');
     Priority: MEDIUM — improves UX and prevents confusion.

 [ ] 11.8.2 — Detect account deletion mid-session
     What:  Similar to above. If admin deletes a user's account, the user's
            existing session keeps working until JWT expiry. Their writes
            fail with a 401/403.
     Where: Same as 11.8.1.
     How:   Same handling — sign out on 401/403 from a background write.
     Priority: MEDIUM.

 [ ] 11.8.3 — Validate Supabase client is loaded before use
     What:  `supabase.js` is a module script — deferred. If a slow network
            delays it, `window.sb` may be undefined briefly. The current code
            handles this in `bootAuth` (3-second timeout). Verify all other
            entry points also guard.
     Where: `ui.js`, `app.js`.
     How:   `if(!window.sb) { toast('...'); return; }` before any
            `window.sb.*` call.
     Priority: LOW — mostly handled.

 [ ] 11.8.4 — Service worker scope safety
     What:  `navigator.serviceWorker.register('/sw.js', { scope: '/' })` —
            the SW intercepts requests to the entire origin. If the app is
            ever moved to a subpath or shares a domain with another app,
            this could interfere with the other app.
     Where: `index.html` bottom script.
     How:   For GitHub Pages: change to `'./sw.js'` and `scope: './'`.
            For Netlify root deploy: current scope is correct.
     Priority: LOW — only an issue if hosting changes.

 [ ] 11.8.5 — Re-validate role on every sensitive action
     What:  If a user is demoted from admin to user, their `currentUser.role`
            in memory still says `'admin'` until they re-sign-in. They can
            still see admin buttons and click them — but the Edge Function
            will reject with 403.
     Where: `ui.js` admin-only action handlers.
     How:   Before each admin action, re-fetch the profile:
              const profile = await sbFetchProfile(currentUser.id);
              if(!profile || profile.role !== 'admin') {
                toast('لم تعد مديراً — سيتم تسجيل الخروج', 'bad');
                await sbSignOut(); showAuth(); return;
              }
            OR: listen to `sb.auth.onAuthStateChange` and refresh role on
            every token refresh.
     Priority: LOW — Edge Function blocks the action anyway; this is just
               UX (avoid the "why doesn't this button work?" confusion).

 [ ] 11.8.6 — Sign-out should terminate all sessions
     What:  The "خروج" button calls `sbSignOut()` which only terminates the
            current session. Other devices stay signed in.
     Where: `ui.js` `#btnLogout` handler.
     How:   Add a separate "Sign out everywhere" button, or in the confirm
            dialog, offer "خروج من هذا الجهاز فقط" vs "خروج من كل الأجهزة".
            The latter calls `sb.auth.signOut({ scope: 'global' })`.
     Priority: LOW — nice-to-have UX.

 [ ] 11.8.7 — Handle storage quota exceeded
     What:  IndexedDB has a per-origin quota (~50 MB typical). If a user
            captures 200 photos, IndexedDB fills and photo saves fail.
            Currently `savePhotoInDB` throws and the failure is logged.
     Where: `core.js` savePhotoInDB / `ui.js` visit save.
     How:   Catch the quota error explicitly:
              if(e.name === 'QuotaExceededError') {
                toast('مساحة التخزين المحلية ممتلئة. احذف بعض الزيارات القديمة.', 'bad');
              }
     Priority: LOW.

 [ ] 11.8.8 — HTTPS enforcement
     What:  Netlify provides HTTPS free and redirects HTTP → HTTPS by default.
            Confirm HSTS is set (already in netlify.toml §4).
     Where: `netlify.toml` + Netlify dashboard Domain settings.
     How:   Netlify → Domain management → HTTPS → verify "Force HTTPS" is ON.
     Priority: LOW — likely already configured.

 [ ] 11.8.9 — Lock down `.well-known/security.txt` (do NOT publish)
     What:  If you ever rename this SECURITY.txt file to `security.txt` and
            place it at the repo root, Netlify WILL serve it publicly as
            `/.well-known/security.txt` (RFC 9116). That's the opposite of
            what you want — this file is internal.
     Where: This file.
     How:   Keep the name `SECURITY.txt` (not `security.txt`), keep it OUT of
            the repo (per the top of this file). If you must commit it to a
            private repo, name it `SECURITY_PRIVATE.txt` or `_security.txt`.
     Priority: HIGH — prevents accidental public disclosure of this file.

 [ ] 11.8.10 — Redaction on error messages
     What:  `[sync] item failed: project upsert p_mew...` — the console
            shows internal project IDs and error messages. If a user shares
            a screenshot in a support request, IDs leak.
     Where: `core.js` flushQueue catch, `ui.js` toast messages.
     How:   Wrap console.warn calls in a DEBUG flag:
              const DEBUG = new URLSearchParams(location.search).has('debug');
              if(DEBUG) console.warn(...);
            And redact IDs from user-facing toasts:
              toast('تعذّرت مزامنة عنصر — حاول مجدداً', 'bad');
     Priority: LOW.


════════════════════════════════════════════════════════════════════════════════
 11.9 PRIORITIZED VIEW — what to do first
════════════════════════════════════════════════════════════════════════════════

 If you only do 3 things this month:
   [ ] 11.1.2 — CSV formula injection guard          (30 min, HIGH)
   [ ] 11.3.1 — Self-host supabase-js (remove CDN)   (1 hour, HIGH)
   [ ] 11.8.9 — Confirm SECURITY.txt stays private   (5 min, HIGH)

 If you do 5 things this quarter:
   The 3 above PLUS:
   [ ] 11.1.1 — Full HTML escape audit               (2 hours, HIGH)
   [ ] 11.4.5 — TOTP for admins                      (4 hours, HIGH)

 The next tier (when you have time):
   [ ] 11.3.3 — Enable CSP                           (2 hours, MEDIUM)
   [ ] 11.2.1 — Magic-byte photo validation          (1 hour, MEDIUM)
   [ ] 11.2.2 — Image bomb guard                     (30 min, MEDIUM)
   [ ] 11.4.1 — Inactivity timeout                   (1 hour, MEDIUM)
   [ ] 11.4.6 — Session termination on downgrade     (1 hour, MEDIUM)
   [ ] 11.5.1 — Server-side input validation         (2 hours, MEDIUM)
   [ ] 11.7.1 — Privacy notice on sign-in            (1 hour, MEDIUM)

 Everything else can wait until the app has more users or higher stakes.

════════════════════════════════════════════════════════════════════════════════
 END OF SECTION 11 — SECURITY: TODO
════════════════════════════════════════════════════════════════════════════════
════════════════════════════════════════════════════════════════════════════════
 END OF FILE — This file is meant to grow. Add to it as you learn.
════════════════════════════════════════════════════════════════════════════════