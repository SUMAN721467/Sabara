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

export const Route = createFileRoute("/api/users/sync")({
  server: {
    middlewares: [requireSupabaseAuth],
    handlers: {
      // ── GET /api/users/sync ──────────────────────────────────────────────
      GET: async ({ request, context }) => {
        try {
          const { supabase, userId } = await resolveSupabaseClient(request, context);

          if (!supabase || !userId) {
            return Response.json({ success: false, error: "Unauthorized: Missing session" }, { status: 401 });
          }

          // Fetch only cart, wishlist, and login_method columns if possible, but select * is fine and robust
          const { data, error } = await supabase
            .from("user_profiles")
            .select("cart, wishlist, login_method")
            .eq("id", userId)
            .single();

          if (error && error.code !== "PGRST116") {
            console.error("[sync GET error]", error.message);
            return Response.json({ success: false, error: error.message }, { status: 500 });
          }

          return Response.json({
            success: true,
            cart: data?.cart || [],
            wishlist: data?.wishlist || [],
            loginMethod: data?.login_method || null
          });
        } catch (err: any) {
          console.error("[sync GET exception]", err);
          return Response.json({ success: false, error: err.message }, { status: 500 });
        }
      },

      // ── POST /api/users/sync ─────────────────────────────────────────────
      POST: async ({ request, context }) => {
        try {
          const { supabase, userId } = await resolveSupabaseClient(request, context);

          if (!supabase || !userId) {
            return Response.json({ success: false, error: "Unauthorized: Missing session" }, { status: 401 });
          }

          const body = await request.json();
          const { cart, wishlist, loginMethod } = body;

          // Prepare updates (only update fields that are provided in the body)
          const updates: Record<string, any> = { id: userId };
          if (cart !== undefined) updates.cart = cart;
          if (wishlist !== undefined) updates.wishlist = wishlist;
          if (loginMethod !== undefined && loginMethod !== null) updates.login_method = loginMethod;

          const { data, error } = await supabase
            .from("user_profiles")
            .upsert(updates, { onConflict: "id" })
            .select()
            .single();

          if (error) {
            console.error("[sync POST error]", error.message);
            return Response.json({ success: false, error: error.message }, { status: 500 });
          }

          return Response.json({
            success: true,
            cart: data?.cart || [],
            wishlist: data?.wishlist || [],
            loginMethod: data?.login_method || null
          });
        } catch (err: any) {
          console.error("[sync POST exception]", err);
          return Response.json({ success: false, error: err.message }, { status: 500 });
        }
      }
    }
  }
});
