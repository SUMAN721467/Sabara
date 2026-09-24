import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import heroImg from "@/assets/hero.jpg";
import craftImg from "@/assets/craft.jpg";

export type HeroSlide = {
  id: string;
  badge?: string;
  title?: string;
  subtitle?: string;
  imageUrl: string;
  mobileImageUrl?: string;
  buttonText?: string;
  buttonLink?: string;
  showInCarousel?: boolean;
};

export type HeroSettings = {
  title: string;
  subtitle: string;
  badge: string;
  imageUrl: string;
  mobileImageUrl?: string;
  slides?: HeroSlide[];
};

const defaultSettings: HeroSettings = {
  title: "Mats woven slowly, to live with you for years.",
  subtitle: "A collection of natural-fibre floor mats, yoga mats, doormats and table linens - each piece worked on a wooden loom by a single pair of hands.",
  badge: "Small batch · Handwoven",
  imageUrl: heroImg,
  mobileImageUrl: heroImg,
  slides: [],
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

export const defaultPromoSettings: PromoSettings = {
  enabled: true,
  backgroundColor: "#f5f0e8",
  textColor: "#2d3329",
  autoPlay: true,
  autoPlayInterval: 5,
  items: []
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
            setSettings({
              ...defaultPromoSettings,
              ...data.value,
              items: Array.isArray(data.value.items) ? data.value.items : [],
            });
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

import mat1 from "@/assets/mat-1.jpg";
import mat2 from "@/assets/mat-2.jpg";
import mat3 from "@/assets/mat-3.jpg";
import mat4 from "@/assets/mat-4.jpg";

export type CollectionCategoryItem = {
  id: string;
  name: string;
  category?: string;
  link?: string;
  image: string;
};

export type CollectionsSection = {
  badge: string;
  title: string;
  items: CollectionCategoryItem[];
};

export type ValuesBandItem = {
  icon: string;
  title: string;
  text: string;
};

export type HomepageSettings = {
  collectionsSection?: CollectionsSection;
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
  collectionsSection: {
    badge: "Artisanal Weaves",
    title: "Collections",
    items: [
      { id: "col-1", name: "Floor Mats", category: "Floor", link: "/shop?category=Floor", image: mat1 },
      { id: "col-2", name: "Yoga Mats", category: "Yoga", link: "/shop?category=Yoga", image: mat2 },
      { id: "col-3", name: "Doormats", category: "Doormat", link: "/shop?category=Doormat", image: mat3 },
      { id: "col-4", name: "Table Linens", category: "Table", link: "/shop?category=Table", image: mat4 },
    ],
  },
  valuesBand: [
    { icon: "Hand", title: "Handmade", text: "Woven slowly on traditional pit looms." },
    { icon: "Leaf", title: "Eco-Friendly", text: "Natural, biodegradable materials." },
    { icon: "Shield", title: "Durable", text: "Designed for heavy everyday use." },
    { icon: "Truck", title: "Pan-India Shipping", text: "Delivered straight to your doorstep." },
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
              collectionsSection: data.value.collectionsSection || defaultHomepageSettings.collectionsSection,
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
      collectionsSection: {
        ...(settings.collectionsSection || defaultHomepageSettings.collectionsSection!),
        ...(newSettings.collectionsSection || {}),
      },
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


