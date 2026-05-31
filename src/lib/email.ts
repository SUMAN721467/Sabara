import { createClient } from "@supabase/supabase-js";
import fs from "fs/promises";
import path from "path";

interface EmailPayload {
  order: {
    id: string;
    order_number?: string;
    orderNumber?: string;
    customer_name?: string;
    customerName?: string;
    customer_email?: string;
    customerEmail?: string;
    customer_phone?: string;
    customerPhone?: string;
    total: number;
    shipping_street?: string;
    shippingStreet?: string;
    shipping_city?: string;
    shippingCity?: string;
    shipping_state?: string;
    shippingState?: string;
    shipping_zip_code?: string;
    shippingZipCode?: string;
    created_at?: string;
    couponCode?: string | null;
    discountAmount?: number;
  };
  items: Array<{
    productName?: string;
    product_name?: string;
    productImage?: string;
    product_image?: string;
    qty: number;
    price: number;
  }>;
  origin?: string;
}

const ADMIN_EMAIL = "contact.sabara@gmail.com";

// Common helper to format currency to INR (₹)
const formatVal = (val: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(val);
};

// Common Styles
const emailStyle = `
  font-family: 'Work Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
  color: #374151;
  background-color: #fafaf9;
  padding: 24px 12px;
  margin: 0;
`;

// Helper to build items HTML table rows
function buildItemsHtml(items: any[]) {
  return items
    .map((item) => {
      const name = item.productName || item.product_name || "Handcrafted Product";
      const img = item.productImage || item.product_image || "";
      const price = Number(item.price);
      const qty = Number(item.qty);
      const subtotal = price * qty;
      
      const imgTag = img 
        ? `<td style="padding: 12px 0; vertical-align: middle; width: 60px;">
             <img src="${img}" alt="${name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px; border: 1px solid #e5e7eb;" />
           </td>`
        : "";

      return `
        <tr style="border-bottom: 1px solid #f3f4f6;">
          ${imgTag}
          <td style="padding: 12px 8px; vertical-align: middle;">
            <div style="font-weight: 600; color: #1f2937; font-size: 14px;">${name}</div>
            <div style="font-size: 12px; color: #6b7280; margin-top: 2px;">Qty: ${qty} &times; ${formatVal(price)}</div>
          </td>
          <td style="padding: 12px 0; text-align: right; font-weight: 600; color: #111827; font-family: monospace; font-size: 14px; vertical-align: middle;">
            ${formatVal(subtotal)}
          </td>
        </tr>
      `;
    })
    .join("");
}

// Universal Email Dispatcher with SMTP / Resend API / Local Preview fallbacks
export async function dispatchEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const secure = process.env.SMTP_SECURE === "true";
  const from = process.env.SMTP_FROM || process.env.RESEND_FROM_EMAIL || "Sabara <onboarding@resend.dev>";

  // 1. Try sending via SMTP (Nodemailer) if configured
  if (host && user && pass) {
    try {
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass }
      });

      await transporter.sendMail({
        from,
        to,
        subject,
        html
      });
      console.log(`[Email Service] Sent email to ${to} via SMTP`);
      return { success: true, method: "SMTP" };
    } catch (smtpErr: any) {
      console.error("[Email Service] SMTP dispatch failed. Falling back to Resend...", smtpErr.message);
    }
  }

  // 2. Try sending via Resend API if configured
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    try {
      const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
      const fromName = "Sabara";
      const fromHeader = `${fromName} <${fromEmail}>`;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          from: fromHeader,
          to: [to],
          subject,
          html
        })
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Resend API returned status ${res.status}: ${text}`);
      }

      console.log(`[Email Service] Sent email to ${to} via Resend API`);
      return { success: true, method: "Resend" };
    } catch (resendErr: any) {
      console.error("[Email Service] Resend API fallback failed", resendErr.message);
    }
  }

  // 3. Fallback: Write to local folder for development/inspection
  console.warn(`[Email Service] No working email configuration. Writing file locally.`);
  try {
    const dir = path.join(process.cwd(), "sent-emails");
    await fs.mkdir(dir, { recursive: true });
    const sanitUrl = subject.replace(/[^a-zA-Z0-9]/g, "-").substring(0, 30);
    const filename = path.join(dir, `${sanitUrl}-${Date.now()}.html`);
    await fs.writeFile(filename, html, "utf-8");
    console.log(`[Email Service] Local email saved to: ${filename}`);
  } catch (fsErr) {
    console.error("[Email Service] Failed to save local email copy", fsErr);
  }

  return { success: false, error: "No email dispatch service could send the email. Saved locally." };
}

/**
 * Sends order confirmation emails to the customer and a notification email to the admin.
 * Preserves legacy function interface for api/checkout.ts call.
 */
export async function sendOrderEmails({ order, items, origin }: EmailPayload) {
  const orderNum = order.order_number || order.orderNumber || order.id.substring(0, 8);
  const custName = order.customer_name || order.customerName || "Customer";
  const custEmail = order.customer_email || order.customerEmail;
  const custPhone = order.customer_phone || order.customerPhone || "—";
  const totalAmount = Number(order.total);
  const couponCodeApplied = order.couponCode || null;
  const discountVal = order.discountAmount || 0;
  const subtotalAmount = items.reduce((sum, item) => sum + Number(item.price) * Number(item.qty), 0);

  const street = order.shipping_street || order.shippingStreet || "—";
  const city = order.shipping_city || order.shippingCity || "—";
  const state = order.shipping_state || order.shippingState || "—";
  const zip = order.shipping_zip_code || order.shippingZipCode || "—";
  const shippingAddressStr = `${street}, ${city}, ${state} ${zip}`;

  if (!custEmail) {
    console.error("[Email Service] Customer email is missing. Cannot send order confirmation. Order ID:", order.id);
    return { success: false, error: "Customer email is missing." };
  }

  const itemsRowsHtml = buildItemsHtml(items);

  const customerHtml = `
    <div style="${emailStyle}">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #f3f4f4; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);">
        <tr>
          <td align="center" style="background-color: #faf7f2; padding: 40px 20px; border-bottom: 1px solid #f1ece4;">
            <div style="font-family: Georgia, serif; font-size: 28px; letter-spacing: 0.1em; color: #3d3a35; text-transform: uppercase; font-weight: 500;">S A B A R A</div>
            <div style="font-size: 12px; letter-spacing: 0.2em; color: #8c857b; text-transform: uppercase; margin-top: 4px;">Woven with Tradition</div>
          </td>
        </tr>
        <tr>
          <td style="padding: 32px 32px 24px 32px;">
            <h1 style="font-family: Georgia, serif; font-size: 24px; color: #111827; margin: 0 0 16px 0; font-weight: 600; text-align: center;">Order Confirmed!</h1>
            <p style="font-size: 15px; color: #4b5563; margin: 0 0 24px 0; text-align: center; line-height: 1.6;">
              Dear ${custName}, thank you for choosing Sabara. We are delighted to confirm that your order has been placed successfully and is currently being processed. Here are the details of your purchase:
            </p>
            <div style="background-color: #fcfbf9; border-radius: 8px; border: 1px solid #f5f2eb; padding: 16px; margin-bottom: 24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size: 13px; color: #6b7280; font-weight: 500;">Order Number</td>
                  <td align="right" style="font-size: 14px; font-weight: 700; color: #111827; font-family: monospace;">${orderNum}</td>
                </tr>
              </table>
            </div>
            <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin: 0 0 12px 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px;">Items Ordered</h3>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
              ${itemsRowsHtml}
              <tr>
                <td colspan="2" style="padding: 16px 8px 8px 8px; font-weight: 600; color: #4b5563; font-size: 14px;">Subtotal</td>
                <td align="right" style="padding: 16px 0 8px 0; font-weight: 600; color: #111827; font-family: monospace; font-size: 14px;">${formatVal(subtotalAmount)}</td>
              </tr>
              ${discountVal > 0 ? `
              <tr>
                <td colspan="2" style="padding: 8px 8px; font-weight: 600; color: #10b981; font-size: 14px;">Discount (${couponCodeApplied})</td>
                <td align="right" style="padding: 8px 0; font-weight: 600; color: #10b981; font-family: monospace; font-size: 14px;">-${formatVal(discountVal)}</td>
              </tr>` : ""}
              <tr>
                <td colspan="2" style="padding: 8px 8px; font-weight: 600; color: #4b5563; font-size: 14px;">Shipping</td>
                <td align="right" style="padding: 8px 0; font-weight: 600; color: #10b981; font-size: 13px;">FREE</td>
              </tr>
              <tr style="border-top: 2px solid #e5e7eb;">
                <td colspan="2" style="padding: 16px 8px; font-size: 16px; font-weight: 700; color: #111827; border-top: 1px solid #e5e7eb;">Total</td>
                <td align="right" style="padding: 16px 0; font-size: 20px; font-weight: 700; color: #c49a6c; font-family: monospace; border-top: 1px solid #e5e7eb;">${formatVal(totalAmount)}</td>
              </tr>
            </table>
            <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin: 0 0 12px 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px;">Delivery Information</h3>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 12px;">
              <tr>
                <td style="font-size: 13px; color: #6b7280; font-weight: 500; padding: 4px 0; width: 120px;">Recipient</td>
                <td style="font-size: 14px; color: #374151; font-weight: 600; padding: 4px 0;">${custName}</td>
              </tr>
              <tr>
                <td style="font-size: 13px; color: #6b7280; font-weight: 500; padding: 4px 0;">Address</td>
                <td style="font-size: 13px; color: #374151; padding: 4px 0;">${shippingAddressStr}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="background-color: #fafaf9; padding: 24px 32px; border-top: 1px solid #f3f3f2; text-align: center;">
            <p style="font-size: 12px; color: #9ca3af; margin: 0;">If you have any questions, contact support@sabara.com.</p>
            <p style="font-size: 11px; color: #bcaaa4; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 0.05em;">Sabara &copy; 2026 - Handcrafted Heritage</p>
          </td>
        </tr>
      </table>
    </div>
  `;

  const adminHtml = `
    <div style="${emailStyle}">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #f3f4f4; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);">
        <tr>
          <td align="center" style="background-color: #111827; padding: 30px 20px; text-align: center;">
            <div style="font-size: 14px; font-weight: 700; color: #10b981; letter-spacing: 0.2em; text-transform: uppercase;">Admin Notification</div>
            <div style="font-family: Georgia, serif; font-size: 24px; color: #ffffff; margin-top: 6px; font-weight: 500;">New Order Placed</div>
          </td>
        </tr>
        <tr>
          <td style="padding: 32px 32px 24px 32px;">
            <p style="font-size: 14px; color: #4b5563; margin: 0 0 24px 0; line-height: 1.5;">
              A new order has been placed. Details follow:
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px; font-size: 13px;">
              <tr>
                <td style="color: #6b7280; font-weight: 500; padding: 4px 0; width: 120px;">Customer</td>
                <td style="color: #111827; font-weight: 600; padding: 4px 0;">${custName} (${custEmail})</td>
              </tr>
              <tr>
                <td style="color: #6b7280; font-weight: 500; padding: 4px 0;">Order Number</td>
                <td style="color: #111827; padding: 4px 0; font-weight: 700;">${orderNum}</td>
              </tr>
              <tr>
                <td style="color: #6b7280; font-weight: 500; padding: 4px 0;">Total</td>
                <td style="color: #c49a6c; padding: 4px 0; font-weight: 700;">${formatVal(totalAmount)}</td>
              </tr>
            </table>
            <h3 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin: 0 0 12px 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px;">Items</h3>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 12px;">
              ${itemsRowsHtml}
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;

  // Asynchronously dispatch both emails
  const custPromise = dispatchEmail({ to: custEmail, subject: `Order Confirmation - ${orderNum}`, html: customerHtml });
  const adminPromise = dispatchEmail({ to: ADMIN_EMAIL, subject: `🚨 Alert: New Order Placed - ${orderNum}`, html: adminHtml });
  
  const [custRes, adminRes] = await Promise.all([custPromise, adminPromise]);
  return {
    success: custRes.success && adminRes.success,
    customer: custRes,
    admin: adminRes
  };
}

/**
 * Automates email notifications for any update/activity on an order.
 * Queries full order and item details, builds templates, and dispatches them.
 */
export async function sendActivityEmail(
  activityType: "status_update" | "customer_cancelled" | "return_requested" | "return_approved" | "return_rejected",
  orderId: string,
  supabase: any,
  origin?: string
) {
  try {
    // 1. Fetch complete order and items from database
    const { data: o, error: orderErr } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", orderId)
      .single();

    if (orderErr || !o) {
      console.error(`[Email Service] Failed to retrieve order details for ID ${orderId}:`, orderErr?.message);
      return { success: false, error: "Order details query failed" };
    }

    const streetParts = (o.shipping_street || "").split("|");
    const baseStreet = streetParts[0];
    const courier = streetParts[1] || null;
    const trackingNumber = streetParts[2] || null;
    const couponCode = streetParts[3] || null;
    const discountAmount = streetParts[4] ? Number(streetParts[4]) : 0;

    const orderNum = o.order_number || o.id.substring(0, 8);
    const custName = o.customer_name || "Customer";
    const custEmail = o.customer_email;
    const totalAmount = Number(o.total);

    if (!custEmail) {
      console.warn(`[Email Service] Order has no customer email address. Skipping email alerts. ID: ${orderId}`);
      return { success: false, error: "Customer email missing" };
    }

    const itemsHtml = buildItemsHtml(
      (o.order_items || []).map((item: any) => ({
        productName: item.product_name,
        productImage: item.product_image,
        qty: item.qty,
        price: Number(item.price)
      }))
    );

    let customerSubject = "";
    let customerBody = "";
    let adminSubject = "";
    let adminBody = "";

    // ─── Generate content templates based on activity ───────────────────────
    switch (activityType) {
      case "status_update": {
        const status = o.status;
        customerSubject = `Update on Order ${orderNum} - Status: ${status}`;
        
        let trackingDetails = "";
        if (status === "Shipped" && courier && trackingNumber) {
          trackingDetails = `
            <div style="background-color: #faf7f2; border: 1px solid #f1ece4; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
              <div style="font-size: 11px; text-transform: uppercase; color: #8c857b; font-weight: 600; letter-spacing: 0.1em;">Delivery Carrier & Tracking</div>
              <div style="font-size: 16px; font-weight: 700; color: #3d3a35; margin-top: 4px;">${courier}</div>
              <div style="font-family: monospace; font-size: 15px; font-weight: 700; color: #111827; margin-top: 2px;">Tracking #: ${trackingNumber}</div>
            </div>
          `;
        }

        customerBody = `
          <p>Dear ${custName},</p>
          <p>The status of your order <strong>${orderNum}</strong> has been updated to: <span style="font-weight: 700; color: #c49a6c; text-transform: uppercase;">${status}</span>.</p>
          ${trackingDetails}
          ${o.seller_instruction ? `<p style="background-color: #f9fafb; border-radius: 8px; padding: 12px; font-size: 13px; color: #4b5563; border-left: 3px solid #111827; margin-top: 15px;"><strong>Seller Message:</strong> ${o.seller_instruction}</p>` : ""}
          <p style="margin-top: 20px;">You can view and track your order status in your <a href="${origin || 'https://sabara.in'}/account?tab=orders" style="color: #c49a6c; font-weight: 600; text-decoration: none;">Order History</a>.</p>
        `;

        adminSubject = `Fulfillment Update - Order ${orderNum} is ${status}`;
        adminBody = `
          <p>Admin Order Update Alert:</p>
          <p>Order <strong>${orderNum}</strong> has been updated to <strong>${status}</strong>.</p>
          ${courier ? `<p>Courier: ${courier} | Tracking Number: ${trackingNumber}</p>` : ""}
          ${o.seller_instruction ? `<p>Instruction sent: "${o.seller_instruction}"</p>` : ""}
        `;
        break;
      }

      case "customer_cancelled": {
        customerSubject = `Order ${orderNum} Cancelled Successfully`;
        customerBody = `
          <p>Dear ${custName},</p>
          <p>We are writing to confirm that your order <strong>${orderNum}</strong> has been cancelled successfully at your request.</p>
          ${o.cancellation_reason ? `<p style="font-size: 13px; color: #6b7280; font-style: italic; margin-top: 10px;">Cancellation reason: "${o.cancellation_reason}"</p>` : ""}
          <p style="margin-top: 15px;">If you already paid, any pending refund will be processed to your original payment method within 5-7 business days.</p>
        `;

        adminSubject = `🚨 Cancelled by Customer - Order ${orderNum}`;
        adminBody = `
          <p>Alert: Customer <strong>${custName}</strong> has cancelled order <strong>${orderNum}</strong>.</p>
          <p><strong>Reason provided:</strong> "${o.cancellation_reason || "No reason provided"}"</p>
          <p>Total: ${formatVal(totalAmount)}</p>
        `;
        break;
      }

      case "return_requested": {
        customerSubject = `Return Requested for Order ${orderNum}`;
        customerBody = `
          <p>Dear ${custName},</p>
          <p>We have received your return request for order <strong>${orderNum}</strong>.</p>
          <div style="background-color: #faf7f2; border: 1px solid #f1ece4; padding: 14px; border-radius: 8px; margin: 15px 0;">
            <strong style="font-size: 13px; color: #8c857b;">Your Reason for Return:</strong>
            <p style="font-size: 14px; color: #3d3a35; margin: 4px 0 0 0; font-style: italic;">"${o.cancellation_reason || "No reason provided"}"</p>
          </div>
          <p>Our administration team is reviewing your request. We will notify you by email as soon as your return is approved or if we need further information.</p>
        `;

        adminSubject = `🚨 Return Requested - Order ${orderNum}`;
        adminBody = `
          <p>Fulfillment Alert: A customer return has been requested for Order <strong>${orderNum}</strong>.</p>
          <p><strong>Customer:</strong> ${custName} (${custEmail})</p>
          <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 14px; border-radius: 8px; margin: 15px 0;">
            <strong>Reason for Return:</strong>
            <p style="color: #b91c1c; font-style: italic; margin: 4px 0 0 0;">"${o.cancellation_reason || "No reason provided"}"</p>
          </div>
          <p>Please open the <a href="${origin || 'https://sabara.in'}/admin" style="font-weight: 600; color: #111827;">Admin Dashboard</a> to Approve or Reject this return.</p>
        `;
        break;
      }

      case "return_approved": {
        customerSubject = `Return Approved - Order ${orderNum}`;
        customerBody = `
          <p>Dear ${custName},</p>
          <p>We are pleased to inform you that your return request for order <strong>${orderNum}</strong> has been <span style="color: #10b981; font-weight: 700; text-transform: uppercase;">Approved</span>.</p>
          <p>Our support team will send you return shipping instructions shortly. A full refund of <strong>${formatVal(totalAmount)}</strong> will be issued once the returned items are received and inspected.</p>
        `;

        adminSubject = `Return Approved - Order ${orderNum}`;
        adminBody = `
          <p>Notification: Return request for Order <strong>${orderNum}</strong> has been approved.</p>
          <p>Status: Cancelled (Refund Pending) | customerStatus: Return Approved</p>
        `;
        break;
      }

      case "return_rejected": {
        customerSubject = `Return Request Status - Order ${orderNum}`;
        customerBody = `
          <p>Dear ${custName},</p>
          <p>We have reviewed your return request for order <strong>${orderNum}</strong>. Unfortunately, we are unable to approve the return at this time.</p>
          <p>For details regarding our returns policy, please refer to the product terms or contact our support team at support@sabara.com.</p>
        `;

        adminSubject = `Return Rejected - Order ${orderNum}`;
        adminBody = `
          <p>Notification: Return request for Order <strong>${orderNum}</strong> has been rejected.</p>
          <p>Status remains: Delivered | customerStatus: Return Rejected</p>
        `;
        break;
      }
    }

    // Build the fully branded wrapper HTML
    const buildBrandedHtml = (body: string, isAlert = false) => `
      <div style="${emailStyle}">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #f3f4f4; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);">
          <tr>
            <td align="center" style="background-color: ${isAlert ? '#111827' : '#faf7f2'}; padding: 30px 20px; border-bottom: 1px solid ${isAlert ? '#1f2937' : '#f1ece4'}; text-align: center;">
              <div style="font-family: Georgia, serif; font-size: 26px; letter-spacing: 0.1em; color: ${isAlert ? '#ffffff' : '#3d3a35'}; text-transform: uppercase; font-weight: 500;">S A B A R A</div>
              <div style="font-size: 11px; letter-spacing: 0.2em; color: ${isAlert ? '#9ca3af' : '#8c857b'}; text-transform: uppercase; margin-top: 4px;">Woven with Tradition</div>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 32px 24px 32px; font-size: 14px; color: #4b5563; line-height: 1.6;">
              ${body}
              <h3 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin: 25px 0 12px 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px;">Order Summary</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 10px;">
                ${itemsHtml}
                <tr>
                  <td style="padding: 12px 8px; font-weight: 600; color: #111827;">Total Amount Paid</td>
                  <td align="right" style="padding: 12px 0; font-weight: 700; color: #c49a6c; font-family: monospace; font-size: 16px;">${formatVal(totalAmount)}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="background-color: #fafaf9; padding: 20px 32px; border-top: 1px solid #f3f3f2; text-align: center;">
              <p style="font-size: 11px; color: #9ca3af; margin: 0;">Sabara &copy; 2026 - Handcrafted Heritage</p>
            </td>
          </tr>
        </table>
      </div>
    `;

    const fullCustomerHtml = buildBrandedHtml(customerBody, false);
    const fullAdminHtml = buildBrandedHtml(adminBody, true);

    const custPromise = dispatchEmail({ to: custEmail, subject: customerSubject, html: fullCustomerHtml });
    const adminPromise = dispatchEmail({ to: ADMIN_EMAIL, subject: adminSubject, html: fullAdminHtml });

    const [custRes, adminRes] = await Promise.all([custPromise, adminPromise]);
    
    return {
      success: custRes.success && adminRes.success,
      customer: custRes,
      admin: adminRes
    };
  } catch (err: any) {
    console.error(`[Email Service] sendActivityEmail encountered a fatal error:`, err);
    return { success: false, error: err.message };
  }
}
