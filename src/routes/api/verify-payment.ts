import { createFileRoute } from "@tanstack/react-router";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { sendOrderEmails } from "@/lib/email";

export const Route = createFileRoute("/api/verify-payment")({
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

          const {
            razorpay_payment_id,
            razorpay_order_id,
            razorpay_signature,
            orderId,
            origin
          } = body;

          // Validate missing fields
          if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !orderId) {
            return Response.json(
              { success: false, error: "Missing required verification fields" },
              { status: 400 }
            );
          }

          // Signature Verification
          const keySecret = process.env.RAZORPAY_KEY_SECRET?.replace(/['"]/g, '').trim();
          if (!keySecret) {
            console.error("Razorpay API Secret is missing in environment variables.");
            return Response.json(
              { success: false, error: "Razorpay signature verification configuration error" },
              { status: 500 }
            );
          }

          const text = razorpay_order_id + "|" + razorpay_payment_id;
          const generatedSignature = crypto
            .createHmac("sha256", keySecret)
            .update(text)
            .digest("hex");

          if (generatedSignature !== razorpay_signature) {
            console.warn("[Signature Mismatch] Verification failed.");
            return Response.json(
              { success: false, error: "Payment signature mismatch" },
              { status: 400 }
            );
          }

          // Update Order in Supabase
          const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)?.replace(/['"]/g, '').trim();
          const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/['"]/g, '').trim();
          const useServiceKey = !!(serviceKey && serviceKey.startsWith("eyJ"));
          const supabase = useServiceKey
            ? createClient(supabaseUrl!, serviceKey, {
                auth: {
                  storage: undefined,
                  persistSession: false,
                  autoRefreshToken: false,
                }
              })
            : createClient(supabaseUrl!, (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY)!?.replace(/['"]/g, '').trim());

          // Update order customer_status to "Paid" (status stays "Pending" due to database constraints)
          const { error: updateError } = await supabase
            .from("orders")
            .update({ customer_status: "Paid" })
            .eq("id", orderId);

          if (updateError) {
            console.error("[api/verify-payment DB error]", updateError.message);
            throw new Error(`Failed to update order status: ${updateError.message}`);
          }

          // Fetch the updated order details with items to send confirmation emails
          const { data: dbOrder, error: fetchError } = await supabase
            .from("orders")
            .select("*, order_items(*)")
            .eq("id", orderId)
            .single();

          if (fetchError || !dbOrder) {
            console.error("[api/verify-payment DB fetch error]", fetchError?.message);
            // Even if emails fail to send, payment was successful, so we return success: true but log warning
            return Response.json({
              success: true,
              message: "Payment verified successfully, but failed to fetch order details for emails."
            });
          }

          // Parse shipping_street fields
          const streetParts = (dbOrder.shipping_street || "").split("|");
          const baseStreet = streetParts[0];
          const couponCode = streetParts[3] || null;
          const discountAmount = streetParts[4] ? Number(streetParts[4]) : 0;

          const orderPayload = {
            id: dbOrder.id,
            orderNumber: dbOrder.order_number,
            customerName: dbOrder.customer_name,
            customerEmail: dbOrder.customer_email,
            customerPhone: dbOrder.customer_phone,
            total: Number(dbOrder.total),
            shippingStreet: baseStreet,
            shippingCity: dbOrder.shipping_city,
            shippingState: dbOrder.shipping_state,
            shippingZipCode: dbOrder.shipping_zip_code,
            created_at: dbOrder.created_at,
            couponCode: couponCode,
            discountAmount: discountAmount
          };

          const itemsPayload = (dbOrder.order_items || []).map((item: any) => ({
            productName: item.product_name,
            productImage: item.product_image,
            qty: item.qty,
            price: Number(item.price)
          }));

          // Send confirmation emails
          sendOrderEmails({
            order: orderPayload,
            items: itemsPayload,
            origin: origin || new URL(request.url).origin
          }).catch((err) => {
            console.error("[api/verify-payment email dispatch failed]", err);
          });

          return Response.json({
            success: true,
            message: "Payment verified and order status updated."
          });
        } catch (err: any) {
          console.error("[api/verify-payment error]", err);
          return Response.json(
            { success: false, error: err.message || "Internal server error" },
            { status: 500 }
          );
        }
      }
    },
  },
});
