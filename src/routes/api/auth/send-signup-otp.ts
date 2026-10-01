import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { dispatchEmail } from "@/lib/email";
import crypto from "crypto";

export const Route = createFileRoute("/api/auth/send-signup-otp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { email } = await request.json();
          if (!email) {
            return Response.json({ error: "Missing email" }, { status: 400 });
          }

          const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
          const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

          if (!supabaseUrl || !serviceKey) {
            return Response.json({ error: "Server configuration missing" }, { status: 500 });
          }

          const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
            },
          });

          // 1. Check if user already exists
          const { data: existingUsers, error: checkErr } = await supabaseAdmin.auth.admin.listUsers();
          if (!checkErr && existingUsers?.users) {
             const exists = existingUsers.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
             if (exists) {
               // If confirmed, they shouldn't sign up again
               if (exists.email_confirmed_at) {
                 return Response.json({ error: "User already registered" }, { status: 400 });
               }
               // If unconfirmed, we delete them so the admin panel is kept clean
               // (They will be properly created once they verify the OTP)
               await supabaseAdmin.auth.admin.deleteUser(exists.id);
             }
          }

          // 2. Generate a random 6-digit OTP
          const otp = Math.floor(100000 + Math.random() * 900000).toString();

          // 3. Create a stateless verifiable token (expires in 15 minutes)
          const expiresAt = Date.now() + 15 * 60 * 1000;
          const payload = `${email.toLowerCase()}:${otp}:${expiresAt}`;
          const signature = crypto.createHmac('sha256', serviceKey).update(payload).digest('hex');
          const token = `${expiresAt}.${signature}`;

          // 4. Send Custom Email
          const html = `
            <div style="font-family: 'Work Sans', sans-serif; padding: 40px 20px; background-color: #fafaf9; text-align: center;">
              <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px; background-color: #ffffff; border-radius: 12px; border: 1px solid #EBE7E0;">
                <tr>
                  <td align="center" style="padding: 40px 20px; border-bottom: 1px solid #EBE7E0; background-color: #FDFCF8;">
                    <img src="https://auzyzlrimtjmzbkimtvz.supabase.co/storage/v1/object/public/asset/sabara%20logo.png" alt="Sabara" width="150" />
                  </td>
                </tr>
                <tr>
                  <td style="padding: 32px;">
                    <h2 style="font-family: Georgia, serif; font-size: 22px; color: #111827; margin-bottom: 16px; font-weight: 500;">Verify your email address</h2>
                    <p style="font-size: 15px; color: #4b5563; line-height: 1.6; margin-bottom: 24px;">
                      Thank you for joining Sabara! Use the following verification code to complete your account registration:
                    </p>
                    <div style="background-color: #faf7f2; border: 1px solid #f1ece4; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
                      <h1 style="letter-spacing: 0.3em; color: #c49a6c; font-size: 32px; margin: 0; font-family: monospace;">${otp}</h1>
                    </div>
                    <p style="font-size: 13px; color: #6b7280;">This code will expire in 15 minutes. If you didn't request this, you can safely ignore this email.</p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: 20px; border-top: 1px solid #f3f3f2; background-color: #fafaf9;">
                    <p style="font-size: 11px; color: #8c857b; margin: 0; text-transform: uppercase; letter-spacing: 0.1em;">SABARA &copy; 2026 - WOVEN WITH TRADITION</p>
                  </td>
                </tr>
              </table>
            </div>
          `;
          
          const emailRes = await dispatchEmail({
            to: email,
            subject: "Verify your email address - Sabara",
            html
          });

          if (!emailRes.success) {
            console.error("Failed to send OTP email:", emailRes.error);
            return Response.json({ error: "Failed to send email" }, { status: 500 });
          }

          // Return the token to the client so it can be verified later
          return Response.json({ success: true, token });
        } catch (error: any) {
          console.error("Send OTP error:", error);
          return Response.json({ error: error.message || "Internal server error" }, { status: 500 });
        }
      },
    },
  },
});
