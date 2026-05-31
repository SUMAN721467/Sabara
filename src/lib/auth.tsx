import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// ── Admin allow-list (read from env at build time) ───────────────────────────
const ADMIN_EMAILS: Set<string> = new Set(
  (import.meta.env.VITE_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean),
);

// Fallback admin emails
ADMIN_EMAILS.add("contact.sabara@gmail.com");

/** Returns true if the given email is in the admin allow-list */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.has(email.trim().toLowerCase());
}

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  /** true only during the initial session resolution */
  loading: boolean;
  /** true if the current user is an admin */
  isAdmin: boolean;
  /** true for ~2.5 s after a fresh SIGNED_IN event — drives the login popup */
  justLoggedIn: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** Returns true when the current URL contains an OAuth callback payload */
function isOAuthCallback() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return (
    params.has("code") ||                          // PKCE flow
    window.location.hash.includes("access_token")  // implicit flow (legacy)
  );
}

/** Remove OAuth params from the URL without a page reload */
function cleanOAuthUrl() {
  if (typeof window === "undefined") return;
  window.history.replaceState(null, "", window.location.pathname);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [justLoggedIn, setJustLoggedIn] = useState(false);
  const popupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popupShown = useRef(false);

  const triggerLoginPopup = useCallback(() => {
    if (popupShown.current) return;
    popupShown.current = true;
    setJustLoggedIn(true);
    if (popupTimer.current) clearTimeout(popupTimer.current);
    popupTimer.current = setTimeout(() => setJustLoggedIn(false), 2500);
  }, []);

  useEffect(() => {
    // ── 1. Register auth-state listener FIRST so we never miss an event ──────
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setLoading(false);

      if (event === "SIGNED_IN") {
        triggerLoginPopup();

        if (isOAuthCallback()) {
          cleanOAuthUrl();
          setTimeout(() => { window.location.href = "/"; }, 100);
        }
      }
    });

    // ── 2. Resolve any existing session (localStorage / cookie) ─────────────
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && isOAuthCallback()) {
        triggerLoginPopup();
        cleanOAuthUrl();
        setTimeout(() => { window.location.href = "/"; }, 100);
      }
      setSession(data.session);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      popupShown.current = false;
      if (popupTimer.current) clearTimeout(popupTimer.current);
    };
  }, [triggerLoginPopup]);

  const value: AuthContextValue = {
    user: session?.user ?? null,
    session,
    loading,
    isAdmin: isAdminEmail(session?.user?.email),
    justLoggedIn,
    signOut: () => supabase.auth.signOut().then(() => {}),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
