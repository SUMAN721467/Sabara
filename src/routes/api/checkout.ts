import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { sendOrderEmails } from "@/lib/email";
import dns from "node:dns";
import Razorpay from "razorpay";

if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

let cachedSupabase: any = null;
let cachedRazorpay: any = null;

function getSupabase() {
  if (cachedSupabase) return cachedSupabase;
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)?.replace(/['"]/g, "").trim();
  const supabaseKey = (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY)?.replace(/['"]/g, "").trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/['"]/g, "").trim();
  const isServiceKeyValid = !!(serviceKey && serviceKey.startsWith("eyJ"));

  cachedSupabase = isServiceKeyValid
    ? createClient(supabaseUrl!, serviceKey, {
        auth: {
          storage: undefined,
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : createClient(supabaseUrl!, supabaseKey!);
  return cachedSupabase;
}

function getRazorpay() {
  if (cachedRazorpay) return cachedRazorpay;
  const keyId = process.env.RAZORPAY_KEY_ID?.replace(/['"]/g, "").trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.replace(/['"]/g, "").trim();
  if (!keyId || !keySecret) return null;
  const RazorpayConstructor = (Razorpay as any).default || Razorpay;
  cachedRazorpay = new RazorpayConstructor({
    key_id: keyId,
    key_secret: keySecret,
  });
  return cachedRazorpay;
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

          const supabase = getSupabase();

          // 1. Execute ALL initial queries concurrently in parallel (batch product stock, coupons, shipping, recent orders)
          const productIds = items.map((i: any) => i.productId).filter(Boolean);
          const code = couponCode?.trim().toUpperCase();

          const [productsRes, couponSettingRes, shippingSettingRes, recentOrdersRes] = await Promise.all([
            productIds.length > 0
              ? supabase.from("products").select("id, stock, name, price").in("id", productIds)
              : Promise.resolve({ data: [] }),
            code
              ? supabase.from("site_settings").select("value").eq("key", "coupons").maybeSingle()
              : Promise.resolve({ data: null }),
            supabase.from("site_settings").select("value").eq("key", "shipping").maybeSingle(),
            supabase.from("orders").select("order_number").order("created_at", { ascending: false }).limit(5),
          ]);

          let prodMap = new Map<string, any>();
          if (productsRes.data) {
            productsRes.data.forEach((p: any) => prodMap.set(p.id, p));
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

          const currentOrderNumber = `LW-2026-${String(seq).padStart(4, "0")}`;
          const baseStreet = `${shippingAddress.street.replace(/\|/g, " ")}${shippingAddress.landmark ? ` (Landmark: ${shippingAddress.landmark.replace(/\|/g, " ")})` : ""}${shippingAddress.district ? ` (District: ${shippingAddress.district.replace(/\|/g, " ")})` : ""}`;

          // Pre-initialize Razorpay order concurrently alongside order insertion
          const keyId = process.env.RAZORPAY_KEY_ID?.replace(/['"]/g, "").trim();
          const amountPaise = Math.round(Number(finalTotal) * 100);

          const orderInsertPromise = supabase
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

          const razorpayOrderPromise = (async () => {
            const razorpay = getRazorpay();
            if (!razorpay) return null;
            try {
              return await razorpay.orders.create({
                amount: amountPaise,
                currency: "INR",
                receipt: currentOrderNumber,
              });
            } catch (rzpErr) {
              console.warn("[api/checkout Razorpay order creation warning]", rzpErr);
              return null;
            }
          })();

          const [orderRes, rzpOrder] = await Promise.all([
            orderInsertPromise,
            razorpayOrderPromise,
          ]);

          if (orderRes.error) {
            throw new Error(orderRes.error.message);
          }
          const order = orderRes.data;

          // Concurrently insert order items and update coupon limit
          const orderItemsPayload = items.map((item: any) => ({
            order_id: order.id,
            product_id: item.productId,
            product_name: item.productName,
            product_image: item.productImage,
            qty: item.qty,
            price: item.price
          }));

          const orderItemsPromise = supabase
            .from("order_items")
            .insert(orderItemsPayload);

          const couponUpdatePromise = (async () => {
            if (!matchedCouponToDecrement || matchedCouponToDecrement.limit === undefined || matchedCouponToDecrement.limit === null) {
              return null;
            }
            try {
              const updatedCoupons = allCouponsList.map((c: any) => {
                if (c.code?.trim().toUpperCase() === matchedCouponToDecrement.code?.trim().toUpperCase()) {
                  return {
                    ...c,
                    limit: Math.max(0, Number(c.limit) - 1)
                  };
                }
                return c;
              });

              await supabase.from("site_settings").upsert({
                key: "coupons",
                value: { coupons: updatedCoupons },
                updated_at: new Date().toISOString()
              });

              // Write to fallback JSON file in background
              import("path").then(async (path) => {
                const fs = await import("fs/promises");
                const filePath = path.join(process.cwd(), "src", "data", "coupons.json");
                await fs.mkdir(path.dirname(filePath), { recursive: true });
                await fs.writeFile(filePath, JSON.stringify({ coupons: updatedCoupons }, null, 2), "utf-8");
              }).catch(() => {});
            } catch (e) {
              console.warn("[api/checkout coupon decrement error]", e);
            }
          })();

          const [itemsRes] = await Promise.all([
            orderItemsPromise,
            couponUpdatePromise,
          ]);

          if (itemsRes.error) {
            // Roll back order insertion
            await supabase.from("orders").delete().eq("id", order.id);
            throw new Error(itemsRes.error.message);
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

          // Use pre-generated Razorpay order (created concurrently above) without repeating external API call
          const razorpayData = (rzpOrder && keyId)
            ? {
                key_id: keyId,
                order_id: rzpOrder.id,
                amount: rzpOrder.amount,
                currency: rzpOrder.currency,
              }
            : null;

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

