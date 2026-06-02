import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import heroImg from "@/assets/hero.jpg";
import craftImg from "@/assets/craft.jpg";

export type HeroSettings = {
  title: string;
  subtitle: string;
  badge: string;
  imageUrl: string;
};

const defaultSettings: HeroSettings = {
  title: "Mats woven slowly, to live with you for years.",
  subtitle: "A collection of natural-fibre floor mats, yoga mats, doormats and table linens - each piece worked on a wooden loom by a single pair of hands.",
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

export type ValuesBandItem = {
  icon: string;
  title: string;
  text: string;
};

export type HomepageSettings = {
  valuesBand: ValuesBandItem[];
  featuredSection: {
    badge: string;
    title: string;
  };
  craftStory: {
    badge: string;
    title: string;
    description: string;
    imageUrl: string;
  };
  testimonials: {
    q: string;
    a: string;
  }[];
  showTestimonials: boolean;
};

export const defaultHomepageSettings: HomepageSettings = {
  valuesBand: [
    { icon: "Hand", title: "Hand-made", text: "Woven by a single artisan on a wooden loom." },
    { icon: "Leaf", title: "Natural fibres", text: "Jute, cotton, coir and seagrass. Nothing synthetic." },
    { icon: "Package", title: "Plastic-free shipping", text: "Wrapped in cotton and recycled paper." },
  ],
  featuredSection: {
    badge: "The collection",
    title: "Recently off the loom",
  },
  craftStory: {
    badge: "Our craft",
    title: "Three days at the loom, one mat at a time.",
    description: "Each piece begins with raw fibre — jute spun on a charkha, cotton dyed in small batches with plant pigments. From there, it moves to a wooden pit loom, where a single weaver works the warp and weft over two to four days.",
    imageUrl: craftImg,
  },
  testimonials: [
    { q: "Beautifully made, and softer than I expected. It already feels like an heirloom.", a: "Priya, Bangalore" },
    { q: "The doormat has survived a Pacific Northwest winter. Worth every penny.", a: "Marcus, Portland" },
    { q: "I bought the yoga mat in spring — I still notice the weave under my hands every morning.", a: "Elena, Lisbon" },
  ],
  showTestimonials: true,
};

export function useHomepageSettings() {
  const [settings, setSettings] = useState<HomepageSettings>(defaultHomepageSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/site-settings?key=homepage");
        if (res.ok) {
          const data = await res.json();
          if (data?.success && data?.value) {
            setSettings({
              valuesBand: data.value.valuesBand || defaultHomepageSettings.valuesBand,
              featuredSection: {
                ...defaultHomepageSettings.featuredSection,
                ...(data.value.featuredSection || {}),
              },
              craftStory: {
                ...defaultHomepageSettings.craftStory,
                ...(data.value.craftStory || {}),
              },
              testimonials: data.value.testimonials || defaultHomepageSettings.testimonials,
              showTestimonials: data.value.showTestimonials !== undefined ? data.value.showTestimonials : defaultHomepageSettings.showTestimonials,
            });
          }
        }
      } catch (e) {
        console.error("[useHomepageSettings load error]", e);
      } finally {
        setIsLoaded(true);
      }
    }
    loadSettings();
  }, []);

  const updateSettings = async (newSettings: Partial<HomepageSettings>) => {
    const updated = {
      ...settings,
      ...newSettings,
      featuredSection: {
        ...settings.featuredSection,
        ...(newSettings.featuredSection || {}),
      },
      craftStory: {
        ...settings.craftStory,
        ...(newSettings.craftStory || {}),
      },
    };
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
          key: "homepage",
          value: updated,
        }),
      });

      if (!res.ok) {
        console.error("[useHomepageSettings update failed]", await res.text());
      }
    } catch (e) {
      console.error("[useHomepageSettings update error]", e);
    }
  };

  return { settings, updateSettings, isLoaded };
}

export type ShippingSettings = {
  enabled: boolean;
  fee: number;
  minOrder: number;
};

export const defaultShippingSettings: ShippingSettings = {
  enabled: true,
  fee: 100, // ₹100 shipping fee
  minOrder: 1000, // Free shipping above ₹1000
};

export function useShippingSettings() {
  const [settings, setSettings] = useState<ShippingSettings>(defaultShippingSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/site-settings?key=shipping");
        if (res.ok) {
          const data = await res.json();
          if (data?.success && data?.value) {
            setSettings({ ...defaultShippingSettings, ...data.value });
          }
        }
      } catch (e) {
        console.error("[useShippingSettings load error]", e);
      } finally {
        setIsLoaded(true);
      }
    }
    loadSettings();
  }, []);

  const updateSettings = async (newSettings: Partial<ShippingSettings>) => {
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
          key: "shipping",
          value: updated,
        }),
      });

      if (!res.ok) {
        console.error("[useShippingSettings update failed]", await res.text());
      }
    } catch (e) {
      console.error("[useShippingSettings update error]", e);
    }
  };

  return { settings, updateSettings, isLoaded };
}


