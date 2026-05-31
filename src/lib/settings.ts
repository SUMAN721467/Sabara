import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import heroImg from "@/assets/hero.jpg";

export type HeroSettings = {
  title: string;
  subtitle: string;
  badge: string;
  imageUrl: string;
};

const defaultSettings: HeroSettings = {
  title: "Mats woven slowly, to live with you for years.",
  subtitle: "A collection of natural-fibre floor mats, yoga mats, doormats and table linens — each piece worked on a wooden loom by a single pair of hands.",
  badge: "Small batch · Handwoven",
  imageUrl: heroImg,
};

export function useHeroSettings() {
  const [settings, setSettings] = useState<HeroSettings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/site-settings?key=hero");
        if (res.ok) {
          const data = await res.json();
          if (data?.success && data?.value) {
            setSettings({ ...defaultSettings, ...data.value });
          }
        }
      } catch (e) {
        console.error("[useHeroSettings load error]", e);
      } finally {
        setIsLoaded(true);
      }
    }
    loadSettings();
  }, []);

  const updateSettings = async (newSettings: Partial<HeroSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/admin/site-settings", {
        method: "POST",
        headers,
        body: JSON.stringify({
          key: "hero",
          value: updated,
        }),
      });

      if (!res.ok) {
        console.error("[useHeroSettings update failed]", await res.text());
      }
    } catch (e) {
      console.error("[useHeroSettings update error]", e);
    }
  };

  return { settings, updateSettings, isLoaded };
}

export type PromotionItem = {
  id: string;
  text: string;
  link?: string;
  isActive: boolean;
};

export type PromoSettings = {
  enabled: boolean;
  backgroundColor: string;
  textColor: string;
  autoPlay: boolean;
  autoPlayInterval: number; // in seconds
  items: PromotionItem[];
};

const defaultPromoSettings: PromoSettings = {
  enabled: true,
  backgroundColor: "#111111",
  textColor: "#ffffff",
  autoPlay: true,
  autoPlayInterval: 5,
  items: [
    { id: "1", text: "Get any 3 100ml PERFUMES for just ₹1298", link: "/shop", isActive: true },
    { id: "2", text: "Free shipping on orders above ₹1000!", link: "", isActive: true },
    { id: "3", text: "Use coupon FESTIVE10 for 10% off your first purchase!", link: "", isActive: true }
  ]
};

export function usePromoSettings() {
  const [settings, setSettings] = useState<PromoSettings>(defaultPromoSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/site-settings?key=promotions");
        if (res.ok) {
          const data = await res.json();
          if (data?.success && data?.value) {
            setSettings({ ...defaultPromoSettings, ...data.value });
          }
        }
      } catch (e) {
        console.error("[usePromoSettings load error]", e);
      } finally {
        setIsLoaded(true);
      }
    }
    loadSettings();
  }, []);

  const updateSettings = async (newSettings: Partial<PromoSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/admin/site-settings", {
        method: "POST",
        headers,
        body: JSON.stringify({
          key: "promotions",
          value: updated,
        }),
      });

      if (!res.ok) {
        console.error("[usePromoSettings update failed]", await res.text());
      }
    } catch (e) {
      console.error("[usePromoSettings update error]", e);
    }
  };

  return { settings, updateSettings, isLoaded };
}

