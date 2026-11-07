/* ===================== supabase.js =====================
   Minimal client + storage adapter.
   Requires: @supabase/supabase-js CDN loaded BEFORE this file.
   ==================================================== */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const sb = createClient(
  window.APP_CONFIG.SUPABASE_URL,
  window.APP_CONFIG.SUPABASE_ANON_KEY,
  { auth: { persistSession: true, autoRefreshToken: true } }
);

window.sb = sb; // expose for console debugging

/* ── Projects table (columns: id uuid pk, name text, data jsonb, updated_at timestamptz) ── */
async function sbLoadProjects() {
  const { data, error } = await sb.from('projects').select('*').order('updated_at', { ascending: false });
  if (error) throw error;
  return data.map(r => ({ ...r.data, id: r.id, updatedAt: r.updated_at }));
}

async function sbSaveProjects(projects) {
  const rows = projects.map(p => ({
    id: p.id,
    name: p.name,
    data: p,
    updated_at: new Date().toISOString()
  }));
  const { error } = await sb.from('projects').upsert(rows);
  if (error) throw error;
}

/* ── Photos: use Supabase Storage bucket "visit-photos" ── */
async function sbSavePhoto(photo) {
  const path = `${photo.projectId}/${photo.id}.jpg`;
  const { error } = await sb.storage.from('visit-photos').upload(path, photo.blob, { upsert: true });
  if (error) throw error;
  return path;
}

async function sbGetPhotoUrl(path) {
  const { data } = sb.storage.from('visit-photos').getPublicUrl(path);
  return data.publicUrl;
}