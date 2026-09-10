import { createFileRoute } from "@tanstack/react-router";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import dns from "node:dns";

if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

async function resolveSupabaseClient(request: Request, context: any) {
  let supabase = (context as any)?.supabase;
  let userId = (context as any)?.userId;

  const authHeader = request.headers.get("authorization");
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;

  // Extract userId from token if not provided in context
  if (!userId && token) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (supabaseUrl && supabaseKey) {
      try {
        const tempClient = createClient(supabaseUrl, supabaseKey);
        const { data } = await tempClient.auth.getClaims(token);
        if (data?.claims?.sub) {
          userId = data.claims.sub;
        }
      } catch (e) {
        console.error("[resolveSupabaseClient extract sub error]", e);
      }
    }
  }

  // Create client: Prefer service role key if available to bypass RLS on backend server calls
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (supabaseUrl) {
    if (serviceKey && serviceKey.trim() && serviceKey.trim().startsWith("eyJ")) {
      supabase = createClient(supabaseUrl, serviceKey, {
        auth: {
          storage: undefined,
          persistSession: false,
          autoRefreshToken: false,
        }
      });
    } else if (token && supabaseKey) {
      supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: {
          storage: undefined,
          persistSession: false,
          autoRefreshToken: false,
        }
      });
    }
  }

  return { supabase, userId };
}

export const Route = createFileRoute("/api/users/profile")({
  server: {
    middlewares: [requireSupabaseAuth],
    handlers: {
      // ── GET /api/users/profile ───────────────────────────────────────────
      GET: async ({ request, context }) => {
        try {
          const { supabase, userId } = await resolveSupabaseClient(request, context);

          if (!supabase || !userId) {
            return Response.json({ success: false, error: "Unauthorized: Missing session" }, { status: 401 });
          }

          const { data, error } = await supabase
            .from("user_profiles")
            .select("*")
            .eq("id", userId)
            .single();

          if (error && error.code !== "PGRST116") {
            console.error("[profile GET]", error.message);
            return Response.json({ success: false, error: error.message }, { status: 500 });
          }

          if (!data) {
            return Response.json({ success: true, profile: null });
          }

          let addresses: any[] = [];

          // Try fetching from dedicated shipping_addresses table first
          try {
            const { data: dbAddrs, error: addrErr } = await supabase
              .from("shipping_addresses")
              .select("*")
              .eq("user_id", userId)
              .order("created_at", { ascending: true });

            if (!addrErr && dbAddrs && dbAddrs.length > 0) {
              addresses = dbAddrs.map((a: any) => ({
                id: a.id,
                fullName: a.full_name,
                email: a.email || "",
                phone: a.phone,
                street: a.street,
                landmark: a.landmark || "",
                district: a.district || "",
                city: a.city || a.district || "",
                state: a.state,
                zipCode: a.zip_code,
                label: a.label || "HOME",
                isDefault: a.is_default || false,
              }));
            }
          } catch (e) {
            console.error("[profile GET shipping_addresses error]", e);
          }

          // Fallback to user_profiles.street if shipping_addresses table was empty or not yet created
          if (addresses.length === 0 && data) {
            const streetStr = (data.street || "").trim();
            if (streetStr.startsWith("[")) {
              try {
                const parsed = JSON.parse(streetStr);
                if (Array.isArray(parsed)) {
                  addresses = parsed;
                }
              } catch (e) {
                console.error("[profile GET parse addresses error]", e);
              }
            } else if (streetStr !== "" && streetStr !== "[]") {
              const parts = streetStr.split("|||");
              const street = parts[0] || "";
              const landmark = parts[1] || "";
              const district = parts[2] || "";
              if (street || landmark || district || data.city || data.state || data.zip_code) {
                addresses = [{
                  id: "default",
                  fullName: data.full_name || "",
                  email: "",
                  phone: data.phone || "",
                  street: street,
                  city: data.city || "",
                  district: district,
                  state: data.state || "",
                  zipCode: data.zip_code || "",
                  landmark: landmark,
                  label: "HOME"
                }];
              }
            }
          }

          const profile = {
            fullName: data?.full_name,
            age: data?.age,
            phone: data?.phone,
            avatarUrl: data?.avatar_url,
            addresses: addresses,
            address: addresses[0] || null,
          };

          return Response.json({ success: true, profile });
        } catch (err: any) {
          console.error("[profile GET error]", err);
          return Response.json({ success: false, error: err.message }, { status: 500 });
        }
      },

      // ── POST /api/users/profile ──────────────────────────────────────────
      POST: async ({ request, context }) => {
        try {
          const { supabase, userId } = await resolveSupabaseClient(request, context);

          if (!supabase || !userId) {
            return Response.json({ success: false, error: "Unauthorized: Missing session" }, { status: 401 });
          }

          const body = await request.json();
          const { fullName, age, phone, address, addresses, avatarUrl } = body as {
            fullName?: string;
            age?: string | number;
            phone?: string;
            avatarUrl?: string | null;
            addresses?: any[];
            address?: { street?: string; city?: string; district?: string; state?: string; zipCode?: string; landmark?: string };
          };

          // Handle age string-to-number safe casting
          const parsedAge = age && age !== "" ? Number(age) : null;

          // Fetch the existing profile to preserve avatar_url if not explicitly provided
          let existingAvatarUrl = null;
          try {
            const { data: existing } = await supabase
              .from("user_profiles")
              .select("avatar_url")
              .eq("id", userId)
              .single();
            if (existing) {
              existingAvatarUrl = existing.avatar_url;
            }
          } catch (e) {
            console.error("[profile POST] Error fetching existing avatar_url:", e);
          }

          const finalAvatarUrl = avatarUrl !== undefined ? avatarUrl : existingAvatarUrl;

          // Process addresses and street column encoding
          let dbStreet: string | null = null;
          let firstAddr: any = null;

          if (addresses !== undefined && Array.isArray(addresses)) {
            dbStreet = JSON.stringify(addresses);
            firstAddr = addresses[0] || null;

            // Sync with dedicated shipping_addresses table
            try {
              // Delete old addresses for this user
              await supabase
                .from("shipping_addresses")
                .delete()
                .eq("user_id", userId);

              // Insert new addresses
              if (addresses.length > 0) {
                const insertPayload = addresses.map((addr) => ({
                  user_id: userId,
                  full_name: addr.fullName || fullName || "",
                  email: addr.email || null,
                  phone: addr.phone || phone || "",
                  street: addr.street || "",
                  landmark: addr.landmark || null,
                  district: addr.district || "",
                  city: addr.city || addr.district || null,
                  state: addr.state || "",
                  zip_code: addr.zipCode || "",
                  label: addr.label || "HOME",
                  is_default: addr.isDefault || false,
                }));

                await supabase
                  .from("shipping_addresses")
                  .insert(insertPayload);
              }
            } catch (dbErr) {
              console.error("[profile POST shipping_addresses sync error]", dbErr);
            }
          } else if (address !== undefined) {
            if (address && (address.street || address.landmark || address.district)) {
              dbStreet = `${address.street || ""}|||${address.landmark || ""}|||${address.district || ""}`;
              firstAddr = address;
            } else {
              dbStreet = "[]";
              firstAddr = null;
            }
          }

          const upsertPayload: Record<string, any> = {
            id: userId,
            full_name: fullName ?? null,
            age: parsedAge,
            phone: phone ?? null,
            avatar_url: finalAvatarUrl,
          };

          if (addresses !== undefined || address !== undefined) {
            upsertPayload.street = dbStreet;
            upsertPayload.city = firstAddr?.city ?? null;
            upsertPayload.state = firstAddr?.state ?? null;
            upsertPayload.zip_code = firstAddr?.zipCode ?? null;
          }

          const { data, error } = await supabase
            .from("user_profiles")
            .upsert(upsertPayload, { onConflict: "id" })
            .select()
            .single();

          if (error) {
            console.error("[profile POST]", error.message);
            return Response.json({ success: false, error: error.message }, { status: 500 });
          }

          const streetStr = (data.street || "").trim();
          let responseAddresses: any[] = [];
          if (streetStr.startsWith("[")) {
            try {
              const parsed = JSON.parse(streetStr);
              if (Array.isArray(parsed)) {
                responseAddresses = parsed;
              }
            } catch (e) {}
          } else if (streetStr !== "" && streetStr !== "[]") {
            const parts = streetStr.split("|||");
            const street = parts[0] || "";
            const landmark = parts[1] || "";
            const district = parts[2] || "";
            if (street || landmark || district || data.city || data.state || data.zip_code) {
              responseAddresses = [{
                id: "default",
                fullName: data.full_name || "",
                phone: data.phone || "",
                street: street,
                city: data.city || "",
                district: district,
                state: data.state || "",
                zipCode: data.zip_code || "",
                landmark: landmark,
                label: "HOME"
              }];
            }
          }

          const profile = {
            fullName: data.full_name,
            age: data.age,
            phone: data.phone,
            avatarUrl: data.avatar_url,
            addresses: responseAddresses,
            address: responseAddresses[0] || null,
          };

          return Response.json({ success: true, profile });
        } catch (err: any) {
          console.error("[profile POST error]", err);
          return Response.json({ success: false, error: err.message }, { status: 500 });
        }
      },
    },
  },
});
