import { createFileRoute } from "@tanstack/react-router";
import { dispatchEmail } from "@/lib/email";

export const Route = createFileRoute("/api/contact")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const { name, email, message } = body;

          if (!name || !email || !message) {
            return Response.json(
              { success: false, error: "Name, email, and message are required." },
              { status: 400 }
            );
          }

          const html = `
            <div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
              <h2 style="border-bottom: 2px solid #7d9b76; padding-bottom: 10px; color: #7d9b76;">New Contact Message Received</h2>
              <p><strong>Name:</strong> ${name}</p>
              <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
              <p><strong>Message:</strong></p>
              <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; border-left: 4px solid #7d9b76; white-space: pre-wrap;">${message}</div>
              <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
              <p style="font-size: 12px; color: #999;">Sent from the Sabara website contact form.</p>
            </div>
          `;

          const emailRes = await dispatchEmail({
            to: "contact.sabara@gmail.com",
            subject: `New Contact Message from ${name}`,
            html,
          });

          return Response.json({ success: true, method: emailRes.method });
        } catch (err: any) {
          console.error("[api/contact POST error]", err);
          return Response.json({ success: false, error: err.message }, { status: 500 });
        }
      },
    },
  },
});
