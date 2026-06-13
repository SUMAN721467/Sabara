import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, Minus, Plus, Heart, Star, MessageSquare, X, Loader2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
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

const getProductDetails = createServerFn({ method: "GET" })
  .handler(async ({ data: id }: any) => {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const supabase = createClient(supabaseUrl!, supabaseKey!);
    const list = await getOrSeedProducts(supabase, true);
    const product = list.find((p: any) => p.id === id);
    if (!product) return null;

    const baseName = product.name.split(" - ")[0];
    const variants = list
      .filter((p: any) => p.name.split(" - ")[0] === baseName)
      .sort((a: any, b: any) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return aTime - bTime;
      });

    // Group related products by base name (excluding variants of current product)
    const otherProducts = list.filter((x: any) => {
      if (x.name.split(" - ")[0] === baseName) return false;
      const xCats = (x.category || "").split(",").map((c: string) => c.trim().toLowerCase());
      const prodCats = (product.category || "").split(",").map((c: string) => c.trim().toLowerCase());
      return xCats.some((c: string) => prodCats.includes(c));
    });
    const relatedGroups = new Map<string, any[]>();
    otherProducts.forEach((p: any) => {
      const bName = p.name.split(" - ")[0];
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
        return {
          ...main,
          variants: sorted,
        };
      })
      .slice(0, 3);

    return { product, related, variants };
  });

export const Route = createFileRoute("/product/$id")({
  loader: async ({ params }) => {
    const data = await (getProductDetails as any)({ data: params.id });
    if (!data || !data.product) throw notFound();
    return data;
  },
  component: ProductPage,
  head: ({ loaderData }) =>
    loaderData
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

  const lensSize = { width: 130, height: 162.5 }; // aspect-ratio matching aspect-[4/5] (e.g. 130/162.5 = 4/5) - smaller lens = higher zoom factor

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
      className="relative w-full aspect-[4/5] select-none"
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
          className="h-full w-full object-cover aspect-[4/5]"
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
            className="absolute pointer-events-none border-2 border-primary/50 bg-primary/10 shadow-sm z-10 transition-none"
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
  const { add } = useCart();
  const { toggle: toggleWishlist, has: hasWishlist } = useWishlist();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isWishlisted = hasWishlist(product.id);
  const maxStock = product.stock !== undefined && product.stock !== null ? Number(product.stock) : 10;
  const isOutOfStock = maxStock <= 0;
  const [qty, setQty] = useState(1);

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

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:py-10">
      <Link
        to="/shop"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to shop
      </Link>

      <div className="mt-6 grid gap-6 md:grid-cols-[320px_1fr] lg:grid-cols-[360px_1fr] md:gap-8 lg:gap-12 items-start">
        <div className="flex flex-col gap-4">
          <Carousel setApi={setApi} className="w-full relative group">
            <CarouselContent>
              {product.gallery.map((img: string, i: number) => (
                <CarouselItem key={i}>
                  <ZoomableImage src={img} alt={`${product.name} view ${i + 1}`} />
                </CarouselItem>
              ))}
            </CarouselContent>
            {product.gallery.length > 1 && (
              <>
                <CarouselPrevious className="left-4 opacity-0 transition-opacity group-hover:opacity-100" />
                <CarouselNext className="right-4 opacity-0 transition-opacity group-hover:opacity-100" />
              </>
            )}
          </Carousel>
          <div className="grid grid-cols-4 gap-3">
            {product.gallery.map((img: string, i: number) => (
              <button
                key={i}
                onClick={() => api?.scrollTo(i)}
                className={`overflow-hidden rounded-lg bg-secondary/50 transition-all ${
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
        </div>

        <div className="flex flex-col">
          <span className="text-xs font-medium uppercase tracking-[0.22em] text-primary">
            {(product.category || "").split(",").map((c: string) => c.trim()).join(" · ")}
          </span>
          <h1 className="mt-3 font-serif text-2xl leading-tight text-foreground md:text-3xl">
            {product.name.split(" - ")[0]}
          </h1>
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

          <div className="mt-6 flex items-stretch gap-3">
            <div className="inline-flex items-center rounded-full border border-border">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="inline-flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Decrease"
                disabled={isOutOfStock || qty <= 1}
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-8 text-center text-sm tabular-nums">{qty}</span>
              <button
                onClick={() => setQty((q) => Math.min(maxStock, q + 1))}
                className="inline-flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Increase"
                disabled={isOutOfStock || qty >= maxStock}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {isOutOfStock ? (
              <button
                disabled
                className="flex-1 rounded-full bg-border text-muted-foreground px-6 py-3 text-sm font-medium cursor-not-allowed opacity-50"
              >
                Out of Stock
              </button>
            ) : user ? (
              <button
                onClick={() => {
                  add(product.id, qty);
                  toast.success(`${product.name} added to cart`);
                }}
                className="flex-1 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 cursor-pointer"
              >
                Add to cart · {formatPrice(product.price * qty)}
              </button>
            ) : (
              <button
                onClick={() => {
                  navigate({ to: "/login", search: { redirect: `/product/${product.id}` } });
                }}
                className="flex-1 rounded-full bg-secondary border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary/80 cursor-pointer"
              >
                Login to add to cart
              </button>
            )}
            <button
              onClick={() => {
                toggleWishlist(product.id);
                if (isWishlisted) {
                  toast.success(`${product.name} removed from wishlist.`);
                } else {
                  toast.success(`${product.name} added to wishlist!`);
                }
              }}
              className={cn(
                "inline-flex h-11 w-11 items-center justify-center rounded-full border transition-all active:scale-90 cursor-pointer",
                isWishlisted
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
              aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
            >
              <Heart className={cn("h-5 w-5", isWishlisted && "fill-current")} />
            </button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Free shipping on all orders</p>

          {/* Formatted Story/Description */}
          {(() => {
            const story = product.story || "";
            if (story.includes("★")) {
              const parts = story.split("★").map(p => p.trim()).filter(Boolean);
              return (
                <div className="mt-8 space-y-3.5">
                  {parts.map((part, index) => {
                    const colonIndex = part.indexOf(":");
                    if (colonIndex > -1) {
                      const title = part.substring(0, colonIndex).trim();
                      const desc = part.substring(colonIndex + 1).trim();
                      return (
                        <div key={index} className="flex gap-3 items-start bg-secondary/25 p-4 rounded-xl border border-border/30 hover:bg-secondary/45 transition-all duration-300">
                          <span className="text-primary shrink-0 font-bold text-sm mt-0.5">★</span>
                          <div>
                            <h4 className="font-semibold text-foreground text-sm leading-snug">{title}</h4>
                            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{desc}</p>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={index} className="flex gap-3 items-start bg-secondary/25 p-4 rounded-xl border border-border/30 hover:bg-secondary/45 transition-all duration-300">
                        <span className="text-primary shrink-0 font-bold text-sm mt-0.5">★</span>
                        <p className="text-xs text-muted-foreground leading-relaxed">{part}</p>
                      </div>
                    );
                  })}
                </div>
              );
            }
            return <p className="mt-8 leading-relaxed text-sm text-foreground/80 whitespace-pre-line">{story}</p>;
          })()}

          {/* Variety Selector */}
          {variants && variants.length > 1 && (
            <div className="mt-6 border-t border-border/60 pt-5">
              <span className="text-sm font-semibold text-foreground">
                Variety: <span className="font-normal text-muted-foreground">{product.name.split(" - ")[1] || "Default"}</span>
              </span>
              <div className="mt-3 flex flex-wrap gap-3">
                {variants.map((v: any) => {
                  const isSelected = v.id === product.id;
                  const vColor = v.name.split(" - ")[1] || "Default";
                  return (
                    <Link
                      key={v.id}
                      to="/product/$id"
                      params={{ id: v.id }}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-xl border p-2 text-center bg-card transition-all hover:border-primary cursor-pointer w-24 sm:w-28",
                        isSelected
                          ? "border-primary ring-2 ring-primary/20 scale-[1.02]"
                          : "border-border/60 opacity-85 hover:opacity-100"
                      )}
                    >
                      <div className="h-16 w-full rounded-lg overflow-hidden bg-secondary/50">
                        <img src={v.image} alt={vColor} className="h-full w-full object-cover" />
                      </div>
                      <div className="text-[11px] font-medium truncate w-full text-foreground/90">{vColor}</div>
                      <div className="text-[10px] font-semibold text-muted-foreground whitespace-nowrap">
                        {formatPrice(v.price)}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          <dl className="mt-8 grid grid-cols-2 gap-y-3 border-y border-border/60 py-5 text-sm">
            {product.sku && (
              <>
                <dt className="text-muted-foreground">SKU ID</dt>
                <dd className="text-foreground font-mono text-xs">{product.sku}</dd>
              </>
            )}
            <dt className="text-muted-foreground">Materials</dt>
            <dd className="text-foreground">{product.materials}</dd>
            <dt className="text-muted-foreground">Dimensions</dt>
            <dd className="text-foreground">{product.dimensions}</dd>
            <dt className="text-muted-foreground">Made</dt>
            <dd className="text-foreground">By hand, in small batches</dd>
            <dt className="text-muted-foreground">Returns</dt>
            <dd className="text-foreground text-emerald-600 dark:text-emerald-400 font-semibold">7 Days Hassle-Free Return</dd>
          </dl>

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
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </section>


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
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-12 lg:grid-cols-3">
            {related.map((p: any) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
