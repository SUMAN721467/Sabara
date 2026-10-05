import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if consent has already been given or declined
    const hasConsent = document.cookie.includes("sabara-cookie-consent=accepted");
    const hasDeclined = document.cookie.includes("sabara-cookie-consent=declined");
    
    if (!hasConsent && !hasDeclined) {
      // Delay showing the banner slightly to not overwhelm on load
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const acceptCookies = () => {
    // Set cookie for 1 year
    document.cookie = "sabara-cookie-consent=accepted; path=/; max-age=31536000; SameSite=Lax";
    setIsVisible(false);
    
    // Trigger the analytics loader manually since consent is now granted
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("cookie-consent-granted"));
    }
  };

  const declineCookies = () => {
    // Set cookie for 30 days to not ask again
    document.cookie = "sabara-cookie-consent=declined; path=/; max-age=2592000; SameSite=Lax";
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6 sm:bottom-6 sm:left-6 sm:right-auto sm:max-w-sm pointer-events-none animate-in slide-in-from-bottom-5 duration-500">
      <div className="pointer-events-auto flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-serif text-lg font-semibold text-foreground">
              We value your privacy
            </h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. 
              By clicking "Accept", you consent to our use of cookies.
            </p>
            <Link 
              to="/privacy-policy" 
              className="mt-2 inline-block text-xs text-primary hover:underline"
              onClick={() => setIsVisible(false)}
            >
              Read our Privacy Policy
            </Link>
          </div>
          <button 
            onClick={declineCookies}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex gap-2 w-full mt-2">
          <Button 
            variant="outline" 
            className="flex-1 text-xs sm:text-sm"
            onClick={declineCookies}
          >
            Decline
          </Button>
          <Button 
            className="flex-1 text-xs sm:text-sm"
            onClick={acceptCookies}
          >
            Accept All
          </Button>
        </div>
      </div>
    </div>
  );
}
