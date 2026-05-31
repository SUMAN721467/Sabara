import { Link } from "@tanstack/react-router";
import { formatPrice } from "@/lib/cart";
import type { Product } from "@/data/products";
import { Heart } from "lucide-react";
import { useWishlist } from "@/lib/wishlist";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function ProductCard({ product }: { product: Product }) {
  const { toggle, has } = useWishlist();
  const isWishlisted = has(product.id);

  const handleWishlistToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggle(product.id);
    if (isWishlisted) {
      toast.success(`${product.name} removed from wishlist.`);
    } else {
      toast.success(`${product.name} added to wishlist!`);
    }
  };

  return (
    <Link
      to="/product/$id"
      params={{ id: product.id }}
      className="group block card-hover rounded-xl p-2 bg-card/45 border border-border/20 transition-all duration-300"
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-secondary/50">
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.21,0.6,0.35,1)] group-hover:scale-[1.06]"
        />
        {product.badge && (
          <span className="absolute left-3 top-3 rounded-full bg-background/85 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-foreground backdrop-blur animate-in fade-in zoom-in-75 duration-300">
            {product.badge}
          </span>
        )}
        <button
          onClick={handleWishlistToggle}
          className={cn(
            "absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full shadow-sm backdrop-blur transition-all duration-300 active:scale-90 hover:scale-105 cursor-pointer",
            isWishlisted
              ? "bg-primary text-primary-foreground opacity-100"
              : "bg-background/85 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 focus:opacity-100"
          )}
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart className={cn("h-4 w-4", isWishlisted && "fill-current")} />
        </button>
      </div>

      {/* Variant Indicators */}
      {(product as any).variants && (product as any).variants.length > 1 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5 px-1" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
          {(product as any).variants.map((v: any) => {
            const variantColor = v.name.split(" - ")[1] || "Default";
            const isSelected = v.id === product.id;
            return (
              <Link
                key={v.id}
                to="/product/$id"
                params={{ id: v.id }}
                className={cn(
                  "relative h-6 w-6 rounded-full overflow-hidden border-2 transition-all hover:scale-110",
                  isSelected ? "border-primary scale-105" : "border-transparent opacity-75 hover:opacity-100"
                )}
                title={variantColor}
              >
                <img src={v.image} alt={variantColor} className="h-full w-full object-cover" />
              </Link>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex items-baseline justify-between gap-3 px-1">
        <h3 className="font-serif text-lg leading-tight text-foreground transition-colors group-hover:text-primary duration-300">
          {product.name.split(" - ")[0]}
        </h3>
        {product.original_price && product.original_price > product.price ? (
          <div className="flex flex-col items-end shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                {formatPrice(product.price)}
              </span>
              <span className="text-xs text-muted-foreground line-through decoration-muted-foreground">
                {formatPrice(product.original_price)}
              </span>
            </div>
            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              ({Math.round(((product.original_price - product.price) / product.original_price) * 100)}% off)
            </span>
          </div>
        ) : (
          <span className="text-sm font-medium text-muted-foreground">{formatPrice(product.price)}</span>
        )}
      </div>
      <p className="mt-0.5 text-xs uppercase tracking-wider text-muted-foreground/80 px-1 pb-1">
        {product.category} · {product.materials}
      </p>
    </Link>
  );
}
