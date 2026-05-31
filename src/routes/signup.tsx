import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AuthService } from "@/services/auth.service";
import { Mail, ShieldCheck, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/signup")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      redirect: (search.redirect as string) || undefined,
    };
  },
  component: SignupPage,
  head: () => ({
    meta: [
      { title: "Create account · Sabara" },
      { name: "description", content: "Create your Sabara account." },
    ],
  }),
});

// ── Step types ────────────────────────────────────────────────────────────────
type Step = "details" | "otp";

function SignupPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { redirect } = Route.useSearch();

  // Bounce already-authenticated users
  useEffect(() => {
    if (!loading && user) navigate({ to: redirect || "/account" });
  }, [loading, user, navigate, redirect]);

  // ── Form state ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("details");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // ── Step 1: Register → Supabase sends OTP email ─────────────────────────────
  const onSubmitDetails = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);

    // signUp with emailRedirectTo disabled — we want OTP verification, not a link
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Supabase sends a 6-digit OTP to the user's email when
        // "Email OTP" or "Email Confirmation" is enabled in the dashboard.
        emailRedirectTo: undefined,
        data: { full_name: fullName },
      },
    });

    setBusy(false);

    if (authError) {
      toast.error(authError.message);
      return;
    }

    // If session is immediately present, email confirmation is disabled in
    // Supabase — skip OTP step and go straight to saving profile.
    if (authData.session) {
      await saveProfile(authData.session.access_token);
      toast.success("Account created!");
      navigate({ to: redirect || "/" });
      return;
    }

    // Supabase created the user but sent a confirmation OTP → advance to step 2
    toast.success(`Verification code sent to ${email}`);
    setStep("otp");
    setResendCooldown(60);
  };

  // ── Step 2: Verify OTP ───────────────────────────────────────────────────────
  const onVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otp.trim(),
      type: "signup",
    });

    if (error || !data.session) {
      setBusy(false);
      toast.error(error?.message ?? "Invalid or expired code. Please try again.");
      return;
    }

    // OTP verified — save profile via our protected API
    await saveProfile(data.session.access_token);
    setBusy(false);
    toast.success("Account created and verified!");
    navigate({ to: redirect || "/" });
  };

  // ── Helper: save profile via API ─────────────────────────────────────────────
  const saveProfile = async (token: string) => {
    try {
      await fetch("/api/users/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fullName,
          age,
          phone,
          address: null,
        }),
      });
    } catch {
      // Non-fatal — account is created, profile can be set later
      toast.error("Account created, but profile could not be saved.");
    }
  };

  // ── Resend OTP ───────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setBusy(true);
    const { error } = await supabase.auth.resend({ type: "signup", email });
    setBusy(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("New code sent!");
      setResendCooldown(60);
    }
  };

  const handleGoogleSignup = async () => {
    try {
      await AuthService.signInWithGoogle();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // ── OTP Screen ───────────────────────────────────────────────────────────────
  if (step === "otp") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 sm:px-6 md:py-24">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-6">
          <Mail className="h-8 w-8 text-primary" />
        </div>
        <h1 className="font-serif text-3xl text-foreground text-center">Check your email</h1>
        <p className="mt-3 text-sm text-muted-foreground text-center max-w-xs">
          We sent a 6-digit verification code to{" "}
          <span className="font-medium text-foreground">{email}</span>
        </p>

        <form onSubmit={onVerifyOtp} className="mt-8 w-full space-y-4">
          <div>
            <label className="text-sm text-foreground">Verification Code</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-3 text-center text-2xl tracking-[0.5em] text-foreground outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <button
            type="submit"
            disabled={busy || otp.length !== 6}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            <ShieldCheck className="h-4 w-4" />
            {busy ? "Verifying…" : "Verify & Create Account"}
          </button>
        </form>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={() => setStep("details")}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Change email
          </button>
          <span className="text-muted-foreground">·</span>
          <button
            onClick={handleResend}
            disabled={resendCooldown > 0 || busy}
            className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
          </button>
        </div>
      </div>
    );
  }

  // ── Details Screen ───────────────────────────────────────────────────────────
  return (
    <div className="mx-auto flex max-w-xl flex-col px-4 py-16 sm:px-6 md:py-24">
      <header className="text-center mb-8">
        <span className="text-xs font-medium uppercase tracking-[0.22em] text-primary">
          Join us
        </span>
        <h1 className="mt-3 font-serif text-4xl text-foreground">Create an account</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Save your favourites and check out faster.
        </p>
      </header>

      <button
        type="button"
        onClick={handleGoogleSignup}
        className="mb-6 flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path d="M12.0003 4.75C13.7703 4.75 15.3553 5.36002 16.6053 6.54998L20.0303 3.125C17.9502 1.19 15.2353 0 12.0003 0C7.31028 0 3.25527 2.69 1.28027 6.60998L5.27028 9.70498C6.21525 6.86002 8.87028 4.75 12.0003 4.75Z" fill="#EA4335"/>
          <path d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12 V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L19.945 21.1C22.2 19.01 23.49 15.92 23.49 12.275Z" fill="#4285F4"/>
          <path d="M5.26498 14.2949C5.02498 13.5699 4.88501 12.7999 4.88501 11.9999C4.88501 11.1999 5.01998 10.4299 5.26498 9.7049L1.275 6.60986C0.46 8.22986 0 10.0599 0 11.9999C0 13.9399 0.46 15.7699 1.28 17.3899L5.26498 14.2949Z" fill="#FBBC05"/>
          <path d="M12.0004 24.0001C15.2404 24.0001 17.9654 22.935 19.9454 21.095L16.0804 18.095C15.0054 18.82 13.6204 19.245 12.0004 19.245C8.8704 19.245 6.21537 17.135 5.26538 14.29L1.27539 17.385C3.25539 21.31 7.3104 24.0001 12.0004 24.0001Z" fill="#34A853"/>
        </svg>
        Sign up with Google
      </button>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
        <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Or register with email</span></div>
      </div>

      <form onSubmit={onSubmitDetails} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-foreground">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-sm text-foreground">Password</label>
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="text-sm text-foreground">Full Name</label>
            <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-sm text-foreground">Age</label>
            <input type="number" required value={age} onChange={(e) => setAge(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>

        <div>
          <label className="text-sm text-foreground">Phone Number</label>
          <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? "Sending verification…" : "Continue — Verify Email"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" search={{ redirect }} className="text-foreground underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  );
}
