import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AuthService } from "@/services/auth.service";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      redirect: (search.redirect as string) || undefined,
    };
  },
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Sign in · Sabara" },
      { name: "description", content: "Sign in to your Sabara account." },
    ],
  }),
});

type LoginStep = "login" | "forgot" | "otp-reset";

function LoginPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { redirect } = Route.useSearch();
  const [step, setStep] = useState<LoginStep>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // ─── If already logged-in, bounce to /account — never show the login form ──
  useEffect(() => {
    if (!loading && user && step === "login") {
      navigate({ to: redirect || "/account" });
    }
  }, [loading, user, navigate, step, redirect]);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // ─── Still resolving session — show spinner ───────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
      </div>
    );
  }

  // ─── Authenticated — render nothing while useEffect fires the redirect ─────
  if (user && step === "login") return null;

  const handleGoogleLogin = async () => {
    try {
      await AuthService.signInWithGoogle();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back");
    navigate({ to: redirect || "/account" });
  };

  const handleRequestReset = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email address.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Reset OTP sent to ${email}`);
    setStep("otp-reset");
    setResendCooldown(60);
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!otpToken || otpToken.length !== 6) {
      toast.error("Please enter the 6-digit verification code.");
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);

    try {
      // 1. Verify the OTP code for recovery type
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otpToken.trim(),
        type: "recovery",
      });

      if (verifyError || !data.session) {
        throw new Error(verifyError?.message || "Invalid or expired verification code.");
      }

      // 2. Successful verification logs the user in temporarily.
      // Now update their password to the new one.
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw new Error(updateError.message);
      }

      toast.success("Password reset successfully! Welcome back.");
      navigate({ to: redirect || "/account" });
    } catch (err: any) {
      toast.error(err.message || "Failed to reset password. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleResendResetCode = async () => {
    if (resendCooldown > 0) return;
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setBusy(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("New reset code sent!");
      setResendCooldown(60);
    }
  };

  // ─── Forgot Password Request Screen ───────────────────────────────────────────
  if (step === "forgot") {
    return (
      <div className="mx-auto flex max-w-md flex-col px-4 py-16 sm:px-6 md:py-24 animate-in fade-in-50 duration-200">
        <header className="text-center mb-8">
          <span className="text-xs font-medium uppercase tracking-[0.22em] text-primary">
            Reset Password
          </span>
          <h1 className="mt-3 font-serif text-4xl text-foreground">Forgot Password?</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Enter your email address and we'll send you a 6-digit OTP code to reset your password.
          </p>
        </header>

        <form onSubmit={handleRequestReset} className="space-y-4">
          <div>
            <label className="text-sm text-foreground font-medium">Email Address</label>
            <input
              type="email"
              required
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60 cursor-pointer"
          >
            {busy ? "Sending code…" : "Send Reset Code"}
          </button>
        </form>

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setStep("login")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground cursor-pointer font-medium"
          >
            <ArrowLeft className="h-4 w-4" /> Back to sign in
          </button>
        </div>
      </div>
    );
  }

  // ─── OTP & Password Reset Verification Screen ───────────────────────────────
  if (step === "otp-reset") {
    return (
      <div className="mx-auto flex max-w-md flex-col px-4 py-16 sm:px-6 md:py-24 animate-in fade-in-50 duration-200">
        <header className="text-center mb-8">
          <span className="text-xs font-medium uppercase tracking-[0.22em] text-primary">
            Verify & Reset
          </span>
          <h1 className="mt-3 font-serif text-4xl text-foreground">Reset Password</h1>
          <p className="mt-3 text-sm text-muted-foreground text-center">
            We sent an OTP verification code to <span className="font-medium text-foreground">{email}</span>.
          </p>
        </header>

        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label className="text-sm text-foreground font-medium">Verification Code</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
              placeholder="000000"
              value={otpToken}
              onChange={(e) => setOtpToken(e.target.value.replace(/\D/g, ""))}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-3 text-center text-2xl tracking-[0.5em] text-foreground outline-none focus:ring-2 focus:ring-ring font-mono"
            />
          </div>

          <div>
            <label className="text-sm text-foreground font-medium">New Password</label>
            <input
              type="password"
              required
              minLength={6}
              placeholder="At least 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <button
            type="submit"
            disabled={busy || otpToken.length !== 6}
            className="inline-flex w-full items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60 cursor-pointer"
          >
            {busy ? "Resetting…" : "Reset & Log In"}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep("forgot")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground cursor-pointer font-medium"
          >
            <ArrowLeft className="h-4 w-4" /> Change email
          </button>
          <button
            type="button"
            onClick={handleResendResetCode}
            disabled={resendCooldown > 0 || busy}
            className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 cursor-pointer font-medium"
          >
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
          </button>
        </div>
      </div>
    );
  }

  // ─── Default Login Screen ───────────────────────────────────────────────────
  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16 sm:px-6 md:py-24">
      <header className="text-center mb-8">
        <span className="text-xs font-medium uppercase tracking-[0.22em] text-primary">
          Welcome back
        </span>
        <h1 className="mt-3 font-serif text-4xl text-foreground">Sign in</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Pick up where you left off.
        </p>
      </header>

      <button
        type="button"
        onClick={handleGoogleLogin}
        className="mb-6 flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path d="M12.0003 4.75C13.7703 4.75 15.3553 5.36002 16.6053 6.54998L20.0303 3.125C17.9502 1.19 15.2353 0 12.0003 0C7.31028 0 3.25527 2.69 1.28027 6.60998L5.27028 9.70498C6.21525 6.86002 8.87028 4.75 12.0003 4.75Z" fill="#EA4335"/>
          <path d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L19.945 21.1C22.2 19.01 23.49 15.92 23.49 12.275Z" fill="#4285F4"/>
          <path d="M5.26498 14.2949C5.02498 13.5699 4.88501 12.7999 4.88501 11.9999C4.88501 11.1999 5.01998 10.4299 5.26498 9.7049L1.275 6.60986C0.46 8.22986 0 10.0599 0 11.9999C0 13.9399 0.46 15.7699 1.28 17.3899L5.26498 14.2949Z" fill="#FBBC05"/>
          <path d="M12.0004 24.0001C15.2404 24.0001 17.9654 22.935 19.9454 21.095L16.0804 18.095C15.0054 18.82 13.6204 19.245 12.0004 19.245C8.8704 19.245 6.21537 17.135 5.26538 14.29L1.27539 17.385C3.25539 21.31 7.3104 24.0001 12.0004 24.0001Z" fill="#34A853"/>
        </svg>
        Sign in with Google
      </button>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
        <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Or sign in with email</span></div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="text-sm text-foreground">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="text-sm text-foreground">Password</label>
            <button
              type="button"
              onClick={() => setStep("forgot")}
              className="text-xs text-primary hover:underline font-medium cursor-pointer"
            >
              Forgot password?
            </button>
          </div>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60 cursor-pointer"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link to="/signup" search={{ redirect }} className="text-foreground underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </div>
  );
}
