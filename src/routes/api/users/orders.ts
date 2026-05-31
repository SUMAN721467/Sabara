import { createFileRoute } from "@tanstack/react-router";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import { sendActivityEmail } from "@/lib/email";

async function resolveSupabaseClient(request: Request, context: any) {
  let supabase = (context as any)?.supabase;
  let userId = (context as any)?.userId;

  if (!supabase || !userId) {
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      if (supabaseUrl && supabaseKey) {
        try {
          const client = createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: {
              storage: undefined,
              persistSession: false,
              autoRefreshToken: false,
            }
          });
          const { data } = await client.auth.getClaims(token);
          if (data?.claims?.sub) {
            supabase = client;
            userId = data.claims.sub;
          }
        } catch (e) {
          console.error("[resolveSupabaseClient fallback error]", e);
        }
      }
    }
  }

  return { supabase, userId };
}

export const Route = createFileRoute("/api/users/orders")({
  server: {
    middlewares: [requireSupabaseAuth],
    handlers: {
      GET: async ({ request, context }) => {
        try {
          const { supabase, userId } = await resolveSupabaseClient(request, context);

          if (!supabase || !userId) {
            return Response.json({ success: false, error: "Unauthorized: Missing session" }, { status: 401 });
          }

          // Fetch orders for this user with order items
          const { data: dbOrders, error } = await supabase
            .from("orders")
            .select("*, order_items(*)")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

          if (error) {
            console.error("[users/orders GET]", error.message);
            return Response.json({ success: false, error: error.message }, { status: 500 });
          }

          const formatted = (dbOrders || []).map((o: any) => {
            const streetParts = (o.shipping_street || "").split("|");
            const baseStreet = streetParts[0];
            const courier = streetParts[1] || null;
            const trackingNumber = streetParts[2] || null;
            const couponCode = streetParts[3] || null;
            const discountAmount = streetParts[4] ? Number(streetParts[4]) : 0;

            return {
              id: o.id,
              orderNumber: o.order_number,
              customerName: o.customer_name,
              customerEmail: o.customer_email,
              customerPhone: o.customer_phone,
              total: Number(o.total),
              status: o.status,
              courier,
              trackingNumber,
              couponCode,
              discountAmount,
              date: o.created_at,
              shippingAddress: {
                street: baseStreet,
                city: o.shipping_city,
                state: o.shipping_state,
                zipCode: o.shipping_zip_code
              },
              cancellationReason: o.cancellation_reason || null,
              customerStatus: o.customer_status || "Pending",
              sellerInstruction: o.seller_instruction || null,
              items: (o.order_items || []).map((item: any) => ({
                productId: item.product_id,
                productName: item.product_name,
                productImage: item.product_image,
                qty: item.qty,
                price: Number(item.price)
              }))
            };
          });

          return Response.json({ success: true, orders: formatted });
        } catch (err: any) {
          console.error("[users/orders GET error]", err);
          return Response.json({ success: false, error: err.message }, { status: 500 });
        }
      },
      PUT: async ({ request, context }) => {
        try {
          const { supabase, userId } = await resolveSupabaseClient(request, context);

          if (!supabase || !userId) {
            return Response.json({ success: false, error: "Unauthorized: Missing session" }, { status: 401 });
          }

          const body = await request.json();
          const { orderId, action, reason } = body;

          if (!orderId) {
            return Response.json({ success: false, error: "Missing orderId" }, { status: 400 });
          }

          // 1. Fetch order details to verify ownership and current status/creation time
          const { data: order, error: fetchError } = await supabase
            .from("orders")
            .select("user_id, status, created_at")
            .eq("id", orderId)
            .single();

          if (fetchError) {
            console.error("[users/orders PUT fetch error]", fetchError.message);
            return Response.json({ success: false, error: "Order not found" }, { status: 404 });
          }

          if (order.user_id !== userId) {
            return Response.json({ success: false, error: "Forbidden: You do not own this order" }, { status: 403 });
          }

          if (action === "return") {
            if (order.status !== "Delivered") {
              return Response.json({ success: false, error: `Cannot request return for order with status: ${order.status}` }, { status: 400 });
            }

            // Check if it is within 7 days
            const orderDate = new Date(order.created_at);
            const now = new Date();
            const diffTime = Math.abs(now.getTime() - orderDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays > 7) {
              return Response.json({ success: false, error: "Return period has expired (7 days from delivery/order placement)" }, { status: 400 });
            }

            // Update customer_status to 'Return Requested' and cancellation_reason to reason
            const { error: updateError } = await supabase
              .from("orders")
              .update({ 
                customer_status: "Return Requested",
                cancellation_reason: reason || "No reason provided"
              })
              .eq("id", orderId);

            if (updateError) {
              console.error("[users/orders PUT return update error]", updateError.message);
              return Response.json({ success: false, error: updateError.message }, { status: 500 });
            }

            // Trigger return_requested email notifications asynchronously
            const origin = new URL(request.url).origin;
            sendActivityEmail("return_requested", orderId, supabase, origin).catch((e) => {
              console.error("[users/orders PUT return email dispatch error]", e);
            });

            return Response.json({ success: true, message: "Return requested successfully" });
          } else {
            // Default to cancel action
            if (order.status !== "Pending") {
              return Response.json({ success: false, error: `Cannot cancel order with status: ${order.status}` }, { status: 400 });
            }

            // Perform status update to 'Cancelled' and set customer_status to 'Cancelled by Customer' and save reason
            const { error: updateError } = await supabase
              .from("orders")
              .update({ 
                status: "Cancelled",
                customer_status: "Cancelled by Customer",
                cancellation_reason: reason || null
              })
              .eq("id", orderId);

            if (updateError) {
              console.error("[users/orders PUT cancel update error]", updateError.message);
              return Response.json({ success: false, error: updateError.message }, { status: 500 });
            }

            // Trigger customer_cancelled email notifications asynchronously
            const origin = new URL(request.url).origin;
            sendActivityEmail("customer_cancelled", orderId, supabase, origin).catch((e) => {
              console.error("[users/orders PUT cancel email dispatch error]", e);
            });

            return Response.json({ success: true, message: "Order cancelled successfully" });
          }
        } catch (err: any) {
          console.error("[users/orders PUT error]", err);
          return Response.json({ success: false, error: err.message }, { status: 500 });
        }
      }
    }
  },
});
