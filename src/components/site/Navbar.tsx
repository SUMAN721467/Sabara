import { Link, useNavigate } from "@tanstack/react-router";
import logoImg from "@/assets/Sabara-logo.png";
import {
  ShoppingBag,
  Menu,
  X,
  Search,
  User,
  LogOut,
  CheckCircle2,
  ChevronRight,
  Settings,
  Heart,
} from "lucide-react";
import { useState, useEffect, useRef, type FormEvent } from "react";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const links = [
  { to: "/", label: "Home" },
  { to: "/shop", label: "Shop" },
  { to: "/about", label: "Our craft" },
  { to: "/contact", label: "Contact" },
];

// ─── Login-success popup (bottom-left, auto-dismisses in 2 s) ───────────────
function LoginSuccessPopup({ user }: { user: { email?: string | null; user_metadata?: any } }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Mount → slide in
    const t1 = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t1);
  }, []);

  const name =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "there";

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed bottom-6 left-6 z-[9999] flex items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3 shadow-xl shadow-black/10 transition-all duration-500 ease-out",
        visible ? "translate-x-0 opacity-100" : "-translate-x-10 opacity-0",
      )}
      style={{ maxWidth: 320 }}
    >
      {/* Avatar / icon */}
      {user.user_metadata?.avatar_url ? (
        <img
          src={user.user_metadata.avatar_url}
          alt={name}
          className="h-9 w-9 rounded-full object-cover ring-2 ring-primary/30"
        />
      ) : (
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
          <User className="h-4 w-4" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          Welcome back, {name}!
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {user.email}
        </p>
      </div>

      <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
    </div>
  );
}

// ─── Account panel (dropdown when clicking User icon while logged in) ────────
function AccountPanel({
  user,
  isAdmin,
  onClose,
  onSignOut,
}: {
  user: any;
  isAdmin: boolean;
  onClose: () => void;
  onSignOut: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { count: wishlistCount } = useWishlist();

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const name =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "Account";

  const initials = name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px]"
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Account menu"
        className="absolute right-0 top-[calc(100%+8px)] z-50 w-72 origin-top-right animate-in fade-in zoom-in-95 duration-150 rounded-2xl border border-border/70 bg-card shadow-2xl shadow-black/10 overflow-hidden"
      >
        {/* Header */}
        <div className="relative bg-primary/10 px-5 py-5">
          <div className="flex items-center gap-3">
            {user.user_metadata?.avatar_url ? (
              <img
                src={user.user_metadata.avatar_url}
                alt={name}
                className="h-12 w-12 rounded-full object-cover ring-2 ring-primary/30"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-base font-semibold">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-medium text-foreground truncate">{name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground truncate">
                {user.email}
              </p>
            </div>
          </div>
        </div>

        {/* Menu items */}
        <div className="p-2">
          <Link
            to="/account"
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-secondary group"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary group-hover:bg-primary/15 transition-colors">
              <User className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <span className="flex-1">My Account</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
          </Link>

          <Link
            to="/account"
            search={{ tab: "orders" }}
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-secondary group"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary group-hover:bg-primary/15 transition-colors">
              <ShoppingBag className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <span className="flex-1">My Orders</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
          </Link>

          <Link
            to="/wishlist"
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-secondary group hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary group-hover:bg-primary/15 transition-colors">
              <Heart className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <span className="flex-1">My Wishlist</span>
            {wishlistCount > 0 && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                {wishlistCount}
              </span>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
          </Link>

          {isAdmin && (
            <Link
              to="/admin"
              onClick={onClose}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-secondary group"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary group-hover:bg-primary/15 transition-colors">
                <Settings className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <span className="flex-1">Admin Dashboard</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
            </Link>
          )}
        </div>

        <div className="mx-3 border-t border-border/60" />

        <div className="p-2">
          <button
            onClick={onSignOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-destructive transition-colors hover:bg-destructive/10 group"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 transition-colors">
              <LogOut className="h-4 w-4 text-destructive" />
            </div>
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Main Navbar ─────────────────────────────────────────────────────────────
export function Navbar() {
  const { count } = useCart();
  const { count: wishlistCount } = useWishlist();
  const { user, signOut, isAdmin, justLoggedIn } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [query, setQuery] = useState("");
  const userBtnRef = useRef<HTMLButtonElement>(null);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    setSearchOpen(false);
    setOpen(false);
    navigate({ to: "/shop", search: { q: q || undefined } as never });
  };

  const handleSignOut = async () => {
    setAccountOpen(false);
    await signOut();
    toast.success("Signed out");
    navigate({ to: "/" });
  };

  return (
    <>
      {/* ── Login success popup ────────────────────────────────────────────── */}
      {justLoggedIn && user && <LoginSuccessPopup user={user} />}

      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-2 sm:px-6">
          <Link to="/" className="font-serif text-xl tracking-tight group mr-2 sm:mr-3 shrink-0">
            <img src={logoImg} alt="Sabara" className="h-6 sm:h-9 w-auto max-h-6 sm:max-h-9 max-w-[90px] sm:max-w-none transition-transform duration-500 ease-out group-hover:scale-105" />
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground link-underline pb-0.5"
                activeProps={{ className: "text-foreground active", "data-active": "true" } as any}
                activeOptions={{ exact: l.to === "/" }}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-0.5 sm:gap-1">
            <Link
              to="/shop"
              className="inline-flex h-6 items-center justify-center rounded-full border border-primary/30 bg-transparent px-2 text-[9px] font-bold text-primary transition-all hover:bg-primary/5 active:scale-95 md:hidden whitespace-nowrap cursor-pointer ml-1 mr-0.5"
            >
              Shop Now
            </Link>

            <button
              onClick={() => setSearchOpen((v) => !v)}
              aria-label="Search"
              className="inline-flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full text-foreground transition-all duration-200 hover:bg-secondary hover:scale-105 active:scale-90"
            >
              <Search className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>

            {/* User button — relative container for the dropdown panel */}
            <div className="relative">
              {user ? (
                <>
                  <button
                    ref={userBtnRef}
                    aria-label="Account menu"
                    aria-expanded={accountOpen}
                    onClick={() => setAccountOpen((v) => !v)}
                    className={cn(
                      "relative flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full text-foreground transition-all duration-200 hover:bg-secondary hover:scale-105 active:scale-90",
                      accountOpen && "bg-secondary scale-105",
                    )}
                  >
                    {user.user_metadata?.avatar_url ? (
                      <img
                        src={user.user_metadata.avatar_url}
                        alt="avatar"
                        className="h-5 w-5 sm:h-7 sm:w-7 rounded-full object-cover"
                      />
                    ) : (
                      <User className="h-4 w-4 sm:h-5 sm:w-5" />
                    )}
                    {/* Green online dot */}
                    <span className="absolute -right-0.5 -top-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full border border-background bg-emerald-500 animate-pulse" />
                  </button>

                  {accountOpen && (
                    <AccountPanel
                      user={user}
                      isAdmin={isAdmin}
                      onClose={() => setAccountOpen(false)}
                      onSignOut={handleSignOut}
                    />
                  )}
                </>
              ) : (
                <Link
                  to="/login"
                  aria-label="Sign in"
                  className="inline-flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full text-foreground transition-all duration-200 hover:bg-secondary hover:scale-105 active:scale-90"
                >
                  <User className="h-4 w-4 sm:h-5 sm:w-5" />
                </Link>
              )}
            </div>

            <Link
              to="/wishlist"
              aria-label="Wishlist"
              className="relative hidden sm:inline-flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full text-foreground transition-all duration-200 hover:bg-secondary hover:scale-105 active:scale-90 cursor-pointer"
            >
              <Heart className="h-4 w-4 sm:h-5 sm:w-5" />
              {wishlistCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 sm:h-5 sm:min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[9px] sm:text-[11px] font-medium text-primary-foreground animate-in zoom-in-50 duration-300">
                  {wishlistCount}
                </span>
              )}
            </Link>

            <Link
              to="/cart"
              aria-label="Cart"
              className="relative inline-flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full text-foreground transition-all duration-200 hover:bg-secondary hover:scale-105 active:scale-90 cursor-pointer"
            >
              <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5" />
              {count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 sm:h-5 sm:min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[9px] sm:text-[11px] font-medium text-primary-foreground animate-in zoom-in-50 duration-300">
                  {count}
                </span>
              )}
            </Link>

            <button
              onClick={() => setOpen((v) => !v)}
              className="inline-flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full text-foreground transition-all duration-200 hover:bg-secondary hover:scale-105 active:scale-90 md:hidden"
              aria-label="Toggle menu"
            >
              {open ? <X className="h-4 w-4 sm:h-5 sm:w-5" /> : <Menu className="h-4 w-4 sm:h-5 sm:w-5" />}
            </button>
          </div>
        </div>

        {/* ── Search bar ─────────────────────────────────────────────────────── */}
        <div
          className={cn(
            "overflow-hidden border-t border-border/60 transition-[max-height] duration-300",
            searchOpen ? "max-h-24" : "max-h-0",
          )}
        >
          <form
            onSubmit={onSearch}
            className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 sm:px-6"
          >
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              autoFocus={searchOpen}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search mats by name, material, category…"
              className="h-9 flex-1 min-w-0 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            <button
              type="submit"
              className="rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background"
            >
              Search
            </button>
          </form>
        </div>

        {/* ── Mobile drawer ──────────────────────────────────────────────────── */}
        <div
          className={cn(
            "overflow-hidden border-t border-border/60 transition-[max-height] duration-300 md:hidden",
            open ? "max-h-[32rem]" : "max-h-0",
          )}
        >
          <nav className="flex flex-col px-4 py-3">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="py-2 text-sm text-muted-foreground hover:text-foreground font-medium"
                activeProps={{ className: "py-2 text-sm text-foreground font-semibold" }}
                activeOptions={{ exact: l.to === "/" }}
              >
                {l.label}
              </Link>
            ))}

            <Link
              to="/wishlist"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between py-2 text-sm text-muted-foreground hover:text-foreground hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
            >
              <span>My Wishlist</span>
              {wishlistCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-medium text-primary-foreground">
                  {wishlistCount}
                </span>
              )}
            </Link>

            <div className="mt-2 border-t border-border/60 pt-2">
              {user ? (
                <div className="flex flex-col gap-1">
                  {/* Mobile account info */}
                  <div className="flex items-center gap-2 px-0 py-2">
                    {user.user_metadata?.avatar_url ? (
                      <img
                        src={user.user_metadata.avatar_url}
                        alt="avatar"
                        className="h-7 w-7 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary">
                        <User className="h-3.5 w-3.5" />
                      </div>
                    )}
                    <span className="text-sm text-foreground truncate max-w-[180px]">
                      {user.email}
                    </span>
                  </div>
                  <Link
                    to="/account"
                    onClick={() => setOpen(false)}
                    className="py-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    My Account
                  </Link>
                  <Link
                    to="/account"
                    search={{ tab: "orders" }}
                    onClick={() => setOpen(false)}
                    className="py-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    My Orders
                  </Link>
                  {isAdmin && (
                    <Link
                      to="/admin"
                      onClick={() => setOpen(false)}
                      className="py-2 text-sm text-muted-foreground hover:text-foreground"
                    >
                      Admin Dashboard
                    </Link>
                  )}
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 py-2 text-sm text-destructive hover:text-destructive/80"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              ) : (
                <div className="flex flex-col">
                  <Link
                    to="/login"
                    onClick={() => setOpen(false)}
                    className="py-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/signup"
                    onClick={() => setOpen(false)}
                    className="py-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    Create account
                  </Link>
                </div>
              )}
            </div>
          </nav>
        </div>
      </header>
    </>
  );
}
