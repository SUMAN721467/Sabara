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

// ── Admin allow-list ─────────────────────────────────────────────────────────
const ADMIN_EMAILS: Set<string> = new Set([
  "contact.sabara@gmail.com",
  "sumansamanta721467@gmail.com",
]);

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
  isLoginModalOpen: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
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

// ── 30-Day Inactivity Session Policy via Cookies (Zero localStorage) ──────────
const INACTIVITY_TIMEOUT_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days in seconds
const LAST_ACTIVITY_COOKIE = "sabara-last-activity";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(?:^|;\\s*)" + encodeURIComponent(name) + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, maxAge = COOKIE_MAX_AGE_SECONDS) {
  if (typeof document === "undefined") return;
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
}

function removeCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${encodeURIComponent(name)}=; path=/; max-age=0; SameSite=Lax`;
}

export function recordUserActivity() {
  setCookie(LAST_ACTIVITY_COOKIE, Date.now().toString(), COOKIE_MAX_AGE_SECONDS);
}

export function isSessionExpiredDueToInactivity(): boolean {
  if (typeof document === "undefined") return false;
  const lastActivity = getCookie(LAST_ACTIVITY_COOKIE);
  if (!lastActivity) return false;
  const elapsed = Date.now() - parseInt(lastActivity, 10);
  return elapsed > INACTIVITY_TIMEOUT_MS;
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
      if (s) {
        if (isSessionExpiredDueToInactivity()) {
          removeCookie(LAST_ACTIVITY_COOKIE);
          supabase.auth.signOut().catch(() => {});
          setSession(null);
          setLoading(false);
          return;
        }
        recordUserActivity();
      }

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

    // ── 2. Resolve any existing session (cookies) ────────────────────────────
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        if (isSessionExpiredDueToInactivity()) {
          removeCookie(LAST_ACTIVITY_COOKIE);
          supabase.auth.signOut().catch(() => {});
          setSession(null);
          setLoading(false);
          return;
        }
        recordUserActivity();

        if (isOAuthCallback()) {
          triggerLoginPopup();
          cleanOAuthUrl();
          setTimeout(() => { window.location.href = "/"; }, 100);
        }
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

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const openLoginModal = useCallback(() => setIsLoginModalOpen(true), []);
  const closeLoginModal = useCallback(() => setIsLoginModalOpen(false), []);

  // Listen to custom event so any component or link can open it
  useEffect(() => {
    const handleOpen = () => setIsLoginModalOpen(true);
    const handleClose = () => setIsLoginModalOpen(false);
    window.addEventListener("open-login-modal", handleOpen);
    window.addEventListener("close-login-modal", handleClose);
    return () => {
      window.removeEventListener("open-login-modal", handleOpen);
      window.removeEventListener("close-login-modal", handleClose);
    };
  }, []);

  // Auto-detect ?auth=login or ?login=true in URL on load
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("login") === "true" || params.get("auth") === "login") {
      setIsLoginModalOpen(true);
      params.delete("login");
      params.delete("auth");
      const newSearch = params.toString() ? `?${params.toString()}` : "";
      window.history.replaceState(null, "", `${window.location.pathname}${newSearch}`);
    }
  }, []);

  // Auto-close modal if user is logged in
  useEffect(() => {
    if (session?.user) {
      setIsLoginModalOpen(false);
    }
  }, [session?.user]);

  // ── Track user activity to maintain 30-day inactivity session ─────────────
  useEffect(() => {
    if (!session?.user || typeof window === "undefined") return;

    let lastSaved = Date.now();
    recordUserActivity();

    const handleActivity = () => {
      const now = Date.now();
      // Throttle localStorage updates to once every 5 minutes
      if (now - lastSaved > 5 * 60 * 1000) {
        lastSaved = now;
        recordUserActivity();
      }
    };

    const events = ["mousedown", "keydown", "scroll", "touchstart", "click"];
    events.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }));

    const checkInactivity = () => {
      if (isSessionExpiredDueToInactivity()) {
        removeCookie(LAST_ACTIVITY_COOKIE);
        supabase.auth.signOut().catch(() => {});
        setSession(null);
      }
    };

    window.addEventListener("focus", checkInactivity);
    const hourlyCheck = setInterval(checkInactivity, 60 * 60 * 1000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleActivity));
      window.removeEventListener("focus", checkInactivity);
      clearInterval(hourlyCheck);
    };
  }, [session?.user]);

  const value: AuthContextValue = {
    user: session?.user ?? null,
    session,
    loading,
    isAdmin: isAdminEmail(session?.user?.email),
    justLoggedIn,
    signOut: async () => {
      removeCookie(LAST_ACTIVITY_COOKIE);
      try {
        localStorage.removeItem("sabara-auth-token");
        localStorage.removeItem("sabara-last-activity");
      } catch {}
      await supabase.auth.signOut();
      setSession(null);
    },
    isLoginModalOpen,
    openLoginModal,
    closeLoginModal,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
