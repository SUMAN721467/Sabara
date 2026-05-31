import { createFileRoute } from "@tanstack/react-router";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";

async function resolveSupabaseClient(request: Request, context: any) {
  let supabase = (context as any)?.supabase;
  let userId = (context as any)?.userId;

  const authHeader = request.headers.get("authorization");
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;

  // Extract userId from token if not provided in context
  if (!userId && token) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (supabaseUrl && supabaseKey) {
      try {
        const tempClient = createClient(supabaseUrl, supabaseKey);
        const { data } = await tempClient.auth.getClaims(token);
        if (data?.claims?.sub) {
          userId = data.claims.sub;
        }
      } catch (e) {
        console.error("[resolveSupabaseClient extract sub error]", e);
      }
    }
  }

  // Create client: Prefer service role key if available to bypass RLS on backend server calls
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (supabaseUrl) {
    if (serviceKey && serviceKey.trim() && serviceKey.trim().startsWith("eyJ")) {
      supabase = createClient(supabaseUrl, serviceKey, {
        auth: {
          storage: undefined,
          persistSession: false,
          autoRefreshToken: false,
        }
      });
    } else if (token && supabaseKey) {
      supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: {
          storage: undefined,
          persistSession: false,
          autoRefreshToken: false,
        }
      });
    }
  }

  return { supabase, userId };
}

export const Route = createFileRoute("/api/users/profile")({
  server: {
    middlewares: [requireSupabaseAuth],
    handlers: {
      // ── GET /api/users/profile ───────────────────────────────────────────
      GET: async ({ request, context }) => {
        try {
          const { supabase, userId } = await resolveSupabaseClient(request, context);

          if (!supabase || !userId) {
            return Response.json({ success: false, error: "Unauthorized: Missing session" }, { status: 401 });
          }

          const { data, error } = await supabase
            .from("user_profiles")
            .select("*")
            .eq("id", userId)
            .single();

          if (error && error.code !== "PGRST116") {
            console.error("[profile GET]", error.message);
            return Response.json({ success: false, error: error.message }, { status: 500 });
          }

          if (!data) {
            return Response.json({ success: true, profile: null });
          }

          const profile = {
            fullName: data.full_name,
            age: data.age,
            phone: data.phone,
            avatarUrl: data.avatar_url,
            address: {
              street: data.street,
              city: data.city,
              state: data.state,
              zipCode: data.zip_code,
            },
          };

          return Response.json({ success: true, profile });
        } catch (err: any) {
          console.error("[profile GET error]", err);
          return Response.json({ success: false, error: err.message }, { status: 500 });
        }
      },

      // ── POST /api/users/profile ──────────────────────────────────────────
      POST: async ({ request, context }) => {
        try {
          const { supabase, userId } = await resolveSupabaseClient(request, context);

          if (!supabase || !userId) {
            return Response.json({ success: false, error: "Unauthorized: Missing session" }, { status: 401 });
          }

          const body = await request.json();
          const { fullName, age, phone, address, avatarUrl } = body as {
            fullName?: string;
            age?: string | number;
            phone?: string;
            avatarUrl?: string | null;
            address?: { street?: string; city?: string; state?: string; zipCode?: string };
          };

          // Handle age string-to-number safe casting
          const parsedAge = age && age !== "" ? Number(age) : null;

          // Fetch the existing profile to preserve avatar_url if not explicitly provided
          let existingAvatarUrl = null;
          try {
            const { data: existing } = await supabase
              .from("user_profiles")
              .select("avatar_url")
              .eq("id", userId)
              .single();
            if (existing) {
              existingAvatarUrl = existing.avatar_url;
            }
          } catch (e) {
            console.error("[profile POST] Error fetching existing avatar_url:", e);
          }

          const finalAvatarUrl = avatarUrl !== undefined ? avatarUrl : existingAvatarUrl;

          const { data, error } = await supabase
            .from("user_profiles")
            .upsert(
              {
                id: userId,
                full_name: fullName ?? null,
                age: parsedAge,
                phone: phone ?? null,
                street: address?.street ?? null,
                city: address?.city ?? null,
                state: address?.state ?? null,
                zip_code: address?.zipCode ?? null,
                avatar_url: finalAvatarUrl,
              },
              { onConflict: "id" },
            )
            .select()
            .single();

          if (error) {
            console.error("[profile POST]", error.message);
            return Response.json({ success: false, error: error.message }, { status: 500 });
          }

          const profile = {
            fullName: data.full_name,
            age: data.age,
            phone: data.phone,
            avatarUrl: data.avatar_url,
            address: {
              street: data.street,
              city: data.city,
              state: data.state,
              zipCode: data.zip_code,
            },
          };

          return Response.json({ success: true, profile });
        } catch (err: any) {
          console.error("[profile POST error]", err);
          return Response.json({ success: false, error: err.message }, { status: 500 });
        }
      },
    },
  },
});
