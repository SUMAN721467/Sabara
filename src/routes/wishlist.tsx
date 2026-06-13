import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Trash2, ShoppingCart, ArrowRight } from "lucide-react";
import { formatPrice, useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/wishlist")({
  component: WishlistPage,
  head: () => ({ meta: [{ title: "Wishlist · Sabara" }] }),
});

function WishlistPage() {
  const { detailed, remove, count, clear } = useWishlist();
  const { add: addToCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleAddToCart = (product: any) => {
    addToCart(product.id, 1);
    toast.success(`${product.name} added to cart!`);
  };

  const handleRemove = (id: string, name: string) => {
    remove(id);
    toast.success(`${name} removed from wishlist.`);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-20 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
        <div>
          <span className="text-xs font-medium uppercase tracking-[0.22em] text-primary">
            Saved for later
          </span>
          <h1 className="mt-3 font-serif text-4xl text-foreground md:text-5xl">Your Wishlist</h1>
        </div>
        {count > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clear}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full px-4 cursor-pointer"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear All
          </Button>
        )}
      </div>

      {count === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-16 text-center max-w-xl mx-auto mt-8 bg-card/25 shadow-sm">
          <p className="text-muted-foreground text-lg">Your wishlist is currently empty.</p>
          <p className="text-sm text-muted-foreground/75 mt-2">
            Explore our collection of slow-made, handwoven natural fibre mats and save your favorites here.
          </p>
          <Button asChild className="mt-8 rounded-full px-8 py-6 text-base group cursor-pointer">
            <Link to="/shop">
              Browse the collection
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {detailed.map((product) => (
            <div
              key={product.id}
              className="group relative flex flex-col rounded-xl border bg-card/45 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-300"
            >
              {/* Image */}
              <div className="relative aspect-[4/5] overflow-hidden bg-secondary/50">
                <Link to="/product/$id" params={{ id: product.id }}>
                  <img
                    src={product.image}
                    alt={product.name}
                    className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.21,0.6,0.35,1)] group-hover:scale-[1.05]"
                  />
                </Link>
                <button
                  onClick={() => handleRemove(product.id, product.name)}
                  className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-background/90 text-muted-foreground shadow-sm backdrop-blur hover:bg-destructive hover:text-white transition-all active:scale-90 cursor-pointer"
                  aria-label="Remove from wishlist"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                {product.badge && (
                  <span className="absolute left-3 top-3 rounded-full bg-background/85 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-foreground backdrop-blur">
                    {product.badge}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="flex flex-1 flex-col justify-between p-5">
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      to="/product/$id"
                      params={{ id: product.id }}
                      className="font-serif text-lg leading-tight text-foreground hover:underline"
                    >
                      {product.name}
                    </Link>
                    {product.original_price && product.original_price > product.price ? (
                      <div className="flex flex-col items-end whitespace-nowrap shrink-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-red-600 dark:text-red-400">
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
                      <span className="font-medium text-foreground whitespace-nowrap">
                        {formatPrice(product.price)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground/80">
                    {product.category} · {product.materials}
                  </p>
                </div>

                <div className="mt-5 flex gap-2">
                  {user ? (
                    <Button
                      onClick={() => handleAddToCart(product)}
                      className="flex-1 rounded-full text-sm font-medium py-5 cursor-pointer"
                    >
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      Add to Cart
                    </Button>
                  ) : (
                    <Button
                      onClick={() => navigate({ to: "/login", search: { redirect: "/wishlist" } })}
                      variant="secondary"
                      className="flex-1 rounded-full text-sm font-medium py-5 border border-border cursor-pointer"
                    >
                      Login to add to cart
                    </Button>
                  )}
                  <Button
                    asChild
                    variant="outline"
                    className="rounded-full text-sm font-medium px-4 py-5 cursor-pointer"
                  >
                    <Link to="/product/$id" params={{ id: product.id }}>
                      View Details
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
