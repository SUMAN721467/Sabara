import { createFileRoute } from "@tanstack/react-router";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import { getOrSeedProducts, clearProductsCache } from "../products";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function getAdminEmails(): Set<string> {
  return new Set([
    "contact.sabara@gmail.com",
    "sumansamanta721467@gmail.com",
  ]);
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
          const { data } = await supabaseAdmin.auth.getClaims(token);
          if (data?.claims) {
            claims = data.claims;
          }
        } catch (e) {
          console.error("[assertAdmin reviews fallback authentication failed]", e);
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
    throw new Error(`Forbidden: Admin access required.`);
  }
}

export const Route = createFileRoute("/api/admin/reviews")({
  server: {
    middlewares: [requireSupabaseAuth],
    handlers: {
      GET: async ({ request, context }) => {
        try {
          await assertAdmin(request, context);

          const { data: reviews, error } = await supabaseAdmin
            .from("product_reviews")
            .select("*")
            .order("created_at", { ascending: false });

          if (error) throw new Error(error.message);

          const dbProducts = await getOrSeedProducts(supabaseAdmin, false, true);
          const productsMap = new Map(dbProducts.map((p) => [p.id, p]));

          const list = (reviews || []).map((r: any) => {
            const p = productsMap.get(r.product_id);
            return {
              ...r,
              product_name: p ? p.name : "Unknown Product",
              product_image: p ? p.image : null,
            };
          });

          return Response.json({ reviews: list });
        } catch (err: any) {
          console.error("[api/admin/reviews GET error]", err);
          return Response.json({ success: false, error: err.message }, { status: 500 });
        }
      },
      PUT: async ({ request, context }) => {
        try {
          await assertAdmin(request, context);
          const body = await request.json();
          const { id, rating, comment } = body;

          if (!id || rating === undefined) {
            return Response.json({ success: false, error: "Missing ID or rating" }, { status: 400 });
          }

          const { data, error } = await supabaseAdmin
            .from("product_reviews")
            .update({
              rating: Number(rating),
              comment: comment ?? null,
            })
            .eq("id", id)
            .select("*")
            .single();

          if (error) throw new Error(error.message);

          clearProductsCache();

          return Response.json({ success: true, review: data });
        } catch (err: any) {
          console.error("[api/admin/reviews PUT error]", err);
          return Response.json({ success: false, error: err.message }, { status: 500 });
        }
      },
      DELETE: async ({ request, context }) => {
        try {
          await assertAdmin(request, context);
          const url = new URL(request.url);
          const id = url.searchParams.get("id");

          if (!id) {
            return Response.json({ success: false, error: "Missing review ID" }, { status: 400 });
          }

          const { error } = await supabaseAdmin
            .from("product_reviews")
            .delete()
            .eq("id", id);

          if (error) throw new Error(error.message);

          clearProductsCache();

          return Response.json({ success: true });
        } catch (err: any) {
          console.error("[api/admin/reviews DELETE error]", err);
          return Response.json({ success: false, error: err.message }, { status: 500 });
        }
      },
    },
  },
});
