import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/seo";

export const Route = createFileRoute("/api/robots")({
  server: {
    handlers: {
      GET: async () => {
        const body = `# Sabara — robots.txt
User-agent: *
Allow: /

# Disallow private / transactional areas
Disallow: /api/
Disallow: /admin
Disallow: /account
Disallow: /cart
Disallow: /checkout
Disallow: /wishlist
Disallow: /login
Disallow: /signup

# Sitemap
Sitemap: ${SITE_URL}/sitemap.xml
`;
        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=86400, s-maxage=86400",
          },
        });
      },
    },
  },
});
