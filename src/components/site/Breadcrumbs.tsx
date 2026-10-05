import { Link } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  name: string;
  url?: string;
  search?: Record<string, any>;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center text-sm text-muted-foreground", className)}>
      <ol className="flex items-center gap-1.5 sm:gap-2.5">
        <li>
          <Link to="/" className="flex items-center transition-colors hover:text-foreground">
            <Home className="h-3.5 w-3.5" />
            <span className="sr-only">Home</span>
          </Link>
        </li>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={index} className="flex items-center gap-1.5 sm:gap-2.5">
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
              {isLast || !item.url ? (
                <span className="font-medium text-foreground line-clamp-1" aria-current="page">
                  {item.name}
                </span>
              ) : (
                <Link
                  to={item.url as any}
                  search={item.search as any}
                  className="transition-colors hover:text-foreground line-clamp-1"
                >
                  {item.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
