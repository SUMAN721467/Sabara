import { createFileRoute, Link } from "@tanstack/react-router";
import { buildPageMeta, SITE_NAME, CONTACT_EMAIL, CONTACT_PHONE, BUSINESS_ADDRESS } from "@/lib/seo";

export const Route = createFileRoute("/privacy-policy")({
  component: PrivacyPolicyPage,
  head: () =>
    buildPageMeta({
      title: `Privacy Policy | ${SITE_NAME}`,
      description:
        "Read Sabara's privacy policy. Learn how we collect, use and protect your personal information when you shop for handcrafted natural grass products.",
      path: "/privacy-policy",
    }),
});

function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 md:py-20 animate-in fade-in duration-500">
      <span className="text-xs font-medium uppercase tracking-[0.22em] text-primary">
        Legal
      </span>
      <h1 className="mt-3 font-serif text-4xl text-foreground md:text-5xl">
        Privacy Policy
      </h1>
      <p className="mt-4 text-sm text-muted-foreground">
        Last updated: October 2026
      </p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted-foreground [&_h2]:font-serif [&_h2]:text-xl [&_h2]:text-foreground [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:font-medium [&_h3]:text-foreground [&_h3]:mt-4 [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
        <p>
          Sabara ("{SITE_NAME}", "we", "our" or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose and safeguard your information when you visit our website{" "}
          <Link to="/" className="text-primary hover:underline">www.sabara.in</Link>{" "}
          and make purchases from us.
        </p>

        <h2>1. Information We Collect</h2>
        <h3>Personal Information You Provide</h3>
        <p>When you create an account, place an order or contact us, we may collect:</p>
        <ul>
          <li>Full name</li>
          <li>Email address</li>
          <li>Phone number</li>
          <li>Shipping and billing address</li>
          <li>Order and transaction history</li>
        </ul>

        <h3>Information Collected Automatically</h3>
        <p>When you browse our website, we may automatically collect:</p>
        <ul>
          <li>IP address and browser type</li>
          <li>Pages viewed and time spent on each page</li>
          <li>Referring website or link</li>
          <li>Device type and screen resolution</li>
        </ul>

        <h2>2. How We Use Your Information</h2>
        <p>We use the information we collect to:</p>
        <ul>
          <li>Process and fulfil your orders</li>
          <li>Create and manage your account</li>
          <li>Send order confirmations and shipping updates</li>
          <li>Respond to your enquiries and support requests</li>
          <li>Improve our website, products and customer experience</li>
          <li>Comply with legal obligations</li>
        </ul>

        <h2>3. Third-Party Services</h2>
        <p>We use the following third-party services to operate our website and process transactions:</p>
        <ul>
          <li>
            <strong>Supabase</strong> — Database and authentication service. Your account information and order data are stored securely on Supabase's infrastructure.
          </li>
          <li>
            <strong>Razorpay</strong> — Payment gateway. We do not store your credit/debit card details. All payment information is handled directly by Razorpay in compliance with PCI-DSS standards.
          </li>
          <li>
            <strong>Google Analytics & Google Tag Manager</strong> — Website analytics to understand how visitors interact with our site. Data is anonymised where possible.
          </li>
          <li>
            <strong>Microsoft Clarity</strong> — Session replay and heatmap analytics to improve user experience. Personal information is masked.
          </li>
          <li>
            <strong>Brevo (Sendinblue)</strong> — Email service for sending order confirmations, shipping updates and support communications.
          </li>
          <li>
            <strong>Vercel</strong> — Website hosting platform.
          </li>
        </ul>

        <h2>4. Cookies</h2>
        <p>
          We use cookies to maintain your login session, remember your cart and preferences, and to collect analytics data. You can manage your cookie preferences through your browser settings or our cookie consent mechanism.
        </p>
        <p>Types of cookies we use:</p>
        <ul>
          <li><strong>Essential cookies</strong> — Required for authentication, cart functionality and site operation.</li>
          <li><strong>Analytics cookies</strong> — Used by Google Analytics and Microsoft Clarity to understand site usage.</li>
        </ul>

        <h2>5. Data Security</h2>
        <p>
          We implement appropriate technical and organisational measures to protect your personal information. All data transmission is encrypted via HTTPS. Payment processing is handled by Razorpay's PCI-DSS compliant infrastructure.
        </p>

        <h2>6. Data Retention</h2>
        <p>
          We retain your personal information for as long as necessary to fulfil the purposes outlined in this policy, unless a longer retention period is required by law. Order records are retained for accounting and legal compliance purposes.
        </p>

        <h2>7. Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li>Access the personal data we hold about you</li>
          <li>Request correction of inaccurate data</li>
          <li>Request deletion of your data (subject to legal obligations)</li>
          <li>Withdraw consent for marketing communications</li>
        </ul>

        <h2>8. Children's Privacy</h2>
        <p>
          Our website is not intended for children under the age of 18. We do not knowingly collect personal information from children.
        </p>

        <h2>9. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated revision date. We encourage you to review this page periodically.
        </p>

        <h2>10. Contact Us</h2>
        <p>
          If you have questions about this Privacy Policy or your personal data, please contact us:
        </p>
        <ul>
          <li>Email: <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">{CONTACT_EMAIL}</a></li>
          <li>Phone: <a href={`tel:${CONTACT_PHONE}`} className="text-primary hover:underline">+91 62943 59714</a></li>
          <li>Address: {BUSINESS_ADDRESS.streetAddress}, {BUSINESS_ADDRESS.addressRegion}, {BUSINESS_ADDRESS.state} {BUSINESS_ADDRESS.postalCode}, India</li>
        </ul>
      </div>

      <div className="mt-12 flex gap-4 text-sm">
        <Link to="/terms-and-conditions" className="text-primary hover:underline">Terms & Conditions</Link>
        <Link to="/refund-policy" className="text-primary hover:underline">Refund Policy</Link>
        <Link to="/contact" className="text-primary hover:underline">Contact Us</Link>
      </div>
    </div>
  );
}
