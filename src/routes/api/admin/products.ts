import { createFileRoute } from "@tanstack/react-router";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import { getOrSeedProducts } from "../products";

/** Emails allowed to manage products — read from server env at request time */
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

/** Throw a 403 if the caller is not in the admin allow-list */
async function assertAdmin(request: Request, context: any) {
  let claims = context?.claims;
  
  // Double-layer security fallback: parse and verify JWT directly from request if middleware didn't populate claims
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
          console.error("[assertAdmin fallback authentication failed]", e);
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

export const Route = createFileRoute("/api/admin/products")({
  server: {
    middlewares: [requireSupabaseAuth],   // verifies JWT — unchanged
    handlers: {
      GET: async ({ request, context }) => {
        try {
          await assertAdmin(request, context);
          const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
          const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
          const supabase = createClient(supabaseUrl!, supabaseKey!);
          const dbProducts = await getOrSeedProducts(supabase);
          return Response.json({ products: dbProducts });
        } catch (err: any) {
          console.error("[api/admin/products GET error]", err);
          return Response.json({ success: false, error: err.message }, { status: 500 });
        }
      },
      POST: async ({ request, context }) => {
        try {
          await assertAdmin(request, context);
          const body = await request.json();
          const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
          const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
          const supabase = createClient(supabaseUrl!, supabaseKey!);

          const { data, error } = await supabase
            .from("products")
            .insert({
              name: body.name,
              price: body.price,
              original_price: body.original_price || null,
              image: body.image,
              category: body.category,
              materials: body.materials,
              dimensions: body.dimensions,
              story: body.story,
              badge: body.badge || null,
              gallery: body.gallery || [body.image],
              stock: body.stock !== undefined ? Number(body.stock) : 10
            })
            .select("*")
            .single();

          if (error) throw new Error(error.message);
          return Response.json({ success: true, product: data });
        } catch (err: any) {
          console.error("[api/admin/products POST error]", err);
          return Response.json({ success: false, error: err.message }, { status: 500 });
        }
      },
      PUT: async ({ request, context }) => {
        try {
          await assertAdmin(request, context);
          const body = await request.json();
          const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
          const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
          const supabase = createClient(supabaseUrl!, supabaseKey!);

          const { data, error } = await supabase
            .from("products")
            .upsert({
              id: body.id,
              name: body.name,
              price: body.price,
              original_price: body.original_price || null,
              image: body.image,
              category: body.category,
              materials: body.materials,
              dimensions: body.dimensions,
              story: body.story,
              badge: body.badge || null,
              gallery: body.gallery || [body.image],
              stock: body.stock !== undefined ? Number(body.stock) : 10
            })
            .select("*")
            .single();

          if (error) throw new Error(error.message);
          return Response.json({ success: true, product: data });
        } catch (err: any) {
          console.error("[api/admin/products PUT error]", err);
          return Response.json({ success: false, error: err.message }, { status: 500 });
        }
      },
      DELETE: async ({ request, context }) => {
        try {
          await assertAdmin(request, context);
          const url = new URL(request.url);
          const id = url.searchParams.get("id");
          const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
          const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
          const supabase = createClient(supabaseUrl!, supabaseKey!);

          const { error } = await supabase
            .from("products")
            .delete()
            .eq("id", id);

          if (error) throw new Error(error.message);
          return Response.json({ success: true });
        } catch (err: any) {
          console.error("[api/admin/products DELETE error]", err);
          return Response.json({ success: false, error: err.message }, { status: 500 });
        }
      },
    },
  },
});
