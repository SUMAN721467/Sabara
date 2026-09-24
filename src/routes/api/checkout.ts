import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { sendOrderEmails } from "@/lib/email";
import dns from "node:dns";
import Razorpay from "razorpay";

if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

export const Route = createFileRoute("/api/checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const { userId, items, customerName, customerEmail, customerPhone, total, couponCode, shippingAddress } = body;

          if (!userId) {
            return Response.json(
              { success: false, error: "Authentication is required to place an order." },
              { status: 401 }
            );
          }

          if (!items || !items.length || !customerEmail || !shippingAddress) {
            return Response.json(
              { success: false, error: "Missing required checkout details" },
              { status: 400 }
            );
          }

          const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)?.replace(/['"]/g, '').trim();
          const supabaseKey = (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY)?.replace(/['"]/g, '').trim();
          const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/['"]/g, '').trim();
          const isServiceKeyValid = !!(serviceKey && serviceKey.startsWith("eyJ"));
          const supabase = isServiceKeyValid
            ? createClient(supabaseUrl!, serviceKey, {
                auth: {
                  storage: undefined,
                  persistSession: false,
                  autoRefreshToken: false,
                }
              })
            : createClient(supabaseUrl!, supabaseKey!);

          // 1. Batch verify and deduct stock in a single DB query
          const productIds = items.map((i: any) => i.productId).filter(Boolean);
          let prodMap = new Map<string, any>();
          if (productIds.length > 0) {
            const { data: dbProducts } = await supabase
              .from("products")
              .select("id, stock, name, price")
              .in("id", productIds);
            if (dbProducts) {
              dbProducts.forEach((p: any) => prodMap.set(p.id, p));
            }
          }

          let secureSubtotal = 0;
          for (const item of items) {
            const prod = prodMap.get(item.productId);
            if (prod) {
              const currentStock = prod.stock !== undefined && prod.stock !== null ? Number(prod.stock) : 10;
              if (currentStock < item.qty) {
                return Response.json(
                  { success: false, error: `Product "${prod.name}" only has ${currentStock} item(s) left in stock.` },
                  { status: 400 }
                );
              }
              secureSubtotal += Number(prod.price) * item.qty;
            } else {
              secureSubtotal += Number(item.price) * item.qty;
            }
          }

          // 2. Fetch coupons, shipping settings, and recent orders simultaneously in parallel
          const code = couponCode?.trim().toUpperCase();
          const [couponSettingRes, shippingSettingRes, recentOrdersRes] = await Promise.all([
            code
              ? supabase.from("site_settings").select("value").eq("key", "coupons").maybeSingle()
              : Promise.resolve({ data: null }),
            supabase.from("site_settings").select("value").eq("key", "shipping").maybeSingle(),
            supabase.from("orders").select("order_number").order("created_at", { ascending: false }).limit(20),
          ]);

          // Apply coupon discount securely
          let discount = 0;
          let matchedCouponToDecrement: any = null;
          let allCouponsList: any[] = [];

          if (code) {
            let dbCoupons = (couponSettingRes.data?.value as any)?.coupons;

            if (!dbCoupons) {
              try {
                const fs = await import("fs/promises");
                const path = await import("path");
                const filePath = path.join(process.cwd(), "src", "data", "coupons.json");
                const fileContent = await fs.readFile(filePath, "utf-8");
                const localValue = JSON.parse(fileContent);
                if (localValue?.coupons) {
                  dbCoupons = localValue.coupons;
                }
              } catch (e) {
                // Ignore
              }
            }

            if (!dbCoupons) {
              dbCoupons = [
                { code: "FESTIVE10", discount: 10 },
                { code: "FIRSTORDER", discount: 20 },
                { code: "SABARA15", discount: 15 }
              ];
            }

            allCouponsList = dbCoupons;
            const matchedCoupon = dbCoupons.find(
              (c: any) => c.code?.trim().toUpperCase() === code
            );

            if (matchedCoupon) {
              // Validate minimum order requirement
              if (matchedCoupon.minOrder !== undefined && matchedCoupon.minOrder !== null) {
                const minOrderNum = Number(matchedCoupon.minOrder);
                if (secureSubtotal < minOrderNum) {
                  return Response.json(
                    { success: false, error: `Minimum order amount of ₹${minOrderNum} is required to apply coupon "${code}".` },
                    { status: 400 }
                  );
                }
              }
              // Validate usage limit
              if (matchedCoupon.limit !== undefined && matchedCoupon.limit !== null) {
                const limitNum = Number(matchedCoupon.limit);
                if (limitNum <= 0) {
                  return Response.json(
                    { success: false, error: `Coupon "${code}" usage limit has been reached.` },
                    { status: 400 }
                  );
                }
              }

              matchedCouponToDecrement = matchedCoupon;
              const pct = Number(matchedCoupon.discount) || 0;
              discount = Math.round(secureSubtotal * (pct / 100));
            } else {
              return Response.json(
                { success: false, error: `Coupon code "${code}" is invalid.` },
                { status: 400 }
              );
            }
          }

          // Shipping settings
          const shippingSettings = (shippingSettingRes.data?.value as any) || {
            enabled: true,
            fee: 100,
            minOrder: 1000
          };

          let shippingFee = 0;
          if (shippingSettings.enabled && (secureSubtotal - discount) < shippingSettings.minOrder) {
            shippingFee = Number(shippingSettings.fee) || 0;
          }

          const finalTotal = Math.max(0, secureSubtotal - discount + shippingFee);

          // Find sequence number from latest orders
          let seq = 1;
          const existingOrders = recentOrdersRes.data;
          if (existingOrders && existingOrders.length > 0) {
            const seqs = existingOrders
              .map((o: any) => {
                const match = o.order_number?.match(/^LW-2026-(\d+)$/);
                return match ? parseInt(match[1], 10) : 0;
              })
              .filter(Boolean);
            if (seqs.length > 0) {
              seq = Math.max(...seqs) + 1;
            }
          }

          const baseStreet = `${shippingAddress.street.replace(/\|/g, " ")}${shippingAddress.landmark ? ` (Landmark: ${shippingAddress.landmark.replace(/\|/g, " ")})` : ""}${shippingAddress.district ? ` (District: ${shippingAddress.district.replace(/\|/g, " ")})` : ""}`;

          // Insert order with retry loop for unique constraint safety
          let order = null;
          let attempts = 0;
          const maxAttempts = 5;

          while (attempts < maxAttempts) {
            const currentOrderNumber = `LW-2026-${String(seq).padStart(4, "0")}`;
            const { data, error: insertError } = await supabase
              .from("orders")
              .insert({
                order_number: currentOrderNumber,
                customer_name: customerName,
                customer_email: customerEmail,
                customer_phone: customerPhone || null,
                total: finalTotal,
                status: "Pending",
                shipping_street: code 
                  ? `${baseStreet}|||${code}|${discount}` 
                  : baseStreet,
                shipping_city: shippingAddress.city,
                shipping_state: shippingAddress.state,
                shipping_zip_code: shippingAddress.zipCode,
                user_id: userId || null
              })
              .select("*")
              .single();

            if (!insertError) {
              order = data;
              break;
            }

            if (insertError.message.includes("duplicate key") || insertError.message.includes("unique constraint")) {
              seq++;
              attempts++;
            } else {
              throw new Error(insertError.message);
            }
          }

          if (!order) {
            throw new Error("Failed to generate a unique order number after multiple attempts.");
          }

          // Insert order items
          const orderItemsPayload = items.map((item: any) => ({
            order_id: order.id,
            product_id: item.productId,
            product_name: item.productName,
            product_image: item.productImage,
            qty: item.qty,
            price: item.price
          }));

          const { error: itemsError } = await supabase
            .from("order_items")
            .insert(orderItemsPayload);

          if (itemsError) {
            // Roll back order insertion
            await supabase.from("orders").delete().eq("id", order.id);
            throw new Error(itemsError.message);
          }

          // Decrement coupon limit if applicable
          if (matchedCouponToDecrement && matchedCouponToDecrement.limit !== undefined && matchedCouponToDecrement.limit !== null) {
            const updatedCoupons = allCouponsList.map((c: any) => {
              if (c.code?.trim().toUpperCase() === matchedCouponToDecrement.code?.trim().toUpperCase()) {
                return {
                  ...c,
                  limit: Math.max(0, Number(c.limit) - 1)
                };
              }
              return c;
            });

            // Write back to database using Service Role key if possible to bypass RLS, otherwise fallback to publishable key client
            const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/['"]/g, '').trim();
            const isServiceKeyValid = !!(serviceKey && serviceKey.startsWith("eyJ"));
            const supabaseAdmin = isServiceKeyValid
              ? createClient(supabaseUrl!, serviceKey, {
                  auth: {
                    storage: undefined,
                    persistSession: false,
                    autoRefreshToken: false,
                  }
                })
              : supabase;

            try {
              const { error: updateErr } = await supabaseAdmin
                .from("site_settings")
                .upsert({
                  key: "coupons",
                  value: { coupons: updatedCoupons },
                  updated_at: new Date().toISOString()
                });
              if (updateErr) {
                console.warn("[api/checkout coupon decrement db error]", updateErr.message);
              }
            } catch (e: any) {
              console.warn("[api/checkout coupon decrement db exception]", e);
            }

            // Write to fallback JSON file
            try {
              const fs = await import("fs/promises");
              const path = await import("path");
              const filePath = path.join(process.cwd(), "src", "data", "coupons.json");
              await fs.mkdir(path.dirname(filePath), { recursive: true });
              await fs.writeFile(filePath, JSON.stringify({ coupons: updatedCoupons }, null, 2), "utf-8");
            } catch (fsErr) {
              console.error("[api/checkout coupon decrement local write error]", fsErr);
            }
          }

          const camelCaseOrder = {
            id: order.id,
            orderNumber: order.order_number,
            customerName: order.customer_name,
            customerEmail: order.customer_email,
            customerPhone: order.customer_phone,
            total: Number(order.total),
            status: order.status,
            date: order.created_at,
            shippingAddress: {
              street: order.shipping_street,
              city: order.shipping_city,
              state: order.shipping_state,
              zipCode: order.shipping_zip_code,
              landmark: shippingAddress.landmark || "",
              district: shippingAddress.district || ""
            },
            items: items.map((i: any) => ({
              productId: i.productId,
              productName: i.productName,
              productImage: i.productImage,
              qty: i.qty,
              price: i.price
            }))
          };

          // Note: Confirmation emails will be sent from /api/verify-payment after successful payment verification.

          // Pre-generate Razorpay Order immediately on server to eliminate second client round-trip
          let razorpayData = null;
          const keyId = process.env.RAZORPAY_KEY_ID?.replace(/['"]/g, '').trim();
          const keySecret = process.env.RAZORPAY_KEY_SECRET?.replace(/['"]/g, '').trim();

          if (keyId && keySecret) {
            try {
              const RazorpayConstructor = (Razorpay as any).default || Razorpay;
              const razorpay = new RazorpayConstructor({
                key_id: keyId,
                key_secret: keySecret,
              });

              const amountPaise = Math.round(Number(camelCaseOrder.total) * 100);
              const rzpOrder = await razorpay.orders.create({
                amount: amountPaise,
                currency: "INR",
                receipt: camelCaseOrder.orderNumber,
              });

              razorpayData = {
                key_id: keyId,
                order_id: rzpOrder.id,
                amount: rzpOrder.amount,
                currency: rzpOrder.currency,
              };
            } catch (rzpErr: any) {
              console.warn("[api/checkout Razorpay order creation warning]", rzpErr);
            }
          }

          return Response.json({
            success: true,
            order: camelCaseOrder,
            razorpay: razorpayData,
          });
        } catch (err: any) {
          console.error("[api/checkout error]", err);
          return Response.json({ success: false, error: err.message }, { status: 500 });
        }
      }
    }
  }
});
