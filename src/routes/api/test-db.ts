import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/test-db")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
          const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
          const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

          const clientPublishable = createClient(supabaseUrl!, supabaseKey!);
          const clientService = serviceKey ? createClient(supabaseUrl!, serviceKey) : null;

          // 1. Test profiles with publishable key
          const { data: pubProfiles, error: pubProfilesErr } = await clientPublishable
            .from("user_profiles")
            .select("*");

          // Test upserting a profile to check RLS permissions
          const { data: testUpsert, error: testUpsertErr } = await clientPublishable
            .from("user_profiles")
            .upsert({
              id: "00000000-0000-0000-0000-000000000000",
              full_name: "Test RLS User"
            })
            .select();

          // 2. Test orders with publishable key
          const { data: pubOrders, error: pubOrdersErr } = await clientPublishable
            .from("orders")
            .select("*");

          // 3. Test profiles with service key
          let servProfiles = null;
          let servProfilesErr = null;
          if (clientService) {
            const { data, error } = await clientService.from("user_profiles").select("*");
            servProfiles = data;
            servProfilesErr = error;
          }

          // 4. Test orders with service key
          let servOrders = null;
          let servOrdersErr = null;
          if (clientService) {
            const { data, error } = await clientService.from("orders").select("*");
            servOrders = data;
            servOrdersErr = error;
          }

          return Response.json({
            success: true,
            env: {
              supabaseUrl: !!supabaseUrl,
              supabaseKey: !!supabaseKey,
              serviceKey: !!serviceKey,
            },
            publishable: {
              profilesCount: pubProfiles ? pubProfiles.length : null,
              profilesError: pubProfilesErr ? pubProfilesErr.message : null,
              testUpsertError: testUpsertErr ? testUpsertErr.message : null,
              testUpsertResult: testUpsert,
              ordersCount: pubOrders ? pubOrders.length : null,
              ordersError: pubOrdersErr ? pubOrdersErr.message : null,
              sampleOrders: pubOrders ? pubOrders.slice(0, 2) : null,
            },
            serviceRole: {
              profilesCount: servProfiles ? servProfiles.length : null,
              profilesError: servProfilesErr ? servProfilesErr.message : null,
              ordersCount: servOrders ? servOrders.length : null,
              ordersError: servOrdersErr ? servOrdersErr.message : null,
              sampleProfiles: servProfiles ? servProfiles.slice(0, 2) : null,
            }
          });
        } catch (e: any) {
          return Response.json({ success: false, error: e.message });
        }
      }
    }
  }
});
