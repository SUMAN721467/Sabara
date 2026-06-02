import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Minus, Plus, X, Loader2, CheckCircle2, Info } from "lucide-react";
import { toast } from "sonner";
import { formatPrice, useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INDIAN_STATES, fetchDistrictAndStateFromPincode } from "@/lib/pincode";
import { useShippingSettings } from "@/lib/settings";



export const Route = createFileRoute("/cart")({
  component: CartPage,
  head: () => ({ meta: [{ title: "Cart · Sabara" }] }),
});

function CartPage() {
  const { detailed, subtotal, setQty, remove, clear } = useCart();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Load Razorpay Script dynamically
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // Checkout states
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<any | null>(null);
  const [checkoutStep, setCheckoutStep] = useState(1);
  const { settings: shippingSettings } = useShippingSettings();

  // Form fields
  const [fullName, setFullName] = useState("");

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

  // Auto-redirect to My Orders tab in Account page after successful checkout
  useEffect(() => {
    if (orderSuccess) {
      const timer = setTimeout(() => {
        navigate({ to: "/account", search: { tab: "orders" } });
      }, 5000); // 5 seconds to read receipt/details
      return () => clearTimeout(timer);
    }
  }, [orderSuccess, navigate]);

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
              
              if (p.address.street) {
                setCheckoutStep(2);
              }
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

    if (!(window as any).Razorpay) {
      toast.error("Razorpay SDK is not loaded. Please check your internet connection.");
      return;
    }

    setBusy(true);
    setCheckoutStep(3);
    let dbOrder: any = null;

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
        total: subtotal - discount + FEES,
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

      // 1. Create order in the local database (status: Pending)
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Checkout failed");
      
      dbOrder = json.order;

      // 2. Create order in Razorpay (via backend API)
      const amountPaise = Math.round(Number(dbOrder.total) * 100);
      const razorpayOrderRes = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountPaise,
          currency: "INR",
          receipt: dbOrder.orderNumber
        })
      });

      const razorpayOrderJson = await razorpayOrderRes.json();
      if (!razorpayOrderRes.ok || !razorpayOrderJson.success) {
        // Revert database order/stock if Razorpay order creation fails
        await fetch("/api/cancel-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: dbOrder.id, reason: "Razorpay order creation failed" })
        });
        throw new Error(razorpayOrderJson.error || "Failed to initiate payment gateway.");
      }

      // 3. Launch Razorpay payment modal
      const razorpayKeyId = razorpayOrderJson.key_id;
      if (!razorpayKeyId) {
        throw new Error("Razorpay Key ID is not configured on the server.");
      }

      const options = {
        key: razorpayKeyId,
        amount: razorpayOrderJson.amount,
        currency: razorpayOrderJson.currency,
        name: "Sabara",
        description: `Order ${dbOrder.orderNumber}`,
        order_id: razorpayOrderJson.order_id,
        handler: async function (response: any) {
          setBusy(true);
          try {
            const verifyRes = await fetch("/api/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                orderId: dbOrder.id,
                origin: window.location.origin
              })
            });

            const verifyJson = await verifyRes.json();
            if (!verifyRes.ok || !verifyJson.success) {
              throw new Error(verifyJson.error || "Payment verification failed.");
            }

            setOrderSuccess(dbOrder);
            clear();
            toast.success("Payment verified and order placed successfully!");
          } catch (verifyErr: any) {
            toast.error((verifyErr.message || "Payment verification failed. Please contact support.") + " If any money was debited, it will be refunded automatically.");
          } finally {
            setBusy(false);
          }
        },
        prefill: {
          name: fullName,
          email: email,
          contact: phone
        },
        theme: {
          color: "#c49a6c"
        },
        modal: {
          ondismiss: async function () {
            setBusy(true);
            try {
              await fetch("/api/cancel-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderId: dbOrder.id, reason: "Payment cancelled by user" })
              });
              setCheckoutStep(2);
              toast.error("Payment cancelled. Your order has not been placed. If any money was debited from your account, it will be refunded automatically.");
            } catch (cancelErr) {
              console.error("Error cancelling order:", cancelErr);
            } finally {
              setBusy(false);
            }
          }
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", async function (response: any) {
        console.error("Payment failed:", response.error);
        setBusy(true);
        try {
          await fetch("/api/cancel-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: dbOrder.id,
              reason: `Payment failed: ${response.error.description || "Unknown error"}`
            })
          });
          setCheckoutStep(2);
          toast.error(`Payment failed: ${response.error.description || "Transaction failed"}. If any money was debited, it will be refunded automatically.`);
        } catch (cancelErr) {
          console.error("Error cancelling failed order:", cancelErr);
        } finally {
          setBusy(false);
        }
      });
      rzp.open();

    } catch (err: any) {
      setCheckoutStep(2);
      toast.error(err.message || "Something went wrong during checkout.");
    } finally {
      // Set busy to false only if we did NOT proceed to payment window
      if (!dbOrder) {
        setBusy(false);
      }
    }
  };

  if (orderSuccess) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <div className="flex justify-center mb-6">
          <CheckCircle2 className="h-16 w-16 text-emerald-500 animate-pulse" />
        </div>
        <h1 className="font-serif text-3xl mb-2 text-foreground">Payment Success! Order Pending</h1>
        <p className="text-muted-foreground mb-8">
          Your order <span className="font-mono font-medium text-foreground">{orderSuccess.orderNumber}</span> has been placed successfully. We are redirecting you to your order history tab...
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
        <div className="flex flex-col gap-3">
          <Button onClick={() => navigate({ to: "/account", search: { tab: "orders" } })} className="rounded-full px-8 py-6 text-base">
            Go to My Orders Now
          </Button>
          <span className="text-xs text-muted-foreground animate-pulse">
            Redirecting automatically in a few seconds...
          </span>
        </div>
      </div>
    );
  }

  const totalMRP = detailed.reduce((sum, line) => {
    const original = line.product.original_price || Math.round(line.product.price * 1.45);
    return sum + original * line.qty;
  }, 0);
  const totalDiscount = totalMRP - (subtotal - discount);
  const totalAmount = subtotal - discount + FEES;

  const getDeliveryDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 4);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-14 sm:px-6 md:pt-8 md:pb-16">
      <h1 className="font-serif text-3xl text-foreground md:text-4xl mb-6 text-center sm:text-left">Checkout</h1>

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
        <div className="space-y-6">
          {/* Stepper Header */}
          <div className="max-w-xl mx-auto mb-8">
            <div className="flex items-center justify-between relative">
              {/* Horizontal connecting lines */}
              <div className="absolute left-[10%] right-[10%] top-5 h-0.5 bg-gray-200 z-0" />
              <div 
                className="absolute left-[10%] top-5 h-0.5 bg-primary transition-all duration-300 z-0" 
                style={{ width: checkoutStep === 3 ? '80%' : checkoutStep === 2 ? '40%' : '0%' }}
              />

              {/* Step 1: Address */}
              <button 
                type="button"
                onClick={() => {
                  if (street) setCheckoutStep(1);
                }}
                disabled={!street}
                className="relative z-10 flex flex-col items-center gap-2 group cursor-pointer focus:outline-none"
              >
                <div className={`h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 font-semibold ${
                  checkoutStep > 1 
                    ? 'border-primary bg-white text-primary' 
                    : 'border-primary bg-primary text-primary-foreground'
                }`}>
                  {checkoutStep > 1 ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : '1'}
                </div>
                <span className={`text-xs sm:text-sm font-medium ${
                  checkoutStep > 1 ? 'text-muted-foreground' : 'text-foreground font-bold'
                }`}>Address</span>
              </button>

              {/* Step 2: Order Summary */}
              <button
                type="button"
                onClick={() => {
                  if (fullName && email && phone && street && landmark && city && district && stateName && zipCode && zipCode.length === 6) {
                    setCheckoutStep(2);
                  }
                }}
                disabled={!(fullName && email && phone && street && landmark && city && district && stateName && zipCode && zipCode.length === 6)}
                className="relative z-10 flex flex-col items-center gap-2 group focus:outline-none"
              >
                <div className={`h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 font-semibold ${
                  checkoutStep === 2 
                    ? 'border-primary bg-primary text-primary-foreground' 
                    : checkoutStep > 2 
                      ? 'border-primary bg-white text-primary'
                      : 'border-border bg-muted text-muted-foreground'
                }`}>
                  {checkoutStep > 2 ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : '2'}
                </div>
                <span className={`text-xs sm:text-sm font-medium ${
                  checkoutStep === 2 ? 'text-foreground font-bold' : 'text-muted-foreground'
                }`}>Order Summary</span>
              </button>

              {/* Step 3: Payment */}
              <div className="relative z-10 flex flex-col items-center gap-2">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 font-semibold ${
                  checkoutStep === 3 
                    ? 'border-primary bg-primary text-primary-foreground' 
                    : 'border-border bg-muted text-muted-foreground'
                }`}>
                  3
                </div>
                <span className={`text-xs sm:text-sm font-medium ${
                  checkoutStep === 3 ? 'text-foreground font-bold' : 'text-muted-foreground'
                }`}>Payment</span>
              </div>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1fr_400px] w-full">
            {/* Left Column: Form or Summary depending on checkoutStep */}
            <div className="space-y-8 w-full min-w-0">
              {checkoutStep === 1 ? (
                /* Step 1: Address Form */
                <div>
                  <div className="flex flex-col mb-6">
                    <h2 className="font-serif text-2xl text-left">1. Shipping & Delivery Address</h2>
                    <p className="text-xs text-muted-foreground mt-1 text-left">
                      Please enter your shipping address details. All fields are mandatory.
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
                    <div className="space-y-6 rounded-xl border bg-card p-6 shadow-sm">
                      <div className="grid gap-4 sm:grid-cols-2 text-left">
                        <div className="space-y-2">
                          <Label htmlFor="fullName">Full Name <span className="text-destructive">*</span></Label>
                          <Input
                            id="fullName"
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
                            placeholder="abcd@gmail.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-2 text-left">
                        <Label htmlFor="phone">Phone Number <span className="text-destructive">*</span></Label>
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="+91 12345 67890"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2 text-left">
                        <Label htmlFor="street">Street Address <span className="text-destructive">*</span></Label>
                        <Input
                          id="street"
                          placeholder="Enter your full address"
                          value={street}
                          onChange={(e) => setStreet(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2 text-left">
                        <Label htmlFor="landmark">Landmark <span className="text-destructive">*</span></Label>
                        <Input
                          id="landmark"
                          placeholder="e.g. Near Temple, Next to SBI Bank"
                          value={landmark}
                          onChange={(e) => setLandmark(e.target.value)}
                        />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2 text-left">
                        <div className="space-y-2">
                          <Label htmlFor="city">City / Town / Village <span className="text-destructive">*</span></Label>
                          <Input
                            id="city"
                            placeholder="Enter your city/town name"
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="district">District <span className="text-destructive">*</span></Label>
                          <Input
                            id="district"
                            placeholder="Enter your district name"
                            value={district}
                            onChange={(e) => setDistrict(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="state">State / Province <span className="text-destructive">*</span></Label>
                          <Input
                            id="state"
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

                      <div className="pt-4 flex justify-end">
                        <Button 
                          type="button" 
                          onClick={async () => {
                            if (!fullName || !email || !phone.trim() || !street.trim() || !landmark.trim() || !city.trim() || !district.trim() || !stateName.trim() || !zipCode.trim()) {
                              toast.error("Please fill in all shipping details. All fields are mandatory.");
                              return;
                            }
                            if (zipCode.length !== 6) {
                              toast.error("ZIP / Postal Code must be exactly 6 digits.");
                              return;
                            }

                            // Save address to profile in background (upsert to Supabase via backend profile endpoint)
                            try {
                              const { data } = await supabase.auth.getSession();
                              const token = data?.session?.access_token;
                              if (token) {
                                await fetch("/api/users/profile", {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                    Authorization: `Bearer ${token}`
                                  },
                                  body: JSON.stringify({
                                    fullName,
                                    phone,
                                    address: { street, city, district, state: stateName, zipCode, landmark }
                                  })
                                });
                              }
                            } catch (err) {
                              console.error("Failed to auto-save address:", err);
                            }

                            setCheckoutStep(2);
                          }}
                          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-[4px] py-6 text-base font-bold transition-all shadow-sm uppercase tracking-wider"
                        >
                          Use This Address & Continue
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Step 2: Order Summary & Review Items */
                <div className="space-y-6">
                  {/* Address Summary Card */}
                  <div className="rounded-lg border border-[#e0e0e0] bg-white p-4 sm:p-6 shadow-sm flex justify-between items-start gap-3 sm:gap-4 text-left">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Deliver to:</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-bold text-[13px] sm:text-[15px] text-foreground">{fullName}</span>
                      </div>
                      <p className="text-[12px] sm:text-[14px] text-foreground mt-1 leading-relaxed break-words">
                        {street}, {landmark ? `${landmark}, ` : ""}{city}{district ? `, ${district}` : ""}, {stateName} - <span className="font-semibold">{zipCode}</span>
                      </p>
                      <p className="text-[12px] sm:text-[14px] text-foreground mt-2 font-medium break-all">
                        {phone}
                      </p>
                      <p className="text-[12px] sm:text-[14px] text-foreground mt-0.5 font-medium break-all">
                        {email}
                      </p>
                    </div>
                    <button 
                      onClick={() => setCheckoutStep(1)}
                      className="border border-primary/20 text-primary bg-white rounded-[4px] px-3 py-1 sm:px-5 sm:py-1.5 text-xs sm:text-sm font-semibold hover:shadow-sm cursor-pointer shrink-0 transition-all hover:bg-primary/5"
                    >
                      Change
                    </button>
                  </div>

                  {/* Review items block */}
                  <div className="bg-white border border-[#e0e0e0] rounded-lg p-4 sm:p-6 shadow-sm">
                    <h3 className="font-serif text-xl sm:text-2xl mb-4 sm:mb-6 text-left">2. Review Items</h3>
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
                                  className="inline-flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
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
                                  className="inline-flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
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
                                  className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer p-1"
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
              )}
            </div>

            {/* Right Column: Order Summary & Action Buttons */}
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
                        className="flex-1 min-w-0 bg-background/80 rounded-full h-9 sm:h-10 text-xs sm:text-sm border-border"
                      />
                      <Button
                        onClick={handleApplyCoupon}
                        variant="outline"
                        className="rounded-full px-4 sm:px-5 h-9 sm:h-10 text-xs sm:text-sm cursor-pointer border-primary text-primary hover:bg-primary/5"
                      >
                        Apply
                      </Button>
                    </div>
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

                {checkoutStep === 1 ? (
                  <Button
                    onClick={() => {
                      if (!fullName || !email || !phone.trim() || !street.trim() || !landmark.trim() || !city.trim() || !district.trim() || !stateName.trim() || !zipCode.trim()) {
                        toast.error("Please fill in all shipping details. All fields are mandatory.");
                        return;
                      }
                      if (zipCode.length !== 6) {
                        toast.error("ZIP / Postal Code must be exactly 6 digits.");
                        return;
                      }
                      setCheckoutStep(2);
                    }}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-[4px] py-4 sm:py-6 text-sm sm:text-base font-bold transition-all uppercase tracking-wider shadow-sm"
                  >
                    Proceed to Summary
                  </Button>
                ) : null}
              </aside>

              {/* Continuing Bottom Bar under the price details inside the right column */}
              {checkoutStep === 2 && (
                <div className="bg-white border border-[#e0e0e0] rounded-lg p-3 sm:p-4 flex items-center justify-between shadow-sm sticky bottom-4 z-20 w-full">
                  <div className="flex items-center gap-1">
                    <span className="text-lg sm:text-xl font-bold text-foreground font-serif">{formatPrice(totalAmount)}</span>
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <Button
                    onClick={handleCheckout}
                    disabled={busy || detailed.length === 0}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-[4px] px-6 py-4 sm:px-10 sm:py-5 text-xs sm:text-sm font-bold uppercase tracking-wider transition-all shadow-sm flex items-center justify-center min-w-[120px] sm:min-w-[150px]"
                  >
                    {busy ? (
                      <>
                        <Loader2 className="h-4.5 w-4.5 mr-1.5 animate-spin" /> Placing...
                      </>
                    ) : (
                      "Pay Now"
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
