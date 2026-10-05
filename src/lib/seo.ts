/**
 * Sabara — Centralized SEO configuration & JSON-LD schema helpers.
 *
 * Single source of truth for site-wide metadata, canonical URLs,
 * Open Graph defaults and structured data generators.
 */

// ── Site-wide constants ─────────────────────────────────────────────────────
export const SITE_NAME = "Sabara";
export const SITE_URL = "https://www.sabara.in";
export const SITE_DOMAIN = "www.sabara.in";
export const DEFAULT_TITLE = "Sabara — Handcrafted Natural Grass Home Decor & Mats";
export const DEFAULT_DESCRIPTION =
  "Shop handcrafted Madur Kathi and natural grass home decor from West Bengal. Floor mats, yoga mats, wall organisers and table linens — woven by artisans, shipped across India.";
// TODO: Replace with a proper branded 1200×630 OG image URL once available
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;
export const CONTACT_EMAIL = "contact.sabara@gmail.com";
export const CONTACT_PHONE = "+916294359714";
export const BUSINESS_ADDRESS = {
  streetAddress: "NankarNila, Sabang",
  addressLocality: "Sabang",
  addressRegion: "Paschim Medinipur",
  postalCode: "721467",
  addressCountry: "IN",
  state: "West Bengal",
};
export const INSTAGRAM_URL =
  "https://www.instagram.com/sabara.in";

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Build an absolute canonical URL for a given path */
export function canonical(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${clean}`;
}

/** Truncate a string to a maximum character count, ending on a word boundary */
export function truncateDescription(text: string | undefined | null, max = 155): string {
  if (!text) return DEFAULT_DESCRIPTION;
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  const truncated = cleaned.slice(0, max);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 80 ? truncated.slice(0, lastSpace) : truncated) + "…";
}

/** Build the standard <head> meta array for a page */
export function buildPageMeta({
  title,
  description,
  path,
  ogImage,
  ogType = "website",
  noindex = false,
  extra = [],
}: {
  title: string;
  description: string;
  path: string;
  ogImage?: string;
  ogType?: string;
  noindex?: boolean;
  extra?: Array<Record<string, string>>;
}) {
  const url = canonical(path);
  const image = ogImage || DEFAULT_OG_IMAGE;

  const meta: Array<Record<string, string>> = [
    { title },
    { name: "description", content: description },
    // Open Graph
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: url },
    { property: "og:type", content: ogType },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:image", content: image },
    // Twitter / X
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image },
    ...extra,
  ];

  if (noindex) {
    meta.push({ name: "robots", content: "noindex, nofollow" });
  }

  return { meta, links: [{ rel: "canonical", href: url }] };
}

// ── Structured Data (JSON-LD) generators ────────────────────────────────────

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    contactPoint: {
      "@type": "ContactPoint",
      email: CONTACT_EMAIL,
      telephone: CONTACT_PHONE,
      contactType: "customer service",
      availableLanguage: ["English", "Hindi", "Bengali"],
    },
    sameAs: [INSTAGRAM_URL],
    address: {
      "@type": "PostalAddress",
      ...BUSINESS_ADDRESS,
    },
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/shop?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbSchema(
  items: Array<{ name: string; url: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function productSchema(product: {
  name: string;
  description?: string;
  image?: string;
  price: number;
  original_price?: number | null;
  id: string;
  category?: string;
  materials?: string;
  rating?: number | null;
  reviewsCount?: number;
  stock?: number | null;
}) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: truncateDescription(product.description, 500),
    image: product.image,
    brand: {
      "@type": "Brand",
      name: SITE_NAME,
    },
    offers: {
      "@type": "Offer",
      url: canonical(`/product/${product.id}`),
      priceCurrency: "INR",
      price: product.price,
      availability:
        product.stock !== undefined && product.stock !== null && product.stock <= 0
          ? "https://schema.org/OutOfStock"
          : "https://schema.org/InStock",
      seller: {
        "@type": "Organization",
        name: SITE_NAME,
      },
    },
    category: product.category,
    material: product.materials,
  };

  // Only add AggregateRating if real review data exists
  if (product.rating && product.reviewsCount && product.reviewsCount > 0) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: product.rating,
      reviewCount: product.reviewsCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return schema;
}

export function collectionPageSchema(
  name: string,
  description: string,
  path: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    description,
    url: canonical(path),
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
    },
  };
}
