const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const HUBSPOT_WEBHOOK_URL =
  "https://api-na1.hubapi.com/automation/v4/webhook-triggers/9321751/E0lS7db";

function subscriberType(segment?: string): string {
  if (segment === "pro") return "Aluno PRO";
  if (segment === "standard") return "Aluno SanarFlix";
  return "Não assinante";
}

interface UserPayload {
  email: string;
  full_name?: string;
  segment?: string;
  created_at?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Mode: "bulk" syncs all existing users, "single" syncs one user
    const mode: string = body.mode || "single";

    if (mode === "bulk") {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceRoleKey);

      let allUsers: UserPayload[] = [];
      let from = 0;
      const pageSize = 500;

      while (true) {
        const { data, error } = await supabase
          .from("profiles")
          .select("email, full_name, segment, created_at")
          .not("email", "is", null)
          .range(from, from + pageSize - 1);

        if (error) {
          console.error("Error fetching profiles:", error);
          break;
        }
        if (!data || data.length === 0) break;

        allUsers = allUsers.concat(data as UserPayload[]);
        if (data.length < pageSize) break;
        from += pageSize;
      }

      console.log(`Bulk sync: ${allUsers.length} users to send`);

      let successCount = 0;
      let failCount = 0;

      for (const user of allUsers) {
        try {
          const res = await fetch(HUBSPOT_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: user.email,
              full_name: user.full_name || "",
              segment: user.segment || "guest",
              subscriber_type: subscriberType(user.segment),
              registered_at: user.created_at || new Date().toISOString(),
              source: "enamed-arena",
            }),
          });

          if (res.ok) {
            successCount++;
          } else {
            failCount++;
            console.error(`HubSpot error for ${user.email}: ${res.status}`);
          }
        } catch (err) {
          failCount++;
          console.error(`Network error for ${user.email}:`, err);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          total: allUsers.length,
          sent: successCount,
          failed: failCount,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Single user mode
    const { email, full_name, segment, created_at } = body as UserPayload;

    if (!email) {
      return new Response(
        JSON.stringify({ error: "email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const hubspotPayload = {
      email,
      full_name: full_name || "",
      segment: segment || "guest",
      registered_at: created_at || new Date().toISOString(),
      source: "enamed-arena",
    };

    console.log("Sending to HubSpot:", JSON.stringify(hubspotPayload));

    const hubspotRes = await fetch(HUBSPOT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(hubspotPayload),
    });

    const status = hubspotRes.status;
    let responseBody: string;
    try {
      responseBody = await hubspotRes.text();
    } catch {
      responseBody = "";
    }

    console.log(`HubSpot response: ${status} - ${responseBody}`);

    return new Response(
      JSON.stringify({ success: hubspotRes.ok, hubspot_status: status }),
      {
        status: hubspotRes.ok ? 200 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
