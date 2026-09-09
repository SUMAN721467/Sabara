import { createFileRoute } from "@tanstack/react-router";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import { getOrSeedProducts, clearProductsCache } from "../products";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function extractStorageBucketAndPath(url: string, defaultBucket: string = "product-images"): { bucket: string; path: string } | null {
  if (!url || typeof url !== "string") return null;

  // If already a relative storage path (e.g., "products/1725...jpg")
  if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("/")) {
    return { bucket: defaultBucket, path: url.split("?")[0].split("#")[0] };
  }

  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://dummy.com/${url.replace(/^\/+/, "")}`);
    const pathname = decodeURIComponent(parsed.pathname);

    // Matches /storage/v1/object/public/<bucket>/<path>
    // or /storage/v1/object/sign/<bucket>/<path>
    // or /storage/v1/render/image/public/<bucket>/<path>
    // or /storage/v1/object/<bucket>/<path>
    const patterns = [
      /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/,
      /\/storage\/v1\/object\/sign\/([^/]+)\/(.+)$/,
      /\/storage\/v1\/render\/image\/public\/([^/]+)\/(.+)$/,
      /\/storage\/v1\/object\/([^/]+)\/(.+)$/,
      /\/([^/]+)\/(products\/.+)$/,
    ];

    for (const pattern of patterns) {
      const match = pathname.match(pattern);
      if (match) {
        const bucket = match[1];
        let path = match[2];
        if (bucket && path) {
          path = path.split("?")[0].split("#")[0];
          return { bucket, path };
        }
      }
    }

    // Fallback: check if URL contains bucket name
    const bucketMarker = `/${defaultBucket}/`;
    const bIdx = url.indexOf(bucketMarker);
    if (bIdx !== -1) {
      const rawPath = url.substring(bIdx + bucketMarker.length).split("?")[0].split("#")[0];
      return { bucket: defaultBucket, path: decodeURIComponent(rawPath) };
    }
  } catch (err) {
    console.error("Error parsing storage url:", url, err);
  }

  return null;
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
    middlewares: [requireSupabaseAuth],
    handlers: {
      GET: async ({ request, context }) => {
        try {
          await assertAdmin(request, context);
          const list = await getOrSeedProducts(supabaseAdmin, false, true);
          return Response.json({ success: true, products: list });
        } catch (err: any) {
          console.error("[api/admin/products GET error]", err);
          return Response.json({ success: false, error: err.message }, { status: 500 });
        }
      },
      POST: async ({ request, context }) => {
        try {
          await assertAdmin(request, context);
          const body = await request.json();
          const {
            name, price, original_price, category, materials, dimensions,
            story, image, gallery, badge, stock, sku, highlights, care_instructions, delivery_policy
          } = body;

          if (!name || price === undefined) {
            return Response.json({ success: false, error: "Missing required fields" }, { status: 400 });
          }

          // Combine accordion & highlight metadata into story comment
          let cleanStory = (story || "").replace(/\n*<!--SABARA_META:[\s\S]*?-->/g, "").trim();
          const meta: any = {};
          if (highlights && String(highlights).trim()) meta.highlights = String(highlights).trim();
          if (care_instructions && String(care_instructions).trim()) meta.care_instructions = String(care_instructions).trim();
          if (delivery_policy && String(delivery_policy).trim()) meta.delivery_policy = String(delivery_policy).trim();

          const finalStory = Object.keys(meta).length > 0
            ? `${cleanStory}\n\n<!--SABARA_META:${JSON.stringify(meta)}-->`
            : cleanStory;

          const dbPayload: any = {
            name,
            price: Number(price),
            original_price: original_price ? Number(original_price) : null,
            category: category || "",
            materials: materials || "",
            dimensions: dimensions || "",
            story: finalStory,
            image: image || "",
            gallery: Array.isArray(gallery) ? gallery : (gallery ? [gallery] : []),
            badge: badge || null,
            stock: stock !== undefined && stock !== null ? Number(stock) : 10,
            sku: sku || null,
          };

          const { data, error } = await supabaseAdmin
            .from("products")
            .insert([dbPayload])
            .select()
            .single();

          if (error) throw new Error(error.message);
          clearProductsCache();
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
          const { id, highlights, care_instructions, delivery_policy, ...rawUpdates } = body;
          if (!id) {
            return Response.json({ success: false, error: "Missing product ID" }, { status: 400 });
          }

          let cleanStory = (rawUpdates.story || "").replace(/\n*<!--SABARA_META:[\s\S]*?-->/g, "").trim();
          const meta: any = {};
          if (highlights && String(highlights).trim()) meta.highlights = String(highlights).trim();
          if (care_instructions && String(care_instructions).trim()) meta.care_instructions = String(care_instructions).trim();
          if (delivery_policy && String(delivery_policy).trim()) meta.delivery_policy = String(delivery_policy).trim();

          const finalStory = Object.keys(meta).length > 0
            ? `${cleanStory}\n\n<!--SABARA_META:${JSON.stringify(meta)}-->`
            : cleanStory;

          const dbPayload: any = {
            ...rawUpdates,
            story: finalStory,
          };
          delete dbPayload.highlights;
          delete dbPayload.care_instructions;
          delete dbPayload.delivery_policy;

          const { data, error } = await supabaseAdmin
            .from("products")
            .update(dbPayload)
            .eq("id", id)
            .select()
            .single();

          if (error) throw new Error(error.message);
          clearProductsCache();
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

          if (!id) {
            return Response.json({ success: false, error: "Missing product ID" }, { status: 400 });
          }

          // 1. Fetch product data (image and gallery) before deletion
          const { data: product } = await supabaseAdmin
            .from("products")
            .select("id, name, image, gallery")
            .eq("id", id)
            .single();

          // 2. Delete associated reviews from product_reviews table
          try {
            await supabaseAdmin
              .from("product_reviews")
              .delete()
              .eq("product_id", id);
          } catch (reviewErr) {
            console.warn("[api/admin/products DELETE] product_reviews cleanup notice:", reviewErr);
          }

          // 3. Delete product row from products table in Supabase
          const { error } = await supabaseAdmin
            .from("products")
            .delete()
            .eq("id", id);

          if (error) throw new Error(error.message);
          clearProductsCache();

          // 4. Delete all images from Supabase Storage bucket
          if (product) {
            const urlsToDelete = new Set<string>();
            if (product.image && typeof product.image === "string") {
              urlsToDelete.add(product.image);
            }
            if (Array.isArray(product.gallery)) {
              product.gallery.forEach((u: any) => {
                if (u && typeof u === "string") urlsToDelete.add(u);
              });
            } else if (typeof product.gallery === "string" && product.gallery.trim()) {
              try {
                const parsed = JSON.parse(product.gallery);
                if (Array.isArray(parsed)) {
                  parsed.forEach((u: any) => {
                    if (u && typeof u === "string") urlsToDelete.add(u);
                  });
                }
              } catch {
                product.gallery.split(",").forEach((u: string) => {
                  const trimmed = u.trim();
                  if (trimmed) urlsToDelete.add(trimmed);
                });
              }
            }

            // Group paths by storage bucket
            const bucketToPaths: Record<string, string[]> = {};
            urlsToDelete.forEach((imgUrl) => {
              const parsed = extractStorageBucketAndPath(imgUrl, "product-images");
              if (parsed && parsed.path) {
                if (!bucketToPaths[parsed.bucket]) {
                  bucketToPaths[parsed.bucket] = [];
                }
                bucketToPaths[parsed.bucket].push(parsed.path);
              }
            });

            // Perform storage file deletion
            for (const [bucket, paths] of Object.entries(bucketToPaths)) {
              if (paths.length > 0) {
                try {
                  const { error: storageErr } = await supabaseAdmin.storage
                    .from(bucket)
                    .remove(paths);
                  if (storageErr) {
                    console.error(`[api/admin/products DELETE] Storage cleanup error for bucket "${bucket}":`, storageErr.message);
                  } else {
                    console.log(`[api/admin/products DELETE] Successfully removed ${paths.length} file(s) from "${bucket}" storage.`);
                  }
                } catch (storageErr) {
                  console.error(`[api/admin/products DELETE] Storage cleanup exception for bucket "${bucket}":`, storageErr);
                }
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
