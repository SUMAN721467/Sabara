import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Search, X, TrendingUp, Flame, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import type { Product } from "@/data/products";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Fetch actual products from the database API
  const { data, isLoading } = useQuery({
    queryKey: ["products", "all"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to load products");
      return res.json() as Promise<{ products: Product[]; categories: string[] }>;
    },
    enabled: isOpen, // Only fetch when modal is open
    staleTime: 120000, // 2 minutes
  });

  const allProducts = data?.products || [];
  
  const trending = data?.categories || [];

  const bestsellers = allProducts.slice(0, 2);

  const filteredProducts = query.trim()
    ? allProducts.filter((p) => 
        p.name.toLowerCase().includes(query.toLowerCase()) || 
        (p.category && p.category.toLowerCase().includes(query.toLowerCase())) ||
        (p.materials && p.materials.toLowerCase().includes(query.toLowerCase()))
      ).slice(0, 8)
    : [];

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate({ to: "/shop", search: { q: query.trim() } as never });
      onClose();
    }
  };

  const handleSuggestionClick = (term: string) => {
    navigate({ to: "/shop", search: { q: term } as never });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] sm:pt-[15vh]">
      {/* Backdrop overlay */}
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      {/* Modal Box */}
      <div className="relative w-[95%] max-w-3xl rounded-3xl bg-card border border-border shadow-2xl p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200">
        <form onSubmit={handleSearch} className="flex items-center border-b border-border/50 pb-4">
          <Search className="h-6 w-6 text-primary shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search mats, natural fibres, styles..."
            className="flex-1 bg-transparent px-4 text-xl sm:text-2xl font-light text-foreground placeholder:text-muted-foreground outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </form>

        <div className="mt-8 space-y-8 overflow-y-auto max-h-[60vh] pr-2">
          {query.trim() ? (
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold tracking-wider text-muted-foreground mb-4">
                <Search className="h-4 w-4" />
                SEARCH RESULTS
              </div>
              
              {filteredProducts.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {filteredProducts.map((product) => (
                    <Link
                      key={product.id}
                      to="/product/$id"
                      params={{ id: product.id }}
                      onClick={onClose}
                      className="flex items-center gap-4 rounded-2xl border border-border/60 bg-background p-3 transition-colors hover:border-primary hover:bg-primary/5 group"
                    >
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-secondary">
                        <img 
                          src={product.image} 
                          alt={product.name} 
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" 
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground line-clamp-1">{product.name}</span>
                        <span className="text-sm font-medium text-primary mt-0.5">₹{product.price.toLocaleString()}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  No products found for "{query}". Try a different search term.
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Trending Searches */}
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold tracking-wider text-muted-foreground">
                  <TrendingUp className="h-4 w-4" />
                  TRENDING SEARCHES
                </div>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  {trending.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => handleSuggestionClick(term)}
                      className="rounded-full border border-border/60 bg-background px-4 py-2 text-sm text-foreground transition-colors hover:border-primary hover:bg-primary/5"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bestselling Essentials */}
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold tracking-wider text-muted-foreground">
                  <Flame className="h-4 w-4 text-orange-500" />
                  Bestselling Essentials
                </div>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {bestsellers.map((product) => (
                    <Link
                      key={product.id}
                      to="/product/$id"
                      params={{ id: product.id }}
                      onClick={onClose}
                      className="flex items-center gap-4 rounded-2xl border border-border/60 bg-background p-3 transition-colors hover:border-primary hover:bg-primary/5 group"
                    >
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-secondary">
                        <img 
                          src={product.image} 
                          alt={product.name} 
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" 
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground line-clamp-1">{product.name}</span>
                        <span className="text-sm font-medium text-primary mt-0.5">₹{product.price.toLocaleString()}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
