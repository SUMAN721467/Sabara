import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Minus, Plus, X, Info } from "lucide-react";
import { toast } from "sonner";
import { formatPrice, useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useShippingSettings } from "@/lib/settings";

export const Route = createFileRoute("/cart")({
  component: CartPage,
  head: () => ({ meta: [{ title: "Cart · Sabara" }] }),
});

function CartPage() {
  const { detailed, subtotal, setQty, remove, count } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { settings: shippingSettings } = useShippingSettings();

  // Coupon states
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [discount, setDiscount] = useState(0);
  const [availableCoupons, setAvailableCoupons] = useState<any[]>([]);

  const FEES = (shippingSettings.enabled && (subtotal - discount) < shippingSettings.minOrder) 
    ? shippingSettings.fee 
    : 0;

  // Fetch available coupons
  useEffect(() => {
    async function fetchCoupons() {
      try {
        const res = await fetch("/api/site-settings?key=coupons");
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.value?.coupons) {
            setAvailableCoupons(json.value.coupons);
            return;
          }
        }
      } catch (err) {
        console.error("Failed to fetch coupons:", err);
      }
      setAvailableCoupons([
        { code: "FESTIVE10", discount: 10 },
        { code: "FIRSTORDER", discount: 20 },
        { code: "SABARA15", discount: 15 }
      ]);
    }
    fetchCoupons();
  }, []);

  // Sync discount when subtotal or applied coupon changes
  useEffect(() => {
    if (appliedCoupon && availableCoupons.length > 0) {
      const match = availableCoupons.find(
        (c) => c.code.toUpperCase() === appliedCoupon.toUpperCase()
      );
      if (match) {
        if (match.minOrder !== undefined && match.minOrder !== null && subtotal < match.minOrder) {
          setAppliedCoupon(null);
          setDiscount(0);
          toast.error(`Coupon removed: Subtotal must be at least ₹${match.minOrder} to use this coupon.`);
          return;
        }
        setDiscount(Math.round(subtotal * (Number(match.discount) / 100)));
        return;
      }
    }
    setDiscount(0);
  }, [subtotal, appliedCoupon, availableCoupons]);

  const handleApplyCoupon = (e: React.MouseEvent) => {
    e.preventDefault();
    const code = couponCode.trim().toUpperCase();
    if (!code) return;

    const match = availableCoupons.find(
      (c) => c.code.toUpperCase() === code
    );

    if (match) {
      if (match.minOrder !== undefined && match.minOrder !== null && subtotal < match.minOrder) {
        toast.error(`Minimum order amount of ₹${match.minOrder} is required for this coupon.`);
        return;
      }
      if (match.limit !== undefined && match.limit !== null && match.limit <= 0) {
        toast.error(`This coupon has reached its limit and is no longer available.`);
        return;
      }
      setAppliedCoupon(match.code.toUpperCase());
      toast.success(`Coupon ${match.code.toUpperCase()} applied! (${match.discount}% off)`);
    } else {
      toast.error("Invalid coupon code.");
    }
  };

  const handleApplyDirectCoupon = (match: any) => {
    if (match.minOrder !== undefined && match.minOrder !== null && subtotal < match.minOrder) {
      toast.error(`Minimum order amount of ₹${match.minOrder} is required for this coupon.`);
      return;
    }
    if (match.limit !== undefined && match.limit !== null && match.limit <= 0) {
      toast.error(`This coupon has reached its limit and is no longer available.`);
      return;
    }
    setAppliedCoupon(match.code.toUpperCase());
    toast.success(`Coupon ${match.code.toUpperCase()} applied! (${match.discount}% off)`);
  };

  const handleRemoveCoupon = (e: React.MouseEvent) => {
    e.preventDefault();
    setAppliedCoupon(null);
    setDiscount(0);
    setCouponCode("");
    toast.success("Coupon removed.");
  };

  const totalMRP = detailed.reduce((sum, line) => {
    const original = line.product.original_price || Math.round(line.product.price * 1.45);
    return sum + original * line.qty;
  }, 0);
  const totalDiscount = totalMRP - (subtotal - discount);
  const totalAmount = subtotal - discount + FEES;

  const handleProceedToCheckout = () => {
    if (!user) {
      // User is not logged in: navigate to /login and pass redirect to /checkout
      navigate({
        to: "/login",
        search: {
          redirect: appliedCoupon ? `/checkout?coupon=${appliedCoupon}` : "/checkout"
        }
      });
    } else {
      // User is logged in: navigate to /checkout and pass the applied coupon
      navigate({
        to: "/checkout",
        search: {
          coupon: appliedCoupon || undefined
        }
      });
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-14 sm:px-6 md:pt-8 md:pb-16">
      <h1 className="font-serif text-3xl text-foreground md:text-4xl mb-6 text-center sm:text-left">Shopping Cart ({count} {count === 1 ? 'item' : 'items'})</h1>

      {detailed.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">Your cart is empty.</p>
          <Link
            to="/shop"
            className="mt-6 inline-flex items-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Browse the collection
          </Link>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_400px] w-full">
          {/* Left Column: Cart Items List */}
          <div className="space-y-6 w-full min-w-0">
            <div className="bg-white border border-[#e0e0e0] rounded-lg p-4 sm:p-6 shadow-sm">
              <ul className="divide-y divide-border/60">
                {detailed.map((line) => {
                  const original = line.product.original_price || Math.round(line.product.price * 1.45);
                  const discountPercent = Math.round(((original - line.product.price) / original) * 100);

                  return (
                    <li key={line.id} className="flex gap-4 sm:gap-6 py-4 sm:py-6 first:pt-0 last:pb-0">
                      {/* Product Image & Qty Dropdown */}
                      <div className="flex flex-col items-center">
                        <Link
                          to="/product/$id"
                          params={{ id: line.product.id }}
                          className="h-24 w-20 sm:h-28 sm:w-24 shrink-0 overflow-hidden rounded-md bg-secondary/30 flex items-center justify-center"
                        >
                          <img
                            src={line.product.image}
                            alt={line.product.name}
                            className="h-full w-full object-contain"
                          />
                        </Link>

                        {/* Quantity Selector with - and + */}
                        <div className="mt-2.5 inline-flex items-center rounded-full border border-primary/20 bg-white">
                          <button
                            type="button"
                            onClick={() => setQty(line.id, Math.max(1, line.qty - 1))}
                            disabled={line.qty <= 1}
                            className="inline-flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer bg-transparent border-none"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                          </button>
                          <span className="w-6 sm:w-8 text-center text-[11px] sm:text-xs font-semibold tabular-nums text-foreground select-none">
                            {line.qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => setQty(line.id, Math.min(line.product.stock || 10, line.qty + 1))}
                            disabled={line.qty >= (line.product.stock || 10)}
                            className="inline-flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer bg-transparent border-none"
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Product Info */}
                      <div className="flex flex-1 min-w-0 flex-col justify-between">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <Link
                              to="/product/$id"
                              params={{ id: line.product.id }}
                              className="text-foreground text-[13px] sm:text-[15px] font-medium hover:text-primary text-left block leading-snug break-words"
                            >
                              {line.product.name}
                            </Link>
                            <p className="text-[11px] sm:text-[12px] text-muted-foreground mt-1 text-left font-medium">
                              {line.product.category} · {line.product.dimensions || "Standard Size"}
                            </p>

                            {/* Price Row */}
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-[11px] sm:text-[13px] text-primary font-bold flex items-center">
                                <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 13l-7 7-7-7" />
                                </svg>
                                {discountPercent}% Off
                              </span>
                              <span className="text-[11px] sm:text-[13px] text-muted-foreground line-through">
                                {formatPrice(original)}
                              </span>
                              <span className="text-[14px] sm:text-[16px] font-bold text-foreground">
                                {formatPrice(line.product.price)}
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => remove(line.id)}
                            aria-label="Remove"
                            className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer p-1 bg-transparent border-none"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="flex items-center justify-end mt-3 pt-3 border-t border-dashed border-border/60">
                          <div className="text-xs sm:text-sm font-bold text-foreground">
                            Subtotal: {formatPrice(line.product.price * line.qty)}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          {/* Right Column: Order Summary & Coupon */}
          <div className="space-y-4 w-full min-w-0">
            <aside className="sticky top-6 h-fit rounded-lg border border-[#e0e0e0] bg-white p-4 sm:p-6 text-left shadow-sm w-full">
              <h2 className="text-muted-foreground text-[11px] sm:text-[13px] font-bold uppercase tracking-wider border-b border-border/60 pb-3 mb-4">
                Price Details
              </h2>
              <dl className="space-y-4 text-xs sm:text-sm mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-foreground border-b border-dashed border-border/80 pb-0.5 cursor-help">
                    MRP (incl. of all taxes)
                  </span>
                  <span className="text-foreground">{formatPrice(totalMRP)}</span>
                </div>
                <div className="flex justify-between items-center text-primary font-semibold">
                  <span className="flex items-center gap-1 border-b border-dashed border-border/80 pb-0.5 cursor-help">
                    Product Discount
                  </span>
                  <span>-{formatPrice(totalMRP - subtotal)}</span>
                </div>
                {appliedCoupon && discount > 0 && (
                  <div className="flex justify-between items-center text-primary font-semibold">
                    <span className="flex items-center gap-1 border-b border-dashed border-border/80 pb-0.5 cursor-help">
                      Coupon Discount ({appliedCoupon})
                    </span>
                    <span>-{formatPrice(discount)}</span>
                  </div>
                )}
                {shippingSettings.enabled && (
                  <div className="flex justify-between items-center text-foreground">
                    <span className="flex items-center gap-1 border-b border-dashed border-border/80 pb-0.5 cursor-help">
                      Shipping Charges
                    </span>
                    <span className={FEES === 0 ? "text-green-600 font-semibold" : "text-foreground font-mono"}>
                      {FEES === 0 ? "FREE" : formatPrice(FEES)}
                    </span>
                  </div>
                )}
              </dl>

              {shippingSettings.enabled && FEES > 0 && (
                <div className="mb-6 bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] rounded-lg p-2.5 flex items-center gap-1.5 font-medium animate-pulse">
                  <Info className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>Add {formatPrice(shippingSettings.minOrder - (subtotal - discount))} more to get <strong>FREE SHIPPING!</strong></span>
                </div>
              )}

              {/* Coupon Form */}
              <div className="mb-6 border-t border-[#f0f0f0] pt-4">
                <Label htmlFor="coupon-input" className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
                  Promo / Coupon Code
                </Label>
                {appliedCoupon ? (
                  <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-xl px-4 py-2.5">
                    <div className="text-xs sm:text-sm">
                      <span className="font-semibold text-primary">
                        {appliedCoupon} ({
                          availableCoupons.find(c => c.code.toUpperCase() === appliedCoupon.toUpperCase())?.discount || 0
                        }% off)
                      </span>
                      <span className="text-xs text-muted-foreground ml-1.5 font-normal">applied</span>
                    </div>
                    <button
                      onClick={handleRemoveCoupon}
                      className="text-xs text-destructive hover:underline font-medium cursor-pointer bg-transparent border-none p-0"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <Input
                        id="coupon-input"
                        placeholder="e.g. SABARA15"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        className="flex-1 min-w-0 bg-background/80 rounded-full h-9 sm:h-10 text-xs sm:text-sm border-border font-mono uppercase"
                      />
                      <Button
                        onClick={handleApplyCoupon}
                        variant="outline"
                        className="rounded-full px-4 sm:px-5 h-9 sm:h-10 text-xs sm:text-sm cursor-pointer border-primary text-primary hover:bg-primary/5"
                      >
                        Apply
                      </Button>
                    </div>

                    {/* Available Coupons list */}
                    {availableCoupons.filter(c => c.showInList !== false).length > 0 && (
                      <div className="mt-4 space-y-2">
                        <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                          Available Coupons
                        </span>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {availableCoupons.filter(c => c.showInList !== false).map((c) => (
                            <div key={c.code} className="flex items-center justify-between p-2 sm:p-2.5 border border-[#f0f0f0] rounded-lg bg-card/50 hover:bg-primary/5 transition-colors text-xs">
                              <div className="text-left flex flex-col gap-0.5 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold bg-primary/10 border border-primary/20 text-primary px-1.5 py-0.5 rounded text-[10px] uppercase">
                                    {c.code}
                                  </span>
                                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                    {c.discount}% OFF
                                  </span>
                                </div>
                                <span className="text-[10px] text-muted-foreground truncate">
                                  {c.minOrder ? `Valid on orders of ₹${c.minOrder} or more` : "No minimum order value required"}
                                </span>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleApplyDirectCoupon(c);
                                }}
                                className="text-xs font-bold text-primary hover:text-primary/80 transition-colors cursor-pointer bg-transparent border-none p-1 shrink-0"
                              >
                                Apply
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="mt-4 flex justify-between border-t border-[#f0f0f0] pt-4 text-sm sm:text-base mb-6 font-bold">
                <span className="text-foreground text-[14px] sm:text-[16px]">Total Amount</span>
                <span className="text-[16px] sm:text-[18px] text-foreground font-serif">
                  {formatPrice(totalAmount)}
                </span>
              </div>

              {/* Savings banner */}
              {totalDiscount > 0 && (
                <div className="bg-primary/10 border border-primary/20 text-primary text-xs sm:text-sm font-semibold rounded-[4px] p-2.5 sm:p-3 flex items-center gap-2 mb-6">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>You'll save {formatPrice(totalDiscount)} on this order!</span>
                </div>
              )}

              <Button
                onClick={handleProceedToCheckout}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-[4px] py-4 sm:py-6 text-sm sm:text-base font-bold transition-all uppercase tracking-wider shadow-sm"
              >
                Proceed to Checkout
              </Button>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}
