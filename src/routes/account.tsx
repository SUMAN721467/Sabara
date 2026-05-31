import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, MapPin, Loader2, Lock, Camera, Trash2, ShoppingBag, ChevronDown, ChevronUp, Truck, Info } from "lucide-react";
import { formatPrice } from "@/lib/cart";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { INDIAN_STATES, fetchDistrictAndStateFromPincode } from "@/lib/pincode";



export const Route = createFileRoute("/account")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      tab: (search.tab as string) || "profile",
    };
  },
  component: AccountPage,
  head: () => ({
    meta: [
      { title: "Sabara - Woven with Tradition" },
      { name: "description", content: "Manage your Sabara account." },
    ],
  }),
});

const getStoragePathFromUrl = (url: string, bucketName: string = "product-images"): string | null => {
  if (!url) return null;
  const marker = `/${bucketName}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  const pathWithQuery = url.substring(index + marker.length);
  return pathWithQuery.split("?")[0];
};

const getProductNamesString = (items: any[]) => {
  if (!items || !items.length) return "Order";
  const names = items.map((item) => item.productName || "Product");
  if (names.length <= 1) return names[0];
  return `${names[0]} (+ ${names.length - 1} other${names.length - 1 > 1 ? "s" : ""})`;
};

function AccountPage() {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const activeTab = search.tab || "profile";

  const handleTabChange = (val: string) => {
    navigate({
      to: "/account",
      search: { tab: val }
    });
  };
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Orders states
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<string | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState("");
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [orderToReturn, setOrderToReturn] = useState<string | null>(null);
  const [returnReasonInput, setReturnReasonInput] = useState("");
  const [returningId, setReturningId] = useState<string | null>(null);

  // Refs
  const avatarFileRef = useRef<HTMLInputElement>(null);

  // Form states
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
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


  // ─── Redirect unauthenticated users AFTER auth resolves ───────────────────
  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/login" });
    }
  }, [authLoading, user, navigate]);

  // ─── Fetch profile once the user is confirmed ─────────────────────────────
  useEffect(() => {
    if (!user) return;

    setProfileLoading(true);
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
            setAge(p.age !== undefined && p.age !== null ? String(p.age) : "");
            setPhone(p.phone || "");
            if (p.address) {
              setStreet(p.address.street || "");
              setCity(p.address.city || "");
              setDistrict(p.address.district || "");
              setStateName(p.address.state || "");
              setZipCode(p.address.zipCode || "");
              setLandmark(p.address.landmark || "");
            }

            // Sync database avatar_url to auth user metadata if they differ
            if (p.avatarUrl && p.avatarUrl !== user.user_metadata?.avatar_url) {
              supabase.auth.updateUser({
                data: { avatar_url: p.avatarUrl }
              }).catch(err => console.error("Error syncing avatar to auth metadata:", err));
            } else if (!p.avatarUrl && user.user_metadata?.avatar_url) {
              // Database is missing the avatar url but auth metadata has it, sync to database!
              supabase
                .from("user_profiles")
                .update({ avatar_url: user.user_metadata.avatar_url })
                .eq("id", user.id)
                .catch(err => console.error("Error syncing avatar to database:", err));
            }
          }
        })
        .catch((err) => {
          console.error("Error fetching profile:", err);
        })
        .finally(() => setProfileLoading(false));
    });
  }, [user]);

  const fetchOrders = async () => {
    if (!user) return;
    setOrdersLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) return;

      const res = await fetch("/api/users/orders", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        setOrders(json.orders || []);
      }
    } catch (err) {
      console.error("Error fetching orders:", err);
    } finally {
      setOrdersLoading(false);
    }
  };

  // ─── Fetch orders once the user is confirmed ─────────────────────────────
  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user]);

  const handleCancelOrder = async () => {
    if (!orderToCancel) return;

    setCancellingId(orderToCancel);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) {
        toast.error("You must be logged in to cancel your order.");
        return;
      }

      const res = await fetch("/api/users/orders", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orderId: orderToCancel, reason: cancelReasonInput }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success("Order cancelled successfully.");
        setCancelDialogOpen(false);
        setOrderToCancel(null);
        setCancelReasonInput("");
        await fetchOrders();
      } else {
        throw new Error(json.error || "Failed to cancel order");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel order. Please try again.");
    } finally {
      setCancellingId(null);
    }
  };

  const handleReturnOrder = async () => {
    if (!orderToReturn) return;

    setReturningId(orderToReturn);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) {
        toast.error("You must be logged in to return your order.");
        return;
      }

      const res = await fetch("/api/users/orders", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          orderId: orderToReturn, 
          action: "return", 
          reason: returnReasonInput 
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success("Return request submitted successfully.");
        setReturnDialogOpen(false);
        setOrderToReturn(null);
        setReturnReasonInput("");
        await fetchOrders();
      } else {
        throw new Error(json.error || "Failed to submit return request");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to submit return request. Please try again.");
    } finally {
      setReturningId(null);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
    navigate({ to: "/" });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `avatars/${user.id}-${Date.now()}.${ext}`;

      // Upload image to the Supabase storage bucket 'product-images'
      const { error: uploadErr } = await supabase.storage
        .from("product-images")
        .upload(path, file, { cacheControl: "3600", upsert: true });

      if (uploadErr) {
        throw new Error(uploadErr.message);
      }

      // Get public URL
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      const publicUrl = data.publicUrl;

      // Clean up old avatar image from storage if it exists
      const oldAvatarUrl = profile?.avatarUrl || user.user_metadata?.avatar_url || null;
      if (oldAvatarUrl) {
        const oldPath = getStoragePathFromUrl(oldAvatarUrl, "product-images");
        if (oldPath) {
          try {
            await supabase.storage.from("product-images").remove([oldPath]);
          } catch (delErr) {
            console.error("Failed to delete old avatar from storage:", delErr);
          }
        }
      }

      // Update Supabase auth user metadata so the Navbar dropdown updates immediately
      const { error: updateErr } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
      });

      if (updateErr) {
        throw new Error(updateErr.message);
      }

      // Also save to user_profiles table in the database
      const { error: dbErr } = await supabase
        .from("user_profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);

      if (dbErr) {
        console.error("Failed to save avatar to database:", dbErr);
      }

      // Update local profile state
      setProfile((prev: any) => prev ? { ...prev, avatarUrl: publicUrl } : { avatarUrl: publicUrl });

      toast.success("Profile picture updated successfully!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to upload profile picture.");
    } finally {
      setUploadingAvatar(false);
      if (avatarFileRef.current) avatarFileRef.current.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    setUploadingAvatar(true);
    try {
      // Clean up old avatar image from storage if it exists
      const oldAvatarUrl = profile?.avatarUrl || user.user_metadata?.avatar_url || null;
      if (oldAvatarUrl) {
        const oldPath = getStoragePathFromUrl(oldAvatarUrl, "product-images");
        if (oldPath) {
          try {
            await supabase.storage.from("product-images").remove([oldPath]);
          } catch (delErr) {
            console.error("Failed to delete avatar from storage:", delErr);
          }
        }
      }

      const { error } = await supabase.auth.updateUser({
        data: { avatar_url: null }
      });
      if (error) throw error;

      // Also remove from user_profiles table in the database
      const { error: dbErr } = await supabase
        .from("user_profiles")
        .update({ avatar_url: null })
        .eq("id", user.id);

      if (dbErr) {
        console.error("Failed to remove avatar from database:", dbErr);
      }

      // Update local profile state
      setProfile((prev: any) => prev ? { ...prev, avatarUrl: null } : null);

      toast.success("Profile picture removed.");
    } catch (err: any) {
      toast.error(err.message || "Failed to remove profile picture.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);

    try {
      if (!phone || !phone.trim()) {
        toast.error("Phone / Mobile Number is mandatory.");
        setSavingProfile(false);
        return;
      }

      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) {
        toast.error("You must be logged in to update your profile.");
        return;
      }

      const response = await fetch("/api/users/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fullName,
          age: age === "" ? "" : Number(age),
          phone,
          avatarUrl: profile?.avatarUrl || user.user_metadata?.avatar_url || null,
          address: {
            street,
            city,
            district,
            state: stateName,
            zipCode,
            landmark,
          },
        }),
      });

      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error || "Failed to save profile details");
      }

      // Update Supabase auth user metadata so the Navbar dropdown updates immediately
      try {
        await supabase.auth.updateUser({
          data: { full_name: fullName }
        });
      } catch (authErr) {
        console.error("Failed to update auth metadata:", authErr);
      }

      setProfile(json.profile);
      toast.success("Profile details updated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Something went wrong.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!street.trim() || !landmark.trim() || !city.trim() || !district.trim() || !stateName.trim() || !zipCode.trim()) {
      toast.error("All shipping address fields are mandatory.");
      return;
    }

    if (zipCode.length !== 6) {
      toast.error("ZIP / Postal Code must be exactly 6 digits.");
      return;
    }

    setSavingAddress(true);


    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) {
        toast.error("You must be logged in to update your address.");
        return;
      }

      const response = await fetch("/api/users/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fullName,
          age: age === "" ? "" : Number(age),
          phone,
          avatarUrl: profile?.avatarUrl || user.user_metadata?.avatar_url || null,
          address: {
            street,
            city,
            district,
            state: stateName,
            zipCode,
            landmark,
          },
        }),
      });

      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error || "Failed to save shipping address");
      }

      setProfile(json.profile);
      toast.success("Shipping address updated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Something went wrong.");
    } finally {
      setSavingAddress(false);
    }
  };

  const toggleOrder = (orderId: string) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Pending":
        return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20";
      case "Shipped":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20";
      case "Delivered":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20";
      case "Cancelled":
      case "Cancelled by Customer":
      case "Cancelled by Seller":
        return "bg-destructive/10 text-destructive border border-destructive/20";
      case "Return Requested":
        return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20";
      case "Return Approved":
        return "bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20";
      case "Return Rejected":
        return "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20";
      default:
        return "bg-secondary text-secondary-foreground border border-secondary/20";
    }
  };

  // ─── While auth is still loading, show a spinner ─────────────────────────
  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
      </div>
    );
  }

  // ─── Not logged in (redirect will fire from useEffect above) ─────────────
  if (!user) return null;

  const initials = fullName
    ? fullName
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <div className="mb-10">
        <h1 className="font-serif text-4xl text-foreground">My Account</h1>
        <p className="text-muted-foreground mt-1">
          Manage your personal profile, track orders, and edit delivery addresses.
        </p>
      </div>

      {profileLoading ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/80 bg-card p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Loading your account details...</p>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 p-1.5 h-12 bg-secondary/60 rounded-xl border border-border/40">
            <TabsTrigger
              value="profile"
              className="rounded-lg py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <User className="h-4 w-4" />
              Profile Details
            </TabsTrigger>
            <TabsTrigger
              value="address"
              className="rounded-lg py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <MapPin className="h-4 w-4" />
              Shipping Address
            </TabsTrigger>
            <TabsTrigger
              value="orders"
              className="rounded-lg py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <ShoppingBag className="h-4 w-4" />
              My Orders
            </TabsTrigger>
          </TabsList>

          {/* ── PROFILE DETAILS TAB ────────────────────────────────────────── */}
          <TabsContent value="profile" className="focus-visible:ring-0 focus-visible:ring-offset-0 animate-in fade-in-50 duration-200">
            <div className="rounded-2xl border border-border/60 bg-card p-6 sm:p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border/40">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-serif text-foreground">Personal Information</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Update your display name, age, and phone number.
                  </p>
                </div>
              </div>

              {/* Profile Photo Uploader */}
              <div className="flex flex-col items-center sm:flex-row gap-6 mb-8 pb-6 border-b border-border/40">
                <div className="relative">
                  {user.user_metadata?.avatar_url ? (
                    <img
                      src={user.user_metadata.avatar_url}
                      alt={fullName || "User Avatar"}
                      className="h-24 w-24 rounded-full object-cover border-2 border-border shadow-sm"
                    />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20 text-3xl font-serif font-bold">
                      {initials}
                    </div>
                  )}
                  {uploadingAvatar && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-full">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="font-medium text-foreground text-center sm:text-left">Profile Photo</h3>
                  <p className="text-xs text-muted-foreground text-center sm:text-left">
                    PNG, JPG or WEBP. Max 2MB.
                  </p>
                  <div className="flex gap-2 justify-center sm:justify-start">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadingAvatar}
                      onClick={() => avatarFileRef.current?.click()}
                      className="rounded-full px-4"
                    >
                      <Camera className="h-3.5 w-3.5 mr-1.5" />
                      Change Photo
                    </Button>
                    {user.user_metadata?.avatar_url && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={uploadingAvatar}
                        onClick={handleRemoveAvatar}
                        className="rounded-full px-4 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                        Remove
                      </Button>
                    )}
                  </div>
                  <input
                    type="file"
                    ref={avatarFileRef}
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                </div>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="max-w-md"
                  />
                </div>

                <div className="grid gap-6 sm:grid-cols-2 max-w-md">
                  <div className="space-y-2">
                    <Label htmlFor="age">Age</Label>
                    <Input
                      id="age"
                      type="number"
                      placeholder="e.g. 28"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone / Mobile Number <span className="text-destructive">*</span></Label>
                    <Input
                      id="phone"
                      type="tel"
                      required
                      placeholder="+91 12345 67890"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2 max-w-md">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="email" className="text-muted-foreground">Email Address</Label>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Lock className="h-3 w-3" /> Cannot be edited
                    </span>
                  </div>
                  <Input
                    id="email"
                    type="email"
                    disabled
                    value={user.email || ""}
                    className="bg-secondary/40 text-muted-foreground cursor-not-allowed border-dashed"
                  />
                </div>

                <div className="pt-2">
                  <Button type="submit" disabled={savingProfile} className="rounded-full px-6 py-5">
                    {savingProfile ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving Changes...
                      </>
                    ) : (
                      "Save Profile Details"
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </TabsContent>

          {/* ── SHIPPING ADDRESS TAB ───────────────────────────────────────── */}
          <TabsContent value="address" className="focus-visible:ring-0 focus-visible:ring-offset-0 animate-in fade-in-50 duration-200">
            <div className="rounded-2xl border border-border/60 bg-card p-6 sm:p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border/40">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-serif text-foreground">Shipping Details</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Add or update your address for smooth checkout deliveries. <span className="font-semibold text-destructive dark:text-red-400 block sm:inline mt-1 sm:mt-0 sm:ml-1">(All fields are mandatory)</span>
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveAddress} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="street">Street Address <span className="text-destructive">*</span></Label>
                  <Input
                    id="street"
                    required
                    placeholder="House number, apartment, street name"
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

                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="city">City / Town / Village <span className="text-destructive">*</span></Label>
                    <Input
                      id="city"
                      required
                      placeholder="e.g. Kharagpur"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="district">District <span className="text-destructive">*</span></Label>
                    <Input
                      id="district"
                      required
                      placeholder="e.g. Paschim Medinipur"
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="state">State / Province <span className="text-destructive">*</span></Label>
                    <Input
                      id="state"
                      required
                      placeholder="e.g. West Bengal"
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
                        placeholder="e.g. 400001"
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

                {/* Display Current Address Card if populated */}
                {profile?.address?.street && (
                  <div className="mt-6 rounded-xl border border-border/50 bg-secondary/20 p-4">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Active Shipping Address
                    </h3>
                    <div className="text-sm space-y-1 text-foreground">
                      <p className="font-medium">{fullName}</p>
                      <p>{street}</p>
                      {profile?.address?.landmark && (
                        <p className="text-xs text-muted-foreground">Landmark: {profile.address.landmark}</p>
                      )}
                      <p>
                        {city}{profile?.address?.district ? `, ${profile.address.district}` : ""}, {stateName} {zipCode}
                      </p>
                      {phone && <p className="text-muted-foreground text-xs mt-1">Phone: {phone}</p>}
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <Button type="submit" disabled={savingAddress} className="rounded-full px-6 py-5">
                    {savingAddress ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving Address...
                      </>
                    ) : (
                      "Save Shipping Address"
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </TabsContent>

          {/* ── MY ORDERS TAB ─────────────────────────────────────────────── */}
          <TabsContent value="orders" className="focus-visible:ring-0 focus-visible:ring-offset-0 animate-in fade-in-50 duration-200">
            <div className="rounded-2xl border border-border/60 bg-card p-6 sm:p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border/40">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ShoppingBag className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-serif text-foreground">Order History</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    View and track all orders you have placed with us.
                  </p>
                </div>
              </div>

              {ordersLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground text-sm">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  Loading your orders...
                </div>
              ) : orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 rounded-xl border border-dashed border-border/70 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground mb-4">
                    <ShoppingBag className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground">No orders found</h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                    You haven't placed any orders yet. Once you make a purchase, it will appear here.
                  </p>
                  <Button
                    onClick={() => navigate({ to: "/shop" })}
                    className="mt-6 rounded-full px-6 py-2 text-sm font-medium"
                  >
                    Start Shopping
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => {
                    const isExpanded = expandedOrders.has(order.id);
                    const formattedDate = new Date(order.date).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    });

                    return (
                      <div
                        key={order.id}
                        className="rounded-xl border border-border bg-card shadow-sm overflow-hidden transition-all"
                      >
                        {/* Summary Header */}
                        <div
                          onClick={() => toggleOrder(order.id)}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-5 gap-4 cursor-pointer hover:bg-secondary/10 transition-colors"
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-serif text-base font-bold text-foreground">
                                {getProductNamesString(order.items)}
                              </span>
                              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide ${
                                order.customerStatus === "Cancelled by Customer" 
                                  ? getStatusColor("Cancelled by Customer") 
                                  : (order.customerStatus && order.customerStatus !== "Pending")
                                    ? getStatusColor(order.customerStatus)
                                    : getStatusColor(order.status)
                              }`}>
                                {order.customerStatus === "Cancelled by Customer" 
                                  ? "Cancelled by Customer" 
                                  : (order.customerStatus && order.customerStatus !== "Pending")
                                    ? order.customerStatus
                                    : order.status}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span>ID: <span className="font-mono">{order.orderNumber}</span></span>
                              <span className="text-muted-foreground/30">•</span>
                              <span>Placed on {formattedDate}</span>
                            </p>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-6">
                            <div className="text-right">
                              <span className="text-xs text-muted-foreground block uppercase tracking-wider">Total</span>
                              <span className="font-serif font-bold text-lg text-primary">
                                {formatPrice(order.total)}
                              </span>
                            </div>
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/60 hover:bg-secondary transition-colors text-muted-foreground">
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Detailed Items & Shipping (Collapsible) */}
                        {isExpanded && (
                          <div className="border-t border-border bg-secondary/10 px-5 py-6 space-y-6 animate-in slide-in-from-top-2 duration-200">
                            {/* Courier Tracking Banner */}
                            {order.courier && order.trackingNumber && (
                              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-1 duration-300">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                    <Truck className="h-5 w-5" />
                                  </div>
                                  <div>
                                    <h4 className="font-serif text-sm font-semibold text-foreground">Package Dispatched</h4>
                                    <p className="text-xs text-muted-foreground">
                                      Your order is in transit with <span className="font-semibold text-foreground">{order.courier}</span>.
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 bg-card border px-4 py-1.5 rounded-full text-xs">
                                  <span className="text-muted-foreground uppercase tracking-wider font-semibold">Tracking #</span>
                                  <span className="font-mono font-bold text-foreground select-all">{order.trackingNumber}</span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard.writeText(order.trackingNumber);
                                      toast.success("Tracking number copied to clipboard!");
                                    }}
                                    className="text-primary hover:underline font-medium ml-1 cursor-pointer"
                                  >
                                    Copy
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Seller Instruction Box */}
                            {order.sellerInstruction && (
                              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 animate-in fade-in slide-in-from-top-1 duration-200">
                                <h4 className="font-serif text-sm font-semibold text-foreground flex items-center gap-1.5 mb-1.5">
                                  <Info className="h-4.5 w-4.5 text-primary shrink-0" />
                                  Seller Instruction
                                </h4>
                                <p className="text-xs text-foreground/95 leading-relaxed font-medium">
                                  {order.sellerInstruction}
                                </p>
                              </div>
                            )}

                            {/* Products list */}
                            <div>
                              <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
                                Ordered Items
                              </h3>
                              <ul className="divide-y divide-border/60">
                                {order.items.map((item: any, idx: number) => (
                                  <li key={idx} className="flex gap-4 py-3 items-center first:pt-0 last:pb-0">
                                    <div className="h-14 w-12 shrink-0 overflow-hidden rounded bg-secondary">
                                      <img
                                        src={item.productImage}
                                        alt={item.productName}
                                        className="h-full w-full object-cover"
                                      />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-medium text-sm text-foreground truncate">
                                        {item.productName}
                                      </h4>
                                      <span className="text-xs text-muted-foreground block mt-0.5">
                                        Qty: {item.qty} · {formatPrice(item.price)} each
                                      </span>
                                    </div>
                                    <span className="font-mono text-sm font-semibold text-foreground">
                                      {formatPrice(item.price * item.qty)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>

                            {/* Shipping address & payment summary grid */}
                            <div className="grid gap-6 md:grid-cols-2 pt-4 border-t border-border/60">
                              <div>
                                <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                                  Delivery Address
                                </h3>
                                <div className="text-xs space-y-1 text-foreground">
                                  <p className="font-medium">{order.customerName}</p>
                                  <p>{order.shippingAddress.street}</p>
                                  <p>
                                    {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}
                                  </p>
                                  {order.customerPhone && (
                                    <p className="text-muted-foreground mt-1">Phone: {order.customerPhone}</p>
                                  )}
                                </div>
                              </div>

                              <div className="flex flex-col justify-between">
                                <div>
                                  <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                                    Payment Summary
                                  </h3>
                                  {(() => {
                                    const itemsSubtotal = order.items.reduce((sum: number, item: any) => sum + (item.price * item.qty), 0);
                                    return (
                                      <dl className="text-xs space-y-1">
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Subtotal</span>
                                          <span className="text-foreground">{formatPrice(itemsSubtotal)}</span>
                                        </div>
                                        {order.couponCode && order.discountAmount > 0 && (
                                          <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium animate-in fade-in duration-200">
                                            <span>Discount ({order.couponCode})</span>
                                            <span>-{formatPrice(order.discountAmount)}</span>
                                          </div>
                                        )}
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Shipping</span>
                                          <span className="font-medium text-emerald-600 dark:text-emerald-400">Free</span>
                                        </div>
                                        <div className="flex justify-between border-t border-border/60 pt-1.5 font-medium mt-1">
                                          <span className="text-foreground font-semibold">Total paid</span>
                                          <span className="text-primary font-bold">{formatPrice(order.total)}</span>
                                        </div>
                                      </dl>
                                    );
                                  })()}
                                </div>

                                {(() => {
                                  const orderDate = new Date(order.date);
                                  const now = new Date();
                                  const diffTime = Math.abs(now.getTime() - orderDate.getTime());
                                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                  const canReturn = diffDays <= 7 && (!order.customerStatus || order.customerStatus === "Pending");

                                  if (order.status === "Delivered" && canReturn) {
                                    return (
                                      <div className="mt-4 pt-4 border-t border-border/40 flex justify-end">
                                        <Button
                                          type="button"
                                          variant="outline"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setOrderToReturn(order.id);
                                            setReturnReasonInput("");
                                            setReturnDialogOpen(true);
                                          }}
                                          disabled={returningId !== null}
                                          className="text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10 rounded-full px-5 py-2 cursor-pointer h-9 text-xs font-semibold"
                                        >
                                          {returningId === order.id ? (
                                            <>
                                              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                              Submitting...
                                            </>
                                          ) : (
                                            "Request Return"
                                          )}
                                        </Button>
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}

                                {order.status === "Pending" && order.customerStatus !== "Cancelled by Customer" && (
                                  <div className="mt-4 pt-4 border-t border-border/40 flex justify-end">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setOrderToCancel(order.id);
                                        setCancelReasonInput("");
                                        setCancelDialogOpen(true);
                                      }}
                                      disabled={cancellingId !== null}
                                      className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20 rounded-full px-5 py-2 cursor-pointer h-9 text-xs"
                                    >
                                      {cancellingId === order.id ? (
                                        <>
                                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                          Cancelling...
                                        </>
                                      ) : (
                                        "Cancel Order"
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
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Moved Sign out button to the bottom */}
      <div className="mt-12 pt-8 border-t border-border/60 flex justify-center">
        <Button onClick={handleSignOut} variant="destructive" className="rounded-full px-8 py-5 transition-transform active:scale-[0.98]">
          Sign out
        </Button>
      </div>

      {/* Custom Cancellation Confirmation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setCancelDialogOpen(false);
          setOrderToCancel(null);
          setCancelReasonInput("");
        }
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Cancel Order</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to cancel this order? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cancellation-reason" className="text-xs font-semibold text-foreground uppercase tracking-wider block">
                Why are you cancelling? (Optional)
              </Label>
              <Textarea
                id="cancellation-reason"
                placeholder="Let us know why you are cancelling this order (e.g. ordered wrong item, change of mind)..."
                value={cancelReasonInput}
                onChange={(e) => setCancelReasonInput(e.target.value)}
                rows={3}
                className="text-xs bg-background resize-none focus-visible:ring-1"
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCancelDialogOpen(false);
                setOrderToCancel(null);
                setCancelReasonInput("");
              }}
              className="rounded-full text-xs h-9 cursor-pointer"
            >
              Go Back
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleCancelOrder}
              disabled={cancellingId !== null}
              className="rounded-full text-xs h-9 cursor-pointer"
            >
              {cancellingId !== null ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Cancelling...
                </>
              ) : (
                "Confirm Cancellation"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Return Request Confirmation Dialog */}
      <Dialog open={returnDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setReturnDialogOpen(false);
          setOrderToReturn(null);
          setReturnReasonInput("");
        }
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Request Return</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Please let us know why you would like to return this order. Returns can be requested within 7 days of delivery.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="return-reason" className="text-xs font-semibold text-foreground uppercase tracking-wider block">
                Reason for Return
              </Label>
              <Textarea
                id="return-reason"
                placeholder="Describe the reason for return (e.g. size doesn't fit, wrong item sent, defective product)..."
                value={returnReasonInput}
                onChange={(e) => setReturnReasonInput(e.target.value)}
                rows={3}
                required
                className="text-xs bg-background resize-none focus-visible:ring-1"
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setReturnDialogOpen(false);
                setOrderToReturn(null);
                setReturnReasonInput("");
              }}
              className="rounded-full text-xs h-9 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleReturnOrder}
              disabled={returningId !== null || !returnReasonInput.trim()}
              className="rounded-full text-xs h-9 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {returningId !== null ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Return Request"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
