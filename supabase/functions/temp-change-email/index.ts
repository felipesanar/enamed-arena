import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (req) => {
  try {
    const { from, to } = await req.json();
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    let page = 1;
    let user: any = null;
    while (page <= 30 && !user) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      user = data.users.find((u) => u.email?.toLowerCase() === String(from).toLowerCase());
      if (data.users.length < 200) break;
      page++;
    }
    if (!user) return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
    const { data: upd, error: e2 } = await admin.auth.admin.updateUserById(user.id, {
      email: to,
      email_confirm: true,
    });
    if (e2) throw e2;
    await admin.from("profiles").update({ email: to }).eq("id", user.id);
    return new Response(JSON.stringify({ id: upd.user.id, email: upd.user.email }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
