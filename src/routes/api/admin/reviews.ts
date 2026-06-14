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

function getStoragePathFromUrl(url: string, bucketName: string = "product-images"): string | null {
  if (!url) return null;
  const marker = `/${bucketName}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  const pathWithQuery = url.substring(index + marker.length);
  return pathWithQuery.split("?")[0];
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

          // Write reviews log for debugging
          try {
            const fs = await import("fs");
            fs.writeFileSync("C:/Users/hp/OneDrive/Desktop/Sabara-Test-new/reviews-debug.log", JSON.stringify(reviews, null, 2));
          } catch (logErr) {
            console.error("Failed to write reviews-debug.log:", logErr);
          }

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
        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        let logMsg = `[${new Date().toISOString()}] Deleting review ID: ${id}\n`;

        try {
          await assertAdmin(request, context);

          if (!id) {
            return Response.json({ success: false, error: "Missing review ID" }, { status: 400 });
          }

          // Fetch the review's images before deleting it
          const { data: review, error: fetchErr } = await supabaseAdmin
            .from("product_reviews")
            .select("images")
            .eq("id", id)
            .single();

          logMsg += `Fetch review result: ${JSON.stringify(review)}\n`;
          if (fetchErr) {
            logMsg += `Fetch review error: ${JSON.stringify(fetchErr)}\n`;
            throw new Error(`Fetch review error: ${fetchErr.message}`);
          }

          let storageResults = null;
          let pathsToDelete: string[] = [];

          // Delete image files from storage bucket if they exist
          if (review && review.images && review.images.length > 0) {
            review.images.forEach((imgUrl: string) => {
              const path = getStoragePathFromUrl(imgUrl, "product-images");
              if (path) {
                pathsToDelete.push(path);
              }
            });
            logMsg += `Parsed storage paths to delete: ${JSON.stringify(pathsToDelete)}\n`;

            if (pathsToDelete.length > 0) {
              const { data: storageData, error: storageErr } = await supabaseAdmin.storage
                .from("product-images")
                .remove(pathsToDelete);
              
              if (storageErr) {
                logMsg += `Storage remove error: ${JSON.stringify(storageErr)}\n`;
                throw new Error(`Storage remove error: ${storageErr.message}`);
              } else {
                logMsg += `Storage remove success: ${JSON.stringify(storageData)}\n`;
                storageResults = { success: true, deleted: storageData };
              }
            }
          } else {
            logMsg += `No images found to delete for this review.\n`;
          }

          // Delete review from database
          const { error: dbErr } = await supabaseAdmin
            .from("product_reviews")
            .delete()
            .eq("id", id);

          if (dbErr) {
            logMsg += `Database delete error: ${JSON.stringify(dbErr)}\n`;
            throw new Error(dbErr.message);
          } else {
            logMsg += `Database delete success.\n`;
          }

          clearProductsCache();

          // Write log to file
          try {
            const fs = await import("fs");
            fs.appendFileSync("C:/Users/hp/OneDrive/Desktop/Sabara-Test-new/delete-reviews.log", logMsg + "\n");
          } catch (logErr) {
            console.error("Failed to write log file:", logErr);
          }

          return Response.json({ success: true, storageResults });
        } catch (err: any) {
          logMsg += `Handler caught error: ${err.message}\n`;
          try {
            const fs = await import("fs");
            fs.appendFileSync("C:/Users/hp/OneDrive/Desktop/Sabara-Test-new/delete-reviews.log", logMsg + "\n");
          } catch (logErr) {
            console.error("Failed to write error log file:", logErr);
          }
          console.error("[api/admin/reviews DELETE error]", err);
          return Response.json({ success: false, error: err.message }, { status: 500 });
        }
      },
    },
  },
});
