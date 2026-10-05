import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { SITE_URL } from "@/lib/seo";
import { getOrSeedProducts } from "./products";

export const Route = createFileRoute("/api/sitemap")({
  server: {
    handlers: {
      GET: async () => {
        try {
          // ── Static pages ──────────────────────────────────────────────
          const staticPages = [
            { loc: "/", changefreq: "daily", priority: "1.0" },
            { loc: "/shop", changefreq: "daily", priority: "0.9" },
            { loc: "/about", changefreq: "monthly", priority: "0.7" },
            { loc: "/contact", changefreq: "monthly", priority: "0.6" },
            { loc: "/privacy-policy", changefreq: "yearly", priority: "0.3" },
            { loc: "/terms-and-conditions", changefreq: "yearly", priority: "0.3" },
            { loc: "/refund-policy", changefreq: "yearly", priority: "0.3" },
          ];

          // ── Dynamic product pages ────────────────────────────────────
          let productUrls: Array<{ loc: string; changefreq: string; priority: string; lastmod?: string }> = [];
          try {
            const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
            const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

            if (supabaseUrl && supabaseKey) {
              const supabase = createClient(supabaseUrl, supabaseKey);
              const products = await getOrSeedProducts(supabase, true);

              // Group by base name — only include the earliest variant (canonical product)
              const seen = new Set<string>();
              for (const p of products) {
                const baseName = (p.name || "").split(" - ")[0];
                if (seen.has(baseName)) continue;
                seen.add(baseName);

                productUrls.push({
                  loc: `/product/${p.id}`,
                  changefreq: "weekly",
                  priority: "0.8",
                  ...(p.updated_at
                    ? { lastmod: new Date(p.updated_at).toISOString().split("T")[0] }
                    : p.created_at
                      ? { lastmod: new Date(p.created_at).toISOString().split("T")[0] }
                      : {}),
                });
              }
            }
          } catch (err) {
            console.error("[sitemap] Failed to fetch products:", err);
          }

          // ── Build XML ────────────────────────────────────────────────
          const allUrls = [...staticPages, ...productUrls];
          const today = new Date().toISOString().split("T")[0];

          const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls
  .map(
    (u) => `  <url>
    <loc>${SITE_URL}${u.loc}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : `\n    <lastmod>${today}</lastmod>`}
  </url>`,
  )
  .join("\n")}
</urlset>`;

          return new Response(xml, {
            status: 200,
            headers: {
              "Content-Type": "application/xml; charset=utf-8",
              "Cache-Control": "public, max-age=3600, s-maxage=3600",
            },
          });
        } catch (err) {
          console.error("[sitemap] Critical error:", err);
          return new Response("<?xml version=\"1.0\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\"></urlset>", {
            status: 500,
            headers: { "Content-Type": "application/xml" },
          });
        }
      },
    },
  },
});
