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

          const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
          const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
          const supabase = createClient(supabaseUrl!, supabaseKey!);

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

          // Restore product stocks
          const { data: orderItems, error: itemsErr } = await supabase
            .from("order_items")
            .select("product_id, qty")
            .eq("order_id", orderId);

          if (!itemsErr && orderItems) {
            for (const item of orderItems) {
              if (item.product_id) {
                const { data: prod } = await supabase
                  .from("products")
                  .select("stock")
                  .eq("id", item.product_id)
                  .single();

                const currentStock = prod && prod.stock !== undefined && prod.stock !== null ? Number(prod.stock) : 0;
                const newStock = currentStock + Number(item.qty);

                await supabase
                  .from("products")
                  .update({ stock: newStock })
                  .eq("id", item.product_id);
              }
            }
          }

          // Update order status to Cancelled / Payment Failed
          const cancelReason = reason || "Payment cancelled or failed";
          const { error: updateErr } = await supabase
            .from("orders")
            .update({
              status: "Cancelled",
              customer_status: "Cancelled by Customer",
              cancellation_reason: cancelReason
            })
            .eq("id", orderId);

          if (updateErr) {
            throw new Error(`Failed to update order to Cancelled: ${updateErr.message}`);
          }

          return Response.json({
            success: true,
            message: "Order successfully cancelled and stock restored."
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
