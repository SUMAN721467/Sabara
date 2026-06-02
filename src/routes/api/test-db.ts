import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/test-db")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)?.replace(/['"]/g, '').trim();
          const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/['"]/g, '').trim();
          
          if (!serviceKey) {
            return Response.json({ success: false, error: "No service role key found" });
          }

          const supabase = createClient(supabaseUrl!, serviceKey, {
            auth: {
              storage: undefined,
              persistSession: false,
              autoRefreshToken: false,
            }
          });

          // Fetch one order to test
          const { data: orders, error: fetchErr } = await supabase
            .from("orders")
            .select("id, status")
            .limit(1);

          if (fetchErr || !orders || orders.length === 0) {
            return Response.json({ success: false, error: "No orders found to test with: " + fetchErr?.message });
          }

          const testOrderId = orders[0].id;
          const originalCustomerStatus = orders[0].customer_status || null;

          const statusesToTest = [
            "Pending",
            "Paid",
            "Payment Success, Order Pending",
            "Cancelled by Customer",
            "Return Requested",
            "Return Approved",
            "Return Rejected"
          ];
          const results: Record<string, any> = {};

          for (const customer_status of statusesToTest) {
            const { error } = await supabase
              .from("orders")
              .update({ customer_status })
              .eq("id", testOrderId);
            
            if (error) {
              results[customer_status] = { success: false, error: error.message };
            } else {
              results[customer_status] = { success: true };
              // Revert back to original status immediately
              await supabase.from("orders").update({ customer_status: originalCustomerStatus }).eq("id", testOrderId);
            }
          }

          return Response.json({
            success: true,
            testOrderId,
            originalCustomerStatus,
            results
          });
        } catch (e: any) {
          return Response.json({ success: false, error: e.message });
        }
      }
    }
  }
});
