import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const programs: { spec_slug: string; inst_slug: string; vagas: number; cenario: string }[] = await req.json();

    // Fetch all specialties and institutions for slug->id mapping
    const { data: specs } = await supabase.from("enamed_specialties").select("id, slug");
    const { data: insts } = await supabase.from("enamed_institutions").select("id, slug");

    const specMap = new Map(specs!.map((s: any) => [s.slug, s.id]));
    const instMap = new Map(insts!.map((i: any) => [i.slug, i.id]));

    // Build rows
    const rows = programs.map((p) => ({
      specialty_id: specMap.get(p.spec_slug),
      institution_id: instMap.get(p.inst_slug),
      vagas: p.vagas,
      cenario_pratica: p.cenario,
    })).filter(r => r.specialty_id && r.institution_id);

    // Insert in batches of 200
    let inserted = 0;
    const batchSize = 200;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await supabase.from("enamed_programs").insert(batch);
      if (error) throw error;
      inserted += batch.length;
    }

    return new Response(JSON.stringify({ ok: true, inserted, total: programs.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
