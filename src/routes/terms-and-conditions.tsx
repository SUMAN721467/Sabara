import { createFileRoute, Link } from "@tanstack/react-router";
import { buildPageMeta, SITE_NAME, SITE_URL, CONTACT_EMAIL, CONTACT_PHONE, BUSINESS_ADDRESS } from "@/lib/seo";

export const Route = createFileRoute("/terms-and-conditions")({
  component: TermsPage,
  head: () =>
    buildPageMeta({
      title: `Terms & Conditions | ${SITE_NAME}`,
      description:
        "Terms and conditions for using the Sabara website and purchasing handcrafted natural grass home decor products. Read before placing an order.",
      path: "/terms-and-conditions",
    }),
});

function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 md:py-20 animate-in fade-in duration-500">
      <span className="text-xs font-medium uppercase tracking-[0.22em] text-primary">
        Legal
      </span>
      <h1 className="mt-3 font-serif text-4xl text-foreground md:text-5xl">
        Terms &amp; Conditions
      </h1>
      <p className="mt-4 text-sm text-muted-foreground">
        Last updated: October 2026
      </p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted-foreground [&_h2]:font-serif [&_h2]:text-xl [&_h2]:text-foreground [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:font-medium [&_h3]:text-foreground [&_h3]:mt-4 [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1">
        <p>
          Welcome to <Link to="/" className="text-primary hover:underline">{SITE_URL.replace("https://", "")}</Link>. These Terms and Conditions ("Terms") govern your use of the Sabara website and your purchase of products from us. By accessing or using our website, you agree to be bound by these Terms.
        </p>

        <h2>1. About Sabara</h2>
        <p>
          Sabara is an Indian e-commerce brand specialising in handcrafted natural grass and fibre home decor and utility products. Our products include floor mats, yoga mats, wall organisers, table mats and other handwoven items made by artisans in West Bengal, India.
        </p>

        <h2>2. Use of the Website</h2>
        <p>By using our website, you agree to:</p>
        <ul>
          <li>Provide accurate and complete information when creating an account or placing an order</li>
          <li>Keep your account credentials secure and confidential</li>
          <li>Use the website only for lawful purposes</li>
          <li>Not engage in any activity that could harm, disable or overburden the website</li>
        </ul>

        <h2>3. Products and Descriptions</h2>
        <p>
          We make every effort to display our products accurately, including colours, dimensions and materials. However, as our products are handcrafted, slight variations in colour, texture and size are natural and part of the character of each piece. Product images are representative and the actual product may differ slightly.
        </p>

        <h2>4. Pricing</h2>
        <ul>
          <li>All prices are listed in Indian Rupees (₹/INR) and include applicable taxes unless stated otherwise.</li>
          <li>We reserve the right to update prices without prior notice. The price at the time of order placement will be honoured.</li>
          <li>Promotional discounts and coupons are subject to specific terms and may be withdrawn at any time.</li>
        </ul>

        <h2>5. Orders</h2>
        <ul>
          <li>Placing an order constitutes an offer to purchase. We reserve the right to accept or decline any order.</li>
          <li>You will receive an order confirmation via email once your order is successfully placed.</li>
          <li>In rare cases, we may cancel an order due to stock unavailability, pricing errors or suspected fraudulent activity.</li>
        </ul>

        <h2>6. Payments</h2>
        <p>
          We accept online payments through Razorpay, which supports UPI, debit cards, credit cards, net banking and other payment methods. All payment transactions are processed securely by Razorpay in compliance with PCI-DSS standards. Sabara does not store your payment card details.
        </p>

        <h2>7. Shipping</h2>
        <ul>
          <li>We ship across India. Shipping charges, if any, are displayed at checkout.</li>
          <li>Estimated delivery times are provided for reference and may vary depending on your location and external factors.</li>
          <li>Risk of loss and title for items pass to you upon delivery to the carrier.</li>
        </ul>

        <h2>8. Returns and Refunds</h2>
        <p>
          Our returns and refund policy is detailed on our{" "}
          <Link to="/refund-policy" className="text-primary hover:underline">Refund & Return Policy</Link>{" "}
          page. Please review it before placing your order.
        </p>

        <h2>9. Account and Authentication</h2>
        <p>
          You may create an account using your email address or Google sign-in. You are responsible for all activity under your account. If you suspect unauthorised access, please contact us immediately.
        </p>

        <h2>10. Intellectual Property</h2>
        <p>
          All content on this website — including product images, text, logos, graphics, design and code — is the property of Sabara or its content suppliers and is protected by intellectual property laws. You may not reproduce, distribute, modify or create derivative works from our content without prior written permission.
        </p>

        <h2>11. Limitation of Liability</h2>
        <p>
          To the fullest extent permitted by law, Sabara shall not be liable for any indirect, incidental, special or consequential damages arising out of or in connection with your use of the website or purchase of products. Our total liability shall not exceed the amount paid by you for the specific product in question.
        </p>

        <h2>12. Governing Law</h2>
        <p>
          These Terms shall be governed by and construed in accordance with the laws of India. Any disputes arising from these Terms or your use of the website shall be subject to the exclusive jurisdiction of the courts in Paschim Medinipur, West Bengal, India.
        </p>

        <h2>13. Changes to These Terms</h2>
        <p>
          We reserve the right to update these Terms at any time. Changes will be posted on this page with a revised date. Continued use of the website after changes constitutes acceptance of the updated Terms.
        </p>

        <h2>14. Contact Us</h2>
        <p>For questions about these Terms, please reach out to us:</p>
        <ul>
          <li>Email: <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">{CONTACT_EMAIL}</a></li>
          <li>Phone: <a href={`tel:${CONTACT_PHONE}`} className="text-primary hover:underline">+91 62943 59714</a></li>
          <li>Address: {BUSINESS_ADDRESS.streetAddress}, {BUSINESS_ADDRESS.addressRegion}, {BUSINESS_ADDRESS.state} {BUSINESS_ADDRESS.postalCode}, India</li>
        </ul>
      </div>

      <div className="mt-12 flex gap-4 text-sm">
        <Link to="/privacy-policy" className="text-primary hover:underline">Privacy Policy</Link>
        <Link to="/refund-policy" className="text-primary hover:underline">Refund Policy</Link>
        <Link to="/contact" className="text-primary hover:underline">Contact Us</Link>
      </div>
    </div>
  );
}
