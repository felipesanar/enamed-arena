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

    // ── Clean slate ──
    await supabase.from("enamed_programs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("enamed_institutions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("enamed_specialties").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // ── Extract unique specialties ──
    const specSet = new Map<string, string>();
    for (const p of programs) {
      const name = p.spec.trim();
      if (name && !specSet.has(name)) specSet.set(name, slugify(name));
    }

    const specRows = [...specSet.entries()].map(([name, slug]) => ({ name, slug }));
    const { error: specErr } = await supabase.from("enamed_specialties").insert(specRows);
    if (specErr) throw new Error(`Spec insert: ${specErr.message}`);

    // ── Extract unique institutions ──
    const instSet = new Map<string, { name: string; uf: string; slug: string }>();
    const usedSlugs = new Set<string>();
    for (const p of programs) {
      const name = p.inst.trim();
      const uf = p.uf.trim();
      const key = `${name}||${uf}`;
      if (name && !instSet.has(key)) {
        let slug = `${slugify(name)}-${uf.toLowerCase()}`;
        let c = 1;
        while (usedSlugs.has(slug)) slug = `${slugify(name)}-${uf.toLowerCase()}-${c++}`;
        usedSlugs.add(slug);
        instSet.set(key, { name, uf, slug });
      }
    }

    const instRows = [...instSet.values()];
    // Insert in batches
    for (let i = 0; i < instRows.length; i += 200) {
      const { error } = await supabase.from("enamed_institutions").insert(instRows.slice(i, i + 200));
      if (error) throw new Error(`Inst insert batch ${i}: ${error.message}`);
    }

    // ── Re-fetch IDs ──
    const { data: allSpecs } = await supabase.from("enamed_specialties").select("id, name");
    const { data: allInsts } = await supabase.from("enamed_institutions").select("id, name, uf");

    const specMap = new Map(allSpecs!.map((s: any) => [s.name.trim(), s.id]));
    const instMap = new Map(allInsts!.map((i: any) => [`${i.name.trim()}||${i.uf.trim()}`, i.id]));

    // ── Insert programs ──
    const rows = [];
    const errors: string[] = [];

    for (const p of programs) {
      const specId = specMap.get(p.spec.trim());
      const instId = instMap.get(`${p.inst.trim()}||${p.uf.trim()}`);
      if (!specId) { errors.push(`Missing spec: ${p.spec}`); continue; }
      if (!instId) { errors.push(`Missing inst: ${p.inst}||${p.uf}`); continue; }
      rows.push({ specialty_id: specId, institution_id: instId, vagas: p.vagas, cenario_pratica: p.cenario });
    }

    let inserted = 0;
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await supabase.from("enamed_programs").insert(rows.slice(i, i + 200));
      if (error) throw new Error(`Prog insert batch ${i}: ${error.message}`);
      inserted += batch.length;
    }

    return new Response(JSON.stringify({
      ok: true,
      specialties: specRows.length,
      institutions: instRows.length,
      programs: inserted,
      total: programs.length,
      errors: [...new Set(errors)].slice(0, 10),
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
