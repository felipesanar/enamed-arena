import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { canonicalRows, executeImport } from './import.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

Deno.serve(async req => {
  const respond = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: corsHeaders });
  if (req.method === 'OPTIONS') return respond('ok');
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405);
  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return respond({ error: 'Unauthorized' }, 401);
    const url = Deno.env.get('SUPABASE_URL')!;
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return respond({ error: 'Unauthorized' }, 401);
    const { error: capabilityError } = await userClient.rpc('admin_require', { p_capability: 'content.manage' });
    if (capabilityError) return respond({ error: 'Forbidden' }, 403);
    const body = await req.json();
    const input = body.rows ?? body.questions;
    if (typeof body.simulado_id !== 'string' || !Array.isArray(input) || !input.length || input.some(q => !q || typeof q !== 'object' || Array.isArray(q))) return respond({ error: 'simulado_id and rows required' }, 400);
    const rows = canonicalRows(input, body.image_urls);
    if (body.validate_only === true) {
      const { data, error } = await userClient.rpc('admin_validate_question_import', { p_simulado_id: body.simulado_id, p_rows: rows });
      if (error) throw error;
      return respond(data);
    }
    const batch = crypto.randomUUID();
    // Service role is confined to storage after user authentication and capability check.
    const storage = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!).storage.from('question-images');
    const call = async (name: string, payload: typeof rows) => {
      const { data, error } = await userClient.rpc(name, { p_simulado_id: body.simulado_id, p_rows: payload });
      if (error) throw error;
      return data;
    };
    const result = await executeImport(rows, body.images ?? {}, {
      validate: payload => call('admin_validate_question_import', payload),
      commit: payload => call('admin_import_questions', payload),
      upload: async (number, slot, image) => {
        const ext = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' } as Record<string, string>)[image.mime];
        if (!ext) throw new Error('Unsupported image MIME');
        const path = `${body.simulado_id}/imports/${user.id}/${batch}/${number}_${slot}.${ext}`;
        const bytes = Uint8Array.from(atob(image.data), c => c.charCodeAt(0));
        const { error } = await storage.upload(path, bytes, { contentType: image.mime, upsert: false });
        if (error) throw error;
        return { path, url: storage.getPublicUrl(path).data.publicUrl };
      },
      remove: paths => storage.remove(paths),
    });
    // inserted is an additive compatibility field for cached clients.
    return respond({ ...result, inserted: result.imported });
  } catch (error) {
    console.error('[admin-upload-questions] Import failed', error);
    return respond({ error: 'Falha na importação. Verifique o lote antes de repetir.' }, 500);
  }
});
