import { createFileRoute } from "@tanstack/react-router";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";

function getAdminEmails(): Set<string> {
  return new Set([
    "contact.sabara@gmail.com",
    "sumansamanta721467@gmail.com",
  ]);
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
          console.error("[assertAdmin fallback customers authentication failed]", e);
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

export const Route = createFileRoute("/api/admin/customers")({
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
          const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
          const isServiceKeyValid = !!(serviceKey && serviceKey.trim() && serviceKey.trim().startsWith("eyJ"));

          const useAdmin = isServiceKeyValid;
          const supabase = useAdmin
            ? createClient(supabaseUrl!, serviceKey!, {
                auth: {
                  storage: undefined,
                  persistSession: false,
                  autoRefreshToken: false,
                }
              })
            : (token 
                ? createClient(supabaseUrl!, supabaseKey!, {
                    global: { headers: { Authorization: `Bearer ${token}` } }
                  })
                : createClient(supabaseUrl!, supabaseKey!)
              );
          
          // 1. Fetch registered profiles from DB
          let dbProfiles = null;
          let profileErr = null;
          try {
            const res = await supabase.from("user_profiles").select("*");
            dbProfiles = res.data;
            profileErr = res.error;
          } catch (e: any) {
            console.error("[api/admin/customers user_profiles query threw]", e);
          }
            
          if (profileErr) {
            console.warn("[api/admin/customers GET db fetch warning]", profileErr.message);
            // Only throw if using admin client (where we expect it to succeed)
            if (useAdmin) {
              throw new Error(`Profiles Fetch Error: ${profileErr.message}`);
            }
          }

          const profiles = dbProfiles || [];
          console.log("DEBUG: dbProfiles columns:", profiles[0] ? Object.keys(profiles[0]) : "empty", profiles);

          // 2. Fetch all orders from DB
          const { data: dbOrders, error: ordersErr } = await supabase
            .from("orders")
            .select("*");

          if (ordersErr) {
            console.error("[api/admin/customers GET orders fetch error]", ordersErr.message);
            throw new Error(`Orders Fetch Error: ${ordersErr.message}`);
          }

          const orders = dbOrders || [];

          // 3. Map orders by user_id and email
          const ordersByUserId: Record<string, any[]> = {};
          const ordersByEmail: Record<string, any[]> = {};

          orders.forEach((o) => {
            if (o.user_id) {
              if (!ordersByUserId[o.user_id]) ordersByUserId[o.user_id] = [];
              ordersByUserId[o.user_id].push(o);
            }
            const email = (o.customer_email || "").toLowerCase().trim();
            if (email) {
              if (!ordersByEmail[email]) ordersByEmail[email] = [];
              ordersByEmail[email].push(o);
            }
          });

          // 4. Compile customer list
          const customersList: any[] = [];
          const processedEmails = new Set<string>();

          // First compile customers from registered profiles
          profiles.forEach((profile: any) => {
            const userOrders = ordersByUserId[profile.id] || [];
            let email = profile.email || userOrders[0]?.customer_email || "";
            if (email) processedEmails.add(email.toLowerCase().trim());

            const totalSpent = userOrders.reduce((sum, o) => sum + Number(o.total), 0);

            customersList.push({
              id: profile.id,
              fullName: profile.full_name || userOrders[0]?.customer_name || "Anonymous",
              email: email || "Registered Customer (No order yet)",
              phone: profile.phone || userOrders[0]?.customer_phone || "—",
              age: profile.age || "—",
              street: profile.street || userOrders[0]?.shipping_street || "—",
              city: profile.city || userOrders[0]?.shipping_city || "—",
              state: profile.state || userOrders[0]?.shipping_state || "—",
              zipCode: profile.zip_code || userOrders[0]?.shipping_zip_code || "—",
              totalOrders: userOrders.length,
              totalSpent,
              isRegistered: true,
              cart: profile.cart || [],
              wishlist: profile.wishlist || [],
              loginMethod: profile.login_method || "email"
            });
          });

          // Compile other checkout customers who aren't registered (guest checkouts or profiles without email)
          Object.keys(ordersByEmail).forEach((email) => {
            if (!email || processedEmails.has(email)) return;

            const guestOrders = ordersByEmail[email];
            if (!guestOrders || !guestOrders.length) return;
            
            const firstOrder = guestOrders[0];
            const totalSpent = guestOrders.reduce((sum, o) => sum + Number(o.total), 0);
            
            const registeredOrder = guestOrders.find((o) => o.user_id !== null);
            const hasRegisteredOrder = !!registeredOrder;
            const userId = registeredOrder?.user_id;

            customersList.push({
              id: userId || `guest-${firstOrder.id ? firstOrder.id.substring(0, 8) : Math.random().toString(36).slice(2, 10)}`,
              fullName: firstOrder.customer_name || "Anonymous",
              email: firstOrder.customer_email || "No Email",
              phone: firstOrder.customer_phone || "—",
              age: "—",
              street: firstOrder.shipping_street || "—",
              city: firstOrder.shipping_city || "—",
              state: firstOrder.shipping_state || "—",
              zipCode: firstOrder.shipping_zip_code || "—",
              totalOrders: guestOrders.length,
              totalSpent,
              isRegistered: hasRegisteredOrder,
              cart: [],
              wishlist: [],
              loginMethod: "guest"
            });
          });

          return Response.json({ success: true, customers: customersList });
        } catch (err: any) {
          console.error("[api/admin/customers GET error]", err);
          return Response.json({ success: false, error: err.message }, { status: 500 });
        }
      }
    }
  }
});
