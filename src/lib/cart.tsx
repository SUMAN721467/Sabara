import { createContext, useContext, useEffect, useMemo, useState, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";

export type CartLine = { id: string; qty: number };

type CartCtx = {
  lines: CartLine[];
  add: (id: string, qty?: number) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  count: number;
  subtotal: number;
  detailed: Array<CartLine & { product: any }>;
  loading: boolean;
};

const Ctx = createContext<CartCtx | null>(null);
const STORAGE_KEY = "handcraft-cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [dbProducts, setDbProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const { user } = useAuth();
  const userRef = useRef<string | null>(null);
  const [sessionExistsOnMount, setSessionExistsOnMount] = useState<boolean | null>(null);
  const [hasSyncedOnLogin, setHasSyncedOnLogin] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessionExistsOnMount(!!data.session);
    });
  }, []);

  // Helper: Sync cart to DB
  const syncCartToDb = async (cartLines: CartLine[], providerName?: string) => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) return;

      const payload: any = { cart: cartLines };
      if (providerName) {
        payload.loginMethod = providerName;
      }

      await fetch("/api/users/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.error("[CartProvider sync error]", e);
    }
  };

  // 1. Hydrate cart lines from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setLines(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  // 2. Persist cart lines to localStorage
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {}
  }, [lines, hydrated]);

  // 3. Fetch products dynamically from the database
  useEffect(() => {
    async function loadProducts() {
      try {
        const res = await fetch("/api/products");
        if (res.ok) {
          const json = await res.json();
          if (json?.products) {
            setDbProducts(json.products);
          }
        }
      } catch (e) {
        console.error("[CartProvider db fetch error]", e);
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, []);

  // 4. Handle initial sync / merge on login
  useEffect(() => {
    async function syncOnLogin() {
      if (sessionExistsOnMount === null) return;

      if (user && user.id !== userRef.current) {
        userRef.current = user.id;
        setHasSyncedOnLogin(false);
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData?.session?.access_token;
          if (!token) return;

          const res = await fetch("/api/users/sync", {
            headers: { "Authorization": `Bearer ${token}` }
          });
          if (res.ok) {
            const json = await res.json();
            if (json.success) {
              const dbCart: CartLine[] = json.cart || [];
              const provider = sessionData?.session?.user?.app_metadata?.provider || null;

              if (sessionExistsOnMount) {
                // Session restored on page load: overwrite local cart with DB cart
                setLines(dbCart);
                setSessionExistsOnMount(false);
                setHasSyncedOnLogin(true);
              } else {
                // Fresh login: merge guest cart with DB cart
                setLines((currentLines) => {
                  const mergedMap = new Map<string, number>();
                  currentLines.forEach((l) => mergedMap.set(l.id, l.qty));
                  dbCart.forEach((dbLine) => {
                    const product = dbProducts.find((p) => p.id === dbLine.id);
                    const maxStock = product?.stock !== undefined && product?.stock !== null ? Number(product.stock) : 10;
                    const currentQty = mergedMap.get(dbLine.id) || 0;
                    const newQty = Math.min(maxStock, currentQty + dbLine.qty);
                    mergedMap.set(dbLine.id, newQty);
                  });

                  const merged = Array.from(mergedMap.entries()).map(([id, qty]) => ({ id, qty }));
                  syncCartToDb(merged, provider);
                  return merged;
                });
                setHasSyncedOnLogin(true);
              }
            }
          }
        } catch (e) {
          console.error("Cart sync on login error:", e);
        }
      } else if (!user) {
        if (userRef.current !== null) {
          // Clear cart on logout
          setLines([]);
        }
        userRef.current = null;
        setHasSyncedOnLogin(false);
      }
    }

    if (hydrated && dbProducts.length > 0) {
      syncOnLogin();
    }
  }, [user, hydrated, dbProducts, sessionExistsOnMount]);

  // 5. Watch lines change to sync to DB for logged in users
  useEffect(() => {
    if (hydrated && user && dbProducts.length > 0 && hasSyncedOnLogin) {
      syncCartToDb(lines);
    }
  }, [lines, hydrated, user, dbProducts, hasSyncedOnLogin]);

  // 6. Automatically clean up stale/invalid items from lines once dbProducts is loaded
  useEffect(() => {
    if (!loading && dbProducts.length > 0 && lines.length > 0) {
      const validLines = lines.filter(l => dbProducts.some(p => p.id === l.id));
      if (validLines.length !== lines.length) {
        setLines(validLines);
      }
    }
  }, [loading, dbProducts, lines]);

  const value = useMemo<CartCtx>(() => {
    const detailed = lines
      .map((l) => {
        const product = dbProducts.find((p) => p.id === l.id);
        return product ? { ...l, product } : null;
      })
      .filter(Boolean) as Array<CartLine & { product: any }>;

    return {
      lines,
      detailed,
      loading,
      count: detailed.reduce((s, l) => s + l.qty, 0),
      subtotal: detailed.reduce((s, l) => s + l.product.price * l.qty, 0),
      add: (id, qty = 1) =>
        setLines((prev) => {
          const product = dbProducts.find((p) => p.id === id);
          const maxStock = product?.stock !== undefined && product?.stock !== null ? Number(product.stock) : 10;
          const found = prev.find((l) => l.id === id);
          if (found) {
            const newQty = Math.min(maxStock, found.qty + qty);
            if (newQty === found.qty && found.qty >= maxStock) {
              return prev;
            }
            return prev.map((l) => (l.id === id ? { ...l, qty: newQty } : l));
          }
          return [...prev, { id, qty: Math.min(maxStock, qty) }];
        }),
      setQty: (id, qty) =>
        setLines((prev) => {
          const product = dbProducts.find((p) => p.id === id);
          const maxStock = product?.stock !== undefined && product?.stock !== null ? Number(product.stock) : 10;
          const targetQty = Math.min(maxStock, qty);
          return targetQty <= 0 ? prev.filter((l) => l.id !== id) : prev.map((l) => (l.id === id ? { ...l, qty: targetQty } : l));
        }),
      remove: (id) => setLines((prev) => prev.filter((l) => l.id !== id)),
      clear: () => setLines([]),
    };
  }, [lines, dbProducts, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCart must be used within CartProvider");
  return v;
}

export function formatPrice(n: number) {
  return `\u20B9${n.toLocaleString("en-IN")}`;
}
