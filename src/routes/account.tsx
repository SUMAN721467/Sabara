import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, MapPin, Loader2, Lock, Camera, Trash2, ShoppingBag, ChevronDown, ChevronUp, ChevronRight, Truck, Info, Star, ImagePlus, X, ArrowLeft, MessageSquare } from "lucide-react";
import { formatPrice } from "@/lib/cart";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { INDIAN_STATES, fetchDistrictAndStateFromPincode } from "@/lib/pincode";
import { cn } from "@/lib/utils";

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

const getOrderStatusConfig = (order: any) => {
  // 1. Cancelled
  if (order.customerStatus === "Cancelled by Customer" || order.status === "Cancelled" || order.status === "Cancelled by Seller") {
    const reason = (order.cancellationReason || "").toLowerCase();
    const isPaymentFailed = reason.includes("payment failed") || reason.includes("payment cancelled") || reason.includes("payment verification failed") || reason.includes("creation failed");
    
    if (isPaymentFailed) {
      return {
        label: "Payment Failed, Order Not Placed",
        badgeClass: "bg-destructive/10 text-destructive border border-destructive/20",
        dotClass: "bg-destructive",
      };
    }
    
    return {
      label: "Cancelled",
      badgeClass: "bg-destructive/10 text-destructive border border-destructive/20",
      dotClass: "bg-destructive",
    };
  }
  // 2. Returns
  if (order.customerStatus === "Return Requested") {
    return {
      label: "Return Requested",
      badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20",
      dotClass: "bg-purple-500",
    };
  }
  if (order.customerStatus === "Return Approved") {
    return {
      label: "Return Approved",
      badgeClass: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20",
      dotClass: "bg-gray-500",
    };
  }
  if (order.customerStatus === "Return Rejected") {
    return {
      label: "Return Rejected",
      badgeClass: "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
      dotClass: "bg-red-500",
    };
  }
  // 3. Delivered
  if (order.status === "Delivered") {
    return {
      label: "Delivered",
      badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
      dotClass: "bg-emerald-500",
    };
  }
  // 4. Shipped
  if (order.status === "Shipped") {
    return {
      label: "Shipped",
      badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
      dotClass: "bg-blue-500",
    };
  }
  // 4b. Out for Delivery
  if (order.status === "Out for Delivery") {
    return {
      label: "Out for Delivery",
      badgeClass: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20",
      dotClass: "bg-orange-500",
    };
  }
  // 5. Paid (Payment Success, but still pending shipment)
  if (order.customerStatus === "Paid" || order.status === "Paid") {
    return {
      label: "Payment Success, Order Pending",
      badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
      dotClass: "bg-emerald-500",
    };
  }
  // 6. Default Pending
  return {
    label: "Pending",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
    dotClass: "bg-amber-500",
  };
};

const getTimelineStageDates = (
  orderDateStr: string,
  shippedAt?: string | null,
  outForDeliveryAt?: string | null,
  deliveredAt?: string | null
) => {
  const orderDate = new Date(orderDateStr);
  const today = new Date();
  
  const isValidDate = (d: any) => {
    if (!d || d === "null" || d === "undefined" || d === "") return false;
    const parsed = new Date(d);
    return !isNaN(parsed.getTime());
  };

  // 1. Confirmed Date
  const confirmedDate = new Date(orderDate);
  
  // 2. Shipped Date: Use actual shippedAt date if present, otherwise fall back to 1 day after order date
  const shippedDate = isValidDate(shippedAt) ? new Date(shippedAt!) : new Date(orderDate);
  if (!isValidDate(shippedAt)) {
    shippedDate.setDate(shippedDate.getDate() + 1);
    if (shippedDate > today) {
      shippedDate.setTime(today.getTime());
    }
  }
  
  // 3. Out for Delivery Date: Use actual outForDeliveryAt date if present, otherwise fall back to 2 days after order date
  const outForDeliveryDate = isValidDate(outForDeliveryAt) ? new Date(outForDeliveryAt!) : new Date(orderDate);
  if (!isValidDate(outForDeliveryAt)) {
    outForDeliveryDate.setDate(outForDeliveryDate.getDate() + 2);
    if (outForDeliveryDate > today) {
      outForDeliveryDate.setTime(today.getTime());
    }
  }
  
  // 4. Delivered Date: Use actual deliveredAt date if present, otherwise fall back to 3 days after order date
  const deliveryDate = isValidDate(deliveredAt) ? new Date(deliveredAt!) : new Date(orderDate);
  if (!isValidDate(deliveredAt)) {
    deliveryDate.setDate(deliveryDate.getDate() + 3);
    if (deliveryDate > today) {
      deliveryDate.setTime(today.getTime());
    }
  }
  
  // 5. Return Expiry Date: 7 days after delivery date
  const returnExpiryDate = new Date(deliveryDate);
  returnExpiryDate.setDate(returnExpiryDate.getDate() + 7);
  
  return {
    confirmedDate,
    shippedDate,
    outForDeliveryDate,
    deliveryDate,
    returnExpiryDate,
  };
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

  const [selectedOrderItem, setSelectedOrderItem] = useState<{ order: any; item: any } | null>(null);

  // Reviews states
  const [userReviews, setUserReviews] = useState<any[]>([]);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewProduct, setReviewProduct] = useState<any | null>(null);
  const [reviewOrderId, setReviewOrderId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewHoverRating, setReviewHoverRating] = useState<number | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [selectedReviewPhotos, setSelectedReviewPhotos] = useState<File[]>([]);
  const [reviewPhotoPreviews, setReviewPhotoPreviews] = useState<string[]>([]);
  const [existingReviewUrls, setExistingReviewUrls] = useState<string[]>([]);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);

  // Refs
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const reviewPhotoInputRef = useRef<HTMLInputElement>(null);

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

  const fetchUserReviews = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("product_reviews")
        .select("*")
        .eq("user_id", user.id);
      if (!error && data) {
        setUserReviews(data || []);
      } else if (error) {
        console.warn("Could not fetch user reviews, table may not exist yet:", error.message);
      }
    } catch (err) {
      console.warn("Error fetching user reviews:", err);
    }
  };

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

  // ─── Fetch orders and reviews once the user is confirmed ─────────────────
  useEffect(() => {
    if (user) {
      fetchOrders();
      fetchUserReviews();
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
        setSelectedOrderItem(null);
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
        setSelectedOrderItem(null);
      } else {
        throw new Error(json.error || "Failed to submit return request");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to submit return request. Please try again.");
    } finally {
      setReturningId(null);
    }
  };

  // ─── Reviews Handlers ─────────────────────────────────────────────────────
  const openReviewDialog = (item: any, orderId: string) => {
    const existing = userReviews.find(
      (r) => r.order_id === orderId && r.product_id === item.productId
    );
    setReviewProduct({
      id: item.productId,
      name: item.productName,
      image: item.productImage,
    });
    setReviewOrderId(orderId);

    if (existing) {
      setEditingReviewId(existing.id);
      setReviewRating(existing.rating);
      setReviewComment(existing.comment || "");
      setExistingReviewUrls(existing.images || []);
    } else {
      setEditingReviewId(null);
      setReviewRating(5);
      setReviewComment("");
      setExistingReviewUrls([]);
    }

    setSelectedReviewPhotos([]);
    setReviewPhotoPreviews([]);
    setReviewDialogOpen(true);
  };

  const uploadReviewImage = async (file: File, productId: string) => {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `reviews/${productId}-${user.id}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("product-images")
      .upload(path, file, { cacheControl: "3600", upsert: true });

    if (uploadErr) {
      throw new Error(uploadErr.message);
    }

    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleReviewFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const totalCount = existingReviewUrls.length + selectedReviewPhotos.length + files.length;
    if (totalCount > 2) {
      toast.error("You can upload a maximum of 2 photos in total.");
      return;
    }

    const newFiles = [...selectedReviewPhotos, ...files];
    setSelectedReviewPhotos(newFiles);

    const newPreviews = files.map(file => URL.createObjectURL(file));
    setReviewPhotoPreviews([...reviewPhotoPreviews, ...newPreviews]);
  };

  const removeNewReviewPhoto = (index: number) => {
    const updatedPhotos = selectedReviewPhotos.filter((_, i) => i !== index);
    setSelectedReviewPhotos(updatedPhotos);

    URL.revokeObjectURL(reviewPhotoPreviews[index]);
    const updatedPreviews = reviewPhotoPreviews.filter((_, i) => i !== index);
    setReviewPhotoPreviews(updatedPreviews);
  };

  const removeExistingReviewPhoto = (index: number) => {
    const updatedUrls = existingReviewUrls.filter((_, i) => i !== index);
    setExistingReviewUrls(updatedUrls);
  };

  const handleSubmitReview = async () => {
    if (!reviewProduct || !reviewOrderId) return;
    if (reviewRating < 1 || reviewRating > 5) {
      toast.error("Please select a rating between 1 and 5 stars.");
      return;
    }
    if (!reviewComment.trim()) {
      toast.error("Please enter your feedback comment.");
      return;
    }

    setSubmittingReview(true);
    try {
      const uploadedUrls: string[] = [...existingReviewUrls];

      for (const file of selectedReviewPhotos) {
        const url = await uploadReviewImage(file, reviewProduct.id);
        uploadedUrls.push(url);
      }

      const reviewPayload = {
        product_id: reviewProduct.id,
        user_id: user.id,
        user_name: fullName || user.email?.split("@")[0] || "Verified Buyer",
        user_avatar: user.user_metadata?.avatar_url || null,
        rating: reviewRating,
        comment: reviewComment,
        images: uploadedUrls.slice(0, 2),
        order_id: reviewOrderId,
      };

      let resError;
      if (editingReviewId) {
        const { error } = await supabase
          .from("product_reviews")
          .update(reviewPayload)
          .eq("id", editingReviewId);
        resError = error;
      } else {
        const { error } = await supabase
          .from("product_reviews")
          .insert(reviewPayload);
        resError = error;
      }

      if (resError) throw new Error(resError.message);

      toast.success(
        editingReviewId
          ? "Review updated successfully!"
          : "Review submitted successfully!"
      );
      setReviewDialogOpen(false);
      setReviewProduct(null);
      setReviewOrderId(null);
      setReviewRating(5);
      setReviewComment("");
      setSelectedReviewPhotos([]);
      setReviewPhotoPreviews([]);
      setExistingReviewUrls([]);
      setEditingReviewId(null);

      await fetchUserReviews();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to submit review. Please try again.");
    } finally {
      setSubmittingReview(false);
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
      case "Paid":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20";
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
              className="rounded-lg py-2.5 text-xs sm:text-sm font-medium transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <User className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Profile Details</span>
              <span className="inline sm:hidden">Profile</span>
            </TabsTrigger>
            <TabsTrigger
              value="address"
              className="rounded-lg py-2.5 text-xs sm:text-sm font-medium transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Shipping Address</span>
              <span className="inline sm:hidden">Address</span>
            </TabsTrigger>
            <TabsTrigger
              value="orders"
              className="rounded-lg py-2.5 text-xs sm:text-sm font-medium transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <ShoppingBag className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">My Orders</span>
              <span className="inline sm:hidden">Orders</span>
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

          <TabsContent value="orders" className="focus-visible:ring-0 focus-visible:ring-offset-0 animate-in fade-in-50 duration-200">
            {selectedOrderItem ? (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Breadcrumb Navigation */}
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                  <span className="hover:text-primary cursor-pointer" onClick={() => setSelectedOrderItem(null)}>Home</span>
                  <span>/</span>
                  <span>My Account</span>
                  <span>/</span>
                  <span className="hover:text-primary cursor-pointer" onClick={() => setSelectedOrderItem(null)}>My Orders</span>
                  <span>/</span>
                  <span className="text-foreground font-bold">{selectedOrderItem.order.orderNumber}</span>
                </div>

                {/* Back Link */}
                <button
                  onClick={() => setSelectedOrderItem(null)}
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline font-semibold cursor-pointer border border-primary/10 bg-primary/5 hover:bg-primary/10 px-3.5 py-1.5 rounded-full transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to Order History
                </button>

                {/* Flipkart Style Order Details Grid */}
                <div className="grid gap-6 lg:grid-cols-[1fr_300px] items-start">
                  {/* Left Column: Product Items & Timeline */}
                  <div className="space-y-5">
                    {(() => {
                      const order = selectedOrderItem.order;
                      const item = selectedOrderItem.item;
                      const existingReview = userReviews.find(
                        (r) => r.order_id === order.id && r.product_id === item.productId
                      );

                      return (
                        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm flex flex-col">
                          {/* Product Details Header */}
                          <div className="flex items-start justify-between gap-4 p-5 border-b border-border/40 bg-secondary/5">
                            <div className="space-y-1">
                              <h3 className="font-serif text-base font-semibold leading-snug text-foreground">
                                {item.productName}
                              </h3>
                              <p className="text-xs text-muted-foreground">Qty: {item.qty}</p>
                              <p className="text-xs text-primary font-semibold">Seller: Sabara</p>
                              <p className="text-base font-serif font-bold text-foreground mt-2">
                                {formatPrice(item.price)}
                              </p>
                            </div>
                            <img
                              src={item.productImage}
                              alt={item.productName}
                              className="h-20 w-16 object-cover rounded bg-secondary shrink-0 border border-border/60"
                            />
                          </div>

                          {/* Order Timeline (Status Tracking) */}
                          <div className="p-5 space-y-4 border-b border-border/40 bg-background/30">
                            <div className="relative pl-6 space-y-6">
                              {/* Connector line */}
                              <div className="absolute left-2.5 top-2.5 bottom-2.5 w-0.5 bg-border/60" />

                              {/* Stage 1: Ordered */}
                              <div className="relative flex items-start gap-4">
                                <div className={cn(
                                  "absolute -left-[20px] mt-1 h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center bg-card",
                                  order.status !== "Cancelled" && order.status !== "Cancelled by Seller" && order.customerStatus !== "Cancelled by Customer"
                                    ? "border-emerald-500 bg-emerald-500"
                                    : "border-destructive bg-destructive"
                                )}>
                                  <div className="h-1 w-1 rounded-full bg-white" />
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-foreground">Order Confirmed</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {new Date(order.date).toLocaleDateString("en-US", { weekday: 'short', month: 'short', day: '2-digit' })}
                                  </p>
                                </div>
                              </div>

                              {/* Cancellation State (renders instead of Shipped/Delivered if cancelled) */}
                              {(order.status === "Cancelled" || order.status === "Cancelled by Seller" || order.customerStatus === "Cancelled by Customer") ? (
                                <div className="relative flex items-start gap-4 animate-in fade-in duration-200">
                                  <div className="absolute -left-[20px] mt-1 h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center bg-card border-destructive bg-destructive">
                                    <div className="h-1 w-1 rounded-full bg-white" />
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold text-destructive">
                                      {(() => {
                                        const reason = (order.cancellationReason || "").toLowerCase();
                                        const isPaymentFailed = reason.includes("payment failed") || reason.includes("payment cancelled") || reason.includes("payment verification failed") || reason.includes("creation failed");
                                        return isPaymentFailed ? "Payment Failed, Order Not Placed" : "Order Cancelled";
                                      })()}
                                    </p>
                                    <div className="text-[10px] text-muted-foreground mt-0.5 space-y-0.5">
                                      {order.cancellationReason && (
                                        <p>Reason: "{order.cancellationReason}"</p>
                                      )}
                                      <p className="text-destructive font-semibold mt-1 bg-destructive/5 border border-destructive/10 p-2 rounded-lg leading-relaxed text-left">
                                        If any amount was deducted, refund will be processed automatically.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  {/* Stage 2: Shipped */}
                                  {(() => {
                                    const isShipped = order.status === "Shipped" || order.status === "Out for Delivery" || order.status === "Delivered";
                                    const { shippedDate } = getTimelineStageDates(order.date, order.shippedAt, order.outForDeliveryAt, order.deliveredAt);
                                    const dateStr = shippedDate.toLocaleDateString("en-US", { weekday: 'short', month: 'short', day: '2-digit' });
                                    
                                    return (
                                      <div className="relative flex items-start gap-4">
                                        <div className={cn(
                                          "absolute -left-[20px] mt-1.5 h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center bg-card",
                                          isShipped ? "border-emerald-500 bg-emerald-500" : "border-muted-foreground bg-card"
                                        )}>
                                          <div className={cn("h-1.5 w-1.5 rounded-full", isShipped ? "bg-white" : "bg-muted-foreground")} />
                                        </div>
                                        <div>
                                          <p className={cn("text-xs font-semibold", isShipped ? "text-foreground" : "text-muted-foreground")}>Shipped</p>
                                          <p className="text-[10px] text-muted-foreground">
                                            {isShipped ? dateStr : "Pending shipment"}
                                          </p>
                                          {isShipped && order.courier && (
                                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                              Via {order.courier} (Tracking: {order.trackingNumber})
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })()}

                                  {/* Stage 3: Out for Delivery */}
                                  {(() => {
                                    const isOut = order.status === "Out for Delivery" || order.status === "Delivered";
                                    const { outForDeliveryDate } = getTimelineStageDates(order.date, order.shippedAt, order.outForDeliveryAt, order.deliveredAt);
                                    const dateStr = outForDeliveryDate.toLocaleDateString("en-US", { weekday: 'short', month: 'short', day: '2-digit' });
                                    
                                    return (
                                      <div className="relative flex items-start gap-4">
                                        <div className={cn(
                                          "absolute -left-[20px] mt-1.5 h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center bg-card",
                                          isOut ? "border-emerald-500 bg-emerald-500" : "border-muted-foreground bg-card"
                                        )}>
                                          <div className={cn("h-1.5 w-1.5 rounded-full", isOut ? "bg-white" : "bg-muted-foreground")} />
                                        </div>
                                        <div>
                                          <p className={cn("text-xs font-semibold", isOut ? "text-foreground" : "text-muted-foreground")}>Out for Delivery</p>
                                          <p className="text-[10px] text-muted-foreground">
                                            {isOut ? dateStr : "Expected shortly"}
                                          </p>
                                          {isOut && (
                                            <p className="text-[10px] text-muted-foreground mt-0.5 font-light">
                                              Your package is out for delivery
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })()}

                                  {/* Stage 4: Delivered */}
                                  {(() => {
                                    const isDelivered = order.status === "Delivered";
                                    const { deliveryDate } = getTimelineStageDates(order.date, order.shippedAt, order.outForDeliveryAt, order.deliveredAt);
                                    const dateStr = deliveryDate.toLocaleDateString("en-US", { weekday: 'short', month: 'short', day: '2-digit' });
                                    
                                    return (
                                      <div className="relative flex items-start gap-4">
                                        <div className={cn(
                                          "absolute -left-[20px] mt-1.5 h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center bg-card",
                                          isDelivered ? "border-emerald-500 bg-emerald-500" : "border-muted-foreground bg-card"
                                        )}>
                                          <div className={cn("h-1.5 w-1.5 rounded-full", isDelivered ? "bg-white" : "bg-muted-foreground")} />
                                        </div>
                                        <div>
                                          <p className={cn("text-xs font-semibold", isDelivered ? "text-foreground" : "text-muted-foreground")}>Delivered</p>
                                          <p className="text-[10px] text-muted-foreground">
                                            {isDelivered ? dateStr : "Delivery expected shortly"}
                                          </p>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </>
                              )}
                            </div>
                          </div>

                          {/* Return policy details & Inline rating */}
                          {order.status === "Delivered" && (
                            <div className="p-4 bg-emerald-500/5 border-b border-border/40 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium flex justify-between items-center flex-wrap gap-2 text-left">
                              <span>
                                {(() => {
                                  if (order.customerStatus === "Return Requested") return "Return requested.";
                                  if (order.customerStatus === "Return Approved") return "Return request approved.";
                                  if (order.customerStatus === "Return Rejected") return "Return request rejected.";
                                  
                                  const { returnExpiryDate } = getTimelineStageDates(order.date, order.shippedAt, order.outForDeliveryAt, order.deliveredAt);
                                  const isExpired = new Date() > returnExpiryDate;
                                  if (isExpired) {
                                    return "Return window closed.";
                                  }
                                  return `Return policy valid for 7 days after delivery (till ${returnExpiryDate.toLocaleDateString("en-US", { month: 'short', day: '2-digit', year: 'numeric' })})`;
                                })()}
                              </span>
                              
                              <button
                                onClick={() => openReviewDialog(item, order.id)}
                                className="text-[11px] font-bold text-primary bg-primary/10 hover:bg-primary/15 px-3 py-1 rounded-full border border-primary/20 transition-all cursor-pointer flex items-center gap-1"
                              >
                                <Star className="h-3 w-3 fill-current" />
                                {existingReview ? "Edit Review" : "Rate & Review Product"}
                              </button>
                            </div>
                          )}

                          {/* Action Buttons split */}
                          <div className="grid grid-cols-2 divide-x divide-border/40 border-t border-border/20 text-center text-xs font-semibold">
                            {/* Left action: Cancel or Return request */}
                            {order.status === "Pending" && order.customerStatus !== "Cancelled by Customer" ? (
                              <button
                                onClick={() => {
                                  setOrderToCancel(order.id);
                                  setCancelReasonInput("");
                                  setCancelDialogOpen(true);
                                }}
                                className="py-3 hover:bg-destructive/5 text-destructive transition-colors cursor-pointer"
                              >
                                Cancel Order
                              </button>
                            ) : order.status === "Delivered" ? (
                              (() => {
                                if (order.customerStatus === "Return Requested") {
                                  return (
                                    <button disabled className="py-3 text-purple-600 opacity-80 cursor-not-allowed bg-purple-50">
                                      Return Requested
                                    </button>
                                  );
                                }
                                if (order.customerStatus === "Return Approved") {
                                  return (
                                    <button disabled className="py-3 text-gray-600 opacity-80 cursor-not-allowed bg-gray-50">
                                      Return Approved
                                    </button>
                                  );
                                }
                                if (order.customerStatus === "Return Rejected") {
                                  return (
                                    <button disabled className="py-3 text-red-600 opacity-80 cursor-not-allowed bg-red-50">
                                      Return Rejected
                                    </button>
                                  );
                                }
                                
                                const { returnExpiryDate } = getTimelineStageDates(order.date, order.shippedAt, order.outForDeliveryAt, order.deliveredAt);
                                const isExpired = new Date() > returnExpiryDate;
                                if (isExpired) {
                                  return (
                                    <button disabled className="py-3 text-muted-foreground opacity-50 cursor-not-allowed bg-secondary/10">
                                      Return Window Closed
                                    </button>
                                  );
                                }
                                
                                return (
                                  <button
                                    onClick={() => {
                                      setOrderToReturn(order.id);
                                      setReturnReasonInput("");
                                      setReturnDialogOpen(true);
                                    }}
                                    className="py-3 hover:bg-primary/5 text-primary transition-colors cursor-pointer"
                                  >
                                    Return Order
                                  </button>
                                );
                              })()
                            ) : (
                              <button
                                disabled
                                className="py-3 text-muted-foreground opacity-50 cursor-not-allowed bg-secondary/10"
                              >
                                {order.status}
                              </button>
                            )}

                            {/* Right action: Contact Support / Chat with us */}
                            <a
                              href="https://wa.me/916294359714"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="py-3 hover:bg-primary/5 text-foreground hover:text-primary transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              Chat with us
                            </a>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Feedback cards like in Flipkart layout */}
                    <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
                      <h4 className="font-serif text-sm font-semibold text-foreground">Rate your experience</h4>
                      
                      <div className="divide-y divide-border/40 text-xs">
                        <div className="flex justify-between items-center py-2.5 hover:text-primary cursor-pointer transition-colors" onClick={() => navigate({ to: "/contact" })}>
                          <span className="font-medium text-foreground/80">Did you find this page helpful?</span>
                          <span className="text-muted-foreground font-semibold">&gt;</span>
                        </div>
                        <div className="flex justify-between items-center py-2.5 hover:text-primary cursor-pointer transition-colors" onClick={() => navigate({ to: "/contact" })}>
                          <span className="font-medium text-foreground/80">How was your delivery experience?</span>
                          <span className="text-muted-foreground font-semibold">&gt;</span>
                        </div>
                      </div>
                    </div>

                    {/* Footer Order Info with copy */}
                    <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex items-center justify-between text-xs text-muted-foreground">
                      <span>Order #{selectedOrderItem.order.orderNumber}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(selectedOrderItem.order.orderNumber);
                          toast.success("Order ID copied to clipboard!");
                        }}
                        className="text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        Copy ID
                      </button>
                    </div>
                  </div>

                  {/* Right Column: Delivery Details & Price Summary */}
                  <div className="space-y-5">
                    {/* Delivery details Card */}
                    <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
                      <h3 className="font-serif text-sm font-semibold text-foreground border-b border-border/40 pb-2">
                        Delivery details
                      </h3>
                      
                      <div className="space-y-4 text-xs">
                        <div className="flex gap-2.5 items-start">
                          <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <div className="space-y-0.5 text-foreground/80">
                            <p className="font-semibold text-foreground">Delivery Address</p>
                            <p>{selectedOrderItem.order.shippingAddress.street}</p>
                            <p>{selectedOrderItem.order.shippingAddress.city}, {selectedOrderItem.order.shippingAddress.state} - {selectedOrderItem.order.shippingAddress.zipCode}</p>
                          </div>
                        </div>

                        <div className="flex gap-2.5 items-start border-t border-border/40 pt-3">
                          <User className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <div className="space-y-0.5 text-foreground/80">
                            <p className="font-semibold text-foreground">{selectedOrderItem.order.customerName}</p>
                            <p className="text-muted-foreground font-mono">{selectedOrderItem.order.customerPhone || "Phone not provided"}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Price Details Card */}
                    <div className="rounded-xl border border-border bg-card p-5 space-y-3 shadow-sm">
                      <h3 className="font-serif text-sm font-semibold text-foreground border-b border-border/40 pb-2">
                        Price details
                      </h3>

                      {(() => {
                        const order = selectedOrderItem.order;
                        const item = selectedOrderItem.item;
                        const itemSubtotal = item.price * item.qty;
                        return (
                          <div className="space-y-2.5 text-xs">
                            <div className="flex justify-between text-muted-foreground">
                              <span>Listing price</span>
                              <span className="font-medium text-foreground">{formatPrice(itemSubtotal)}</span>
                            </div>
                            
                            {order.couponCode && order.discountAmount > 0 && (
                              <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                                <span>Special discount ({order.couponCode})</span>
                                <span>-{formatPrice(order.discountAmount)}</span>
                              </div>
                            )}

                            <div className="flex justify-between text-muted-foreground">
                              <span>Total delivery fees</span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Free</span>
                            </div>

                            <div className="flex justify-between border-t border-border/40 pt-3 font-semibold text-sm mt-1">
                              <span className="text-foreground">Total amount</span>
                              <span className="text-primary font-bold">{formatPrice(order.total)}</span>
                            </div>

                            <div className="flex justify-between items-center border-t border-border/40 pt-3 text-[10px] text-muted-foreground">
                              <span>Paid By</span>
                              <span className="font-semibold text-foreground px-2 py-0.5 bg-secondary/40 rounded border border-border/60">Online Payment</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Download Invoice Button */}
                    <Button
                      onClick={() => {
                        window.print();
                        toast.success("Opening print view for invoice!");
                      }}
                      variant="outline"
                      className="w-full rounded-full text-xs h-10 border-primary/20 text-primary hover:bg-primary/5 cursor-pointer font-semibold shadow-sm"
                    >
                      Download Invoice
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
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
                    {orders.flatMap((order) =>
                      order.items.map((item: any, idx: number) => {
                        const formattedDate = new Date(order.date).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        });

                        return (
                          <div
                            key={`${order.id}-${item.productId}-${idx}`}
                            onClick={() => setSelectedOrderItem({ order, item })}
                            className="rounded-xl border border-border bg-card shadow-sm overflow-hidden transition-all hover:border-primary/40 cursor-pointer hover:shadow-md flex items-center p-4 gap-4"
                          >
                            <img
                              src={item.productImage}
                              alt={item.productName}
                              className="h-16 w-12 object-cover rounded bg-secondary shrink-0 border border-border/60"
                            />
                            <div className="flex-1 min-w-0">
                              <h3 className="font-serif text-sm font-bold text-foreground truncate max-w-xs sm:max-w-md">
                                {item.productName}
                              </h3>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                Qty: {item.qty} | Seller: Sabara
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                Ordered on {formattedDate}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-serif font-bold text-sm text-primary">
                                {formatPrice(item.price * item.qty)}
                              </p>
                              {(() => {
                                const config = getOrderStatusConfig(order);
                                return (
                                  <span className={cn(
                                    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[9px] font-semibold mt-1.5",
                                    config.badgeClass
                                  )}>
                                    <span className={cn("h-1.5 w-1.5 rounded-full", config.dotClass)} />
                                    {config.label}
                                  </span>
                                );
                              })()}
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-1" />
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            )}
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

      {/* Product Review Submission Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setReviewDialogOpen(false);
          setReviewProduct(null);
          setReviewOrderId(null);
          setReviewRating(5);
          setReviewComment("");
          setSelectedReviewPhotos([]);
          setReviewPhotoPreviews([]);
          setExistingReviewUrls([]);
          setEditingReviewId(null);
        }
      }}>
        <DialogContent className="sm:max-w-[480px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-foreground">
              {editingReviewId ? "Edit Review" : "Write a Review"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Your review helps others make better choices. Share your honest feedback.
            </DialogDescription>
          </DialogHeader>

          {reviewProduct && (
            <div className="flex items-center gap-3 bg-secondary/20 p-3 rounded-xl border border-border/40 mt-1 mb-4">
              <img
                src={reviewProduct.image}
                alt={reviewProduct.name}
                className="h-12 w-10 object-cover rounded bg-secondary shrink-0 border"
              />
              <div className="min-w-0">
                <h4 className="font-medium text-sm text-foreground truncate">{reviewProduct.name}</h4>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Verified Purchase</p>
              </div>
            </div>
          )}

          <div className="space-y-5 py-2">
            {/* Star Rating Picker */}
            <div className="space-y-2 text-center py-2 bg-secondary/5 rounded-xl border border-dashed border-border/60">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Overall Rating
              </Label>
              <div className="flex justify-center gap-2 mt-1">
                {[1, 2, 3, 4, 5].map((star) => {
                  const isActive = star <= (reviewHoverRating ?? reviewRating);
                  return (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setReviewHoverRating(star)}
                      onMouseLeave={() => setReviewHoverRating(null)}
                      onClick={() => setReviewRating(star)}
                      className="text-amber-400 hover:scale-110 active:scale-95 transition-all duration-150 cursor-pointer focus:outline-none bg-transparent border-0"
                    >
                      <Star
                        className={cn(
                          "h-8 w-8 stroke-[1.5]",
                          isActive ? "fill-amber-400 stroke-amber-400" : "text-muted-foreground/45"
                        )}
                      />
                    </button>
                  );
                })}
              </div>
              <div className="text-xs font-medium text-foreground min-h-[16px] transition-all duration-200">
                {(() => {
                  const current = reviewHoverRating ?? reviewRating;
                  if (current === 1) return <span className="text-red-500 font-semibold">Poor (1/5)</span>;
                  if (current === 2) return <span className="text-amber-500 font-semibold">Fair (2/5)</span>;
                  if (current === 3) return <span className="text-yellow-600 dark:text-yellow-400 font-semibold">Good (3/5)</span>;
                  if (current === 4) return <span className="text-blue-600 dark:text-blue-400 font-semibold">Very Good (4/5)</span>;
                  if (current === 5) return <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Excellent (5/5)</span>;
                  return "";
                })()}
              </div>
            </div>

            {/* Comment Area */}
            <div className="space-y-2">
              <Label htmlFor="review-comment" className="text-xs font-semibold text-foreground uppercase tracking-wider block">
                Your Feedback <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="review-comment"
                required
                placeholder="What did you like or dislike? How does it feel? Is the weave high quality?..."
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                rows={4}
                className="text-xs bg-background focus-visible:ring-1 resize-none leading-relaxed"
              />
            </div>

            {/* Photo Uploader */}
            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <Label className="text-xs font-semibold text-foreground uppercase tracking-wider block">
                  Add Photos (Max 2)
                </Label>
                <span className="text-[10px] text-muted-foreground font-medium">
                  {existingReviewUrls.length + selectedReviewPhotos.length} / 2 uploaded
                </span>
              </div>
              
              <div className="flex flex-wrap gap-3 mt-1.5">
                {/* Existing URLs (from DB) */}
                {existingReviewUrls.map((url, idx) => (
                  <div key={`existing-${idx}`} className="group relative h-20 w-20 overflow-hidden rounded-xl border bg-secondary/30">
                    <img src={url} alt={`Review ${idx + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeExistingReviewPhoto(idx)}
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground hover:scale-105 transition-transform shadow-sm"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 py-0.5 text-[8px] text-white">
                      Saved
                    </span>
                  </div>
                ))}

                {/* Newly selected files */}
                {reviewPhotoPreviews.map((preview, idx) => (
                  <div key={`new-${idx}`} className="group relative h-20 w-20 overflow-hidden rounded-xl border bg-secondary/30">
                    <img src={preview} alt={`Preview ${idx + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeNewReviewPhoto(idx)}
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground hover:scale-105 transition-transform shadow-sm"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <span className="absolute bottom-1 left-1 rounded bg-primary/70 px-1 py-0.5 text-[8px] text-white">
                      New
                    </span>
                  </div>
                ))}

                {/* Upload Button */}
                {existingReviewUrls.length + selectedReviewPhotos.length < 2 && (
                  <button
                    type="button"
                    onClick={() => reviewPhotoInputRef.current?.click()}
                    className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors cursor-pointer bg-transparent"
                  >
                    <ImagePlus className="h-5 w-5" />
                    <span className="text-[9px] font-medium">Add Photo</span>
                  </button>
                )}
              </div>

              <input
                ref={reviewPhotoInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleReviewFileChange}
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-0 border-t pt-4 mt-2">
            <Button
              type="button"
              variant="outline"
              disabled={submittingReview}
              onClick={() => {
                setReviewDialogOpen(false);
                setReviewProduct(null);
                setReviewOrderId(null);
                setReviewRating(5);
                setReviewComment("");
                setSelectedReviewPhotos([]);
                setReviewPhotoPreviews([]);
                setExistingReviewUrls([]);
                setEditingReviewId(null);
              }}
              className="rounded-full text-xs h-9 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmitReview}
              disabled={submittingReview || !reviewComment.trim()}
              className="rounded-full text-xs h-9 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {submittingReview ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Submitting...
                </>
              ) : (
                editingReviewId ? "Update Review" : "Submit Review"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
