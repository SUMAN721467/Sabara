import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/cancel-order")({
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

          const { orderId, reason } = body;

          if (!orderId) {
            return Response.json(
              { success: false, error: "Order ID is required" },
              { status: 400 }
            );
          }

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

          // Check if order exists and is in "Pending" status to avoid double cancellation/double stock recovery
          const { data: order, error: orderErr } = await supabase
            .from("orders")
            .select("status")
            .eq("id", orderId)
            .single();

          if (orderErr || !order) {
            return Response.json(
              { success: false, error: "Order not found" },
              { status: 404 }
            );
          }

          if (order.status !== "Pending") {
            return Response.json(
              { success: true, message: "Order is already processed or cancelled", status: order.status }
            );
          }

          // Update order status to Cancelled / Payment Failed
          const cancelReason = reason || "Payment cancelled or failed";
          const isPaymentFailed = cancelReason.toLowerCase().includes("payment failed") || 
                                  cancelReason.toLowerCase().includes("payment cancelled") || 
                                  cancelReason.toLowerCase().includes("payment verification failed") || 
                                  cancelReason.toLowerCase().includes("creation failed");
          const customerStatus = isPaymentFailed ? "Payment Failed" : "Cancelled by Customer";

          const { error: updateErr } = await supabase
            .from("orders")
            .update({
              status: "Cancelled",
              customer_status: customerStatus,
              cancellation_reason: cancelReason
            })
            .eq("id", orderId);

          if (updateErr) {
            throw new Error(`Failed to update order to Cancelled: ${updateErr.message}`);
          }

          return Response.json({
            success: true,
            message: "Order successfully cancelled."
          });
        } catch (err: any) {
          console.error("[api/cancel-order error]", err);
          return Response.json(
            { success: false, error: err.message || "Internal server error" },
            { status: 500 }
          );
        }
      }
    }
  }
});
