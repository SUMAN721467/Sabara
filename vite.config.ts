import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

const isVercel = !!process.env.VERCEL;

import fs from "node:fs";
import path from "node:path";

function imageOptimizerPlugin() {
  return {
    name: "vite-plugin-image-optimizer",
    async buildStart() {
      try {
        const sharpModule = await import("sharp");
        const sharp = sharpModule.default || sharpModule;
        const assetsDir = path.resolve(process.cwd(), "src/assets");
        if (!fs.existsSync(assetsDir)) return;

        const files = fs.readdirSync(assetsDir);

        for (const file of files) {
          const filePath = path.join(assetsDir, file);
          const ext = path.extname(file).toLowerCase();

          // 1. Logo optimization
          if (file === "Sabara-logo.png") {
            const outWebp = path.join(assetsDir, "Sabara-logo.webp");
            if (!fs.existsSync(outWebp)) {
              await sharp(filePath)
                .resize({ width: 300, withoutEnlargement: true })
                .webp({ quality: 85, effort: 6 })
                .toFile(outWebp);
              console.log("[imageOptimizer] Generated Sabara-logo.webp");
            }
          }

          // 2. Hero banner optimization
          if (file === "hero.jpg") {
            const outDesktopWebp = path.join(assetsDir, "hero.webp");
            const outMobileWebp = path.join(assetsDir, "hero-mobile.webp");
            if (!fs.existsSync(outDesktopWebp)) {
              await sharp(filePath)
                .resize({ width: 1600, withoutEnlargement: true })
                .webp({ quality: 80, effort: 6 })
                .toFile(outDesktopWebp);
              console.log("[imageOptimizer] Generated hero.webp");
            }
            if (!fs.existsSync(outMobileWebp)) {
              await sharp(filePath)
                .resize({ width: 600, withoutEnlargement: true })
                .webp({ quality: 80, effort: 6 })
                .toFile(outMobileWebp);
              console.log("[imageOptimizer] Generated hero-mobile.webp");
            }
          }

          // 3. Craft story image
          if (file === "craft.jpg") {
            const outWebp = path.join(assetsDir, "craft.webp");
            if (!fs.existsSync(outWebp)) {
              await sharp(filePath)
                .resize({ width: 1000, withoutEnlargement: true })
                .webp({ quality: 80, effort: 6 })
                .toFile(outWebp);
              console.log("[imageOptimizer] Generated craft.webp");
            }
          }

          // 4. Mat product images (mat-1 to mat-6)
          if (/^mat-\d+\.jpg$/i.test(file)) {
            const baseName = path.basename(file, ext);
            const outWebp = path.join(assetsDir, `${baseName}.webp`);
            if (!fs.existsSync(outWebp)) {
              await sharp(filePath)
                .resize({ width: 600, withoutEnlargement: true })
                .webp({ quality: 80, effort: 6 })
                .toFile(outWebp);
              console.log(`[imageOptimizer] Generated ${baseName}.webp`);
            }
          }

          // 5. Round logo & Favicon optimization (from authentic artwork)
          if (file === "round logo.png" || file === "favicon-icon.png") {
            const outWebp = path.join(assetsDir, "round-logo.webp");
            if (!fs.existsSync(outWebp)) {
              await sharp(filePath)
                .resize({ width: 200, height: 200, fit: "cover" })
                .webp({ quality: 90, effort: 6 })
                .toFile(outWebp);
              console.log("[imageOptimizer] Generated round-logo.webp");
            }
            const outFavicon = path.join(assetsDir, "favicon.webp");
            if (!fs.existsSync(outFavicon)) {
              await sharp(filePath)
                .resize({ width: 64, height: 64, fit: "cover" })
                .webp({ quality: 90, effort: 6 })
                .toFile(outFavicon);
              console.log("[imageOptimizer] Generated favicon.webp");
            }
          }
        }
      } catch (err) {
        console.warn("[imageOptimizer] Notice: sharp WebP generation skipped or completed:", (err as any)?.message);
      }
    },
  };
}

export default defineConfig(async ({ command, mode }) => {
  // ── Plugins ────────────────────────────────────────────────────────
  const plugins: any[] = [imageOptimizerPlugin()];

  plugins.push(tailwindcss());
  plugins.push(tsConfigPaths({ projects: ["./tsconfig.json"] }));

  // TanStack Start plugin — skip Cloudflare server entry on Vercel
  const tanstackStartOptions: any = {
    router: {
      routeFileIgnorePattern: "check-columns",
    },
    importProtection: {
      behavior: "error" as const,
      client: {
        files: ["**/server/**"],
        specifiers: ["server-only"],
      },
    },
    ...(isVercel ? {} : { server: { entry: "server" } }),
  };
  plugins.push(tanstackStart(tanstackStartOptions));

  // React plugin
  plugins.push(react());

  if (isVercel) {
    // On Vercel: use Nitro to build serverless functions
    plugins.push(nitro());
  } else {
    // Locally / Cloudflare: use the Cloudflare plugin for Workers build
    if (command === "build") {
      try {
        const { cloudflare } = await import("@cloudflare/vite-plugin");
        plugins.push(cloudflare({ viteEnvironment: { name: "ssr" } }));
      } catch {
        // @cloudflare/vite-plugin not installed — fall back to nitro
        plugins.push(nitro());
      }
    }
  }

  // ── VITE_* env → import.meta.env define ────────────────────────────
  const loadedEnv = loadEnv(mode, process.cwd(), "VITE_");
  const envDefine: Record<string, string> = {};
  for (const [key, value] of Object.entries(loadedEnv)) {
    envDefine[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  return {
    define: envDefine,

    resolve: {
      alias: {
        "@": `${process.cwd()}/src`,
      },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },

    server: {
      host: "::",
      port: 8080,
    },

    build: {
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules")) {
              if (id.includes("lucide-react")) return "vendor-lucide";
              if (id.includes("@radix-ui")) return "vendor-radix";
              if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
              if (id.includes("embla-carousel")) return "vendor-carousel";
              if (id.includes("@supabase")) return "vendor-supabase";
            }
          },
        },
      },
    },

    plugins,
  };
});


