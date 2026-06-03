import { createFileRoute } from "@tanstack/react-router";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import { getOrSeedProducts } from "../products";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function getStoragePathFromUrl(url: string, bucketName: string = "product-images"): string | null {
  if (!url) return null;
  const marker = `/${bucketName}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  const pathWithQuery = url.substring(index + marker.length);
  return pathWithQuery.split("?")[0];
}

/** Emails allowed to manage products — read from server env at request time */
function getAdminEmails(): Set<string> {
  return new Set([
    "contact.sabara@gmail.com",
    "sumansamanta721467@gmail.com",
  ]);
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
          const { data } = await supabaseAdmin.auth.getClaims(token);
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
          const dbProducts = await getOrSeedProducts(supabaseAdmin);
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
 
          const { data, error } = await supabaseAdmin
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
              stock: body.stock !== undefined ? Number(body.stock) : 10,
              sku: body.sku || null
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
 
          const { data, error } = await supabaseAdmin
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
              stock: body.stock !== undefined ? Number(body.stock) : 10,
              sku: body.sku || null
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
 
          // Fetch product image/gallery urls before deletion
          const { data: product } = await supabaseAdmin
            .from("products")
            .select("image, gallery")
            .eq("id", id)
            .single();
 
          const { error } = await supabaseAdmin
            .from("products")
            .delete()
            .eq("id", id);

          if (error) throw new Error(error.message);

          // Clean up storage images if the product was fetched successfully
          if (product) {
            const urlsToDelete = new Set<string>();
            if (product.image) urlsToDelete.add(product.image);
            if (Array.isArray(product.gallery)) {
              product.gallery.forEach((url: any) => {
                if (url && typeof url === "string") {
                  urlsToDelete.add(url);
                }
              });
            }

            const pathsToDelete: string[] = [];
            urlsToDelete.forEach((url) => {
              const path = getStoragePathFromUrl(url, "product-images");
              if (path) {
                pathsToDelete.push(path);
              }
            });

            if (pathsToDelete.length > 0) {
              try {
                // Perform deletion in storage
                const { error: storageErr } = await supabaseAdmin.storage
                  .from("product-images")
                  .remove(pathsToDelete);
                if (storageErr) {
                  console.error("[api/admin/products DELETE] Storage cleanup error:", storageErr.message);
                }
              } catch (storageErr) {
                console.error("[api/admin/products DELETE] Storage cleanup exception:", storageErr);
              }
            }
          }

          return Response.json({ success: true });
        } catch (err: any) {
          console.error("[api/admin/products DELETE error]", err);
          return Response.json({ success: false, error: err.message }, { status: 500 });
        }
      },
    },
  },
});
