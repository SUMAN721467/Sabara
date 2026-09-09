import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, Minus, Plus, Heart, Star, MessageSquare, X, Loader2, Share2, Ruler, ChevronDown, Truck, RotateCcw, Sparkles } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { formatPrice, useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard } from "@/components/site/ProductCard";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { getOrSeedProducts } from "./api/products";
import { products as fallbackProducts } from "@/data/products";

const getProductDetails = createServerFn({ method: "GET" })
  .handler(async ({ data: id }: any) => {
    try {
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      let list: any[] = [];
      
      if (supabaseUrl && supabaseKey) {
        try {
          const supabaseClient = createClient(supabaseUrl, supabaseKey);
          list = await getOrSeedProducts(supabaseClient, true);
        } catch (dbErr) {
          console.error("Database product fetch failed:", dbErr);
        }
      }

      if (!list || list.length === 0) {
        list = fallbackProducts;
      }

      let product = list.find((p: any) => p.id === id);
      if (!product) {
        product = fallbackProducts.find((p: any) => p.id === id);
      }
      if (!product) {
        // Match by slug / name
        product = list.find((p: any) =>
          p.name?.toLowerCase().replace(/\s+/g, "-") === id?.toLowerCase() ||
          p.id?.toLowerCase() === id?.toLowerCase()
        );
      }

      if (!product) return null;

      // Extract metadata if embedded in story
      if (product.story && typeof product.story === "string") {
        const metaRegex = /<!--SABARA_META:([\s\S]*?)-->/;
        const match = product.story.match(metaRegex);
        if (match) {
          try {
            const meta = JSON.parse(match[1]);
            product = {
              ...product,
              story: product.story.replace(metaRegex, "").trim(),
              highlights: meta.highlights || product.highlights,
              care_instructions: meta.care_instructions || product.care_instructions,
              delivery_policy: meta.delivery_policy || product.delivery_policy,
            };
          } catch (e) {
            console.error("Error parsing product metadata:", e);
          }
        }
      }

      // Ensure gallery is an array
      let gallery: string[] = [];
      if (Array.isArray(product.gallery)) {
        gallery = product.gallery;
      } else if (typeof product.gallery === "string") {
        try {
          gallery = JSON.parse(product.gallery);
        } catch {
          gallery = product.gallery.split(",").map((s: string) => s.trim()).filter(Boolean);
        }
      }
      if (!gallery || gallery.length === 0) {
        gallery = product.image ? [product.image] : [];
      }
      product = { ...product, gallery };

      const baseName = (product.name || "").split(" - ")[0];
      const variants = list
        .filter((p: any) => (p.name || "").split(" - ")[0] === baseName)
        .sort((a: any, b: any) => {
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
          return aTime - bTime;
        });

      // Group related products by base name (excluding variants of current product)
      const otherProducts = list.filter((x: any) => {
        if ((x.name || "").split(" - ")[0] === baseName) return false;
        const xCats = (x.category || "").split(",").map((c: string) => c.trim().toLowerCase());
        const prodCats = (product.category || "").split(",").map((c: string) => c.trim().toLowerCase());
        return xCats.some((c: string) => prodCats.includes(c));
      });
      const relatedGroups = new Map<string, any[]>();
      otherProducts.forEach((p: any) => {
        const bName = (p.name || "").split(" - ")[0];
        if (!relatedGroups.has(bName)) {
          relatedGroups.set(bName, []);
        }
        relatedGroups.get(bName)!.push(p);
      });
      const related = Array.from(relatedGroups.values())
        .map((all) => {
          const sorted = [...all].sort((a, b) => {
            const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
            const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
            return aTime - bTime;
          });
          const main = sorted[0];

          // Roll up rating and review count
          let totalScore = 0;
          let totalReviews = 0;
          all.forEach((p: any) => {
            if (p.rating && p.reviewsCount) {
              totalScore += p.rating * p.reviewsCount;
              totalReviews += p.reviewsCount;
            }
          });
          const averageRating = totalReviews > 0 ? Number((totalScore / totalReviews).toFixed(1)) : null;

          return {
            ...main,
            rating: averageRating,
            reviewsCount: totalReviews,
            variants: sorted,
          };
        })
        .slice(0, 3);

      return { product, related, variants };
    } catch (err) {
      console.error("getProductDetails critical error:", err);
      // Fallback
      const fallback = fallbackProducts.find((p) => p.id === id) || fallbackProducts[0];
      return { product: fallback, related: [], variants: [fallback] };
    }
  });

export const Route = createFileRoute("/product/$id")({
  loader: async ({ params }) => {
    try {
      const data = await (getProductDetails as any)({ data: params.id });
      if (!data || !data.product) throw notFound();
      return data;
    } catch (e) {
      const fallback = fallbackProducts.find((p) => p.id === params.id) || fallbackProducts[0];
      return { product: fallback, related: [], variants: [fallback] };
    }
  },
  component: ProductPage,
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="text-3xl font-serif text-foreground">Product Not Found</h1>
      <p className="mt-3 text-sm text-muted-foreground">The product you are looking for does not exist or has been removed.</p>
      <Link to="/shop" className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
        <ArrowLeft className="h-4 w-4" /> Return to shop
      </Link>
    </div>
  ),
  errorComponent: () => (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="text-3xl font-serif text-foreground">Unable to load product</h1>
      <p className="mt-3 text-sm text-muted-foreground">An unexpected error occurred while loading this product.</p>
      <Link to="/shop" className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
        <ArrowLeft className="h-4 w-4" /> Return to shop
      </Link>
    </div>
  ),
  head: ({ loaderData }) =>
    loaderData?.product
      ? {
          meta: [
            { title: `${loaderData.product.name} · Sabara` },
            { name: "description", content: loaderData.product.story },
          ],
        }
      : {},
});

function ZoomableImage({ src, alt }: { src: string; alt: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [showZoom, setShowZoom] = useState(false);
  const [lensPos, setLensPos] = useState({ x: 0, y: 0 });
  const [bgPos, setBgPos] = useState("0% 0%");
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, height: 0 });

  const lensSize = { width: 140, height: 140 }; // 1:1 square lens for aspect-square images

  useEffect(() => {
    const checkIsDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    checkIsDesktop();
    window.addEventListener("resize", checkIsDesktop);
    return () => window.removeEventListener("resize", checkIsDesktop);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDesktop || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    
    // Calculate mouse relative coordinates inside container
    let x = e.clientX - rect.left - lensSize.width / 2;
    let y = e.clientY - rect.top - lensSize.height / 2;

    // Constrain lens boundary
    if (x < 0) x = 0;
    if (x > rect.width - lensSize.width) x = rect.width - lensSize.width;
    if (y < 0) y = 0;
    if (y > rect.height - lensSize.height) y = rect.height - lensSize.height;

    setLensPos({ x, y });

    // Calculate background position percentage for zoomed image
    const pX = (x / (rect.width - lensSize.width)) * 100;
    const pY = (y / (rect.height - lensSize.height)) * 100;
    setBgPos(`${pX}% ${pY}%`);

    // Update portal coordinates relative to viewport + scroll
    setCoords({
      left: rect.right + 16 + window.scrollX,
      top: rect.top + window.scrollY,
      width: rect.width,
      height: rect.height
    });

    setShowZoom(true);
  };

  const handleMouseLeave = () => {
    setShowZoom(false);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-square select-none"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={() => isDesktop && setShowZoom(true)}
    >
      {/* Image container with rounded corners and overflow hidden */}
      <div className="relative overflow-hidden rounded-2xl bg-secondary/50 w-full h-full cursor-zoom-in">
        {/* Original Image */}
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover aspect-square"
        />

        {/* Lens (Desktop only and when hovering) */}
        {isDesktop && showZoom && (
          <div
            style={{
              left: `${lensPos.x}px`,
              top: `${lensPos.y}px`,
              width: `${lensSize.width}px`,
              height: `${lensSize.height}px`,
            }}
            className="absolute pointer-events-none border-2 border-primary/50 bg-primary/10 shadow-sm z-10 transition-none rounded-lg"
          />
        )}
      </div>

      {/* Zoom Window rendered via React Portal (Desktop only and when hovering) */}
      {isDesktop && showZoom && typeof document !== "undefined" && createPortal(
        <div
          style={{
            position: "absolute",
            left: `${coords.left}px`,
            top: `${coords.top}px`,
            width: `${coords.width * 1.05}px`,
            height: `${coords.height * 1.05}px`,
            backgroundImage: `url(${src})`,
            backgroundPosition: bgPos,
            backgroundSize: `${(coords.width / lensSize.width * 100) / 1.05}% ${(coords.height / lensSize.height * 100) / 1.05}%`,
            backgroundRepeat: "no-repeat",
            pointerEvents: "none"
          }}
          className="z-50 border bg-background rounded-2xl shadow-xl overflow-hidden animate-in fade-in-50 duration-200"
        />,
        document.body
      )}
    </div>
  );
}

const StarRating = ({ rating, size = "h-4 w-4" }: { rating: number; size?: string }) => {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            size,
            star <= rating
              ? "fill-amber-400 text-amber-400 stroke-amber-400"
              : "text-muted-foreground/35 stroke-[1.5]"
          )}
        />
      ))}
    </div>
  );
};

function ProductPage() {
  const { product, related, variants } = Route.useLoaderData();
  const { add, lines } = useCart();
  const { toggle: toggleWishlist, has: hasWishlist } = useWishlist();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isWishlisted = hasWishlist(product.id);
  const maxStock = product.stock !== undefined && product.stock !== null ? Number(product.stock) : 10;
  const isOutOfStock = maxStock <= 0;
  const [qty, setQty] = useState(1);

  const handleShare = async () => {
    const shareData = {
      title: product.name.split(" - ")[0],
      text: product.name.split(" - ")[0],
      url: window.location.href,
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        toast.success("Shared successfully!");
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Error sharing:", err);
          fallbackCopy();
        }
      }
    } else {
      fallbackCopy();
    }
  };

  const fallbackCopy = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Product link copied to clipboard!");
  };

  // Reviews states
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const fetchReviews = async () => {
    setReviewsLoading(true);
    try {
      const { data, error } = await supabase
        .from("product_reviews")
        .select("*")
        .eq("product_id", product.id)
        .order("created_at", { ascending: false });
      
      if (!error && data) {
        setReviews(data || []);
      } else if (error) {
        console.warn("Could not fetch product reviews, table may not exist yet:", error.message);
      }
    } catch (err) {
      console.warn("Error fetching reviews:", err);
    } finally {
      setReviewsLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [product.id]);

  // Keep qty within stock bounds
  useEffect(() => {
    if (isOutOfStock) {
      setQty(0);
    } else {
      setQty((q) => Math.max(1, Math.min(maxStock, q)));
    }
  }, [maxStock, isOutOfStock]);
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
    api.on("select", () => {
      setCurrent(api.selectedScrollSnap());
    });
  }, [api]);

  // Dropdown accordions state
  const [openAccordions, setOpenAccordions] = useState<{ [key: string]: boolean }>({
    description: true,
    care: false,
    delivery: false,
  });

  const [showSizeChart, setShowSizeChart] = useState(false);
  const [isExpressCheckingOut, setIsExpressCheckingOut] = useState(false);

  const toggleAccordion = (key: string) => {
    setOpenAccordions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const highlightsList = useMemo(() => {
    const raw = (product as any).highlights;
    if (raw) {
      if (Array.isArray(raw)) return raw.filter(Boolean);
      return String(raw).split("\n").map((s) => s.trim()).filter(Boolean);
    }
    return [
      "Free Delivery on all prepaid orders",
      "7-Day Hassle-Free Size Exchange",
      "100% Anti-Tarnish & Waterproof",
    ];
  }, [product]);

  const careList = useMemo(() => {
    const raw = (product as any).care_instructions;
    if (raw) {
      if (Array.isArray(raw)) return raw.filter(Boolean);
      return String(raw).split("\n").map((s) => s.trim()).filter(Boolean);
    }
    return [
      "Simply wipe clean with a dry cloth",
    ];
  }, [product]);

  const deliveryText = (product as any).delivery_policy || "Dispatched within 24 hours. Delivered across India within 2 to 4 business days. Easy 7-day exchange support available on WhatsApp.";

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    add(product.id, qty);
    toast.success(`${product.name} (${qty}) added to cart!`);
  };

  const handleBuyNow = () => {
    if (isOutOfStock) {
      toast.error("This item is currently out of stock.");
      return;
    }
    setIsExpressCheckingOut(true);
    add(product.id, qty);
    if (!user) {
      navigate({ to: "/login", search: { redirect: "/checkout" } });
    } else {
      navigate({ to: "/checkout" });
    }
  };

  const galleryImages = useMemo(() => {
    const list: string[] = [];
    if (product.image) list.push(product.image);
    if (Array.isArray(product.gallery)) {
      product.gallery.forEach((img: string) => {
        if (img && !list.includes(img)) list.push(img);
      });
    }
    return list.length > 0 ? list : [product.image || "/placeholder.svg"];
  }, [product]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:py-10">
      <Link
        to="/shop"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to shop
      </Link>

      <div className="mt-6 grid gap-8 md:grid-cols-2 lg:gap-12 items-start">
        <div className="flex flex-col gap-4">
          <Carousel setApi={setApi} className="w-full relative group">
            <CarouselContent>
              {galleryImages.map((img: string, i: number) => (
                <CarouselItem key={i}>
                  <ZoomableImage src={img} alt={`${product.name} view ${i + 1}`} />
                </CarouselItem>
              ))}
            </CarouselContent>
            {galleryImages.length > 1 && (
              <>
                <CarouselPrevious className="left-4 opacity-0 transition-opacity group-hover:opacity-100" />
                <CarouselNext className="right-4 opacity-0 transition-opacity group-hover:opacity-100" />
              </>
            )}
          </Carousel>
          {galleryImages.length > 1 && (
            <div className="grid grid-cols-4 gap-3">
              {galleryImages.map((img: string, i: number) => (
                <button
                  key={i}
                  onClick={() => api?.scrollTo(i)}
                  className={`overflow-hidden rounded-lg bg-secondary/50 transition-all aspect-square ${
                    current === i
                      ? "ring-2 ring-primary ring-offset-2"
                      : "opacity-70 hover:opacity-100"
                  }`}
                >
                  <img
                    src={img}
                    alt={`${product.name} view ${i + 1}`}
                    className="aspect-square h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col">
          <span className="text-xs font-medium uppercase tracking-[0.22em] text-primary">
            {(product.category || "").split(",").map((c: string) => c.trim()).join(" · ")}
          </span>
          <h1 className="mt-3 font-serif text-2xl leading-tight text-foreground md:text-3xl">
            {product.name.split(" - ")[0]}
          </h1>

          {/* Average Rating Banner */}
          <div className="mt-2.5 flex items-center gap-2 text-xs">
            {reviewsLoading ? (
              <span className="text-muted-foreground animate-pulse text-[11px]">Loading rating...</span>
            ) : reviews.length > 0 ? (
              <>
                <div className="flex items-center gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold px-2 py-0.5 rounded">
                  <span>{((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) || 0).toFixed(1)}</span>
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                </div>
                <span className="text-muted-foreground font-medium">
                  Based on {reviews.length} {reviews.length === 1 ? "rating" : "ratings"}
                </span>
              </>
            ) : (
              <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="h-3 w-3 text-muted-foreground/35 stroke-[1.5]" />
                  ))}
                </div>
                <span>No ratings yet</span>
              </div>
            )}
          </div>

          {product.original_price && product.original_price > product.price ? (
            <div className="mt-3 flex items-center gap-3">
              <span className="text-2xl font-semibold text-red-600 dark:text-red-400">
                {formatPrice(product.price)}
              </span>
              <span className="text-lg text-muted-foreground line-through decoration-muted-foreground">
                {formatPrice(product.original_price)}
              </span>
              <span className="rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-in fade-in duration-300">
                {Math.round(((product.original_price - product.price) / product.original_price) * 100)}% OFF
              </span>
            </div>
          ) : (
            <div className="mt-3 text-xl text-muted-foreground">{formatPrice(product.price)}</div>
          )}

          {/* Stock Availability Indicator */}
          {product.stock !== undefined && product.stock !== null && (
            <div className="mt-3 flex items-center gap-2 text-sm font-medium">
              {isOutOfStock ? (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-600 dark:text-red-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                  Out of Stock
                </div>
              ) : maxStock <= 5 ? (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 dark:bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-500 animate-pulse">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Only {maxStock} left
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  In Stock
                </div>
              )}
            </div>
          )}

          {/* ── Size & Size Chart Section ──────────────────────────── */}
          <div className="mt-5 border-t border-border/60 pt-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">SIZE:</span>
                <span className="text-xs font-medium text-muted-foreground">
                  {product.dimensions || "Standard Size"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowSizeChart(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer group"
              >
                <Ruler className="h-3.5 w-3.5 transition-transform group-hover:rotate-12" />
                <span className="underline underline-offset-4">Size Chart</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="px-3.5 py-1.5 rounded-lg border-2 border-primary bg-primary/10 text-primary font-semibold text-xs transition-all shadow-xs">
                {product.dimensions || "Standard (One Size)"}
              </span>
            </div>
          </div>

          {/* ── Purchase Actions: Qty + Add to Cart + Wishlist + Share ── */}
          <div className="mt-5 space-y-2.5">
            <div className="flex items-stretch gap-2 sm:gap-2.5 h-12">
              {/* Quantity Counter */}
              <div className="inline-flex items-center rounded-xl border border-border/80 bg-secondary/35 px-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="inline-flex h-10 w-9 items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/80 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  aria-label="Decrease quantity"
                  disabled={isOutOfStock || qty <= 1}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-7 text-center text-sm font-semibold tabular-nums text-foreground">{qty}</span>
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.min(maxStock, q + 1))}
                  className="inline-flex h-10 w-9 items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/80 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  aria-label="Increase quantity"
                  disabled={isOutOfStock || qty >= maxStock}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {/* Add To Cart Button */}
              {isOutOfStock ? (
                <button
                  disabled
                  className="flex-1 rounded-xl bg-muted text-muted-foreground px-4 text-xs sm:text-sm font-bold tracking-wider uppercase cursor-not-allowed opacity-60 flex items-center justify-center"
                >
                  Out of Stock
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="flex-1 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold tracking-wider uppercase text-xs sm:text-sm shadow-sm transition-all duration-200 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>ADD TO CART</span>
                  <span className="opacity-80 font-normal hidden sm:inline">·</span>
                  <span className="font-semibold hidden sm:inline">{formatPrice(product.price * qty)}</span>
                </button>
              )}

              {/* Wishlist Button */}
              <button
                type="button"
                onClick={() => {
                  toggleWishlist(product.id);
                  if (isWishlisted) {
                    toast.success(`${product.name} removed from wishlist.`);
                  } else {
                    toast.success(`${product.name} added to wishlist!`);
                  }
                }}
                className={cn(
                  "inline-flex h-12 w-12 items-center justify-center rounded-xl border transition-all duration-200 active:scale-90 cursor-pointer shrink-0 shadow-xs",
                  isWishlisted
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/80 bg-card text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                )}
                aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
              >
                <Heart className={cn("h-5 w-5", isWishlisted && "fill-current")} />
              </button>

              {/* Share Button */}
              <button
                type="button"
                onClick={handleShare}
                className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-border/80 bg-card text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all duration-200 active:scale-90 cursor-pointer shrink-0 shadow-xs"
                aria-label="Share product"
              >
                <Share2 className="h-5 w-5" />
              </button>
            </div>

            {/* BUY IT NOW (EXPRESS CHECKOUT) Button */}
            <button
              type="button"
              disabled={isOutOfStock || isExpressCheckingOut}
              onClick={handleBuyNow}
              className={cn(
                "w-full h-12 rounded-xl font-bold tracking-wider uppercase text-xs sm:text-sm shadow-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]",
                isOutOfStock
                  ? "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
                  : "bg-foreground hover:bg-foreground/90 text-background hover:shadow-md"
              )}
            >
              {isExpressCheckingOut ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing Express Checkout...</span>
                </>
              ) : (
                <span>BUY IT NOW (EXPRESS CHECKOUT)</span>
              )}
            </button>
          </div>

          {/* ── Highlighted Points Banner ────────────────────────── */}
          {highlightsList.length > 0 && (
            <div className="mt-4 rounded-xl border border-amber-300/60 bg-[#fefce8] dark:bg-amber-950/30 dark:border-amber-500/30 p-4 shadow-xs space-y-2.5">
              {highlightsList.map((line: string, idx: number) => (
                <div key={idx} className="flex items-center gap-2.5 text-xs font-semibold text-foreground/90">
                  {idx === 0 ? <Truck className="h-4 w-4 text-amber-700 dark:text-amber-400 shrink-0" /> :
                   idx === 1 ? <RotateCcw className="h-4 w-4 text-amber-700 dark:text-amber-400 shrink-0" /> :
                   <Sparkles className="h-4 w-4 text-amber-700 dark:text-amber-400 shrink-0" />}
                  <span>{line}</span>
                </div>
              ))}
            </div>
          )}

          {/* Variety Selector */}
          {variants && variants.length > 1 && (
            <div className="mt-6 border-t border-border/60 pt-4">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                Variety: <span className="font-normal text-muted-foreground">{product.name.split(" - ")[1] || "Default"}</span>
              </span>
              <div className="mt-2.5 flex flex-wrap gap-2.5">
                {variants.map((v: any) => {
                  const isSelected = v.id === product.id;
                  const vColor = v.name.split(" - ")[1] || "Default";
                  return (
                    <Link
                      key={v.id}
                      to="/product/$id"
                      params={{ id: v.id }}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-xl border p-1.5 text-center bg-card transition-all hover:border-primary cursor-pointer w-20 sm:w-24 shadow-2xs",
                        isSelected
                          ? "border-primary ring-2 ring-primary/20 scale-[1.02]"
                          : "border-border/60 opacity-85 hover:opacity-100"
                      )}
                    >
                      <div className="h-12 w-full rounded-lg overflow-hidden bg-secondary/50">
                        <img src={v.image} alt={vColor} className="h-full w-full object-cover" />
                      </div>
                      <div className="text-[10px] font-medium truncate w-full text-foreground/90">{vColor}</div>
                      <div className="text-[9px] font-semibold text-muted-foreground whitespace-nowrap">
                        {formatPrice(v.price)}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Product Dropdown Accordions ──────────────────────── */}
          <div className="mt-6 border-t border-border/60 divide-y divide-border/60">
            {/* Accordion 1: Description & Fabric */}
            <div className="py-4">
              <button
                type="button"
                onClick={() => toggleAccordion("description")}
                className="flex w-full items-center justify-between text-left cursor-pointer group"
              >
                <span className="font-sans text-xs sm:text-sm font-bold uppercase tracking-wider text-foreground group-hover:text-primary transition-colors">
                  DESCRIPTION & FABRIC
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform duration-200",
                    openAccordions.description && "rotate-180"
                  )}
                />
              </button>
              {openAccordions.description && (
                <div className="mt-3 space-y-3 text-xs leading-relaxed text-foreground/80 animate-in fade-in-50 duration-200">
                  <p className="whitespace-pre-line">{product.story || "Slow-made handwoven natural fibre mat crafted by skilled rural artisans."}</p>
                  <div className="pt-2 space-y-1.5 border-t border-border/40 text-xs">
                    <p><strong className="text-foreground">Material:</strong> {product.materials}</p>
                    {product.dimensions && <p><strong className="text-foreground">Dimensions:</strong> {product.dimensions}</p>}
                    {product.sku && <p><strong className="text-foreground">SKU ID:</strong> <span className="font-mono text-[11px]">{product.sku}</span></p>}
                    <p><strong className="text-foreground">Craftsmanship:</strong> Handwoven in small authentic batches</p>
                  </div>
                </div>
              )}
            </div>

            {/* Accordion 2: Care Instructions */}
            <div className="py-4">
              <button
                type="button"
                onClick={() => toggleAccordion("care")}
                className="flex w-full items-center justify-between text-left cursor-pointer group"
              >
                <span className="font-sans text-xs sm:text-sm font-bold uppercase tracking-wider text-foreground group-hover:text-primary transition-colors">
                  CARE INSTRUCTIONS
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform duration-200",
                    openAccordions.care && "rotate-180"
                  )}
                />
              </button>
              {openAccordions.care && (
                <div className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground animate-in fade-in-50 duration-200">
                  <ul className="space-y-1.5 list-disc list-inside">
                    {careList.map((item: string, idx: number) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Accordion 3: Delivery & Exchange Policy */}
            <div className="py-4">
              <button
                type="button"
                onClick={() => toggleAccordion("delivery")}
                className="flex w-full items-center justify-between text-left cursor-pointer group"
              >
                <span className="font-sans text-xs sm:text-sm font-bold uppercase tracking-wider text-foreground group-hover:text-primary transition-colors">
                  DELIVERY & EXCHANGE POLICY
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform duration-200",
                    openAccordions.delivery && "rotate-180"
                  )}
                />
              </button>
              {openAccordions.delivery && (
                <div className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground animate-in fade-in-50 duration-200 whitespace-pre-line">
                  <p>{deliveryText}</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ── Reviews Section ────────────────────────────────────────────────── */}
      <section className="mt-8 border-t border-border/60 pt-6">
        <div className="flex flex-col md:flex-row justify-between md:items-baseline gap-2 mb-4 pb-1.5 border-b border-border/40">
          <div>
            <h2 className="font-serif text-lg text-foreground md:text-xl">Customer Reviews</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <MessageSquare className="h-3 w-3" />
              Real feedback from verified purchasers
            </p>
          </div>
        </div>

        {reviewsLoading ? (
          <div className="flex flex-col items-center justify-center py-6 gap-2 text-muted-foreground text-xs">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Loading reviews...
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-[170px_1fr] lg:grid-cols-[190px_1fr] items-start">
            {/* Left Sidebar: Ratings Summary */}
            <div className="bg-secondary/15 rounded-lg border border-border/40 p-3 space-y-3">
              <div className="text-center md:text-left">
                <span className="font-serif text-2xl font-bold text-foreground">
                  {(() => {
                    const total = reviews.length;
                    if (total === 0) return "0.0";
                    return (reviews.reduce((sum, r) => sum + r.rating, 0) / total).toFixed(1);
                  })()}
                </span>
                <span className="text-muted-foreground text-[10px] font-medium ml-1">/ 5</span>
                
                <div className="flex justify-center md:justify-start mt-1">
                  <StarRating 
                    rating={reviews.length > 0 
                      ? Math.round(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) 
                      : 0
                    } 
                    size="h-3.5 w-3.5" 
                  />
                </div>
                
                <span className="text-[9px] text-muted-foreground block mt-1 font-medium">
                  Based on {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
                </span>
              </div>

              {/* Star distribution breakdown */}
              <div className="space-y-1.5 pt-2 border-t border-border/40">
                {[5, 4, 3, 2, 1].map((starRating) => {
                  const count = reviews.filter((r) => r.rating === starRating).length;
                  const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                  return (
                    <div key={starRating} className="flex items-center gap-1.5 text-[10px] text-foreground font-medium">
                      <span className="w-5 shrink-0 text-right">{starRating} ★</span>
                      <div className="h-1 flex-1 rounded-full bg-secondary overflow-hidden border border-border/10">
                        <div
                          style={{ width: `${percentage}%` }}
                          className="h-full bg-amber-400 rounded-full transition-all duration-500"
                        />
                      </div>
                      <span className="w-5 shrink-0 text-right text-muted-foreground font-mono">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Side: Reviews List */}
            <div className="space-y-4">
              {reviews.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-5 px-3 rounded-lg border-2 border-dashed border-border/60 bg-secondary/5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary mb-2">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <h3 className="font-serif text-sm font-semibold text-foreground">No reviews yet</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5 max-w-xs leading-relaxed">
                    Be the first to share your thoughts about this product after your order is delivered!
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {reviews.map((review) => {
                    const formattedDate = new Date(review.created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    });
                    const initials = review.user_name
                      ? review.user_name
                          .split(" ")
                          .map((n: string) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)
                      : "U";

                    return (
                      <div key={review.id} className="py-4 first:pt-0 last:pb-0 space-y-2 animate-in fade-in duration-200">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                            {review.user_avatar ? (
                              <img
                                src={review.user_avatar}
                                alt={review.user_name}
                                className="h-8 w-8 rounded-full object-cover border"
                              />
                            ) : (
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold border border-primary/20 text-[10px]">
                                {initials}
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-xs text-foreground">{review.user_name}</span>
                                <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                  Verified Buyer
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <StarRating rating={review.rating} size="h-3 w-3" />
                                <span className="text-[9px] text-muted-foreground">{formattedDate}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <p className="text-xs text-foreground/90 leading-relaxed font-normal whitespace-pre-line pl-1">
                          {review.comment}
                        </p>

                        {/* Review Photos */}
                        {review.images && review.images.length > 0 && (
                          <div className="flex gap-2 pt-0.5 pl-1">
                            {review.images.map((img: string, i: number) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => setLightboxImage(img)}
                                className="h-12 w-12 overflow-hidden rounded-lg border bg-secondary/50 hover:scale-[1.03] transition-all cursor-zoom-in"
                              >
                                <img
                                  src={img}
                                  alt={`Review photo ${i + 1}`}
                                  className="h-full w-full object-cover"
                                />
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Admin Reply Section */}
                        {review.admin_reply && (
                          <div className="mt-3 ml-4 p-3 bg-primary/5 border-l-2 border-primary rounded-r-xl space-y-1 text-left">
                            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-primary">
                              <span className="bg-primary/10 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-bold">Official Response</span>
                              <span>Sabara Team</span>
                            </div>
                            <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap font-normal">
                              {review.admin_reply}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </section>


      {/* Size Chart Modal */}
      {showSizeChart && (
        <div
          onClick={() => setShowSizeChart(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-card border border-border p-6 shadow-2xl animate-in zoom-in-95 duration-200"
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-border/60 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                  <Ruler className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-serif text-xl font-bold text-foreground">Size & Placement Guide</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Standard dimensions for handwoven natural mats & recommended placements
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSizeChart(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
                aria-label="Close size guide"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Current Product Size Highlight */}
            {product.dimensions && (
              <div className="mt-4 flex items-center justify-between rounded-xl bg-primary/5 border border-primary/20 p-3.5">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-primary" />
                  <span className="text-xs font-semibold text-foreground">This Product's Dimensions:</span>
                </div>
                <span className="rounded-md bg-primary text-primary-foreground font-mono font-bold text-xs px-2.5 py-1">
                  {product.dimensions}
                </span>
              </div>
            )}

            {/* Dimensions Table */}
            <div className="mt-5 overflow-hidden rounded-xl border border-border/60">
              <table className="w-full text-left text-xs">
                <thead className="bg-secondary/50 text-foreground font-semibold border-b border-border/60">
                  <tr>
                    <th className="p-3">Category / Use</th>
                    <th className="p-3">Feet (ft)</th>
                    <th className="p-3">Inches (in)</th>
                    <th className="p-3">Metric (cm)</th>
                    <th className="p-3">Ideal Placement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 text-muted-foreground">
                  <tr className="hover:bg-secondary/20">
                    <td className="p-3 font-medium text-foreground">Large Floor Chatai</td>
                    <td className="p-3 font-mono">6.5 × 4.5 ft</td>
                    <td className="p-3 font-mono">78 × 54 in</td>
                    <td className="p-3 font-mono">198 × 137 cm</td>
                    <td className="p-3">Living room, bedroom seating</td>
                  </tr>
                  <tr className="hover:bg-secondary/20">
                    <td className="p-3 font-medium text-foreground">Medium Floor Mat</td>
                    <td className="p-3 font-mono">5.0 × 3.0 ft</td>
                    <td className="p-3 font-mono">60 × 36 in</td>
                    <td className="p-3 font-mono">152 × 91 cm</td>
                    <td className="p-3">Bedside, prayer / pooja corner</td>
                  </tr>
                  <tr className="hover:bg-secondary/20">
                    <td className="p-3 font-medium text-foreground">Yoga & Fitness Mat</td>
                    <td className="p-3 font-mono">6.0 × 2.2 ft</td>
                    <td className="p-3 font-mono">72 × 26 in</td>
                    <td className="p-3 font-mono">183 × 66 cm</td>
                    <td className="p-3">Yoga studio, workout, meditation</td>
                  </tr>
                  <tr className="hover:bg-secondary/20">
                    <td className="p-3 font-medium text-foreground">Round Accent Mat</td>
                    <td className="p-3 font-mono">Ø 3.0 ft</td>
                    <td className="p-3 font-mono">Ø 36 in</td>
                    <td className="p-3 font-mono">Ø 90 cm</td>
                    <td className="p-3">Coffee table base, nursery, accent</td>
                  </tr>
                  <tr className="hover:bg-secondary/20">
                    <td className="p-3 font-medium text-foreground">Dining Table Mat (Set)</td>
                    <td className="p-3 font-mono">1.5 × 1.0 ft</td>
                    <td className="p-3 font-mono">18 × 12 in</td>
                    <td className="p-3 font-mono">45 × 30 cm</td>
                    <td className="p-3">Dining table setting, hot plates</td>
                  </tr>
                  <tr className="hover:bg-secondary/20">
                    <td className="p-3 font-medium text-foreground">Doormat / Entryway</td>
                    <td className="p-3 font-mono">2.0 × 1.3 ft</td>
                    <td className="p-3 font-mono">24 × 16 in</td>
                    <td className="p-3 font-mono">60 × 40 cm</td>
                    <td className="p-3">Main entrance, patio, balcony</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Practical Measuring Tips */}
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-border/60 bg-secondary/20 p-3.5 space-y-1">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  📐 Placement Rule of Thumb
                </span>
                <p className="text-muted-foreground leading-relaxed">
                  For living rooms, leave at least 8–12 inches of floor visible around the mat for a balanced aesthetic.
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-secondary/20 p-3.5 space-y-1">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  🌿 Natural Weave Note
                </span>
                <p className="text-muted-foreground leading-relaxed">
                  As each mat is handwoven from natural fibres, slight ±0.5 inch variations are inherent proof of artisanal craftsmanship.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowSizeChart(false)}
                className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-colors cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox / Image Zoom Overlay */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 backdrop-blur-sm animate-in fade-in duration-200 cursor-zoom-out animate-duration-150"
        >
          <button
            type="button"
            onClick={() => setLightboxImage(null)}
            className="absolute right-6 top-6 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors cursor-pointer border-0"
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={lightboxImage}
            alt="Review zoom"
            className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
          />
        </div>
      )}

      {related.length > 0 && (
        <section className="mt-24">
          <h2 className="font-serif text-2xl text-foreground md:text-3xl">You might also like</h2>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10 md:grid-cols-3 lg:grid-cols-4">
            {related.map((p: any) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
