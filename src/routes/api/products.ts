import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { getSiteSetting } from "./site-settings";

let productsCache: { data: any[]; timestamp: number } | null = null;
const PRODUCTS_CACHE_TTL = 120000; // 120 seconds (2 minutes)

export function clearProductsCache() {
  productsCache = null;
}

function getServerSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase environment variables on server");
  }
  return createClient(supabaseUrl, supabaseKey);
}

export async function getOrSeedProducts(supabase: any, filterHidden = false, bypassCache = false) {
  try {
    const now = Date.now();
    let rawList: any[] = [];

    if (!bypassCache && productsCache && (now - productsCache.timestamp) < PRODUCTS_CACHE_TTL) {
      rawList = productsCache.data;
    } else {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error("[getOrSeedProducts] fetch error:", error.message);
        return [];
      }
      rawList = data || [];

      // Aggregate ratings
      let reviewsMap: Record<string, { rating: number; count: number }> = {};
      try {
        const { data: reviewsData, error: reviewsErr } = await supabase
          .from("product_reviews")
          .select("product_id, rating");
          
        if (!reviewsErr && reviewsData) {
          const groups: Record<string, number[]> = {};
          reviewsData.forEach((r: any) => {
            if (!groups[r.product_id]) groups[r.product_id] = [];
            groups[r.product_id].push(r.rating);
          });
          
          Object.keys(groups).forEach((prodId) => {
            const ratings = groups[prodId];
            const avg = ratings.reduce((sum, val) => sum + val, 0) / ratings.length;
            reviewsMap[prodId] = {
              rating: Number(avg.toFixed(1)),
              count: ratings.length
            };
          });
        }
      } catch (err) {
        console.warn("Error aggregating reviews inside getOrSeedProducts:", err);
      }

      rawList = rawList.map((p: any) => {
        const rev = reviewsMap[p.id] || { rating: 0, count: 0 };
        return {
          ...p,
          rating: rev.count > 0 ? rev.rating : null,
          reviewsCount: rev.count
        };
      });

      if (!bypassCache) {
        productsCache = { data: rawList, timestamp: now };
      }
    }

    let list = [...rawList];

    if (filterHidden) {
      try {
        const visibilityData = await getSiteSetting("visibility");
        
        if (visibilityData) {
          const hiddenProducts = visibilityData.hiddenProducts || [];
          const hiddenVarieties = visibilityData.hiddenVarieties || [];
          
          list = list.filter((p: any) => {
            const baseName = p.name.split(" - ")[0].trim();
            if (hiddenProducts.includes(baseName)) {
              return false;
            }
            if (hiddenVarieties.includes(p.id)) {
              return false;
            }
            return true;
          });
        }
      } catch (err) {
        console.warn("[getOrSeedProducts] failed to apply visibility filter:", err);
      }
    }

    return list;
  } catch (e: any) {
    console.error("[getOrSeedProducts] Try-catch error:", e);
    return [];
  }
}

export const Route = createFileRoute("/api/products")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const q = url.searchParams.get("q")?.toLowerCase().trim() ?? "";
          const category = url.searchParams.get("category") ?? "";

          const supabase = getServerSupabase();
          const dbProducts = await getOrSeedProducts(supabase, true);

          // Extract unique categories from all live products dynamically
          const defaultCats = ["Floor", "Yoga", "Doormat", "Table"];
          const catsSet = new Set<string>(defaultCats);
          dbProducts.forEach((p: any) => {
            if (p.category) {
              p.category.split(",").forEach((c: string) => {
                const trimmed = c.trim();
                if (trimmed) catsSet.add(trimmed);
              });
            }
          });
          const uniqueCategories = Array.from(catsSet);

          let list = dbProducts;
          if (category && category !== "All") {
            list = list.filter((p: any) => {
              if (!p.category) return false;
              const cats = p.category.split(",").map((c: string) => c.trim().toLowerCase());
              return cats.includes(category.toLowerCase());
            });
          }
          if (q) {
            list = list.filter(
              (p: any) =>
                p.name.toLowerCase().includes(q) ||
                p.category.toLowerCase().includes(q) ||
                p.materials.toLowerCase().includes(q) ||
                p.story.toLowerCase().includes(q),
            );
          }

          return Response.json(
            { products: list, categories: uniqueCategories },
            { headers: { "cache-control": "public, max-age=5" } },
          );
        } catch (err: any) {
          console.error("[api/products GET error]", err);
          return Response.json({ success: false, error: err.message }, { status: 500 });
        }
      },
    },
  },
});
