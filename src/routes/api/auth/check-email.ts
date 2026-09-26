import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/auth/check-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { email } = await request.json();
          if (!email) {
            return Response.json({ exists: false }, { status: 400 });
          }

          const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
          const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

          if (!supabaseUrl || !serviceKey) {
            // Fallback: If no service key, we can't reliably check securely.
            // But if it's there, we can check auth.users.
            return Response.json({ exists: false });
          }

          const supabase = createClient(supabaseUrl, serviceKey, {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
            },
          });

          // Query auth.users via service role
          const { data, error } = await supabase.auth.admin.listUsers();
          
          if (error) {
            console.error("Check email error:", error);
            return Response.json({ exists: false });
          }

          const userExists = data.users.some(
            (u) => u.email?.toLowerCase() === email.toLowerCase()
          );

          return Response.json({ exists: userExists });
        } catch (error) {
          console.error("Check email error:", error);
          return Response.json({ exists: false });
        }
      },
    },
  },
});
