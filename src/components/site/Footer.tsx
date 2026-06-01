import { Link } from "@tanstack/react-router";
import { Instagram, Mail, Phone } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-12 border-t border-border/60 bg-secondary/40">
      <div className="mx-auto grid grid-cols-2 max-w-6xl gap-8 px-4 py-8 sm:px-6 md:grid-cols-4">
        <div className="col-span-2 md:col-span-2">
          <div className="font-serif text-2xl">Sabara</div>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            Handwoven mats made slowly, in small batches, by a collective of artisans working with
            natural fibres.
          </p>
        </div>

        <div>
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Shop
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link to="/shop" className="hover:text-foreground text-muted-foreground">All mats</Link></li>
            <li><Link to="/about" className="hover:text-foreground text-muted-foreground">Our craft</Link></li>
            <li><Link to="/contact" className="hover:text-foreground text-muted-foreground">Contact</Link></li>
          </ul>
        </div>

        <div>
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Stay in touch
          </div>
          <div className="mt-4 flex gap-3">
            <a
              href="https://www.instagram.com/sabara.in?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw=="
              aria-label="Instagram"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
            >
              <Instagram className="h-4 w-4" />
            </a>
            <a
              href="mailto:contact.sabara@gmail.com"
              aria-label="Email"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
            >
              <Mail className="h-4 w-4" />
            </a>
            <a
              href="tel:+916294359714"
              aria-label="Phone"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
            >
              <Phone className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-4 py-3.5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:px-6">
          <span>© {new Date().getFullYear()} Sabara. Woven with Tradition.</span>
          <span>Shipping all over india · Made to last</span>
        </div>
      </div>
    </footer>
  );
}
