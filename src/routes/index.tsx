import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ArrowRight, Leaf, Hand, Package } from "lucide-react";
import * as LucideIcons from "lucide-react";
import hero from "@/assets/hero.jpg";
import craft from "@/assets/craft.jpg";
import mat1 from "@/assets/mat-1.jpg";
import mat2 from "@/assets/mat-2.jpg";
import mat3 from "@/assets/mat-3.jpg";
import mat4 from "@/assets/mat-4.jpg";
import { ProductCard } from "@/components/site/ProductCard";
import { useHeroSettings, useHomepageSettings, defaultHomepageSettings } from "@/lib/settings";
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { getOrSeedProducts } from "./api/products";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { getSiteSetting } from "./api/site-settings";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

const getFeaturedProducts = createServerFn({ method: "GET" })
  .handler(async () => {
    try {
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const supabase = createClient(supabaseUrl!, supabaseKey!);
      const list = await getOrSeedProducts(supabase, true);

      const groups = new Map<string, any[]>();
      list.forEach((p: any) => {
        const baseName = p.name.split(" - ")[0];
        if (!groups.has(baseName)) {
          groups.set(baseName, []);
        }
        groups.get(baseName)!.push(p);
      });

      const featured = Array.from(groups.values()).map((all) => {
        const sorted = [...all].sort((a, b) => {
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
          return aTime - bTime;
        });
        const main = sorted[0];

        // Roll up (aggregate) rating and review count across all variants of this base product
        let totalScore = 0;
        let totalReviews = 0;
        all.forEach((p: any) => {
          if (p.rating && p.reviewsCount) {
            totalScore += p.rating * p.reviewsCount;
            totalReviews += p.reviewsCount;
          }
        });
        const averageRating = totalReviews > 0 ? Number((totalScore / totalReviews).toFixed(1)) : null;

        return {
          ...main,
          rating: averageRating,
          reviewsCount: totalReviews,
          variants: sorted,
        };
      });

      return featured.slice(0, 4);
    } catch (err: any) {
      console.error("[getFeaturedProducts ERROR]", err?.message, err?.stack);
      return [];
    }
  });

const getHeroSettingsServer = createServerFn({ method: "GET" })
  .handler(async () => {
    try {
      // Discover schema columns once if files are missing
      try {
        const fs = await import("fs");
        if (!fs.existsSync("user_profiles_columns.json") || !fs.existsSync("orders_columns.json")) {
          const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
          const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
          const supabase = serviceKey
            ? createClient(supabaseUrl!, serviceKey, {
                auth: {
                  storage: undefined,
                  persistSession: false,
                  autoRefreshToken: false,
                }
              })
            : createClient(supabaseUrl!, (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY)!);

          const { data: profileSample } = await supabase.from("user_profiles").select("*").limit(1);
          const { data: orderSample } = await supabase.from("orders").select("*").limit(1);
          fs.writeFileSync("user_profiles_columns.json", JSON.stringify({
            keys: profileSample && profileSample[0] ? Object.keys(profileSample[0]) : [],
            sample: profileSample && profileSample[0] ? profileSample[0] : null
          }, null, 2));
          fs.writeFileSync("orders_columns.json", JSON.stringify({
            keys: orderSample && orderSample[0] ? Object.keys(orderSample[0]) : [],
            sample: orderSample && orderSample[0] ? orderSample[0] : null
          }, null, 2));
        }
      } catch (err) {
        console.error("Schema discovery error:", err);
      }

      return await getSiteSetting("hero");
    } catch (e) {
      console.error("[getHeroSettingsServer error]", e);
    }
    return null;
  });

const getHomepageSettingsServer = createServerFn({ method: "GET" })
  .handler(async () => {
    try {
      return await getSiteSetting("homepage");
    } catch (e) {
      console.error("[getHomepageSettingsServer error]", e);
    }
    return null;
  });

export const Route = createFileRoute("/")({
  loader: async () => {
    try {
      const [featured, heroSettings, homepageSettings] = await Promise.all([
        getFeaturedProducts(),
        getHeroSettingsServer(),
        getHomepageSettingsServer(),
      ]);
      return { featured, heroSettings, homepageSettings };
    } catch (err: any) {
      console.error("[Index loader ERROR]", err?.message, err?.stack);
      return { featured: [], heroSettings: null, homepageSettings: null };
    }
  },
  component: Index,
  head: () => ({
    meta: [
      { title: "Sabara - Woven with Tradition" },
      {
        name: "description",
        content:
          "Small-batch handwoven mats in natural fibres. Floor mats, yoga mats, doormats and table linens made by artisans.",
      },
    ],
  }),
});

function Index() {
  const { featured, heroSettings, homepageSettings: serverHomepageSettings } = Route.useLoaderData();
  const { settings: clientSettings, isLoaded } = useHeroSettings();
  const { settings: clientHomepageSettings, isLoaded: homepageLoaded } = useHomepageSettings();

  const settings = isLoaded ? clientSettings : (heroSettings || clientSettings);
  const homepageSettings = (homepageLoaded ? clientHomepageSettings : (serverHomepageSettings || clientHomepageSettings)) || defaultHomepageSettings;
  const showHero = !!heroSettings || isLoaded;

  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!api) return;
    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap());

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap());
    });
  }, [api]);

  useEffect(() => {
    if (!api) return;
    const interval = setInterval(() => {
      if (api.canScrollNext()) {
        api.scrollNext();
      } else {
        api.scrollTo(0);
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [api]);

  const dbSlides = (settings as any).slides?.filter((s: any) => s.imageUrl || s.mobileImageUrl);
  const slides = (dbSlides && dbSlides.length > 0) ? dbSlides : [
    {
      id: "slide-1",
      badge: settings.badge || "Small batch · Handwoven",
      title: settings.title || "Mats woven slowly, to live with you for years.",
      subtitle: settings.subtitle || "A collection of natural-fibre floor mats, yoga mats, doormats and table linens - each piece worked on a wooden loom by a single pair of hands.",
      imageUrl: settings.imageUrl || hero,
      mobileImageUrl: settings.mobileImageUrl || settings.imageUrl || hero,
      buttonText: "Shop the collection",
      buttonLink: "/shop",
    },
    {
      id: "slide-2",
      badge: "Asha Yoga Collection",
      title: "Ground your practice in nature.",
      subtitle: "Organic cotton yoga mats, plant-dyed and hand-loomed for a natural, grounding grip.",
      imageUrl: mat2,
      mobileImageUrl: mat2,
      buttonText: "Shop Yoga Mats",
      buttonLink: "/shop",
    },
    {
      id: "slide-3",
      badge: "Hardwearing Doormats",
      title: "Welcome home, naturally.",
      subtitle: "Sturdy coir and jute doormats made to welcome boots and withstand muddy seasons.",
      imageUrl: mat3,
      mobileImageUrl: mat3,
      buttonText: "Shop Doormats",
      buttonLink: "/shop",
    },
  ];

  const values = [
    {
      icon: "Heart",
      title: "Women Empowerment",
    },
    {
      icon: "RefreshCw",
      title: "Circular Fashion",
    },
    {
      icon: "Leaf",
      title: "Sustainable",
    },
    {
      icon: "Grid",
      title: "Heirloom Crafts",
    },
    {
      icon: "RotateCcw",
      title: "Easy Returns",
    },
  ];

  return (
    <div>
      {/* HERO — full width sliding carousel */}
      <section className="relative w-full overflow-hidden transition-opacity duration-500" style={{ opacity: showHero ? 1 : 0 }}>
        <Carousel setApi={setApi} opts={{ loop: true }} className="w-full relative aspect-[207/325] md:aspect-[32/13] h-auto min-h-0">
          <CarouselContent className="-ml-0 h-full w-full">
            {slides.map((slide: any, index: number) => (
              <CarouselItem key={slide.id || index} className="pl-0 relative h-full w-full flex-none">
                <Link
                  to="/shop"
                  className="block relative w-full aspect-[207/325] md:aspect-[32/13] overflow-hidden cursor-pointer"
                >
                  {/* Mobile Image */}
                  <img
                    src={slide.mobileImageUrl || slide.imageUrl}
                    alt={slide.title || "Hero mobile banner"}
                    width={414}
                    height={650}
                    loading={index === 0 ? "eager" : "lazy"}
                    fetchPriority={index === 0 ? "high" : "low"}
                    className="block md:hidden h-full w-full object-cover object-center transition-transform duration-[4000ms] ease-out hover:scale-[1.02]"
                  />
                  {/* Desktop Image */}
                  <img
                    src={slide.imageUrl}
                    alt={slide.title || "Hero banner"}
                    width={1600}
                    height={650}
                    loading={index === 0 ? "eager" : "lazy"}
                    fetchPriority={index === 0 ? "high" : "low"}
                    className="hidden md:block h-full w-full object-cover object-center transition-transform duration-[4000ms] ease-out hover:scale-[1.02]"
                  />
                </Link>
              </CarouselItem>
            ))}
          </CarouselContent>
          
          {/* Custom Arrow buttons absolute overlays */}
          <CarouselPrevious className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/30 hover:bg-background/60 hover:text-foreground text-foreground border-none rounded-full h-10 w-10 flex items-center justify-center backdrop-blur-sm cursor-pointer z-10 transition-all hover:scale-105 active:scale-95 shrink-0" />
          <CarouselNext className="absolute right-4 top-1/2 -translate-y-1/2 bg-background/30 hover:bg-background/60 hover:text-foreground text-foreground border-none rounded-full h-10 w-10 flex items-center justify-center backdrop-blur-sm cursor-pointer z-10 transition-all hover:scale-105 active:scale-95 shrink-0" />

          {/* Dots indicators overlay */}
          <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2 z-10">
            {Array.from({ length: count }).map((_, i) => (
              <button
                key={i}
                onClick={() => api?.scrollTo(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300 cursor-pointer",
                  current === i ? "w-6 bg-primary" : "w-1.5 bg-foreground/30 hover:bg-foreground/50"
                )}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </Carousel>
      </section>

      {/* VALUES BAND */}
      <section className="border-y border-border/60 bg-secondary/20 py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid grid-cols-2 gap-y-6 gap-x-4 sm:flex sm:flex-wrap sm:justify-around sm:gap-x-6 md:grid md:grid-cols-5 md:gap-4">
            {values.map((v, i) => {
              const IconComponent = (LucideIcons as any)[v.icon] || LucideIcons.HelpCircle;
              return (
                <ScrollReveal key={i} variant="fade-up" delay={i * 80} duration={500}>
                  <div className="flex flex-col items-center text-center group cursor-default">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card text-primary transition-all duration-300 group-hover:scale-110 group-hover:border-primary group-hover:bg-primary/5 shadow-sm">
                      <IconComponent className="h-6 w-6 transition-transform duration-500 group-hover:rotate-12 text-primary" />
                    </div>
                    <span className="mt-3 font-serif text-[11px] font-semibold tracking-wider text-foreground uppercase max-w-[120px] leading-tight transition-colors duration-300 group-hover:text-primary">
                      {v.title}
                    </span>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* COLLECTIONS GRID */}
      <section className="bg-background py-16 border-b border-border/60">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <ScrollReveal variant="fade-up" duration={700}>
            <div className="text-center mb-12">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                Artisanal Weaves
              </span>
              <h2 className="mt-2 font-serif text-3xl sm:text-4xl text-foreground">
                Collections
              </h2>
              <div className="mx-auto mt-4 h-[1px] w-12 bg-primary/45" />
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-4">
            {[
              { name: "Floor Mats", category: "Floor", image: mat1 },
              { name: "Yoga Mats", category: "Yoga", image: mat2 },
              { name: "Doormats", category: "Doormat", image: mat3 },
              { name: "Table Linens", category: "Table", image: mat4 },
            ].map((col, i) => (
              <ScrollReveal key={col.name} variant="fade-up" delay={i * 100} duration={700}>
                <Link
                  to={`/shop?category=${col.category}`}
                  className="group block text-center"
                >
                  <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-border/20 shadow-sm transition-all duration-300 hover:shadow-md">
                    <img
                      src={col.image}
                      alt={col.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    />
                  </div>
                  <h3 className="mt-4 font-serif text-xs sm:text-sm font-semibold uppercase tracking-wider text-foreground transition-colors group-hover:text-primary">
                    {col.name}
                  </h3>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <ScrollReveal variant="fade-up" duration={700}>
          <div className="flex items-end justify-between gap-4">
            <div>
              <span className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                {homepageSettings?.featuredSection?.badge || defaultHomepageSettings.featuredSection.badge}
              </span>
              <h2 className="mt-2 font-serif text-3xl text-foreground md:text-4xl">
                {homepageSettings?.featuredSection?.title || defaultHomepageSettings.featuredSection.title}
              </h2>
            </div>
            <Link
              to="/shop"
              className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline-flex link-underline pb-0.5"
            >
              View all →
            </Link>
          </div>
        </ScrollReveal>

        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-4">
          {(featured || []).map((p: any, i: number) => (
            <ScrollReveal key={p.id} variant="fade-up" delay={i * 100} duration={700}>
              <ProductCard product={p} />
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* CRAFT STORY */}
      <section className="bg-secondary/40">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 md:grid-cols-2 md:items-center">
          <ScrollReveal variant="fade-right" duration={900}>
            <div className="overflow-hidden rounded-2xl">
              <img
                src={homepageSettings?.craftStory?.imageUrl || defaultHomepageSettings.craftStory.imageUrl}
                alt="Hands weaving on a wooden loom"
                loading="lazy"
                width={1400}
                height={1000}
                className="h-full w-full object-cover transition-transform duration-1000 hover:scale-105"
              />
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fade-left" duration={900} delay={100}>
            <div>
              <span className="text-xs font-medium uppercase tracking-[0.22em] text-primary">
                {homepageSettings?.craftStory?.badge || defaultHomepageSettings.craftStory.badge}
              </span>
              <h2 className="mt-3 font-serif text-3xl text-foreground md:text-4xl">
                {homepageSettings?.craftStory?.title || defaultHomepageSettings.craftStory.title}
              </h2>
              <p className="mt-5 leading-relaxed text-muted-foreground whitespace-pre-line">
                {homepageSettings?.craftStory?.description || defaultHomepageSettings.craftStory.description}
              </p>
              <Link
                to="/about"
                className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-foreground link-underline pb-0.5"
              >
                Read the full story <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* TESTIMONIALS */}
      {homepageSettings?.showTestimonials !== false && (
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="grid gap-8 md:grid-cols-3">
            {(homepageSettings?.testimonials || defaultHomepageSettings.testimonials).map((t: any, i: number) => (
              <ScrollReveal key={i} variant="fade-up" delay={i * 120} duration={800}>
                <figure className="rounded-2xl border border-border/60 bg-card p-6 h-full transition-shadow duration-300 hover:shadow-md">
                  <blockquote className="font-serif text-lg leading-snug text-foreground">
                    &ldquo;{t.q}&rdquo;
                  </blockquote>
                  <figcaption className="mt-4 text-xs uppercase tracking-wider text-muted-foreground">
                    {t.a}
                  </figcaption>
                </figure>
              </ScrollReveal>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}

// trigger-refresh
