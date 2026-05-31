import { createFileRoute } from "@tanstack/react-router";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";

function getAdminEmails(): Set<string> {
  const envEmails = process.env.ADMIN_EMAILS || process.env.VITE_ADMIN_EMAILS || "";
  const emails = new Set(
    envEmails
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
  emails.add("contact.sabara@gmail.com");
  return emails;
}

async function assertAdmin(request: Request, context: any) {
  let claims = context?.claims;
  
  if (!claims) {
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      if (supabaseUrl && supabaseKey) {
        try {
          const supabase = createClient(supabaseUrl, supabaseKey);
          const { data } = await supabase.auth.getClaims(token);
          if (data?.claims) {
            claims = data.claims;
          }
        } catch (e) {
          console.error("[assertAdmin fallback site settings authentication failed]", e);
        }
      }
    }
  }

  const email = (
    claims?.email || 
    claims?.user_metadata?.email || 
    ""
  ).toLowerCase().trim();
  
  const adminSet = getAdminEmails();

  if (!email || !adminSet.has(email)) {
    const contextKeys = Object.keys(context || {}).join(", ");
    const claimsKeys = claims ? Object.keys(claims).join(", ") : "null";
    throw new Error(
      `Forbidden: Admin access required. Email: "${email || "unknown"}". Context keys: [${contextKeys}]. Claims keys: [${claimsKeys}].`
    );
  }
}

export const Route = createFileRoute("/api/admin/site-settings")({
  server: {
    middlewares: [requireSupabaseAuth],
    handlers: {
      POST: async ({ request, context }) => {
        try {
          await assertAdmin(request, context);
          const body = await request.json();
          const { key, value } = body;

          if (!key || !value) {
            return Response.json({ success: false, error: "Missing key or value" }, { status: 400 });
          }

          const authHeader = request.headers.get("authorization");
          const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;

          const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
          const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
          const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
          const isServiceKeyValid = !!(serviceKey && serviceKey.trim() && serviceKey.trim().startsWith("eyJ"));

          const supabase = isServiceKeyValid
            ? createClient(supabaseUrl!, serviceKey!, {
                auth: {
                  storage: undefined,
                  persistSession: false,
                  autoRefreshToken: false,
                }
              })
            : (token 
                ? createClient(supabaseUrl!, supabaseKey!, {
                    global: { headers: { Authorization: `Bearer ${token}` } }
                  })
                : createClient(supabaseUrl!, supabaseKey!)
              );

          let dbError = null;
          let data = null;
          try {
            const res = await supabase
              .from("site_settings")
              .upsert({ key, value, updated_at: new Date().toISOString() })
              .select("*")
              .single();
            data = res.data;
            dbError = res.error;
          } catch (e: any) {
            dbError = e;
          }

          // If key is coupons, save locally to src/data/coupons.json as fallback
          let localSaved = false;
          if (key === "coupons") {
            try {
              const fs = await import("fs/promises");
              const path = await import("path");
              const filePath = path.join(process.cwd(), "src", "data", "coupons.json");
              await fs.mkdir(path.dirname(filePath), { recursive: true });
              await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf-8");
              localSaved = true;
            } catch (fsErr) {
              console.error("[api/admin/site-settings local write error]", fsErr);
            }
          }

          if (dbError) {
            console.warn("[api/admin/site-settings POST db save warning]", dbError.message || dbError);
            if (key === "coupons" && localSaved) {
              return Response.json({ success: true, localOnly: true, setting: { key, value } });
            }
            throw new Error(dbError.message || String(dbError));
          }

          return Response.json({ success: true, setting: data });
        } catch (err: any) {
          console.error("[api/admin/site-settings error]", err);
          return Response.json({ success: false, error: err.message }, { status: 500 });
        }
      },
    },
  },
});
