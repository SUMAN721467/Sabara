import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { sendOrderEmails } from "@/lib/email";

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

          const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
          const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
          const supabase = createClient(supabaseUrl!, supabaseKey!);

          // Verify and deduct stock for each item in the order, and calculate secure subtotal
          let secureSubtotal = 0;
          for (const item of items) {
            if (item.productId) {
              const { data: prod, error: prodErr } = await supabase
                .from("products")
                .select("stock, name, price")
                .eq("id", item.productId)
                .single();

              if (!prodErr && prod) {
                const currentStock = prod.stock !== undefined && prod.stock !== null ? Number(prod.stock) : 10;
                if (currentStock < item.qty) {
                  return Response.json(
                    { success: false, error: `Product "${prod.name}" only has ${currentStock} item(s) left in stock.` },
                    { status: 400 }
                  );
                }

                // Decrement stock in database
                const { error: decError } = await supabase
                  .from("products")
                  .update({ stock: Math.max(0, currentStock - item.qty) })
                  .eq("id", item.productId);

                if (decError) {
                  console.error("[api/checkout stock decrement failed]", decError.message);
                }

                secureSubtotal += Number(prod.price) * item.qty;
              } else {
                // If it fails to find the product in the DB, fallback to the item price sent by client
                secureSubtotal += Number(item.price) * item.qty;
              }
            }
          }

          // Apply coupon discount securely
          let discount = 0;
          const code = couponCode?.trim().toUpperCase();
          let matchedCouponToDecrement: any = null;
          let allCouponsList: any[] = [];

          if (code) {
            const { data: settingData } = await supabase
              .from("site_settings")
              .select("value")
              .eq("key", "coupons")
              .single();

            let dbCoupons = (settingData?.value as any)?.coupons;

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
          const finalTotal = Math.max(0, secureSubtotal - discount);

          // Count existing orders to make a sequential order number
          const { count } = await supabase
            .from("orders")
            .select("*", { count: "exact", head: true });

          const seq = (count || 0) + 1;
          const orderNumber = `LW-2026-${String(seq).padStart(4, "0")}`;
          // Insert order
          const { data: order, error: orderError } = await supabase
            .from("orders")
            .insert({
              order_number: orderNumber,
              customer_name: customerName,
              customer_email: customerEmail,
              customer_phone: customerPhone || null,
              total: finalTotal,
              status: "Pending",
              shipping_street: code 
                ? `${shippingAddress.street.replace(/\|/g, " ")}|||${code}|${discount}` 
                : shippingAddress.street.replace(/\|/g, " "),
              shipping_city: shippingAddress.city,
              shipping_state: shippingAddress.state,
              shipping_zip_code: shippingAddress.zipCode,
              user_id: userId || null
            })
            .select("*")
            .single();

          if (orderError) throw new Error(orderError.message);

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
            const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
            const isServiceKeyValid = !!(serviceKey && serviceKey.trim() && serviceKey.trim().startsWith("eyJ"));
            const supabaseAdmin = isServiceKeyValid
              ? createClient(supabaseUrl!, serviceKey!, {
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
              zipCode: order.shipping_zip_code
            },
            items: items.map((i: any) => ({
              productId: i.productId,
              productName: i.productName,
              productImage: i.productImage,
              qty: i.qty,
              price: i.price
            }))
          };

          // Determine request host origin dynamically
          const requestUrl = new URL(request.url);
          const origin = requestUrl.origin;

          // Send confirmation emails asynchronously (non-blocking for checkout completion response)
          sendOrderEmails({
            order: {
              ...camelCaseOrder,
              couponCode: code || null,
              discountAmount: discount
            },
            items: items,
            origin: origin
          }).catch((err) => {
            console.error("[api/checkout email dispatch failed]", err);
          });

          return Response.json({ success: true, order: camelCaseOrder });
        } catch (err: any) {
          console.error("[api/checkout error]", err);
          return Response.json({ success: false, error: err.message }, { status: 500 });
        }
      }
    }
  }
});
