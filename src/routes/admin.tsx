import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef, type FormEvent, Fragment } from "react";
import { useHeroSettings, usePromoSettings } from "@/lib/settings";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { categories as defaultCategories } from "@/data/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatPrice } from "@/lib/cart";
import {
  ShieldX, Plus, X, Upload, ImagePlus, Loader2, ArrowLeft,
  DollarSign, ShoppingBag, Users, Layers, Search, MapPin, ClipboardList,
  ShoppingCart, Heart, Calendar, Activity, Info, LogIn, Mail, Phone, User,
  ChevronDown, ChevronUp
} from "lucide-react";
import { ArrowUp, ArrowDown, Trash2, Edit, Check } from "lucide-react";

export const Route = createFileRoute("/admin")({ component: AdminPage });

/* ── helpers ──────────────────────────────────────────────────────────────── */

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

const BUCKET = "product-images";

/** Upload a file to Supabase Storage and return the public URL */
async function uploadImage(file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `products/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/* ── main page ────────────────────────────────────────────────────────────── */

function AdminPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const headers = await getAuthHeaders();
      
      const [pRes, oRes, cRes] = await Promise.all([
        fetch("/api/admin/products", { headers }),
        fetch("/api/admin/orders", { headers }),
        fetch("/api/admin/customers", { headers })
      ]);

      const [pData, oData, cData] = await Promise.all([
        pRes.json(),
        oRes.json(),
        cRes.json()
      ]);

      if (!pRes.ok) throw new Error(pData.error || `Products API returned status ${pRes.status}`);
      if (!oRes.ok) throw new Error(oData.error || `Orders API returned status ${oRes.status}`);
      if (!cRes.ok) throw new Error(cData.error || `Customers API returned status ${cRes.status}`);

      setProducts(pData.products || []);
      setOrders(oData.orders || []);
      setCustomers(cData.customers || []);
    } catch (e: any) {
      console.error("Dashboard fetch error:", e);
      toast.error(e.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchDashboardData();
    }
  }, [isAdmin]);

  if (authLoading || (isAdmin && loading)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <ShieldX className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="font-serif text-3xl text-foreground">Access Denied</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Admin access is required.
        </p>
        <Button variant="outline" onClick={() => navigate({ to: "/" })}>
          Go back home
        </Button>
      </div>
    );
  }

  // Calculate statistics
  const totalRevenue = orders
    .filter((o) => o.status !== "Cancelled" && o.status !== "Cancelled by Seller" && o.customerStatus !== "Cancelled by Customer")
    .reduce((sum, o) => sum + o.total, 0);

  const stats = [
    {
      title: "Total Revenue",
      value: formatPrice(totalRevenue),
      icon: <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />,
      bg: "bg-emerald-500/10",
      description: "Excluding cancelled orders"
    },
    {
      title: "Orders Placed",
      value: orders.length,
      icon: <ShoppingBag className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />,
      bg: "bg-indigo-500/10",
      description: "Direct & Guest purchases"
    },
    {
      title: "Unique Customers",
      value: customers.length,
      icon: <Users className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
      bg: "bg-amber-500/10",
      description: "Registered & Guests"
    },
    {
      title: "Active Products",
      value: products.length,
      icon: <Layers className="h-5 w-5 text-sky-600 dark:text-sky-400" />,
      bg: "bg-sky-500/10",
      description: "Available in catalog"
    }
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-16 sm:px-6">
      <div className="flex flex-col gap-2 mb-10">
        <h1 className="font-serif text-4xl">Admin Dashboard</h1>
        <p className="text-muted-foreground">Manage your catalog, fulfill orders, and view customer summaries.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-10">
        {stats.map((stat, i) => (
          <div key={i} className="rounded-xl border bg-card p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">{stat.title}</span>
              <div className={`p-2 rounded-lg ${stat.bg}`}>{stat.icon}</div>
            </div>
            <div className="text-3xl font-semibold font-serif tracking-tight">{stat.value}</div>
            <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="products" className="w-full">
        <div className="w-full overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none">
          <TabsList className="flex w-max min-w-full justify-start gap-1 mb-8">
            <TabsTrigger value="products">Products ({products.length})</TabsTrigger>
            <TabsTrigger value="orders">Orders ({orders.length})</TabsTrigger>
            <TabsTrigger value="customers">Customers ({customers.length})</TabsTrigger>
            <TabsTrigger value="coupons">Coupons</TabsTrigger>
            <TabsTrigger value="hero">Hero Settings</TabsTrigger>
            <TabsTrigger value="promotions">Promotions</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="products">
          <ProductsAdmin initialProducts={products} onRefresh={fetchDashboardData} />
        </TabsContent>
        <TabsContent value="orders">
          <OrdersAdmin initialOrders={orders} onRefresh={fetchDashboardData} />
        </TabsContent>
        <TabsContent value="customers">
          <CustomersAdmin initialCustomers={customers} orders={orders} products={products} />
        </TabsContent>
        <TabsContent value="coupons">
          <CouponsAdmin />
        </TabsContent>
        <TabsContent value="hero">
          <HeroAdmin />
        </TabsContent>
        <TabsContent value="promotions">
          <PromotionsAdmin />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PRODUCTS ADMIN — product list + inline add/edit form
   ══════════════════════════════════════════════════════════════════════════ */

type FormMode = "list" | "add" | "edit";

function ProductsAdmin({ initialProducts, onRefresh }: { initialProducts: any[], onRefresh: () => Promise<void> }) {
  const [products, setProducts] = useState<any[]>(initialProducts);
  const [mode, setMode] = useState<FormMode>("list");
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [prefillTarget, setPrefillTarget] = useState<any | null>(null);

  useEffect(() => { setProducts(initialProducts); }, [initialProducts]);

  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});

  const [visibilitySettings, setVisibilitySettings] = useState<{
    hiddenProducts: string[];
    hiddenVarieties: string[];
  }>({ hiddenProducts: [], hiddenVarieties: [] });

  const fetchVisibility = async () => {
    try {
      const res = await fetch("/api/site-settings?key=visibility");
      const json = await res.json();
      if (json.success && json.value) {
        setVisibilitySettings({
          hiddenProducts: json.value.hiddenProducts || [],
          hiddenVarieties: json.value.hiddenVarieties || [],
        });
      }
    } catch (err) {
      console.error("Failed to fetch visibility:", err);
    }
  };

  useEffect(() => {
    fetchVisibility();
  }, []);

  const saveVisibility = async (newSettings: typeof visibilitySettings) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/site-settings", {
        method: "POST",
        headers,
        body: JSON.stringify({
          key: "visibility",
          value: newSettings,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to save visibility");
      setVisibilitySettings(newSettings);
      toast.success("Visibility settings updated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update visibility");
    }
  };

  const toggleProductExpand = (baseName: string) => {
    setExpandedProducts((prev) => ({
      ...prev,
      [baseName]: !prev[baseName],
    }));
  };

  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteSingle = async (prod: any) => {
    setDeleting(true);
    try {
      const headers = await getAuthHeaders();
      await fetch(`/api/admin/products?id=${prod.id}`, { method: "DELETE", headers });
      toast.success(`Variety "${prod.name.split(" - ")[1] || "Main"}" deleted successfully`);
      
      // If we are editing this deleted product, go back to list
      if (editTarget?.id === prod.id || prefillTarget?.id === prod.id) {
        setMode("list");
        setEditTarget(null);
        setPrefillTarget(null);
      }
      
      setDeleteTarget(null);
      await onRefresh();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete product");
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAll = async (prod: any) => {
    setDeleting(true);
    try {
      const headers = await getAuthHeaders();
      const baseName = prod.name.split(" - ")[0];
      const siblings = products.filter((p) => p.name.split(" - ")[0] === baseName);
      
      for (const sib of siblings) {
        await fetch(`/api/admin/products?id=${sib.id}`, { method: "DELETE", headers });
      }
      
      toast.success(`Product "${baseName}" and all its ${siblings.length} varieties deleted`);
      
      const siblingIds = new Set(siblings.map(s => s.id));
      if ((editTarget && siblingIds.has(editTarget.id)) || (prefillTarget && siblingIds.has(prefillTarget.id))) {
        setMode("list");
        setEditTarget(null);
        setPrefillTarget(null);
      }

      setDeleteTarget(null);
      await onRefresh();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete group");
    } finally {
      setDeleting(false);
    }
  };

  const handleDelete = async (id: string): Promise<boolean> => {
    const prod = products.find((p) => p.id === id);
    if (!prod) return false;

    const baseName = prod.name.split(" - ")[0];
    const siblings = products.filter((p) => p.name.split(" - ")[0] === baseName);

    if (siblings.length <= 1) {
      if (!confirm(`Are you sure you want to delete "${prod.name}"?`)) return false;
      setDeleting(true);
      try {
        const headers = await getAuthHeaders();
        await fetch(`/api/admin/products?id=${id}`, { method: "DELETE", headers });
        toast.success("Product deleted");
        await onRefresh();
        return true;
      } catch (e) {
        toast.error("Failed to delete product");
        return false;
      } finally {
        setDeleting(false);
      }
    } else {
      setDeleteTarget(prod);
      return false;
    }
  };

  const handleSave = async (data: any, isEdit: boolean) => {
    try {
      const headers = await getAuthHeaders();
      
      // If we are editing, check if the base name was changed.
      // If the base name changed, rename all sibling varieties to keep the group intact.
      if (isEdit && editTarget) {
        const oldName = editTarget.name || "";
        const oldBase = oldName.split(" - ")[0];
        const newBase = data.name.split(" - ")[0];
        if (oldBase && newBase && oldBase.trim() !== newBase.trim()) {
          const siblings = products.filter(
            (p) => p.id !== data.id && p.name.split(" - ")[0] === oldBase
          );
          for (const sib of siblings) {
            const sibColor = sib.name.split(" - ")[1];
            const sibNewName = sibColor ? `${newBase.trim()} - ${sibColor}` : newBase.trim();
            try {
              await fetch("/api/admin/products", {
                method: "PUT",
                headers,
                body: JSON.stringify({
                  ...sib,
                  name: sibNewName,
                }),
              });
            } catch (err) {
              console.error(`Failed to rename sibling variety ${sib.id}:`, err);
            }
          }
        }
      }

      const res = await fetch("/api/admin/products", {
        method: isEdit ? "PUT" : "POST",
        headers,
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error("API error response:", errText);
        let message = "Save failed";
        try {
          const parsed = JSON.parse(errText);
          if (parsed.error) message = parsed.error;
        } catch {
          message = errText || "Save failed";
        }
        throw new Error(message);
      }
      toast.success(isEdit ? "Product updated!" : "Product added!");
      setMode("list");
      setEditTarget(null);
      setPrefillTarget(null);
      await onRefresh();
    } catch (err: any) {
      console.error("Save catch error:", err);
      toast.error(err.message || "Failed to save product");
      throw err;
    }
  };

  /* ── Inline add / edit form ──────────────────────────────────────────────── */
  if (mode === "add" || mode === "edit") {
    const activeId = mode === "edit" ? editTarget?.id : prefillTarget?.id;
    return (
      <ProductForm
        key={activeId || "new-product"}
        initial={mode === "edit" ? editTarget : prefillTarget}
        isEdit={mode === "edit"}
        onSave={handleSave}
        onCancel={() => { setMode("list"); setEditTarget(null); setPrefillTarget(null); }}
        existingCategories={[...new Set(products.map((p) => p.category))]}
        products={products}
        onEditProduct={(prod) => {
          setEditTarget(prod);
          setMode("edit");
        }}
        onDeleteProduct={async (id) => {
          await handleDelete(id);
          if (activeId === id) {
            setMode("list");
            setEditTarget(null);
            setPrefillTarget(null);
          }
        }}
        onAddVariety={(baseProduct) => {
          setPrefillTarget(baseProduct);
          setMode("add");
        }}
      />
    );
  }

  /* ── Product list ────────────────────────────────────────────────────────── */
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-medium">Manage Products</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {products.length} product{products.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <Button onClick={() => setMode("add")} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-1" /> Add Product
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead>Image</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Badge</TableHead>
              <TableHead>Display</TableHead>
              <TableHead>Varieties</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(() => {
              // Group products by base name
              const groups = new Map<string, any[]>();
              products.forEach((p) => {
                const base = (p.name || "").split(" - ")[0].trim();
                if (!base) return;
                if (!groups.has(base)) {
                  groups.set(base, []);
                }
                groups.get(base)!.push(p);
              });

              if (groups.size === 0) {
                return (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                      No products found. Add one above!
                    </TableCell>
                  </TableRow>
                );
              }

              return Array.from(groups.entries()).map(([baseName, group]) => {
                const sortedGroup = [...group].sort((a, b) => {
                  const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
                  const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
                  return aTime - bTime;
                });
                
                const mainProduct = sortedGroup[0];
                if (!mainProduct) return null;

                const totalStock = sortedGroup.reduce((sum, item) => sum + (item.stock || 0), 0);
                const prices = sortedGroup.map(item => Number(item.price) || 0);
                const minPrice = Math.min(...prices);
                const maxPrice = Math.max(...prices);
                const priceDisplay = minPrice === maxPrice 
                  ? formatPrice(minPrice) 
                  : `${formatPrice(minPrice)} - ${formatPrice(maxPrice)}`;

                const isExpanded = !!expandedProducts[baseName];
                const isProductVisible = !visibilitySettings.hiddenProducts.includes(baseName);

                return (
                  <Fragment key={baseName}>
                    <TableRow className="hover:bg-muted/30">
                      <TableCell className="w-[40px] p-2 text-center">
                        <button
                          type="button"
                          onClick={() => toggleProductExpand(baseName)}
                          className="p-1 rounded hover:bg-secondary transition-colors cursor-pointer"
                          title={isExpanded ? "Collapse varieties" : "Expand varieties"}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell 
                        className="cursor-pointer" 
                        onClick={() => toggleProductExpand(baseName)}
                      >
                        <img src={mainProduct.image} alt={baseName} className="h-10 w-10 rounded object-cover bg-secondary" />
                      </TableCell>
                      <TableCell 
                        className="font-medium cursor-pointer"
                        onClick={() => toggleProductExpand(baseName)}
                      >
                        <div className="font-semibold text-foreground text-sm sm:text-base">{baseName}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {sortedGroup.length} variety{sortedGroup.length !== 1 ? "ies" : ""}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                          {mainProduct.category}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium font-mono text-sm">
                        {priceDisplay}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          totalStock <= 3 
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" 
                            : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        }`}>
                          {totalStock} units total
                        </span>
                      </TableCell>
                      <TableCell>
                        {mainProduct.badge ? (
                          <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            {mainProduct.badge}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={async () => {
                            const updatedHidden = isProductVisible
                              ? [...visibilitySettings.hiddenProducts, baseName]
                              : visibilitySettings.hiddenProducts.filter((b) => b !== baseName);
                            
                            const newSettings = {
                              ...visibilitySettings,
                              hiddenProducts: updatedHidden,
                            };
                            await saveVisibility(newSettings);
                          }}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                            isProductVisible ? "bg-primary" : "bg-secondary"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                              isProductVisible ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => toggleProductExpand(baseName)}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium cursor-pointer"
                        >
                          {isExpanded ? "Hide varieties" : `Show ${sortedGroup.length} varieties`}
                          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost" 
                            size="sm"
                            onClick={() => { setEditTarget(mainProduct); setMode("edit"); }}
                            className="h-8 px-2 text-xs cursor-pointer"
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost" 
                            size="sm"
                            className="h-8 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                            onClick={() => handleDelete(mainProduct.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Collapsible varieties list dropdown */}
                    {isExpanded && (
                      <TableRow className="bg-muted/10 border-l-2 border-l-primary/40 dark:bg-muted/5 transition-colors">
                        <TableCell colSpan={10} className="p-4 sm:p-6">
                          <div className="rounded-xl border bg-background/50 p-4 space-y-4">
                            <div className="flex items-center justify-between border-b pb-3">
                              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Varieties of {baseName}
                              </h4>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 rounded-md px-2 text-xs font-medium border-dashed cursor-pointer hover:bg-primary hover:text-primary-foreground"
                                onClick={() => {
                                  setPrefillTarget(mainProduct);
                                  setMode("add");
                                }}
                              >
                                <Plus className="h-3 w-3 mr-1" /> Add Variety
                              </Button>
                            </div>

                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader className="bg-muted/20">
                                  <TableRow>
                                    <TableHead className="py-2 text-[11px] font-semibold">Image</TableHead>
                                    <TableHead className="py-2 text-[11px] font-semibold">Variety / Color</TableHead>
                                    <TableHead className="py-2 text-[11px] font-semibold">Price</TableHead>
                                    <TableHead className="py-2 text-[11px] font-semibold">Stock</TableHead>
                                    <TableHead className="py-2 text-[11px] font-semibold">Display</TableHead>
                                    <TableHead className="py-2 text-[11px] font-semibold text-right">Actions</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {sortedGroup.slice(1).length === 0 ? (
                                    <TableRow>
                                      <TableCell colSpan={6} className="text-center py-6 text-xs text-muted-foreground">
                                        No other varieties added yet.
                                      </TableCell>
                                    </TableRow>
                                  ) : (
                                    sortedGroup.slice(1).map((v) => {
                                      const vLabel = v.name.split(" - ")[1] || "Default";
                                      const isVarietyVisible = !visibilitySettings.hiddenVarieties.includes(v.id);
                                      return (
                                        <TableRow key={v.id} className="hover:bg-muted/10">
                                          <TableCell className="py-2">
                                            <img src={v.image} alt={vLabel} className="h-8 w-8 rounded object-cover bg-secondary" />
                                          </TableCell>
                                          <TableCell className="py-2 font-medium text-xs">
                                            {vLabel}
                                          </TableCell>
                                          <TableCell className="py-2 font-mono text-xs">
                                            {v.original_price && v.original_price > v.price ? (
                                              <div className="flex items-center gap-1.5">
                                                <span className="font-semibold text-red-600 dark:text-red-400">{formatPrice(v.price)}</span>
                                                <span className="text-[10px] text-muted-foreground line-through">{formatPrice(v.original_price)}</span>
                                              </div>
                                            ) : (
                                              formatPrice(v.price)
                                            )}
                                          </TableCell>
                                          <TableCell className="py-2 text-xs">
                                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                              v.stock <= 3 
                                                ? "bg-red-500/10 text-red-600" 
                                                : "bg-green-500/10 text-green-600"
                                            }`}>
                                              {v.stock} units
                                            </span>
                                          </TableCell>
                                          <TableCell className="py-2">
                                            <button
                                              type="button"
                                              onClick={async () => {
                                                const updatedHidden = isVarietyVisible
                                                  ? [...visibilitySettings.hiddenVarieties, v.id]
                                                  : visibilitySettings.hiddenVarieties.filter((vid) => vid !== v.id);
                                                
                                                const newSettings = {
                                                  ...visibilitySettings,
                                                  hiddenVarieties: updatedHidden,
                                                };
                                                await saveVisibility(newSettings);
                                              }}
                                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 ${
                                                isVarietyVisible ? "bg-primary" : "bg-secondary"
                                              }`}
                                            >
                                              <span
                                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                                                  isVarietyVisible ? "translate-x-4" : "translate-x-0"
                                                }`}
                                              />
                                            </button>
                                          </TableCell>
                                          <TableCell className="py-2 text-right">
                                            <div className="flex justify-end gap-1">
                                              <Button
                                                variant="ghost" 
                                                size="sm"
                                                className="h-7 px-2 text-xs cursor-pointer hover:bg-secondary"
                                                onClick={() => {
                                                  setEditTarget(v);
                                                  setMode("edit");
                                                }}
                                              >
                                                Edit
                                              </Button>
                                              <Button
                                                variant="ghost" 
                                                size="sm"
                                                className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                                                onClick={async () => {
                                                  const label = v.name.split(" - ")[1] || "Default";
                                                  if (confirm(`Are you sure you want to delete variety "${label}" of "${baseName}"?`)) {
                                                    await handleDeleteSingle(v);
                                                  }
                                                }}
                                              >
                                                Delete
                                              </Button>
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })
                                  )}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              });
            })()}
          </TableBody>
        </Table>
      </div>

      {/* Custom Deletion Dialog Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl border bg-card p-6 shadow-lg animate-in zoom-in-95 duration-200">
            <h3 className="font-serif text-2xl text-foreground mb-2">Delete Product</h3>
            <p className="text-sm text-muted-foreground mb-4">
              You are deleting <span className="font-semibold text-foreground">"{deleteTarget.name}"</span>. 
              This product belongs to a variety group with other items sharing the same base name.
            </p>

            <div className="space-y-3 mt-6">
              <Button
                type="button"
                variant="outline"
                disabled={deleting}
                onClick={() => handleDeleteSingle(deleteTarget)}
                className="w-full justify-start text-left py-6 h-auto cursor-pointer border-destructive/20 hover:border-destructive hover:bg-destructive/5"
              >
                <div>
                  <div className="font-semibold text-destructive">Delete Only This Variety</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Removes only "{deleteTarget.name.split(" - ")[1] || "Main"}". The other varieties will remain untouched.
                  </div>
                </div>
              </Button>

              <Button
                type="button"
                disabled={deleting}
                onClick={() => handleDeleteAll(deleteTarget)}
                className="w-full justify-start text-left py-6 h-auto cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                <div>
                  <div className="font-semibold">Delete Entire Product Group</div>
                  <div className="text-xs text-destructive-foreground/80 mt-0.5">
                    Removes this product and all other varieties sharing the base name "{deleteTarget.name.split(" - ")[0]}".
                  </div>
                </div>
              </Button>

              <Button
                type="button"
                variant="ghost"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="w-full rounded-full cursor-pointer mt-2"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PRODUCT FORM — inline (NOT a dialog)
   ══════════════════════════════════════════════════════════════════════════ */

function ProductForm({
  initial,
  isEdit,
  onSave,
  onCancel,
  existingCategories,
  products = [],
  onEditProduct,
  onDeleteProduct,
  onAddVariety,
}: {
  initial: any | null;
  isEdit: boolean;
  onSave: (data: any, isEdit: boolean) => Promise<void>;
  onCancel: () => void;
  existingCategories: string[];
  products?: any[];
  onEditProduct?: (prod: any) => void;
  onDeleteProduct?: (id: string) => Promise<void>;
  onAddVariety?: (baseProd: any) => void;
}) {
  const allCategories = [...new Set([...defaultCategories, ...existingCategories])];

  const [baseName, setBaseName] = useState(() => {
    const parts = (initial?.name ?? "").split(" - ");
    return parts[0];
  });
  const [color, setColor] = useState(() => {
    if (isEdit) {
      const parts = (initial?.name ?? "").split(" - ");
      return parts[1] ?? "";
    }
    return "";
  });
  const [price, setPrice] = useState<number>(initial?.price ?? 0);
  const [originalPrice, setOriginalPrice] = useState<number | undefined>(initial?.original_price ?? undefined);
  const [category, setCategory] = useState(initial?.category ?? allCategories[0] ?? "");
  const [customCategory, setCustomCategory] = useState("");
  const [showCustomCat, setShowCustomCat] = useState(false);
  const [materials, setMaterials] = useState(initial?.materials ?? "");
  const [dimensions, setDimensions] = useState(initial?.dimensions ?? "");
  const [story, setStory] = useState(initial?.story ?? "");
  const [badge, setBadge] = useState(initial?.badge ?? "");
  const [stock, setStock] = useState<number>(initial?.stock ?? 10);

  // Images
  const [mainImageUrl, setMainImageUrl] = useState(initial?.image ?? "");
  const [galleryUrls, setGalleryUrls] = useState<string[]>(initial?.gallery ?? []);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  const mainFileRef = useRef<HTMLInputElement>(null);
  const galleryFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const parts = (initial?.name ?? "").split(" - ");
    setBaseName(parts[0] || "");
    
    if (isEdit) {
      setColor(parts[1] ?? "");
    } else {
      setColor("");
    }
    
    setPrice(initial?.price ?? 0);
    setOriginalPrice(initial?.original_price ?? undefined);
    setCategory(initial?.category ?? defaultCategories[0] ?? "");
    setCustomCategory("");
    setShowCustomCat(false);
    setMaterials(initial?.materials ?? "");
    setDimensions(initial?.dimensions ?? "");
    setStory(initial?.story ?? "");
    setBadge(initial?.badge ?? "");
    setStock(initial?.stock ?? 10);
    setMainImageUrl(initial?.image ?? "");
    setGalleryUrls(initial?.gallery ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial, isEdit]);

  /* ── Image upload handlers ───────────────────────────────────────────────── */
  const handleMainUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      setMainImageUrl(url);
      toast.success("Main image uploaded");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        urls.push(await uploadImage(file));
      }
      setGalleryUrls((prev) => [...prev, ...urls]);
      toast.success(`${urls.length} image(s) uploaded`);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (galleryFileRef.current) galleryFileRef.current.value = "";
    }
  };

  const removeGallery = (i: number) =>
    setGalleryUrls((prev) => prev.filter((_, idx) => idx !== i));

  /* ── Add custom category ─────────────────────────────────────────────────── */
  const addCustomCategory = () => {
    const cat = customCategory.trim();
    if (!cat) return;
    setCategory(cat);
    setCustomCategory("");
    setShowCustomCat(false);
  };

  /* ── Submit ──────────────────────────────────────────────────────────────── */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!mainImageUrl) { toast.error("Please upload a main image"); return; }
    setBusy(true);
    try {
      const gallery = galleryUrls.length > 0 ? galleryUrls : [mainImageUrl];
      const fullName = color.trim() ? `${baseName.trim()} - ${color.trim()}` : baseName.trim();
      const payload: any = {
        name: fullName, price, category, materials, dimensions, story, badge,
        image: mainImageUrl, gallery, stock,
        original_price: originalPrice || null,
      };
      if (isEdit && initial?.id) payload.id = initial.id;
      await onSave(payload, isEdit);
    } catch (err) {
      console.error("Form submit failed:", err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-6 py-4">
        <button
          type="button" onClick={onCancel}
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-secondary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className="text-xl font-medium">
          {isEdit ? "Edit Product" : "Add New Product"}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-8">
        {/* ── Section 1: Basic Info ───────────────────────────────────────── */}
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Basic Information
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="p-name">Product Name *</Label>
              <Input id="p-name" required placeholder="e.g. Asha Yoga Mat"
                value={baseName} onChange={(e) => setBaseName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-price">Selling Price (₹) *</Label>
              <Input id="p-price" type="number" required min={0} placeholder="7400"
                value={price || ""} onChange={(e) => setPrice(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-original-price">Original Price / MRP (₹)</Label>
              <Input id="p-original-price" type="number" min={0} placeholder="11700"
                value={originalPrice || ""} onChange={(e) => setOriginalPrice(e.target.value ? Number(e.target.value) : undefined)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-stock">Stock Quantity *</Label>
              <Input id="p-stock" type="number" required min={0} placeholder="10"
                value={stock} onChange={(e) => setStock(Number(e.target.value))} />
            </div>
          </div>

          {price > 0 && originalPrice && originalPrice > price && (
            <div className="mt-4 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 dark:bg-emerald-500/20 p-2.5 rounded-lg border border-emerald-500/20 animate-in fade-in duration-300">
              Calculated Discount: {formatPrice(originalPrice - price)} off ({Math.round(((originalPrice - price) / originalPrice) * 100)}% discount)
            </div>
          )}

          {/* Category */}
          <div className="mt-4 space-y-2">
            <Label>Category *</Label>
            <div className="flex flex-wrap gap-2">
              {allCategories.map((c) => (
                <button
                  key={c} type="button"
                  onClick={() => setCategory(c)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    category === c
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:bg-secondary"
                  }`}
                >
                  {c}
                </button>
              ))}
              {/* Show custom category if it's not in list */}
              {category && !allCategories.includes(category) && (
                <span className="rounded-full border border-primary bg-primary text-primary-foreground px-3 py-1.5 text-sm">
                  {category}
                </span>
              )}
              <button
                type="button"
                onClick={() => setShowCustomCat(!showCustomCat)}
                className="rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
              >
                <Plus className="inline h-3 w-3 mr-1" />
                New Category
              </button>
            </div>
            {showCustomCat && (
              <div className="flex gap-2 mt-2 max-w-xs">
                <Input
                  placeholder="e.g. Outdoor"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomCategory(); } }}
                />
                <Button type="button" size="sm" onClick={addCustomCategory}>Add</Button>
              </div>
            )}
          </div>

          {/* Badge & Variety */}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="p-badge">Badge / Tag (optional)</Label>
              <Input id="p-badge" placeholder="e.g. Handwoven, Set of 4"
                value={badge} onChange={(e) => setBadge(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-variety">Product Variety (optional)</Label>
              <Input id="p-variety" placeholder="e.g. Green, Blue, Large, Round"
                value={color} onChange={(e) => setColor(e.target.value)} />
            </div>
          </div>
        </section>

        {/* ── Section 2: Details ──────────────────────────────────────────── */}
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Product Details
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="p-materials">Materials *</Label>
              <Input id="p-materials" required placeholder="e.g. Jute + cotton, sage trim"
                value={materials} onChange={(e) => setMaterials(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-dimensions">Dimensions *</Label>
              <Input id="p-dimensions" required placeholder="e.g. Ø 90 cm"
                value={dimensions} onChange={(e) => setDimensions(e.target.value)} />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <Label htmlFor="p-story">Description / Story *</Label>
            <Textarea id="p-story" required rows={4}
              placeholder="Describe the product's craft, origin, and feel…"
              value={story} onChange={(e) => setStory(e.target.value)} />
          </div>
        </section>

        {/* ── Section 3: Images ──────────────────────────────────────────── */}
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Product Images
          </h3>

          {/* Main image */}
          <div className="space-y-2">
            <Label>Main Image *</Label>
            <div className="flex items-start gap-4">
              {mainImageUrl ? (
                <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-xl border">
                  <img src={mainImageUrl} alt="Main" className="h-full w-full object-cover" />
                  <button type="button" onClick={() => setMainImageUrl("")}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => mainFileRef.current?.click()}
                  disabled={uploading}
                  className="flex h-32 w-32 shrink-0 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                  {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
                  <span className="text-xs">Upload</span>
                </button>
              )}
              <input ref={mainFileRef} type="file" accept="image/*" className="hidden" onChange={handleMainUpload} />
              <div className="text-xs text-muted-foreground pt-1">
                <p>Upload from your computer.</p>
                <p className="mt-1">Images are stored in Supabase Storage.</p>
                <p className="mt-1">Or paste a URL:</p>
                <Input className="mt-1" placeholder="https://…" value={mainImageUrl}
                  onChange={(e) => setMainImageUrl(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Gallery */}
          <div className="mt-6 space-y-2">
            <Label>Gallery Images</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Add multiple images for the product carousel. You can upload files or paste URLs.
            </p>

            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
              {galleryUrls.map((url, i) => (
                <div key={i} className="group relative overflow-hidden rounded-xl border bg-secondary/30">
                  <img src={url} alt={`Gallery ${i + 1}`} className="aspect-square w-full object-cover" />
                  <button type="button" onClick={() => removeGallery(i)}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="h-3 w-3" />
                  </button>
                  <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                    {i + 1}
                  </span>
                </div>
              ))}

              {/* Upload tile */}
              <button type="button" onClick={() => galleryFileRef.current?.click()}
                disabled={uploading}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                <span className="text-[10px]">Add images</span>
              </button>
            </div>
            <input ref={galleryFileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryUpload} />
          </div>
        </section>

        {/* ── Section 4: Varieties (Only shown when editing an existing product) ── */}
        {isEdit && initial && (
          <section className="border-t pt-8">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Product Varieties
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Varieties of this product (sharing the base name "{baseName.trim()}").
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-full border-dashed cursor-pointer"
                onClick={() => onAddVariety?.(initial)}
              >
                <Plus className="h-4 w-4 mr-1" /> Add New Variety
              </Button>
            </div>

            {/* List of varieties */}
            <div className="overflow-x-auto border rounded-xl bg-secondary/5">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">Image</TableHead>
                    <TableHead>Variety Name</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const originalBaseName = (initial?.name ?? "").split(" - ")[0].trim();
                    const siblingList = (products || []).filter(
                      (p) => p.name.split(" - ")[0] === originalBaseName
                    );
                    
                    if (siblingList.length === 0) {
                      return (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-xs">
                            No varieties found.
                          </TableCell>
                        </TableRow>
                      );
                    }

                    return siblingList.map((v) => {
                      const isCurrent = v.id === initial.id;
                      const vName = v.name.split(" - ")[1] || "Main (Default)";
                      return (
                        <TableRow key={v.id} className={isCurrent ? "bg-primary/5" : ""}>
                          <TableCell>
                            <img src={v.image} alt={vName} className="h-8 w-8 rounded object-cover bg-secondary" />
                          </TableCell>
                          <TableCell className="font-medium text-sm">
                            <div className="flex items-center gap-2">
                              <span>{vName}</span>
                              {isCurrent && (
                                <span className="text-[9px] text-primary bg-primary/10 rounded px-1.5 py-0.5 font-semibold">
                                  Currently Editing
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-mono">
                            {v.original_price && v.original_price > v.price ? (
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-red-600 dark:text-red-400">{formatPrice(v.price)}</span>
                                <span className="text-xs text-muted-foreground line-through">{formatPrice(v.original_price)}</span>
                              </div>
                            ) : (
                              formatPrice(v.price)
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {v.stock} units
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1.5">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={isCurrent}
                                onClick={() => onEditProduct?.(v)}
                                className="h-8 px-2 text-xs cursor-pointer"
                              >
                                Edit
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  await onDeleteProduct?.(v.id);
                                }}
                                className="h-8 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                              >
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })()}
                </TableBody>
              </Table>
            </div>
          </section>
        )}

        {/* ── Actions ─────────────────────────────────────────────────────── */}
        <div className="flex justify-end gap-3 border-t pt-6">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit" disabled={busy || uploading}>
            {busy ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Saving…</> :
              isEdit ? "Update Product" : "Add Product"}
          </Button>
        </div>
      </form>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   ORDERS ADMIN — live order tracking + shipping details + fulfillment
   ══════════════════════════════════════════════════════════════════════════ */

function OrdersAdmin({ initialOrders, onRefresh }: { initialOrders: any[], onRefresh: () => Promise<void> }) {
  const [orders, setOrders] = useState<any[]>(initialOrders);
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  const [selectedStatus, setSelectedStatus] = useState("");
  const [courierInput, setCourierInput] = useState("");
  const [trackingNumberInput, setTrackingNumberInput] = useState("");
  const [sellerInstructionInput, setSellerInstructionInput] = useState("");

  useEffect(() => { setOrders(initialOrders); }, [initialOrders]);

  useEffect(() => {
    if (selectedOrder) {
      setSelectedStatus(selectedOrder.status || "");
      setCourierInput(selectedOrder.courier || "");
      setTrackingNumberInput(selectedOrder.trackingNumber || "");
      setSellerInstructionInput(selectedOrder.sellerInstruction || "");
    } else {
      setSelectedStatus("");
      setCourierInput("");
      setTrackingNumberInput("");
      setSellerInstructionInput("");
    }
  }, [selectedOrder]);

  const handleStatusChange = async (id: string, newStatus: string, courierVal?: string, trackingVal?: string, sellerInstructionVal?: string, customerStatusVal?: string) => {
    setUpdatingId(id);
    try {
      const headers = await getAuthHeaders();
      const payload: any = { id, status: newStatus };
      if (newStatus === "Shipped") {
        payload.courier = courierVal || "";
        payload.trackingNumber = trackingVal || "";
      }
      if (sellerInstructionVal !== undefined) {
        payload.sellerInstruction = sellerInstructionVal;
      }
      if (customerStatusVal !== undefined) {
        payload.customerStatus = customerStatusVal;
      }
      const res = await fetch("/api/admin/orders", {
        method: "PUT",
        headers,
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to update status");
      toast.success("Order updated successfully!");
      await onRefresh();

      if (selectedOrder && selectedOrder.id === id) {
        setSelectedOrder((prev: any) => ({
          ...prev,
          status: newStatus,
          courier: newStatus === "Shipped" ? courierVal : null,
          trackingNumber: newStatus === "Shipped" ? trackingVal : null,
          sellerInstruction: sellerInstructionVal !== undefined ? sellerInstructionVal : prev.sellerInstruction,
          customerStatus: customerStatusVal !== undefined ? customerStatusVal : prev.customerStatus
        }));
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredOrders = orders.filter((o) =>
    o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
    o.customerName.toLowerCase().includes(search.toLowerCase()) ||
    o.customerEmail.toLowerCase().includes(search.toLowerCase()) ||
    o.shippingAddress.city.toLowerCase().includes(search.toLowerCase()) ||
    o.shippingAddress.state.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Pending": return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400";
      case "Shipped": return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
      case "Delivered": return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
      case "Cancelled":
      case "Cancelled by Customer":
      case "Cancelled by Seller":
        return "bg-destructive/10 text-destructive";
      default: return "bg-secondary text-secondary-foreground";
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {selectedOrder ? (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Button variant="ghost" size="sm" onClick={() => setSelectedOrder(null)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to Orders
            </Button>
          </div>

          <div className="grid gap-8 md:grid-cols-[1fr_350px]">
            <div className="space-y-6">
              <div className="flex justify-between items-start border-b pb-4">
                <div>
                  <h2 className="text-2xl font-serif">{selectedOrder.orderNumber}</h2>
                  <p className="text-sm text-muted-foreground">{formatDate(selectedOrder.date)}</p>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Seller Status:</span>
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusColor(selectedOrder.status)}`}>
                      {selectedOrder.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Customer Status:</span>
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      selectedOrder.customerStatus === "Cancelled by Customer"
                        ? "bg-destructive/10 text-destructive border border-destructive/20"
                        : "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20"
                    }`}>
                      {selectedOrder.customerStatus || "Pending"}
                    </span>
                  </div>
                </div>
              </div>

              {selectedOrder.cancellationReason && selectedOrder.customerStatus !== "Return Requested" && selectedOrder.customerStatus !== "Return Approved" && selectedOrder.customerStatus !== "Return Rejected" && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 animate-in fade-in slide-in-from-top-1 duration-200">
                  <span className="text-xs uppercase tracking-wider text-destructive font-semibold block">Reason for Cancellation</span>
                  <p className="text-sm mt-1 text-foreground font-medium">{selectedOrder.cancellationReason}</p>
                </div>
              )}

              {selectedOrder.customerStatus === "Return Requested" && (
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-5 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div>
                    <span className="text-xs uppercase tracking-wider text-purple-700 dark:text-purple-400 font-bold block">
                      Return Requested by Customer
                    </span>
                    <p className="text-sm mt-1 text-foreground font-medium">
                      Reason: "{selectedOrder.cancellationReason || "No reason provided"}"
                    </p>
                  </div>
                  
                  <div className="flex gap-3">
                    <Button
                      size="sm"
                      onClick={() => handleStatusChange(selectedOrder.id, "Cancelled", courierInput, trackingNumberInput, sellerInstructionInput, "Return Approved")}
                      disabled={updatingId === selectedOrder.id}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-5 text-xs font-semibold cursor-pointer"
                    >
                      Approve Return
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStatusChange(selectedOrder.id, "Delivered", courierInput, trackingNumberInput, sellerInstructionInput, "Return Rejected")}
                      disabled={updatingId === selectedOrder.id}
                      className="border-red-200 text-red-600 hover:bg-red-500/10 rounded-full px-5 text-xs font-semibold cursor-pointer"
                    >
                      Reject Return
                    </Button>
                  </div>
                </div>
              )}

              {(selectedOrder.customerStatus === "Return Approved" || selectedOrder.customerStatus === "Return Rejected") && (
                <div className={`border rounded-xl p-4 animate-in fade-in slide-in-from-top-1 duration-200 ${
                  selectedOrder.customerStatus === "Return Approved"
                    ? "bg-gray-100 dark:bg-gray-900/30 border-gray-200 text-gray-700 dark:text-gray-400"
                    : "bg-red-500/10 border-red-500/20 text-red-600"
                }`}>
                  <span className="text-xs uppercase tracking-wider font-bold block">
                    Return Request {selectedOrder.customerStatus === "Return Approved" ? "Approved" : "Rejected"}
                  </span>
                  <p className="text-sm mt-1 font-medium font-serif">
                    Customer Reason: "{selectedOrder.cancellationReason || "No reason provided"}"
                  </p>
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Ordered Items</h3>
                <ul className="divide-y border-y">
                  {selectedOrder.items.map((item: any, i: number) => (
                    <li key={i} className="flex gap-4 py-4 items-center">
                      <img src={item.productImage} alt={item.productName} className="h-16 w-14 rounded object-cover bg-secondary" />
                      <div className="flex-1">
                        <h4 className="font-medium text-foreground">{item.productName}</h4>
                        <span className="text-xs text-muted-foreground">Quantity: {item.qty}</span>
                      </div>
                      <div className="font-mono text-sm font-medium">{formatPrice(item.price * item.qty)}</div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-secondary/30 rounded-xl p-6 space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-2">
                  Payment Details
                </h3>
                {(() => {
                  const itemsSubtotal = selectedOrder.items.reduce((sum: number, item: any) => sum + (item.price * item.qty), 0);
                  return (
                    <dl className="text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Subtotal:</span>
                        <span className="font-medium text-foreground">{formatPrice(itemsSubtotal)}</span>
                      </div>
                      {selectedOrder.couponCode && selectedOrder.discountAmount > 0 && (
                        <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                          <span>Discount ({selectedOrder.couponCode}):</span>
                          <span>-{formatPrice(selectedOrder.discountAmount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Shipping:</span>
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">Free</span>
                      </div>
                      <div className="flex justify-between border-t pt-3 font-semibold mt-2 text-base">
                        <span className="text-foreground">Total Paid:</span>
                        <span className="text-primary font-bold">{formatPrice(selectedOrder.total)}</span>
                      </div>
                    </dl>
                  );
                })()}
              </div>
            </div>

            <div className="rounded-xl border bg-secondary/10 p-6 space-y-6">
              <h3 className="font-medium text-lg border-b pb-2">Customer & Shipping Details</h3>
              
              <div className="space-y-4">
                <div>
                  <span className="text-xs uppercase tracking-wider text-muted-foreground block">Customer Name</span>
                  <span className="font-medium">{selectedOrder.customerName}</span>
                </div>
                
                <div>
                  <span className="text-xs uppercase tracking-wider text-muted-foreground block">Email Address</span>
                  <span className="font-medium text-sm block truncate">{selectedOrder.customerEmail}</span>
                </div>

                <div>
                  <span className="text-xs uppercase tracking-wider text-muted-foreground block">Phone Number</span>
                  <span className="font-medium">{selectedOrder.customerPhone || "—"}</span>
                </div>

                <div>
                  <span className="text-xs uppercase tracking-wider text-muted-foreground block">Shipping Address</span>
                  <div className="text-sm space-y-1 mt-1 text-foreground">
                    <p>{selectedOrder.shippingAddress.street}</p>
                    <p>{selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state} {selectedOrder.shippingAddress.zipCode}</p>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <Label htmlFor="status-dropdown" className="text-xs uppercase tracking-wider text-muted-foreground block">Quick Status Update</Label>
                  <select
                    id="status-dropdown"
                    disabled={updatingId === selectedOrder.id}
                    value={selectedStatus}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedStatus(val);
                      if (val !== "Shipped") {
                        handleStatusChange(selectedOrder.id, val, courierInput, trackingNumberInput, sellerInstructionInput);
                      }
                    }}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-ring outline-none disabled:opacity-75 disabled:cursor-not-allowed"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Shipped">Shipped</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled by Seller">Cancelled by Seller</option>
                    <option value="Cancelled by Customer">Cancelled by Customer</option>
                    {selectedStatus === "Cancelled" && (
                      <option value="Cancelled">Cancelled</option>
                    )}
                  </select>

                  {selectedStatus === "Shipped" && (
                    <div className="space-y-3 p-3 rounded-lg border bg-background/50 animate-in fade-in duration-200">
                      <div className="space-y-1.5">
                        <Label htmlFor="courier-input" className="text-xs font-semibold text-muted-foreground">Courier Service Name</Label>
                        <Input
                          id="courier-input"
                          placeholder="e.g. Delhivery, BlueDart"
                          value={courierInput}
                          onChange={(e) => setCourierInput(e.target.value)}
                          className="h-9 text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="tracking-input" className="text-xs font-semibold text-muted-foreground">Tracking Number</Label>
                        <Input
                          id="tracking-input"
                          placeholder="e.g. TRK12345678"
                          value={trackingNumberInput}
                          onChange={(e) => setTrackingNumberInput(e.target.value)}
                          className="h-9 text-xs"
                        />
                      </div>
                      <Button
                        size="sm"
                        className="w-full text-xs h-9 cursor-pointer"
                        disabled={updatingId === selectedOrder.id || !courierInput.trim() || !trackingNumberInput.trim()}
                        onClick={() => handleStatusChange(selectedOrder.id, "Shipped", courierInput, trackingNumberInput, sellerInstructionInput)}
                      >
                        {updatingId === selectedOrder.id ? "Saving Details..." : "Save Shipped Details"}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="border-t pt-4 space-y-3">
                  <Label htmlFor="seller-instruction-textarea" className="text-xs uppercase tracking-wider text-muted-foreground block font-semibold">Special Instruction / Message to Customer</Label>
                  <Textarea
                    id="seller-instruction-textarea"
                    placeholder="Enter any instructions or update message for the customer here..."
                    value={sellerInstructionInput}
                    onChange={(e) => setSellerInstructionInput(e.target.value)}
                    rows={3}
                    className="text-xs bg-background focus-visible:ring-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="w-full text-xs h-9 cursor-pointer"
                    disabled={updatingId === selectedOrder.id}
                    onClick={() => handleStatusChange(selectedOrder.id, selectedStatus, courierInput, trackingNumberInput, sellerInstructionInput)}
                  >
                    {updatingId === selectedOrder.id ? "Saving Instruction..." : "Send Instruction to Customer"}
                  </Button>
                </div>

                {/* Customer Cancellation Reason */}
                {(selectedOrder.status === "Cancelled by Customer" || selectedOrder.cancellationReason) && (
                  <div className="border-t pt-4 space-y-3 animate-in fade-in duration-200">
                    <Label htmlFor="customer-reason-textarea" className="text-xs font-semibold text-destructive uppercase tracking-wider block">
                      Customer Cancellation Reason
                    </Label>
                    <Textarea
                      id="customer-reason-textarea"
                      readOnly
                      disabled
                      value={selectedOrder.cancellationReason || "No cancellation reason provided."}
                      rows={3}
                      className="text-xs bg-destructive/5 text-destructive-foreground border-destructive/20 cursor-not-allowed opacity-80"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
            <div>
              <h2 className="text-xl font-medium">Order Management</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Fulfill orders, track shipping, and update statuses.
              </p>
            </div>
            
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by order#, name, city..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                      No orders found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono font-medium">{order.orderNumber}</TableCell>
                      <TableCell>{formatDate(order.date)}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium text-foreground">{order.customerName}</div>
                          <div className="text-xs text-muted-foreground">{order.customerEmail}</div>
                        </div>
                      </TableCell>
                      <TableCell>{order.items.reduce((sum: number, item: any) => sum + item.qty, 0)} items</TableCell>
                      <TableCell className="font-medium">{formatPrice(order.total)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs">
                          <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <span>{order.shippingAddress.city}, {order.shippingAddress.state}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5 py-1">
                          {/* Seller Status */}
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider w-[55px]">Seller:</span>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold ${getStatusColor(order.status)}`}>
                              {order.status}
                            </span>
                          </div>
                          {/* Customer Status */}
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider w-[55px]">Customer:</span>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold ${
                              order.customerStatus === "Cancelled by Customer"
                                ? "bg-destructive/10 text-destructive border border-destructive/20"
                                : (order.customerStatus && order.customerStatus !== "Pending")
                                  ? getStatusColor(order.customerStatus)
                                  : "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20"
                            }`}>
                              {order.customerStatus || "Pending"}
                            </span>
                          </div>
                          {order.status === "Shipped" && order.courier && (
                            <div className="text-[9px] text-muted-foreground leading-tight pl-[59px] mt-0.5">
                              <span className="font-semibold">{order.courier}</span>: {order.trackingNumber}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedOrder(order)}>
                          View Details
                        </Button>
                        <select
                          disabled={updatingId === order.id}
                          value={order.status}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "Shipped") {
                              setSelectedOrder(order);
                              toast.info("Please fill in tracking details for the Shipped status.");
                            } else {
                              handleStatusChange(order.id, val);
                            }
                          }}
                          className="rounded border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring disabled:opacity-75 disabled:cursor-not-allowed"
                        >
                          <option value="Pending">Pending</option>
                          <option value="Shipped">Shipped</option>
                          <option value="Delivered">Delivered</option>
                          <option value="Cancelled by Seller">Cancelled by Seller</option>
                          <option value="Cancelled by Customer">Cancelled by Customer</option>
                          {order.status === "Cancelled" && (
                            <option value="Cancelled">Cancelled</option>
                          )}
                        </select>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   CUSTOMERS ADMIN — customer directory + lifetime spending + tags
   ══════════════════════════════════════════════════════════════════════════ */

function CustomersAdmin({
  initialCustomers,
  orders = [],
  products = []
}: {
  initialCustomers: any[];
  orders: any[];
  products: any[];
}) {
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);

  const filtered = initialCustomers.filter((c) =>
    (c.fullName || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.email || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.city || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.state || "").toLowerCase().includes(search.toLowerCase())
  );

  const getInitials = (name: string) => {
    if (!name || typeof name !== "string") return "??";
    return name
      .split(" ")
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Pending": return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400";
      case "Shipped": return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
      case "Delivered": return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
      case "Cancelled":
      case "Cancelled by Customer":
      case "Cancelled by Seller":
        return "bg-destructive/10 text-destructive";
      default: return "bg-secondary text-secondary-foreground";
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  /* ── Customer Detailed View ────────────────────────────────────────────── */
  if (selectedCustomer) {
    const c = selectedCustomer;

    // 1. Find all orders placed by this customer (matching email)
    const customerOrders = orders.filter(
      (o) => (o.customerEmail || "").toLowerCase().trim() === (c.email || "").toLowerCase().trim()
    );

    // 2. Compile purchased products from orders
    const purchasedMap = new Map<string, any>();
    customerOrders.forEach((o) => {
      (o.items || []).forEach((item: any) => {
        const existing = purchasedMap.get(item.productId);
        if (existing) {
          existing.qty += item.qty;
          existing.totalSpent += Number(item.price) * item.qty;
          if (new Date(o.date) > new Date(existing.lastOrdered)) {
            existing.lastOrdered = o.date;
          }
        } else {
          purchasedMap.set(item.productId, {
            id: item.productId,
            name: item.productName,
            image: item.productImage,
            price: Number(item.price),
            qty: item.qty,
            totalSpent: Number(item.price) * item.qty,
            lastOrdered: o.date,
          });
        }
      });
    });
    const purchasedProducts = Array.from(purchasedMap.values()).sort(
      (a, b) => b.qty - a.qty
    );

    // 3. Compile cart items (for registered users)
    const cartItems = (c.cart || [])
      .map((line: any) => {
        const prod = products.find((p) => p.id === line.id);
        return {
          product: prod || {
            id: line.id,
            name: "Unknown Product",
            image: "",
            price: 0,
            category: "Unknown",
          },
          qty: line.qty,
        };
      })
      .filter(Boolean);

    // 4. Compile wishlist items (for registered users)
    const wishlistItems = (c.wishlist || [])
      .map((id: string) => {
        return products.find((p) => p.id === id);
      })
      .filter(Boolean);

    // 5. Calculate Average Order Value (AOV)
    const aov = c.totalOrders > 0 ? c.totalSpent / c.totalOrders : 0;

    // Login Method Styling
    const getLoginMethodUI = (method: string) => {
      const formatted = (method || "").toLowerCase();
      if (formatted === "google") {
        return {
          label: "Google Account",
          badge: "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/25",
          icon: <LogIn className="h-4 w-4 text-red-500 mr-1.5" />
        };
      } else if (formatted === "guest") {
        return {
          label: "Guest Checkout",
          badge: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/25",
          icon: <Users className="h-4 w-4 text-slate-500 mr-1.5" />
        };
      } else {
        return {
          label: "Email / Password",
          badge: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25",
          icon: <Mail className="h-4 w-4 text-indigo-500 mr-1.5" />
        };
      }
    };

    const loginUI = getLoginMethodUI(c.loginMethod);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedCustomer(null)}
            className="hover:bg-secondary cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Customers
          </Button>
          <div className="text-xs text-muted-foreground font-mono">
            ID: {c.id}
          </div>
        </div>

        {/* Header Summary Banner */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-card to-secondary/20 p-6 md:p-8 shadow-sm">
          <div className="absolute right-0 top-0 -mr-6 -mt-6 h-36 w-36 rounded-full bg-primary/5 blur-2xl pointer-events-none" />
          
          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            {/* Avatar */}
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary/10 font-serif text-3xl font-bold text-primary shadow-inner border border-primary/20">
              {getInitials(c.fullName)}
            </div>

            {/* Main Info */}
            <div className="space-y-1.5 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-3xl font-serif tracking-tight text-foreground">{c.fullName}</h2>
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.isRegistered ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {c.isRegistered ? "Registered" : "Guest"}
                </span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${loginUI.badge}`}>
                  {loginUI.icon} {loginUI.label}
                </span>
              </div>
              
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Mail className="h-4 w-4" /> {c.email}
                </span>
                <span className="flex items-center gap-1">
                  <Phone className="h-4 w-4" /> {c.phone}
                </span>
                {c.age && c.age !== "—" && (
                  <span className="flex items-center gap-1">
                    <User className="h-4 w-4" /> {c.age} years old
                  </span>
                )}
                {c.city && c.city !== "—" && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" /> {c.city}, {c.state}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lifetime Spent</div>
            <div className="mt-2 text-2xl font-semibold font-serif text-emerald-600 dark:text-emerald-400">{formatPrice(c.totalSpent)}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Total revenue including tax</p>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Orders</div>
            <div className="mt-2 text-2xl font-semibold font-serif text-indigo-600 dark:text-indigo-400">{c.totalOrders} order{c.totalOrders !== 1 ? "s" : ""}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Successful or pending orders</p>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Avg. Order Value (AOV)</div>
            <div className="mt-2 text-2xl font-semibold font-serif text-amber-600 dark:text-amber-400">{formatPrice(aov)}</div>
            <p className="text-[10px] text-muted-foreground mt-1">LTV divided by total orders</p>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Delivery Location</div>
            <div className="mt-1 text-sm font-medium leading-relaxed truncate">
              {c.street !== "—" ? (
                <>
                  <span className="block font-semibold truncate">{c.street}</span>
                  <span className="block text-xs text-muted-foreground truncate">{c.city}, {c.state} {c.zipCode}</span>
                </>
              ) : (
                <span className="text-muted-foreground">No address stored</span>
              )}
            </div>
          </div>
        </div>

        {/* Main Details Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          
          {/* Purchased Products (Left column - takes 2/3 space on large screens) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2 border-b pb-4 mb-4">
                <ShoppingBag className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-medium">Products Purchased ({purchasedProducts.length})</h3>
              </div>

              {purchasedProducts.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  This customer has not purchased any products yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-center">Quantity</TableHead>
                        <TableHead>Unit Price</TableHead>
                        <TableHead className="text-right">Total Spent</TableHead>
                        <TableHead className="text-right">Last Ordered</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchasedProducts.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {p.image ? (
                                <img src={p.image} alt={p.name} className="h-10 w-9 object-cover rounded bg-secondary" />
                              ) : (
                                <div className="h-10 w-9 rounded bg-secondary flex items-center justify-center text-muted-foreground">
                                  <Layers className="h-4 w-4" />
                                </div>
                              )}
                              <span className="font-medium text-sm line-clamp-1">{p.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-semibold text-sm">{p.qty}</TableCell>
                          <TableCell className="text-sm">{formatPrice(p.price)}</TableCell>
                          <TableCell className="text-right font-medium text-sm">{formatPrice(p.totalSpent)}</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">{formatDate(p.lastOrdered)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Orders Log */}
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2 border-b pb-4 mb-4">
                <ClipboardList className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-medium">Orders Log ({customerOrders.length})</h3>
              </div>

              {customerOrders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No orders found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerOrders.map((o) => (
                        <TableRow key={o.id}>
                          <TableCell className="font-mono font-medium text-sm">{o.orderNumber}</TableCell>
                          <TableCell className="text-sm">{formatDate(o.date)}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold w-fit ${getStatusColor(o.status)}`}>
                                {o.status}
                              </span>
                              {o.cancellationReason && (
                                <span className="text-[10px] text-destructive/80 font-medium max-w-[180px] truncate" title={o.cancellationReason}>
                                  Reason: {o.cancellationReason}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium text-sm">{formatPrice(o.total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>

          {/* Cart & Wishlist (Right Column - takes 1/3 space) */}
          <div className="space-y-6">
            
            {/* Cart Section */}
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between border-b pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-medium">Shopping Cart</h3>
                </div>
                {c.isRegistered && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    {cartItems.reduce((acc: number, item: any) => acc + item.qty, 0)} items
                  </span>
                )}
              </div>

              {!c.isRegistered ? (
                <div className="rounded-lg bg-secondary/30 p-4 border border-dashed text-center">
                  <Info className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground font-medium">Persisted cart is only available for registered customers.</p>
                </div>
              ) : cartItems.length === 0 ? (
                <p className="text-center py-6 text-sm text-muted-foreground">Shopping cart is empty.</p>
              ) : (
                <ul className="divide-y max-h-60 overflow-y-auto pr-1 space-y-3">
                  {cartItems.map((item: any, idx: number) => (
                    <li key={idx} className="flex items-center gap-3 pt-3 first:pt-0">
                      {item.product.image ? (
                        <img src={item.product.image} alt={item.product.name} className="h-10 w-9 object-cover rounded bg-secondary shrink-0" />
                      ) : (
                        <div className="h-10 w-9 rounded bg-secondary flex items-center justify-center shrink-0">
                          <Layers className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{item.product.name}</p>
                        <p className="text-xs text-muted-foreground">{item.qty} units × {formatPrice(item.product.price)}</p>
                      </div>
                      <div className="text-sm font-semibold font-mono whitespace-nowrap">
                        {formatPrice(item.product.price * item.qty)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Wishlist Section */}
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between border-b pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-medium">Wishlist</h3>
                </div>
                {c.isRegistered && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    {wishlistItems.length} items
                  </span>
                )}
              </div>

              {!c.isRegistered ? (
                <div className="rounded-lg bg-secondary/30 p-4 border border-dashed text-center">
                  <Info className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground font-medium">Persisted wishlist is only available for registered customers.</p>
                </div>
              ) : wishlistItems.length === 0 ? (
                <p className="text-center py-6 text-sm text-muted-foreground">Wishlist is empty.</p>
              ) : (
                <ul className="divide-y max-h-60 overflow-y-auto pr-1">
                  {wishlistItems.map((prod: any, idx: number) => (
                    <li key={idx} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      {prod.image ? (
                        <img src={prod.image} alt={prod.name} className="h-10 w-9 object-cover rounded bg-secondary shrink-0" />
                      ) : (
                        <div className="h-10 w-9 rounded bg-secondary flex items-center justify-center shrink-0">
                          <Layers className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{prod.name}</p>
                        <p className="text-xs text-muted-foreground">{prod.category}</p>
                      </div>
                      <div className="text-sm font-semibold font-mono text-primary">
                        {formatPrice(prod.price)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

          </div>
        </div>
      </div>
    );
  }

  /* ── Customer List View ────────────────────────────────────────────────── */
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-medium">Customer Directory</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Registered members and guest accounts who completed checkout. Click any customer to view details.
          </p>
        </div>
        
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, city..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Primary Location</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-center">Total Orders</TableHead>
              <TableHead className="text-right">Total Spent</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  No customers found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setSelectedCustomer(c)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 font-serif text-sm font-semibold text-primary">
                        {getInitials(c.fullName)}
                      </div>
                      <div>
                        <div className="font-medium text-foreground">{c.fullName}</div>
                        <div className="text-xs text-muted-foreground">{c.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{c.phone}</TableCell>
                  <TableCell>
                    {c.street !== "—" ? (
                      <div className="flex items-center gap-1 text-xs">
                        <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span>{c.city}, {c.state}</span>
                      </div>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${c.isRegistered ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {c.isRegistered ? "Registered" : "Guest"}
                    </span>
                  </TableCell>
                  <TableCell className="text-center font-medium">{c.totalOrders}</TableCell>
                  <TableCell className="text-right font-medium font-mono">{formatPrice(c.totalSpent)}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedCustomer(c)}
                      className="hover:underline font-medium text-xs text-primary"
                    >
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   COUPONS ADMIN — coupon management (add, edit, list, delete)
   ══════════════════════════════════════════════════════════════════════════ */

function CouponsAdmin() {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState("");
  const [minOrder, setMinOrder] = useState("");
  const [limit, setLimit] = useState("");

  const fetchCoupons = async () => {
    try {
      const res = await fetch("/api/site-settings?key=coupons");
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.value?.coupons) {
          setCoupons(json.value.coupons);
          return;
        }
      }
      // Fallback defaults
      const defaults = [
        { code: "FESTIVE10", discount: 10 },
        { code: "FIRSTORDER", discount: 20 },
        { code: "SABARA15", discount: 15 }
      ];
      setCoupons(defaults);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load coupons");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const saveCoupons = async (updatedList: any[]) => {
    const headers = await getAuthHeaders();
    const res = await fetch("/api/admin/site-settings", {
      method: "POST",
      headers,
      body: JSON.stringify({
        key: "coupons",
        value: { coupons: updatedList }
      })
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || "Failed to update coupons settings");
    }
  };

  const handleAddCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const formattedCode = code.trim().toUpperCase();
    const pct = parseInt(discount, 10);
    const minOrderVal = minOrder.trim() ? parseFloat(minOrder) : undefined;
    const limitVal = limit.trim() ? parseInt(limit, 10) : undefined;

    if (!formattedCode) {
      toast.error("Please enter a coupon code");
      return;
    }
    if (isNaN(pct) || pct < 1 || pct > 100) {
      toast.error("Please enter a valid discount percentage (1-100)");
      return;
    }
    if (minOrderVal !== undefined && (isNaN(minOrderVal) || minOrderVal < 0)) {
      toast.error("Please enter a valid minimum order amount");
      return;
    }
    if (limitVal !== undefined && (isNaN(limitVal) || limitVal < 0)) {
      toast.error("Please enter a valid usage limit (stock)");
      return;
    }

    if (coupons.some((c) => c.code.toUpperCase() === formattedCode)) {
      toast.error("A coupon with this code already exists");
      return;
    }

    setAdding(true);
    const newCoupon = {
      code: formattedCode,
      discount: pct,
      ...(minOrderVal !== undefined ? { minOrder: minOrderVal } : {}),
      ...(limitVal !== undefined ? { limit: limitVal } : {})
    };
    const updatedList = [...coupons, newCoupon];

    try {
      await saveCoupons(updatedList);
      setCoupons(updatedList);
      setCode("");
      setDiscount("");
      setMinOrder("");
      setLimit("");
      toast.success(`Coupon ${formattedCode} added successfully!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to add coupon");
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteCoupon = async (codeToDelete: string) => {
    if (!confirm(`Are you sure you want to delete coupon ${codeToDelete}?`)) {
      return;
    }

    const updatedList = coupons.filter(
      (c) => c.code.toUpperCase() !== codeToDelete.toUpperCase()
    );

    try {
      await saveCoupons(updatedList);
      setCoupons(updatedList);
      toast.success(`Coupon ${codeToDelete} deleted successfully`);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete coupon");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      {/* Coupons List */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-medium">Active Discount Coupons</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage coupon codes and their corresponding percentage discount values.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Coupon Code</TableHead>
                <TableHead>Discount Value</TableHead>
                <TableHead>Min Order</TableHead>
                <TableHead>Usage Limit / Stock</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    No active coupons found. Add one on the right!
                  </TableCell>
                </TableRow>
              ) : (
                coupons.map((c) => (
                  <TableRow key={c.code}>
                    <TableCell>
                      <span className="font-mono font-bold text-sm bg-secondary/80 text-secondary-foreground px-3 py-1.5 rounded-lg border">
                        {c.code}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium text-emerald-600 dark:text-emerald-400">
                      {c.discount}% Discount
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground font-medium">
                      {c.minOrder !== undefined && c.minOrder !== null ? `₹${c.minOrder}` : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.limit !== undefined && c.limit !== null ? (
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${c.limit <= 0 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"}`}>
                          {c.limit} left
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Unlimited</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteCoupon(c.code)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Add Coupon Card */}
      <div className="rounded-xl border bg-card p-6 shadow-sm h-fit">
        <h3 className="text-lg font-medium mb-4">Create New Coupon</h3>
        <form onSubmit={handleAddCoupon} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="couponCode">Coupon Code</Label>
            <Input
              id="couponCode"
              placeholder="e.g. SABARA30"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="font-mono uppercase"
            />
            <p className="text-[10px] text-muted-foreground">
              Unique text identifying the discount. Alphanumeric, converted to uppercase.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="discountPercent">Discount Percentage (%)</Label>
            <Input
              id="discountPercent"
              type="number"
              min="1"
              max="100"
              placeholder="e.g. 30"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground">
              Percentage value between 1 and 100 deducted from the subtotal.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="minOrder">Minimum Order Amount (₹)</Label>
            <Input
              id="minOrder"
              type="number"
              min="0"
              placeholder="e.g. 500 (Optional)"
              value={minOrder}
              onChange={(e) => setMinOrder(e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground">
              Minimum cart subtotal required to apply this coupon. Leave empty for no minimum.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="usageLimit">Usage Limit (Stock)</Label>
            <Input
              id="usageLimit"
              type="number"
              min="0"
              placeholder="e.g. 50 (Optional)"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground">
              Number of times this coupon can be applied overall. Leave empty for unlimited.
            </p>
          </div>

          <Button type="submit" disabled={adding} className="w-full mt-4 rounded-full">
            {adding ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1.5" /> Add Coupon Code
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   HERO ADMIN (unchanged)
   ══════════════════════════════════════════════════════════════════════════ */

function HeroAdmin() {
  const { settings, updateSettings, isLoaded } = useHeroSettings();
  if (!isLoaded) return null;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    updateSettings({
      title: fd.get("title") as string,
      subtitle: fd.get("subtitle") as string,
      badge: fd.get("badge") as string,
      imageUrl: fd.get("imageUrl") as string,
    });
    toast.success("Hero settings updated successfully");
  };

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm max-w-2xl">
      <h2 className="text-xl font-medium mb-6">Edit Hero Section</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="badge">Badge Text</Label>
          <Input id="badge" name="badge" defaultValue={settings.badge} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="title">Main Title</Label>
          <Textarea id="title" name="title" defaultValue={settings.title} className="resize-none" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="subtitle">Subtitle / Description</Label>
          <Textarea id="subtitle" name="subtitle" defaultValue={settings.subtitle} rows={4} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="imageUrl">Background Image URL</Label>
          <Input id="imageUrl" name="imageUrl" defaultValue={settings.imageUrl} />
        </div>
        <Button type="submit" className="w-full mt-4">Save Changes</Button>
      </form>
    </div>
  );
}

function PromotionsAdmin() {
  const { settings, updateSettings, isLoaded } = usePromoSettings();
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!isLoaded) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const items = settings.items || [];

  const handleSavePromoSettings = async (updated: Partial<typeof settings>) => {
    setSaving(true);
    try {
      await updateSettings(updated);
      toast.success("Promotion settings updated successfully");
    } catch (e) {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleAddOrEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      toast.error("Promotion text is required");
      return;
    }

    let updatedItems = [...items];
    if (editingId) {
      // Edit existing
      updatedItems = updatedItems.map((item) =>
        item.id === editingId ? { ...item, text: text.trim(), link: link.trim(), isActive } : item
      );
      toast.success("Promotion updated");
    } else {
      // Add new
      const newItem = {
        id: Math.random().toString(36).substring(2, 9),
        text: text.trim(),
        link: link.trim(),
        isActive,
      };
      updatedItems.push(newItem);
      toast.success("Promotion added");
    }

    await handleSavePromoSettings({ items: updatedItems });

    // Reset form
    setText("");
    setLink("");
    setIsActive(true);
    setEditingId(null);
  };

  const handleStartEdit = (item: typeof items[0]) => {
    setEditingId(item.id);
    setText(item.text);
    setLink(item.link || "");
    setIsActive(item.isActive);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setText("");
    setLink("");
    setIsActive(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this promotion?")) return;
    const updatedItems = items.filter((item) => item.id !== id);
    await handleSavePromoSettings({ items: updatedItems });
    if (editingId === id) {
      handleCancelEdit();
    }
  };

  const handleToggleActive = async (id: string) => {
    const updatedItems = items.map((item) =>
      item.id === id ? { ...item, isActive: !item.isActive } : item
    );
    await handleSavePromoSettings({ items: updatedItems });
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    const newItems = [...items];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newItems.length) return;

    // Swap
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;

    await handleSavePromoSettings({ items: newItems });
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      {/* List and Config */}
      <div className="space-y-8">
        {/* Global Configuration */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-medium">Promo Bar Options</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Configure the visibility, colors, and autoplay settings of the announcement bar.
              </p>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-secondary/10">
              <div>
                <Label className="font-semibold">Enable Announcement Bar</Label>
                <p className="text-xs text-muted-foreground">Show/hide the bar globally on your site</p>
              </div>
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => handleSavePromoSettings({ enabled: e.target.checked })}
                className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg bg-secondary/10">
              <div>
                <Label className="font-semibold">Enable Autoplay</Label>
                <p className="text-xs text-muted-foreground">Automatically rotate between messages</p>
              </div>
              <input
                type="checkbox"
                checked={settings.autoPlay}
                onChange={(e) => handleSavePromoSettings({ autoPlay: e.target.checked })}
                className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                disabled={items.filter(i => i.isActive).length <= 1}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bgColor">Background Color</Label>
              <div className="flex gap-2">
                <input
                  id="bgColor"
                  type="color"
                  value={settings.backgroundColor}
                  onChange={(e) => handleSavePromoSettings({ backgroundColor: e.target.value })}
                  className="h-10 w-12 border rounded cursor-pointer p-0.5"
                />
                <Input
                  type="text"
                  value={settings.backgroundColor}
                  onChange={(e) => handleSavePromoSettings({ backgroundColor: e.target.value })}
                  className="font-mono"
                  placeholder="#111111"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Hex code or color picker value for the bar background.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="textColor">Text Color</Label>
              <div className="flex gap-2">
                <input
                  id="textColor"
                  type="color"
                  value={settings.textColor}
                  onChange={(e) => handleSavePromoSettings({ textColor: e.target.value })}
                  className="h-10 w-12 border rounded cursor-pointer p-0.5"
                />
                <Input
                  type="text"
                  value={settings.textColor}
                  onChange={(e) => handleSavePromoSettings({ textColor: e.target.value })}
                  className="font-mono"
                  placeholder="#FFFFFF"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Hex code or color picker value for the announcement text and icons.
              </p>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="interval">Rotation Interval (seconds)</Label>
              <Input
                id="interval"
                type="number"
                min="1"
                value={settings.autoPlayInterval}
                onChange={(e) => handleSavePromoSettings({ autoPlayInterval: parseInt(e.target.value) || 5 })}
                className="max-w-[200px]"
                disabled={!settings.autoPlay}
              />
              <p className="text-[10px] text-muted-foreground">
                How long each promotion displays before sliding to the next one.
              </p>
            </div>
          </div>
        </div>

        {/* Promotions List */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="text-lg font-medium mb-4">Promotions List</h3>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Order</TableHead>
                  <TableHead>Promotion Text</TableHead>
                  <TableHead>Link</TableHead>
                  <TableHead className="w-[100px] text-center">Status</TableHead>
                  <TableHead className="w-[120px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground text-sm">
                      No promotions created yet. Add one on the right!
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item, idx) => (
                    <TableRow key={item.id} className={editingId === item.id ? "bg-primary/5" : ""}>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMove(idx, "up")}
                            disabled={idx === 0}
                            className="h-7 w-7 p-0 cursor-pointer"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMove(idx, "down")}
                            disabled={idx === items.length - 1}
                            className="h-7 w-7 p-0 cursor-pointer"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium leading-relaxed block break-words max-w-[300px]">
                          {item.text}
                        </span>
                      </TableCell>
                      <TableCell>
                        {item.link ? (
                          <span className="text-xs font-mono bg-secondary px-2 py-1 rounded text-secondary-foreground truncate max-w-[150px] inline-block" title={item.link}>
                            {item.link}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">None</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <button
                          onClick={() => handleToggleActive(item.id)}
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold cursor-pointer border transition-colors ${
                            item.isActive
                              ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/30"
                              : "bg-muted text-muted-foreground border-transparent"
                          }`}
                        >
                          {item.isActive ? "Active" : "Inactive"}
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStartEdit(item)}
                            className="h-8 w-8 p-0 hover:bg-secondary cursor-pointer"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(item.id)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Add / Edit Form Card */}
      <div className="rounded-xl border bg-card p-6 shadow-sm h-fit">
        <h3 className="text-lg font-medium mb-4">
          {editingId ? "Edit Promotion" : "Create New Promotion"}
        </h3>
        <form onSubmit={handleAddOrEdit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="promoText">Promotion Text</Label>
            <Textarea
              id="promoText"
              placeholder="e.g. Free shipping on orders above ₹1000!"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <p className="text-[10px] text-muted-foreground">
              The announcement message shown to visitors. Keep it concise.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="promoLink">Link URL / Path (Optional)</Label>
            <Input
              id="promoLink"
              placeholder="e.g. /shop or https://external.com"
              value={link}
              onChange={(e) => setLink(e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground">
              Internal shop path (e.g., /shop) or full external URL. Clicking the bar navigates here.
            </p>
          </div>

          <div className="flex items-center gap-2 py-2">
            <input
              id="promoActive"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
            />
            <Label htmlFor="promoActive" className="cursor-pointer">
              Set active immediately
            </Label>
          </div>

          <div className="flex gap-2">
            {editingId && (
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelEdit}
                className="w-1/2 rounded-full cursor-pointer"
              >
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              disabled={saving}
              className={`rounded-full cursor-pointer ${editingId ? "w-1/2" : "w-full"}`}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...
                </>
              ) : editingId ? (
                <>
                  <Check className="h-4 w-4 mr-1.5" /> Save Changes
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1.5" /> Add Promotion
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
