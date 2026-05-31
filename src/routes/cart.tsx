import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Minus, Plus, X, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { formatPrice, useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INDIAN_STATES, fetchDistrictAndStateFromPincode } from "@/lib/pincode";


export const Route = createFileRoute("/cart")({
  component: CartPage,
  head: () => ({ meta: [{ title: "Cart · Sabara" }] }),
});

function CartPage() {
  const { detailed, subtotal, setQty, remove, clear } = useCart();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Checkout states
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<any | null>(null);

  // Form fields
  const [fullName, setFullName] = useState("");

  // Coupon states
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [discount, setDiscount] = useState(0);
  const [availableCoupons, setAvailableCoupons] = useState<any[]>([]);

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
      // Fallback defaults
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
      // Validate minimum order requirement
      if (match.minOrder !== undefined && match.minOrder !== null && subtotal < match.minOrder) {
        toast.error(`Minimum order amount of ₹${match.minOrder} is required for this coupon.`);
        return;
      }
      // Validate usage limit
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

  const handleRemoveCoupon = (e: React.MouseEvent) => {
    e.preventDefault();
    setAppliedCoupon(null);
    setDiscount(0);
    setCouponCode("");
    toast.success("Coupon removed.");
  };
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [stateName, setStateName] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [isManualInput, setIsManualInput] = useState(false);
  const [landmark, setLandmark] = useState("");
  const [fetchingPincode, setFetchingPincode] = useState(false);

  // Auto-fetch district & state when pincode is exactly 6 digits (manual input only)
  useEffect(() => {
    if (zipCode && zipCode.length === 6 && isManualInput) {
      const fetchDetails = async () => {
        setFetchingPincode(true);
        try {
          const details = await fetchDistrictAndStateFromPincode(zipCode);
          if (details) {
            setDistrict(details.district);
            setStateName(details.state);
            toast.success(`District & State auto-filled for PIN Code ${zipCode}`);
          } else {
            toast.error("Could not find location details for this PIN Code. Please enter manually.");
          }
        } catch (err) {
          console.error("Failed to fetch address details for pincode:", err);
        } finally {
          setFetchingPincode(false);
        }
      };
      fetchDetails();
    }
  }, [zipCode, isManualInput]);


  // Fetch registered user profile details
  useEffect(() => {
    if (!user) return;
    
    setProfileLoading(true);
    setEmail(user.email || "");
    
    supabase.auth.getSession().then(({ data }) => {
      const token = data?.session?.access_token;
      if (!token) {
        setProfileLoading(false);
        return;
      }

      fetch("/api/users/profile", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((json) => {
          if (json.success && json.profile) {
            const p = json.profile;
            setProfile(p);
            setFullName(p.fullName || "");
            setPhone(p.phone || "");
            if (p.address) {
              setStreet(p.address.street || "");
              setCity(p.address.city || "");
              setDistrict(p.address.district || "");
              setStateName(p.address.state || "");
              setZipCode(p.address.zipCode || "");
              setLandmark(p.address.landmark || "");
            }
          }
        })
        .catch(() => {})
        .finally(() => setProfileLoading(false));
    });
  }, [user]);

  const handleCheckout = async (e: FormEvent) => {
    e.preventDefault();
    if (detailed.length === 0) return;

    if (!fullName || !email || !phone.trim() || !street.trim() || !landmark.trim() || !city.trim() || !district.trim() || !stateName.trim() || !zipCode.trim()) {
      toast.error("Please fill in all shipping details. All fields are mandatory.");
      return;
    }

    if (zipCode.length !== 6) {
      toast.error("ZIP / Postal Code must be exactly 6 digits.");
      return;
    }


    setBusy(true);
    try {
      const items = detailed.map((line) => ({
        productId: line.product.id,
        productName: line.product.name,
        productImage: line.product.image,
        qty: line.qty,
        price: line.product.price,
      }));

      const payload = {
        userId: user?.id || null,
        customerName: fullName,
        customerEmail: email,
        customerPhone: phone,
        items,
        total: subtotal - discount,
        couponCode: appliedCoupon,
        shippingAddress: {
          street,
          city,
          district,
          state: stateName,
          zipCode,
          landmark,
        },
      };

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Checkout failed");

      setOrderSuccess(json.order);
      clear();
      toast.success("Order placed successfully!");
    } catch (err: any) {
      toast.error(err.message || "Something went wrong during checkout.");
    } finally {
      setBusy(false);
    }
  };

  if (orderSuccess) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <div className="flex justify-center mb-6">
          <CheckCircle2 className="h-16 w-16 text-emerald-500 animate-pulse" />
        </div>
        <h1 className="font-serif text-4xl mb-2 text-foreground">Thank you for your order!</h1>
        <p className="text-muted-foreground mb-8">
          Your order <span className="font-mono font-medium text-foreground">{orderSuccess.orderNumber}</span> has been received and is being processed.
        </p>
        <div className="rounded-xl border bg-card p-6 text-left shadow-sm mb-8 space-y-4">
          <h3 className="font-medium text-lg border-b pb-2">Delivery Summary</h3>
          <div>
            <span className="text-xs uppercase tracking-wider text-muted-foreground block">Deliver to</span>
            <span className="font-medium">{orderSuccess.customerName}</span>
          </div>
          <div>
            <span className="text-xs uppercase tracking-wider text-muted-foreground block">Shipping Address</span>
            <span>
              {orderSuccess.shippingAddress.street},{" "}
              {orderSuccess.shippingAddress.landmark ? `Landmark: ${orderSuccess.shippingAddress.landmark}, ` : ""}
              {orderSuccess.shippingAddress.city}
              {orderSuccess.shippingAddress.district ? `, ${orderSuccess.shippingAddress.district}` : ""}, {orderSuccess.shippingAddress.state} {orderSuccess.shippingAddress.zipCode}
            </span>
          </div>
          <div>
            <span className="text-xs uppercase tracking-wider text-muted-foreground block">Estimated Total</span>
            <span className="font-serif text-lg text-primary">{formatPrice(orderSuccess.total)}</span>
          </div>
        </div>
        <Button onClick={() => navigate({ to: "/shop" })} className="rounded-full px-8 py-6 text-base">
          Continue Shopping
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-20">
      <h1 className="font-serif text-4xl text-foreground md:text-5xl mb-10">Your Cart & Checkout</h1>

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
        <div className="grid gap-12 lg:grid-cols-[1fr_400px]">
          {/* Left Column: Cart items list + Checkout Form */}
          <div className="space-y-12">
            <div>
              <h2 className="font-serif text-2xl mb-6">1. Review Items</h2>
              <ul className="divide-y divide-border/60 border-y border-border/60">
                {detailed.map((line) => (
                  <li key={line.id} className="flex gap-4 py-6">
                    <Link
                      to="/product/$id"
                      params={{ id: line.product.id }}
                      className="h-24 w-20 shrink-0 overflow-hidden rounded-md bg-secondary/60"
                    >
                      <img
                        src={line.product.image}
                        alt={line.product.name}
                        className="h-full w-full object-cover"
                      />
                    </Link>
                    <div className="flex flex-1 flex-col justify-between">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Link
                            to="/product/$id"
                            params={{ id: line.product.id }}
                            className="font-serif text-lg leading-tight text-foreground hover:underline"
                          >
                            {line.product.name}
                          </Link>
                          <p className="text-xs uppercase tracking-wider text-muted-foreground mt-1">
                            {line.product.category} · {line.product.dimensions}
                          </p>
                          {line.product.stock !== undefined && line.product.stock !== null && (
                            <div className="mt-1.5 flex items-center gap-1.5">
                              {line.product.stock <= 0 ? (
                                <span className="inline-flex items-center rounded bg-red-50 dark:bg-red-950/40 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-300">
                                  Out of stock
                                </span>
                              ) : line.product.stock <= 5 ? (
                                <span className="inline-flex items-center rounded bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-300">
                                  Only {line.product.stock} left in stock
                                </span>
                              ) : null}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => remove(line.id)}
                          aria-label="Remove"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="inline-flex items-center rounded-full border border-border">
                          <button
                            onClick={() => setQty(line.id, line.qty - 1)}
                            className="inline-flex h-9 w-9 items-center justify-center text-muted-foreground hover:text-foreground"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-7 text-center text-sm tabular-nums">{line.qty}</span>
                          <button
                            onClick={() => setQty(line.id, line.qty + 1)}
                            className="inline-flex h-9 w-9 items-center justify-center text-muted-foreground hover:text-foreground"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="text-sm font-medium text-foreground">
                          {formatPrice(line.product.price * line.qty)}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Checkout Form */}
            <div>
              <div className="flex flex-col mb-6">
                <h2 className="font-serif text-2xl">2. Shipping & Delivery</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Please fill in all shipping details. <span className="font-semibold text-destructive dark:text-red-400">(All fields are mandatory)</span>
                </p>
              </div>

              {!user ? (
                <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center shadow-sm">
                  <p className="text-muted-foreground mb-4">Please log in to your account to complete checkout and place an order.</p>
                  <Button asChild className="rounded-full px-6">
                    <Link to="/login" search={{ redirect: "/cart" }}>
                      Sign In to Checkout
                    </Link>
                  </Button>
                </div>
              ) : profileLoading ? (
                <div className="flex items-center gap-2 py-4 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Loading your shipping details...
                </div>
              ) : (
                <form id="checkout-form" onSubmit={handleCheckout} className="space-y-6 rounded-xl border bg-card p-6 shadow-sm">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Full Name <span className="text-destructive">*</span></Label>
                      <Input
                        id="fullName"
                        required
                        placeholder="Enter your full name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address <span className="text-destructive">*</span></Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        placeholder="abcd@gmail.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number <span className="text-destructive">*</span></Label>
                    <Input
                      id="phone"
                      type="tel"
                      required
                      placeholder="+91 12345 67890"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="street">Street Address <span className="text-destructive">*</span></Label>
                    <Input
                      id="street"
                      required
                      placeholder="Enter your full address"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="landmark">Landmark <span className="text-destructive">*</span></Label>
                    <Input
                      id="landmark"
                      required
                      placeholder="e.g. Near Temple, Next to SBI Bank"
                      value={landmark}
                      onChange={(e) => setLandmark(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="city">City / Town / Village <span className="text-destructive">*</span></Label>
                      <Input
                        id="city"
                        required
                        placeholder="Enter your city/town name"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="district">District <span className="text-destructive">*</span></Label>
                      <Input
                        id="district"
                        required
                        placeholder="Enter your district name"
                        value={district}
                        onChange={(e) => setDistrict(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State / Province <span className="text-destructive">*</span></Label>
                      <Input
                        id="state"
                        required
                        placeholder="Enter your state name"
                        value={stateName}
                        onChange={(e) => setStateName(e.target.value)}
                        list="indian-states"
                      />
                      <datalist id="indian-states">
                        {INDIAN_STATES.map((st) => (
                          <option key={st} value={st} />
                        ))}
                      </datalist>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="zipCode" className="flex items-center justify-between">
                        <span>ZIP / Postal Code <span className="text-destructive">*</span></span>
                        {fetchingPincode && (
                          <span className="text-[10px] text-primary flex items-center gap-1 animate-pulse">
                            <Loader2 className="h-2.5 w-2.5 animate-spin" /> Fetching...
                          </span>
                        )}
                      </Label>
                      <div className="relative">
                        <Input
                          id="zipCode"
                          required
                          placeholder="Enter area pin code"
                          value={zipCode}
                          maxLength={6}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                            setIsManualInput(true);
                            setZipCode(val);
                          }}
                          className={fetchingPincode ? "pr-8" : ""}
                        />
                        {fetchingPincode && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Right Column: Order Summary & Place Order Button */}
          <div>
            <aside className="sticky top-6 h-fit rounded-2xl bg-secondary/50 p-6">
              <h2 className="font-serif text-xl text-foreground mb-4">Summary</h2>
              <dl className="space-y-2 text-sm mb-6">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-foreground">{formatPrice(subtotal)}</span>
                </div>
                {appliedCoupon && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                    <span>
                      Discount ({appliedCoupon} - {
                        availableCoupons.find(c => c.code.toUpperCase() === appliedCoupon.toUpperCase())?.discount || 0
                      }%)
                    </span>
                    <span>-{formatPrice(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">Free</span>
                </div>
              </dl>

              {/* Coupon Form */}
              <div className="mb-6 border-t border-border/70 pt-4">
                <Label htmlFor="coupon-input" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
                  Promo / Coupon Code
                </Label>
                {appliedCoupon ? (
                  <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5">
                    <div className="text-sm">
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                        {appliedCoupon} ({
                          availableCoupons.find(c => c.code.toUpperCase() === appliedCoupon.toUpperCase())?.discount || 0
                        }% off)
                      </span>
                      <span className="text-xs text-muted-foreground ml-1.5 font-normal">applied</span>
                    </div>
                    <button
                      onClick={handleRemoveCoupon}
                      className="text-xs text-destructive hover:underline font-medium cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      id="coupon-input"
                      placeholder="e.g. SABARA15"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      className="bg-background/80 rounded-full h-10 text-sm"
                    />
                    <Button
                      onClick={handleApplyCoupon}
                      variant="outline"
                      className="rounded-full px-5 h-10 text-sm cursor-pointer"
                    >
                      Apply
                    </Button>
                  </div>
                )}
              </div>

              <div className="mt-4 flex justify-between border-t border-border/70 pt-4 text-base mb-6">
                <span className="text-foreground font-medium">Total</span>
                <span className="font-serif text-xl text-foreground font-bold">
                  {formatPrice(subtotal - discount)}
                </span>
              </div>
              {!user ? (
                <Button asChild className="w-full rounded-full py-6 text-base font-medium transition-transform active:scale-[0.98]">
                  <Link to="/login" search={{ redirect: "/cart" }}>
                    Sign In to Place Order
                  </Link>
                </Button>
              ) : (
                <Button
                  type="submit"
                  form="checkout-form"
                  disabled={busy || detailed.length === 0}
                  className="w-full rounded-full py-6 text-base font-medium transition-transform active:scale-[0.98]"
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Placing Order...
                    </>
                  ) : (
                    "Place Order"
                  )}
                </Button>
              )}
              <Link
                to="/shop"
                className="mt-4 block text-center text-xs text-muted-foreground hover:text-foreground"
              >
                Continue shopping
              </Link>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}
