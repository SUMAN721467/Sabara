import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/site-settings")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const key = url.searchParams.get("key") || "hero";

          const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
          const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
          const supabase = createClient(supabaseUrl!, supabaseKey!);

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
                  return Response.json({ success: true, value: localValue });
                }
              } catch (e) {
                // ignore
              }
            }
            return Response.json({ success: true, value: null });
          }

          return Response.json({ success: true, value: data.value });
        } catch (err: any) {
          console.error("[api/site-settings GET error]", err);
          return Response.json({ success: false, error: err.message }, { status: 500 });
        }
      },
    },
  },
});
