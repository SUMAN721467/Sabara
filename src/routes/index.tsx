import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Leaf, Hand, Package } from "lucide-react";
import hero from "@/assets/hero.jpg";
import craft from "@/assets/craft.jpg";
import { ProductCard } from "@/components/site/ProductCard";
import { useHeroSettings } from "@/lib/settings";
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { getOrSeedProducts } from "./api/products";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

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
        return {
          ...main,
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
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const supabase = createClient(supabaseUrl!, supabaseKey!);

      // Discover schema columns
      try {
        const { data: profileSample } = await supabase.from("user_profiles").select("*").limit(1);
        const { data: orderSample } = await supabase.from("orders").select("*").limit(1);
        const fs = await import("fs");
        fs.writeFileSync("user_profiles_columns.json", JSON.stringify({
          keys: profileSample && profileSample[0] ? Object.keys(profileSample[0]) : [],
          sample: profileSample && profileSample[0] ? profileSample[0] : null
        }, null, 2));
        fs.writeFileSync("orders_columns.json", JSON.stringify({
          keys: orderSample && orderSample[0] ? Object.keys(orderSample[0]) : [],
          sample: orderSample && orderSample[0] ? orderSample[0] : null
        }, null, 2));
      } catch (err) {
        console.error("Schema discovery error:", err);
      }

      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "hero")
        .single();

      if (data?.value) {
        return data.value;
      }
    } catch (e) {
      console.error("[getHeroSettingsServer error]", e);
    }
    return null;
  });

export const Route = createFileRoute("/")({
  loader: async () => {
    try {
      const [featured, heroSettings] = await Promise.all([
        getFeaturedProducts(),
        getHeroSettingsServer(),
      ]);
      return { featured, heroSettings };
    } catch (err: any) {
      console.error("[Index loader ERROR]", err?.message, err?.stack);
      return { featured: [], heroSettings: null };
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
  const { featured, heroSettings } = Route.useLoaderData();
  const { settings: clientSettings, isLoaded } = useHeroSettings();

  const settings = isLoaded ? clientSettings : (heroSettings || clientSettings);
  const showHero = !!heroSettings || isLoaded;

  return (
    <div>
      {/* HERO — full width */}
      <section className="relative h-[85vh] min-h-[520px] w-full overflow-hidden transition-opacity duration-500" style={{ opacity: showHero ? 1 : 0 }}>
        <img
          src={settings.imageUrl}
          alt={settings.title}
          width={1600}
          height={1100}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 ease-out hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/60 to-transparent" />
        <div className="relative mx-auto flex h-full max-w-6xl items-center px-4 sm:px-6">
          <ScrollReveal variant="fade-up" duration={1000} className="max-w-xl">
            <div>
              <span className="text-xs font-medium uppercase tracking-[0.22em] text-primary">
                {settings.badge}
              </span>
              <h1 className="mt-5 font-serif text-5xl leading-[1.05] tracking-tight text-foreground md:text-6xl lg:text-7xl">
                {settings.title}
              </h1>
              <p className="mt-5 max-w-md text-base leading-relaxed text-foreground/80 whitespace-pre-line">
                {settings.subtitle}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  to="/shop"
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-all duration-200 hover:bg-primary/95 hover:scale-105 active:scale-95 shadow-sm"
                >
                  Shop the collection <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/about"
                  className="inline-flex items-center gap-2 rounded-full border border-foreground/20 bg-background/60 px-4 py-3 text-sm font-medium text-foreground/90 backdrop-blur-sm transition-all duration-200 hover:bg-background/80 hover:scale-105 active:scale-95"
                >
                  Meet the makers
                </Link>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* VALUES BAND */}
      <section className="border-y border-border/60 bg-secondary/40">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6">
          {[
            { icon: Hand, title: "Hand-made", text: "Woven by a single artisan on a wooden loom." },
            { icon: Leaf, title: "Natural fibres", text: "Jute, cotton, coir and seagrass. Nothing synthetic." },
            { icon: Package, title: "Plastic-free shipping", text: "Wrapped in cotton and recycled paper." },
          ].map((v, i) => (
            <ScrollReveal key={v.title} variant="fade-up" delay={i * 120} duration={600}>
              <div className="flex items-start gap-3">
                <v.icon className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <div className="text-sm font-medium text-foreground">{v.title}</div>
                  <div className="text-sm text-muted-foreground">{v.text}</div>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* FEATURED */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <ScrollReveal variant="fade-up" duration={700}>
          <div className="flex items-end justify-between gap-4">
            <div>
              <span className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                The collection
              </span>
              <h2 className="mt-2 font-serif text-3xl text-foreground md:text-4xl">
                Recently off the loom
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

        <div className="mt-10 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((p: any, i: number) => (
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
                src={craft}
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
                Our craft
              </span>
              <h2 className="mt-3 font-serif text-3xl text-foreground md:text-4xl">
                Three days at the loom, one mat at a time.
              </h2>
              <p className="mt-5 leading-relaxed text-muted-foreground">
                Each piece begins with raw fibre — jute spun on a charkha, cotton dyed in small
                batches with plant pigments. From there, it moves to a wooden pit loom, where a
                single weaver works the warp and weft over two to four days.
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
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid gap-8 md:grid-cols-3">
          {[
            { q: "Beautifully made, and softer than I expected. It already feels like an heirloom.", a: "Priya, Bangalore" },
            { q: "The doormat has survived a Pacific Northwest winter. Worth every penny.", a: "Marcus, Portland" },
            { q: "I bought the yoga mat in spring — I still notice the weave under my hands every morning.", a: "Elena, Lisbon" },
          ].map((t, i) => (
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

      {/* NEWSLETTER */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <ScrollReveal variant="zoom-in" duration={800}>
          <div className="rounded-3xl bg-primary/10 px-6 py-14 text-center sm:px-12">
            <h2 className="mx-auto max-w-xl font-serif text-3xl text-foreground md:text-4xl">
              New mats, every few weeks.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
              Quiet notes about what just came off the loom. No noise, no offers.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                (e.currentTarget as HTMLFormElement).reset();
              }}
              className="mx-auto mt-7 flex w-full max-w-md flex-col gap-2 sm:flex-row"
            >
              <input
                type="email"
                required
                placeholder="you@example.com"
                className="h-11 flex-1 rounded-full border border-border bg-background px-5 text-sm outline-none ring-ring focus:ring-2 transition-all"
              />
              <button className="h-11 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-all duration-200 hover:bg-primary/95 hover:scale-105 active:scale-95 shadow-sm">
                Subscribe
              </button>
            </form>
          </div>
        </ScrollReveal>
      </section>
    </div>
  );
}

// trigger-refresh
