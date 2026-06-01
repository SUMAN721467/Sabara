import { createFileRoute } from "@tanstack/react-router";
import Razorpay from "razorpay";

export const Route = createFileRoute("/api/create-order")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          let body;
          try {
            body = await request.json();
          } catch (e) {
            return Response.json(
              { success: false, error: "Invalid JSON request body" },
              { status: 400 }
            );
          }

          const { amount, currency, receipt } = body;

          const keyId = process.env.RAZORPAY_KEY_ID?.replace(/['"]/g, '').trim();
          const keySecret = process.env.RAZORPAY_KEY_SECRET?.replace(/['"]/g, '').trim();

          console.log("[api/create-order debug] keyId length:", keyId?.length, "keySecret length:", keySecret?.length);

          if (!keyId || !keySecret) {
            console.error("Razorpay API Key or Secret is missing in environment variables.");
            return Response.json(
              { success: false, error: "Razorpay authentication configuration error" },
              { status: 401 }
            );
          }

          if (amount === undefined || amount === null) {
            return Response.json(
              { success: false, error: "Amount is required" },
              { status: 400 }
            );
          }

          const parsedAmount = Math.round(Number(amount));
          if (isNaN(parsedAmount) || parsedAmount < 100) {
            return Response.json(
              { success: false, error: "Amount must be at least 100 paise (1 INR)" },
              { status: 400 }
            );
          }

          // Initialize Razorpay SDK (ESM/CJS compatibility fallback)
          const RazorpayConstructor = (Razorpay as any).default || Razorpay;
          if (typeof RazorpayConstructor !== "function") {
            throw new Error("Razorpay SDK is not loaded as a constructor function");
          }

          const razorpay = new RazorpayConstructor({
            key_id: keyId,
            key_secret: keySecret,
          });

          const options = {
            amount: parsedAmount,
            currency: currency || "INR",
            receipt: receipt || `receipt_${Date.now()}`,
          };

          const order = await razorpay.orders.create(options);

          return Response.json({
            success: true,
            order_id: order.id,
            amount: order.amount,
            currency: order.currency,
            key_id: keyId,
          });
        } catch (err: any) {
          console.error("[api/create-order error]", err);
          const errMsg = err.message || (err.error && err.error.description) || String(err);
          return Response.json(
            { success: false, error: errMsg },
            { status: 500 }
          );
        }
      },
    },
  },
});
