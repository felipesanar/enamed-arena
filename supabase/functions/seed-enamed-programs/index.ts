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

    const programs: { spec: string; inst: string; uf: string; vagas: number; cenario: string }[] = await req.json();

    // Delete existing programs first (clean re-insert)
    await supabase.from("enamed_programs").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // Fetch all specialties and institutions
    const { data: specs } = await supabase.from("enamed_specialties").select("id, name");
    const { data: insts } = await supabase.from("enamed_institutions").select("id, name, uf");

    const specMap = new Map(specs!.map((s: any) => [s.name.toUpperCase().trim(), s.id]));
    const instMap = new Map(insts!.map((i: any) => [`${i.name.trim()}||${i.uf.trim()}`, i.id]));

    // Also try case-insensitive matching for institutions
    const instMapUpper = new Map(insts!.map((i: any) => [`${i.name.toUpperCase().trim()}||${i.uf.trim()}`, i.id]));

    const rows = [];
    const missingInsts = new Set<string>();
    const missingSpecs = new Set<string>();

    for (const p of programs) {
      const specId = specMap.get(p.spec.toUpperCase().trim());
      const instKey = `${p.inst.trim()}||${p.uf.trim()}`;
      const instKeyUpper = `${p.inst.toUpperCase().trim()}||${p.uf.trim()}`;
      const instId = instMap.get(instKey) || instMapUpper.get(instKeyUpper);

      if (!specId) { missingSpecs.add(p.spec); continue; }
      if (!instId) { missingInsts.add(instKey); continue; }

      rows.push({
        specialty_id: specId,
        institution_id: instId,
        vagas: p.vagas,
        cenario_pratica: p.cenario,
      });
    }

    // Insert in batches
    let inserted = 0;
    const batchSize = 200;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await supabase.from("enamed_programs").insert(batch);
      if (error) throw error;
      inserted += batch.length;
    }

    return new Response(JSON.stringify({
      ok: true,
      inserted,
      total: programs.length,
      missingSpecs: [...missingSpecs],
      missingInsts: [...missingInsts].slice(0, 20),
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
