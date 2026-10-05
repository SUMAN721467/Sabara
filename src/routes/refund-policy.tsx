import { createFileRoute, Link } from "@tanstack/react-router";
import { buildPageMeta, SITE_NAME, CONTACT_EMAIL, CONTACT_PHONE, BUSINESS_ADDRESS } from "@/lib/seo";

export const Route = createFileRoute("/refund-policy")({
  component: RefundPolicyPage,
  head: () =>
    buildPageMeta({
      title: `Refund & Return Policy | ${SITE_NAME}`,
      description:
        "Sabara's refund, return and cancellation policy for handcrafted natural grass products. Learn about returns, damaged goods, refund processing and how to contact us.",
      path: "/refund-policy",
    }),
});

function RefundPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 md:py-20 animate-in fade-in duration-500">
      <span className="text-xs font-medium uppercase tracking-[0.22em] text-primary">
        Legal
      </span>
      <h1 className="mt-3 font-serif text-4xl text-foreground md:text-5xl">
        Refund &amp; Return Policy
      </h1>
      <p className="mt-4 text-sm text-muted-foreground">
        Last updated: October 2026
      </p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted-foreground [&_h2]:font-serif [&_h2]:text-xl [&_h2]:text-foreground [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:font-medium [&_h3]:text-foreground [&_h3]:mt-4 [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
        <p>
          At Sabara, we take pride in the quality of our handcrafted products. We want you to be completely satisfied with your purchase. Please read our return and refund policy below.
        </p>

        <h2>1. Returns</h2>
        <p>
          We accept returns within <strong>7 days</strong> of delivery, provided the product meets the following conditions:
        </p>
        <ul>
          <li>The product is unused, unwashed and in its original condition</li>
          <li>The product is returned in its original packaging</li>
          <li>You have a valid proof of purchase (order ID or confirmation email)</li>
        </ul>
        <p>
          <strong>Please note:</strong> As our products are handcrafted from natural materials, minor variations in colour, texture, and size are inherent to the craftsmanship and are not considered defects.
        </p>

        <h2>2. Damaged or Defective Products</h2>
        <p>
          If you receive a damaged or defective product, please contact us within <strong>48 hours</strong> of delivery with:
        </p>
        <ul>
          <li>Your order ID</li>
          <li>Clear photographs of the damaged product</li>
          <li>A brief description of the issue</li>
        </ul>
        <p>
          We will arrange for a replacement or full refund at no additional cost to you.
        </p>

        <h2>3. Wrong Product Received</h2>
        <p>
          If you receive a product different from what you ordered, please contact us within <strong>48 hours</strong> of delivery. We will arrange a return pickup and send you the correct product or issue a full refund.
        </p>

        <h2>4. Order Cancellation</h2>
        <ul>
          <li>You may cancel your order before it has been shipped by contacting us via email or phone.</li>
          <li>Once the order has been shipped, cancellation is not possible. You may return the product after delivery as per our return policy.</li>
          <li>Sabara reserves the right to cancel orders due to stock unavailability or other unforeseen circumstances, in which case a full refund will be issued.</li>
        </ul>

        <h2>5. Refund Processing</h2>
        <ul>
          <li>Approved refunds will be processed within <strong>7–10 business days</strong> from the date the returned product is received and inspected.</li>
          <li>Refunds will be credited to the original payment method used during purchase.</li>
          <li>Shipping charges, if any, are non-refundable unless the return is due to a damaged, defective or wrong product.</li>
        </ul>

        <h2>6. Shipping-Related Issues</h2>
        <ul>
          <li>If your shipment is lost in transit, please contact us and we will work with the courier partner to resolve the issue or issue a refund/replacement.</li>
          <li>Delivery delays caused by external factors (weather, logistics disruptions, etc.) are beyond our control, but we will keep you updated on the status of your order.</li>
        </ul>

        <h2>7. Non-Returnable Items</h2>
        <p>The following items are not eligible for return:</p>
        <ul>
          <li>Products that have been used, washed or altered</li>
          <li>Custom or personalised orders (if applicable)</li>
          <li>Products returned after the 7-day return window</li>
        </ul>

        <h2>8. How to Initiate a Return</h2>
        <p>To start a return or report an issue with your order:</p>
        <ul>
          <li>
            Email us at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
              {CONTACT_EMAIL}
            </a>{" "}
            with your order ID and reason for return
          </li>
          <li>
            Call us at{" "}
            <a href={`tel:${CONTACT_PHONE}`} className="text-primary hover:underline">
              +91 62943 59714
            </a>
          </li>
          <li>
            Use the{" "}
            <Link to="/contact" className="text-primary hover:underline">
              Contact form
            </Link>{" "}
            on our website
          </li>
        </ul>
        <p>
          Our team will respond within 24–48 hours and guide you through the return process.
        </p>

        <h2>9. Contact Us</h2>
        <p>For any questions regarding our return and refund policy:</p>
        <ul>
          <li>Email: <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">{CONTACT_EMAIL}</a></li>
          <li>Phone: <a href={`tel:${CONTACT_PHONE}`} className="text-primary hover:underline">+91 62943 59714</a></li>
          <li>Address: {BUSINESS_ADDRESS.streetAddress}, {BUSINESS_ADDRESS.addressRegion}, {BUSINESS_ADDRESS.state} {BUSINESS_ADDRESS.postalCode}, India</li>
        </ul>
      </div>

      <div className="mt-12 flex gap-4 text-sm">
        <Link to="/privacy-policy" className="text-primary hover:underline">Privacy Policy</Link>
        <Link to="/terms-and-conditions" className="text-primary hover:underline">Terms & Conditions</Link>
        <Link to="/contact" className="text-primary hover:underline">Contact Us</Link>
      </div>
    </div>
  );
}
