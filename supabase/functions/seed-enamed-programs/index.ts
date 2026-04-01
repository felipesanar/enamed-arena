import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function slugify(text: string): string {
  return text.trim().toLowerCase()
    .replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e').replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o').replace(/[ùúûü]/g, 'u').replace(/[ç]/g, 'c')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const programs: { spec: string; inst: string; uf: string; vagas: number; cenario: string }[] = await req.json();

    // Delete all existing programs
    await supabase.from("enamed_programs").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // Gather unique institutions from programs
    const instKeys = new Map<string, { name: string; uf: string }>();
    for (const p of programs) {
      const key = `${p.inst.trim()}||${p.uf.trim()}`;
      if (!instKeys.has(key)) instKeys.set(key, { name: p.inst.trim(), uf: p.uf.trim() });
    }

    // Insert missing institutions
    const { data: existingInsts } = await supabase.from("enamed_institutions").select("id, name, uf");
    const existingKeys = new Set(existingInsts!.map((i: any) => `${i.name.trim()}||${i.uf.trim()}`));
    
    const missingInsts: { name: string; uf: string; slug: string }[] = [];
    const usedSlugs = new Set(existingInsts!.map((i: any) => i.slug));
    
    for (const [key, info] of instKeys) {
      if (!existingKeys.has(key)) {
        let slug = `${slugify(info.name)}-${info.uf.toLowerCase()}`;
        let counter = 1;
        while (usedSlugs.has(slug)) { slug = `${slugify(info.name)}-${info.uf.toLowerCase()}-${counter++}`; }
        usedSlugs.add(slug);
        missingInsts.push({ name: info.name, uf: info.uf, slug });
      }
    }

    if (missingInsts.length > 0) {
      const { error: insErr } = await supabase.from("enamed_institutions").insert(missingInsts);
      if (insErr) throw new Error(`Insert institutions: ${insErr.message}`);
    }

    // Re-fetch all institutions and specialties
    const { data: allInsts } = await supabase.from("enamed_institutions").select("id, name, uf");
    const { data: allSpecs } = await supabase.from("enamed_specialties").select("id, name");

    const specMap = new Map(allSpecs!.map((s: any) => [s.name.trim(), s.id]));
    const instMap = new Map(allInsts!.map((i: any) => [`${i.name.trim()}||${i.uf.trim()}`, i.id]));

    const rows = [];
    const errors: string[] = [];

    for (const p of programs) {
      const specId = specMap.get(p.spec.trim());
      const instKey = `${p.inst.trim()}||${p.uf.trim()}`;
      const instId = instMap.get(instKey);

      if (!specId) { errors.push(`Missing spec: ${p.spec}`); continue; }
      if (!instId) { errors.push(`Missing inst: ${instKey}`); continue; }

      rows.push({ specialty_id: specId, institution_id: instId, vagas: p.vagas, cenario_pratica: p.cenario });
    }

    let inserted = 0;
    for (let i = 0; i < rows.length; i += 200) {
      const batch = rows.slice(i, i + 200);
      const { error } = await supabase.from("enamed_programs").insert(batch);
      if (error) throw new Error(`Insert batch ${i}: ${error.message}`);
      inserted += batch.length;
    }

    return new Response(JSON.stringify({
      ok: true,
      inserted,
      total: programs.length,
      newInstitutions: missingInsts.length,
      errors: [...new Set(errors)].slice(0, 20),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
