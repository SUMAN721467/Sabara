import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

let settingsCache: Record<string, { value: any; timestamp: number }> = {};
const SETTINGS_CACHE_TTL = 120000; // 120 seconds (2 minutes)

export function clearSettingsCache(key?: string) {
  if (key) {
    delete settingsCache[key];
  } else {
    settingsCache = {};
  }
}

export async function getSiteSetting(key: string): Promise<any> {
  const now = Date.now();
  const cached = settingsCache[key];
  if (cached && (now - cached.timestamp) < SETTINGS_CACHE_TTL) {
    return cached.value;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase configuration on server");
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", key)
    .single();

  if (error || !data || (key === "coupons" && (!data.value || !data.value.coupons))) {
    if (key === "coupons") {
      try {
        const fs = await import("fs/promises");
        const path = await import("path");
        const filePath = path.join(process.cwd(), "src", "data", "coupons.json");
        const fileContent = await fs.readFile(filePath, "utf-8");
        const localValue = JSON.parse(fileContent);
        if (localValue) {
          settingsCache[key] = { value: localValue, timestamp: now };
          return localValue;
        }
      } catch (e) {
        // ignore
      }
    }
    settingsCache[key] = { value: null, timestamp: now };
    return null;
  }

  settingsCache[key] = { value: data.value, timestamp: now };
  return data.value;
}

export const Route = createFileRoute("/api/site-settings")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const key = url.searchParams.get("key") || "hero";
          const value = await getSiteSetting(key);
          return Response.json({ success: true, value });
        } catch (err: any) {
          console.error("[api/site-settings GET error]", err);
          return Response.json({ success: false, error: err.message }, { status: 500 });
        }
      },
    },
  },
});
