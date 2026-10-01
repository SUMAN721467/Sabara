import { useState, useEffect, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AuthService } from "@/services/auth.service";
import { ArrowLeft, X, AlertCircle } from "lucide-react";
import logoImg from "@/assets/Sabara-logo.png";
import { Link } from "@tanstack/react-router";

export function LoginModal() {
  const { user, isLoginModalOpen, closeLoginModal } = useAuth();
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);
  const [busy, setBusy] = useState(false);

  // Close when pressing Escape key
  useEffect(() => {
    if (!isLoginModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeLoginModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLoginModalOpen, closeLoginModal]);

  // Reset step when modal opens/closes
  useEffect(() => {
    if (!isLoginModalOpen) {
      setStep("email");
      setOtpToken("");
      setOtpError(null);
      setBusy(false);
    }
  }, [isLoginModalOpen]);

  // Count down resend timer
  useEffect(() => {
    if (resendTimer <= 0) return;
    const timer = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendTimer]);

  if (!isLoginModalOpen || user) return null;

  const handleGoogleLogin = async () => {
    try {
      await AuthService.signInWithGoogle();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleSendOtp = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!email) return;
    setBusy(true);
    setOtpError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("OTP sent to your email!");
    setStep("otp");
    setResendTimer(30);
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (!otpToken) return;
    setBusy(true);
    setOtpError(null);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otpToken.trim(),
      type: "email",
    });
    setBusy(false);
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("invalid") || msg.includes("expired") || msg.includes("token")) {
        setOtpError("Wrong OTP. Please enter the correct 6-digit code.");
      } else {
        setOtpError(error.message || "Wrong OTP. Please try again.");
      }
      return;
    }
    toast.success("Logged in successfully");
    closeLoginModal();
  };

  const isValidEmail = email.trim().length > 3 && email.includes("@") && email.includes(".");

  return (
    <>
      {/* Backdrop overlay that forwards mouse wheel to the background so user can scroll */}
      <div
        className="fixed inset-0 z-50 bg-black/25 backdrop-blur-[0.5px] transition-opacity duration-200"
        onClick={closeLoginModal}
        onWheel={(e) => {
          if (typeof window !== "undefined") {
            window.scrollBy({ top: e.deltaY, left: e.deltaX, behavior: "auto" });
          }
        }}
        aria-hidden="true"
      />

      {/* Fixed floating modal window */}
      <div
        className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center p-3.5 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
      >
        <div
          className="pointer-events-auto relative w-full max-w-[380px] sm:max-w-[420px] my-auto overflow-hidden rounded-2xl sm:rounded-3xl bg-[#fcf9f2] shadow-2xl border border-[#ebdccb] animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            type="button"
            onClick={closeLoginModal}
            className="absolute right-3.5 top-3.5 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-stone-200/60 hover:bg-stone-300 text-stone-600 hover:text-stone-900 transition-all cursor-pointer shadow-xs active:scale-95"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Header section with #fcf9f2 background & Sabara logo */}
          <div className="relative w-full bg-[#fcf9f2] flex flex-col items-center justify-center py-7 sm:py-8 px-6 border-b border-[#ebdccb]/60">
            <Link to="/" onClick={closeLoginModal} className="inline-block transition-transform duration-300 hover:scale-105">
              <img
                src={logoImg}
                alt="Sabara - Woven with Tradition"
                width={220}
                height={60}
                className="h-12 sm:h-14 md:h-15 w-auto max-w-[210px] sm:max-w-[250px] object-contain drop-shadow-sm"
              />
            </Link>
          </div>

          {/* Form section */}
          <div className="p-5 sm:p-7 md:p-8 pb-7 sm:pb-9 md:pb-10 bg-[#fcf9f2]">
            <div className="text-center mb-5 sm:mb-7">
              <h2 id="login-modal-title" className="text-xl sm:text-2xl font-bold text-foreground font-serif">
                Log in or sign up
              </h2>
              <p className="mt-1.5 sm:mt-2 text-xs sm:text-[13px] text-muted-foreground">
                Get personalised suggestions, offers &amp; more
              </p>
            </div>

            {step === "email" ? (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="flex w-full min-h-[46px] sm:min-h-[48px] items-center justify-center gap-3 rounded-xl sm:rounded-lg border border-border/80 bg-white px-4 sm:px-5 py-3 sm:py-3.5 text-[13px] sm:text-[14px] font-bold text-foreground transition-all hover:bg-stone-50 btn-interactive touch-manipulation shadow-[0_2px_10px_-4px_rgba(0,0,0,0.06)] active:scale-[0.99]"
                >
                  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" aria-hidden="true">
                    <path d="M12.0003 4.75C13.7703 4.75 15.3553 5.36002 16.6053 6.54998L20.0303 3.125C17.9502 1.19 15.2353 0 12.0003 0C7.31028 0 3.25527 2.69 1.28027 6.60998L5.27028 9.70498C6.21525 6.86002 8.87028 4.75 12.0003 4.75Z" fill="#EA4335" />
                    <path d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L19.945 21.1C22.2 19.01 23.49 15.92 23.49 12.275Z" fill="#4285F4" />
                    <path d="M5.26498 14.2949C5.02498 13.5699 4.88501 12.7999 4.88501 11.9999C4.88501 11.1999 5.01998 10.4299 5.26498 9.7049L1.275 6.60986C0.46 8.22986 0 10.0599 0 11.9999C0 13.9399 0.46 15.7699 1.28 17.3899L5.26498 14.2949Z" fill="#FBBC05" />
                    <path d="M12.0004 24.0001C15.2404 24.0001 17.9654 22.935 19.9454 21.095L16.0804 18.095C15.0054 18.82 13.6204 19.245 12.0004 19.245C8.8704 19.245 6.21537 17.135 5.26538 14.29L1.27539 17.385C3.25539 21.31 7.3104 24.0001 12.0004 24.0001Z" fill="#34A853" />
                  </svg>
                  <span>Continue with Google</span>
                </button>

                <div className="relative my-5 sm:my-6">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/70" /></div>
                  <div className="relative flex justify-center text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                    <span className="bg-[#fcf9f2] px-3 sm:px-4">Or</span>
                  </div>
                </div>

                <form onSubmit={handleSendOtp} className="space-y-5 sm:space-y-6">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">Enter Email ID</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-1 flex items-center pointer-events-none">
                        <svg className="h-[18px] w-[18px] text-muted-foreground/60" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                        </svg>
                      </div>
                      <input
                        type="email"
                        required
                        inputMode="email"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="block w-full pl-8 pr-3 pb-2 pt-2 border-0 border-b-2 border-border/80 bg-transparent text-[16px] sm:text-[15px] font-medium focus:border-primary focus:ring-0 transition-colors placeholder:text-muted-foreground/50 outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={busy}
                    className={`mt-5 sm:mt-6 flex w-full min-h-[46px] sm:min-h-[48px] items-center justify-center gap-2 rounded-xl sm:rounded-lg px-4 py-3 sm:py-3.5 text-[13px] font-bold uppercase tracking-widest transition-all cursor-pointer btn-interactive touch-manipulation shadow-sm active:scale-[0.99] ${
                      isValidEmail
                        ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
                        : "bg-secondary/80 text-muted-foreground hover:bg-secondary disabled:opacity-50"
                    }`}
                  >
                    {busy ? "Sending…" : "Proceed"}
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-[18px] h-[18px]">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  </button>
                </form>

                <p className="mt-6 sm:mt-8 text-center text-[11px] sm:text-[11.5px] leading-relaxed text-muted-foreground/80">
                  By continuing, I agree to Sabara's{" "}
                  <Link to="/" onClick={closeLoginModal} className="underline underline-offset-2 hover:text-foreground transition-colors font-medium">
                    Terms &amp; Conditions
                  </Link>{" "}
                  and{" "}
                  <Link to="/" onClick={closeLoginModal} className="underline underline-offset-2 hover:text-foreground transition-colors font-medium">
                    Privacy Policy
                  </Link>.
                </p>
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-right-2 duration-300">
                <form onSubmit={handleVerifyOtp} className="space-y-5 sm:space-y-6">
                  <div className="text-center mb-3 sm:mb-4">
                    <p className="text-xs sm:text-[13px] text-muted-foreground">
                      Enter the OTP sent to <br />
                      <span className="font-semibold text-foreground break-all">{email}</span>
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 text-center block">
                      Enter OTP
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="one-time-code"
                      required
                      autoFocus
                      placeholder="000000"
                      maxLength={6}
                      value={otpToken}
                      onChange={(e) => {
                        setOtpError(null);
                        setOtpToken(e.target.value.replace(/\D/g, ""));
                      }}
                      className={`block w-full text-center px-3 sm:px-4 py-3 sm:py-4 rounded-xl border-2 bg-white text-xl sm:text-2xl tracking-[0.35em] sm:tracking-[0.5em] font-mono focus:ring-0 transition-colors outline-none shadow-sm ${
                        otpError
                          ? "border-red-500 text-red-600 focus:border-red-500 bg-red-50/30"
                          : "border-border/80 focus:border-primary text-foreground"
                      }`}
                    />
                  </div>

                  {/* Inline Error Message before Verify button */}
                  {otpError && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-semibold animate-in fade-in slide-in-from-top-1 duration-200">
                      <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                      <span>{otpError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={busy || otpToken.length < 6}
                    className="flex w-full min-h-[46px] sm:min-h-[48px] items-center justify-center rounded-xl sm:rounded-lg bg-primary px-4 py-3 sm:py-3.5 text-[13px] font-bold uppercase tracking-widest text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50 cursor-pointer btn-interactive touch-manipulation shadow-md active:scale-[0.99]"
                  >
                    {busy ? "Verifying…" : "Verify & Log in"}
                  </button>

                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-4 px-1">
                    <button
                      type="button"
                      onClick={() => {
                        setStep("email");
                        setOtpError(null);
                      }}
                      className="flex items-center gap-1.5 hover:text-foreground cursor-pointer font-medium transition-colors touch-manipulation py-1"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" /> Change email
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSendOtp()}
                      disabled={busy || resendTimer > 0}
                      className="text-primary hover:underline cursor-pointer font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline py-1"
                    >
                      {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend code"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
