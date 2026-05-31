import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { categories, products as fallbackProducts, type Category, type Product } from "@/data/products";
import { ProductCard } from "@/components/site/ProductCard";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

type Sort = "featured" | "low" | "high";

type SearchParams = { q?: string; category?: string };

export const Route = createFileRoute("/shop")({
  component: Shop,
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    q: typeof search.q === "string" ? search.q : undefined,
    category: typeof search.category === "string" ? search.category : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Shop · Sabara" },
      { name: "description", content: "Browse our collection of handwoven natural-fibre mats." },
    ],
  }),
});

async function fetchProducts(params: { q?: string; category?: string }): Promise<Product[]> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.category && params.category !== "All") search.set("category", params.category);
  const res = await fetch(`/api/products?${search.toString()}`);
  if (!res.ok) throw new Error("Failed to load products");
  const data = (await res.json()) as { products: Product[] };
  return data.products;
}

function groupProducts(list: Product[]): Product[] {
  const groups = new Map<string, Product[]>();
  list.forEach((p) => {
    const baseName = p.name.split(" - ")[0];
    if (!groups.has(baseName)) {
      groups.set(baseName, []);
    }
    groups.get(baseName)!.push(p);
  });

  return Array.from(groups.values()).map((all) => {
    const sorted = [...all].sort((a, b) => {
      const aTime = (a as any).created_at ? new Date((a as any).created_at).getTime() : 0;
      const bTime = (b as any).created_at ? new Date((b as any).created_at).getTime() : 0;
      return aTime - bTime;
    });
    const main = sorted[0];
    return {
      ...main,
      variants: sorted,
    };
  }) as Product[];
}

function ProductCardSkeleton() {
  return (
    <div className="group block rounded-xl p-2 bg-card/45 border border-border/20">
      <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-secondary/50 animate-pulse" />
      <div className="mt-3 flex items-baseline justify-between gap-3 px-1">
        <div className="h-5 w-2/3 rounded bg-secondary/50 animate-pulse" />
        <div className="h-4 w-1/4 rounded bg-secondary/50 animate-pulse shrink-0" />
      </div>
      <div className="mt-2.5 flex gap-1.5 px-1">
        <div className="h-6 w-6 rounded-full bg-secondary/50 animate-pulse" />
        <div className="h-6 w-6 rounded-full bg-secondary/50 animate-pulse" />
      </div>
    </div>
  );
}

function Shop() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();

  const [cat, setCat] = useState<Category | "All">(
    (search.category as Category | "All" | undefined) ?? "All",
  );
  const [sort, setSort] = useState<Sort>("featured");
  const [query, setQuery] = useState(search.q ?? "");

  // Sync URL changes (e.g. from navbar search) into local input
  useEffect(() => {
    setQuery(search.q ?? "");
  }, [search.q]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["products", search.q ?? "", cat],
    queryFn: () => fetchProducts({ q: search.q, category: cat }),
    placeholderData: (prev) => prev,
  });

  const visible = useMemo(() => {
    let list = data;
    // If the database query failed, fallback to mock products so the site remains browsable
    if (isError || (!isLoading && !data)) {
      const q = (search.q ?? "").toLowerCase().trim();
      let fallbackList = cat === "All" ? fallbackProducts : fallbackProducts.filter((p) => p.category === cat);
      if (q) {
        fallbackList = fallbackList.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.materials.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q),
        );
      }
      list = fallbackList;
    }
    const grouped = groupProducts(list ?? []);
    if (sort === "low") return [...grouped].sort((a, b) => a.price - b.price);
    if (sort === "high") return [...grouped].sort((a, b) => b.price - a.price);
    return grouped;
  }, [data, isError, isLoading, sort, cat, search.q]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ search: { q: query.trim() || undefined, category: cat !== "All" ? cat : undefined } });
  };

  const onCategory = (c: Category | "All") => {
    setCat(c);
    navigate({ search: { q: search.q, category: c !== "All" ? c : undefined } });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-20">
      <ScrollReveal variant="fade-up" duration={800}>
        <header className="max-w-2xl">
          <span className="text-xs font-medium uppercase tracking-[0.22em] text-primary">
            The full collection
          </span>
          <h1 className="mt-3 font-serif text-4xl text-foreground md:text-5xl">All mats</h1>
          <p className="mt-3 text-muted-foreground">
            Each piece is one of a small batch — slight variation is part of the weave.
          </p>
        </header>
      </ScrollReveal>

      <ScrollReveal variant="fade-up" duration={700} delay={100}>
        <form
          onSubmit={submitSearch}
          className="mt-8 flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 focus-within:ring-2 focus-within:ring-ring transition-all"
        >
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search mats…"
            className="h-8 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          {(query || search.q) && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                navigate({ search: { category: cat !== "All" ? cat : undefined } });
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </form>
      </ScrollReveal>

      <ScrollReveal variant="fade-up" duration={700} delay={150}>
        <div className="mt-6 flex flex-col gap-4 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="-mx-1 flex flex-wrap gap-1">
            {(["All", ...categories] as const).map((c) => (
              <button
                key={c}
                onClick={() => onCategory(c)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm transition-all duration-200 hover:scale-105 active:scale-95",
                  cat === c
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                {c}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring transition-all"
            >
              <option value="featured">Featured</option>
              <option value="low">Price · Low to high</option>
              <option value="high">Price · High to low</option>
            </select>
          </label>
        </div>
      </ScrollReveal>

      {isError && (
        <p className="mt-8 text-sm text-muted-foreground animate-pulse">
          Showing demo catalogue — live data is unavailable right now.
        </p>
      )}

      <div className="mt-10 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))
        ) : (
          visible.map((p, i) => (
            <ScrollReveal key={p.id} variant="fade-up" delay={(i % 6) * 80} duration={600} once={true}>
              <ProductCard product={p} />
            </ScrollReveal>
          ))
        )}
      </div>

      {!isLoading && visible.length === 0 && (
        <p className="mt-12 text-center text-muted-foreground animate-in fade-in duration-300">
          No mats match {search.q ? `“${search.q}”` : "that filter"}.
        </p>
      )}
    </div>
  );
}
