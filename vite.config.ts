import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

const isVercel = !!process.env.VERCEL;

export default defineConfig(async ({ command, mode }) => {
  // ── Plugins ────────────────────────────────────────────────────────
  const plugins: any[] = [];

  plugins.push(tailwindcss());
  plugins.push(tsConfigPaths({ projects: ["./tsconfig.json"] }));

  // TanStack Start plugin — skip Cloudflare server entry on Vercel
  const tanstackStartOptions: any = {
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
    },

    plugins,
  };
});
