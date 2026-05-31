import { createFileRoute } from "@tanstack/react-router";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import { sendActivityEmail } from "@/lib/email";

function getAdminEmails(): Set<string> {
  const envEmails = process.env.ADMIN_EMAILS || process.env.VITE_ADMIN_EMAILS || "";
  const emails = new Set(
    envEmails
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
  emails.add("contact.sabara@gmail.com");
  return emails;
}

async function assertAdmin(request: Request, context: any) {
  let claims = context?.claims;
  
  if (!claims) {
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      if (supabaseUrl && supabaseKey) {
        try {
          const supabase = createClient(supabaseUrl, supabaseKey);
          const { data } = await supabase.auth.getClaims(token);
          if (data?.claims) {
            claims = data.claims;
          }
        } catch (e) {
          console.error("[assertAdmin fallback orders authentication failed]", e);
        }
      }
    }
  }

  const email = (
    claims?.email || 
    claims?.user_metadata?.email || 
    ""
  ).toLowerCase().trim();
  
  const adminSet = getAdminEmails();

  if (!email || !adminSet.has(email)) {
    throw new Error(`Forbidden: Admin access required.`);
  }
}

export const Route = createFileRoute("/api/admin/orders")({
  server: {
    middlewares: [requireSupabaseAuth],
    handlers: {
      GET: async ({ request, context }) => {
        try {
          await assertAdmin(request, context);
          const authHeader = request.headers.get("authorization");
          const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;

          const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
          const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
          
          const supabase = token 
            ? createClient(supabaseUrl!, supabaseKey!, {
                global: { headers: { Authorization: `Bearer ${token}` } }
              })
            : createClient(supabaseUrl!, supabaseKey!);

          const { data: dbOrders, error: ordersError } = await supabase
            .from("orders")
            .select("*, order_items(*)")
            .order("created_at", { ascending: false });

          if (ordersError) throw new Error(ordersError.message);

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
          console.error("[api/admin/orders GET error]", err);
          return Response.json({ success: false, error: err.message }, { status: 500 });
        }
      },
      PUT: async ({ request, context }) => {
        try {
          await assertAdmin(request, context);
          const body = await request.json();
          const { id, status, courier, trackingNumber, sellerInstruction, customerStatus } = body;
          
          if (!id || !status) {
            return Response.json({ success: false, error: "Missing id or status" }, { status: 400 });
          }

          const authHeader = request.headers.get("authorization");
          const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;

          const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
          const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
          
          const supabase = token 
            ? createClient(supabaseUrl!, supabaseKey!, {
                global: { headers: { Authorization: `Bearer ${token}` } }
              })
            : createClient(supabaseUrl!, supabaseKey!);

          // Get current shipping street and status to verify and preserve address
          const { data: currentOrder, error: fetchErr } = await supabase
            .from("orders")
            .select("status, shipping_street")
            .eq("id", id)
            .single();

          if (fetchErr) throw new Error(fetchErr.message);

          let updatedStreet = currentOrder?.shipping_street || "";
          const parts = (currentOrder?.shipping_street || "").split("|");
          const baseStreet = parts[0];
          const couponCode = parts[3] || "";
          const discountAmount = parts[4] || "";
          if (status === "Shipped" && courier && trackingNumber) {
            updatedStreet = `${baseStreet}|${courier.trim()}|${trackingNumber.trim()}|${couponCode}|${discountAmount}`;
          } else {
            const courierVal = parts[1] || "";
            const trackingVal = parts[2] || "";
            updatedStreet = `${baseStreet}|${courierVal}|${trackingVal}|${couponCode}|${discountAmount}`;
          }

          let finalStatus = status;
          if (status === "Cancelled") {
            finalStatus = "Cancelled by Seller";
          }

          // Update status, customer_status, shipping_street and seller_instruction
          const { error: updateError } = await supabase
            .from("orders")
            .update({ 
              status: finalStatus, 
              customer_status: customerStatus !== undefined ? customerStatus : undefined,
              shipping_street: updatedStreet,
              seller_instruction: sellerInstruction !== undefined ? sellerInstruction : undefined
            })
            .eq("id", id);
          if (updateError) throw new Error(updateError.message);

          // Determine the activity type for notifications
          let activityType: "return_approved" | "return_rejected" | "status_update" | null = null;
          if (customerStatus === "Return Approved") {
            activityType = "return_approved";
          } else if (customerStatus === "Return Rejected") {
            activityType = "return_rejected";
          } else if (finalStatus !== currentOrder?.status || sellerInstruction !== undefined) {
            activityType = "status_update";
          }

          if (activityType) {
            const origin = new URL(request.url).origin;
            sendActivityEmail(activityType, id, supabase, origin).catch((e) => {
              console.error(`[api/admin/orders PUT email dispatch error]`, e);
            });
          }

          const { data: dbOrders, error: ordersError } = await supabase
            .from("orders")
            .select("*, order_items(*)")
            .order("created_at", { ascending: false });

          if (ordersError) throw new Error(ordersError.message);

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
          console.error("[api/admin/orders PUT error]", err);
          return Response.json({ success: false, error: err.message }, { status: 500 });
        }
      }
    }
  }
});
