import { createContext, useContext, useEffect, useMemo, useState, useRef, type ReactNode } from "react";
import type { Product } from "@/data/products";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";

type WishlistCtx = {
  wishlist: string[];
  detailed: Product[];
  add: (id: string) => void;
  remove: (id: string) => void;
  toggle: (id: string) => void;
  has: (id: string) => boolean;
  clear: () => void;
  count: number;
  loading: boolean;
};

const Ctx = createContext<WishlistCtx | null>(null);
const STORAGE_KEY = "sabara-wishlist";

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [dbProducts, setDbProducts] = useState<Product[]>([]);
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

  // Helper: Sync wishlist to DB
  const syncWishlistToDb = async (wishlistItems: string[], providerName?: string) => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) return;

      const payload: any = { wishlist: wishlistItems };
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
      console.error("[WishlistProvider sync error]", e);
    }
  };

  // 1. Hydrate wishlist from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setWishlist(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  // 2. Persist wishlist to localStorage
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(wishlist));
    } catch {}
  }, [wishlist, hydrated]);

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
        console.error("[WishlistProvider db fetch error]", e);
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
              const dbWishlist: string[] = json.wishlist || [];
              const provider = sessionData?.session?.user?.app_metadata?.provider || null;

              if (sessionExistsOnMount) {
                setWishlist(dbWishlist);
                setSessionExistsOnMount(false);
                setHasSyncedOnLogin(true);
              } else {
                setWishlist((currentWishlist) => {
                  // Merge sets
                  const mergedSet = new Set([...currentWishlist, ...dbWishlist]);
                  const merged = Array.from(mergedSet);
                  syncWishlistToDb(merged, provider);
                  return merged;
                });
                setHasSyncedOnLogin(true);
              }
            }
          }
        } catch (e) {
          console.error("Wishlist sync on login error:", e);
        }
      } else if (!user) {
        if (userRef.current !== null) {
          setWishlist([]);
        }
        userRef.current = null;
        setHasSyncedOnLogin(false);
      }
    }

    if (hydrated && dbProducts.length > 0) {
      syncOnLogin();
    }
  }, [user, hydrated, dbProducts, sessionExistsOnMount]);

  // 5. Watch wishlist change to sync to DB for logged in users
  useEffect(() => {
    if (hydrated && user && dbProducts.length > 0 && hasSyncedOnLogin) {
      syncWishlistToDb(wishlist);
    }
  }, [wishlist, hydrated, user, dbProducts, hasSyncedOnLogin]);

  const value = useMemo<WishlistCtx>(() => {
    const detailed = wishlist
      .map((id) => dbProducts.find((p) => p.id === id))
      .filter(Boolean) as Product[];

    return {
      wishlist,
      detailed,
      loading,
      count: wishlist.length,
      add: (id) =>
        setWishlist((prev) => (prev.includes(id) ? prev : [...prev, id])),
      remove: (id) => setWishlist((prev) => prev.filter((item) => item !== id)),
      toggle: (id) =>
        setWishlist((prev) =>
          prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        ),
      has: (id) => wishlist.includes(id),
      clear: () => setWishlist([]),
    };
  }, [wishlist, dbProducts, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWishlist() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWishlist must be used within WishlistProvider");
  return v;
}
