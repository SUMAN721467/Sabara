import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const Route = createFileRoute("/api/auth/verify-signup-otp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { email, password, fullName, phone, token, otp } = await request.json();
          if (!email || !password || !token || !otp) {
            return Response.json({ error: "Missing required fields" }, { status: 400 });
          }

          const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
          const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;

          if (!serviceKey || !supabaseUrl) {
            return Response.json({ error: "Server configuration missing" }, { status: 500 });
          }

          // 1. Verify the token
          const [expiresAtStr, signature] = token.split('.');
          if (!expiresAtStr || !signature) {
            return Response.json({ error: "Invalid verification token format" }, { status: 400 });
          }

          const expiresAt = parseInt(expiresAtStr, 10);
          if (Date.now() > expiresAt) {
            return Response.json({ error: "Verification code has expired. Please request a new one." }, { status: 400 });
          }

          const payload = `${email.toLowerCase()}:${otp}:${expiresAt}`;
          const expectedSignature = crypto.createHmac('sha256', serviceKey).update(payload).digest('hex');

          if (signature !== expectedSignature) {
            return Response.json({ error: "Invalid verification code" }, { status: 400 });
          }

          // 2. Token and OTP are valid! Now we can safely create the confirmed user in Supabase
          const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
            },
          });

          const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Automatically confirm since we verified the OTP
            user_metadata: { full_name: fullName, phone }
          });

          if (authError) {
            console.error("Create user error:", authError);
            return Response.json({ error: authError.message }, { status: 400 });
          }

          // Success! User is created and verified.
          return Response.json({ success: true });
        } catch (error: any) {
          console.error("Verify OTP error:", error);
          return Response.json({ error: error.message || "Internal server error" }, { status: 500 });
        }
      },
    },
  },
});
