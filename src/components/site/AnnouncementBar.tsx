import { useState, useEffect } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePromoSettings } from "@/lib/settings";

export function AnnouncementBar() {
  const { settings, isLoaded } = usePromoSettings();
  const location = useLocation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);

  const activeItems = settings?.items?.filter((item) => item.isActive) || [];

  useEffect(() => {
    if (!settings?.autoPlay || activeItems.length <= 1) return;
    
    const timer = setInterval(() => {
      handleNext();
    }, (settings.autoPlayInterval || 5) * 1000);

    return () => clearInterval(timer);
  }, [settings?.autoPlay, settings?.autoPlayInterval, activeItems.length]);

  if (!isLoaded || !settings?.enabled || activeItems.length === 0) return null;
  if (location.pathname.startsWith("/admin")) return null;

  const handleNext = () => {
    setIsFading(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % activeItems.length);
      setIsFading(false);
    }, 200); // matches the fading transition timing
  };

  const handlePrev = () => {
    setIsFading(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + activeItems.length) % activeItems.length);
      setIsFading(false);
    }, 200);
  };

  const currentItem = activeItems[currentIndex];
  if (!currentItem) return null;

  const renderContent = () => {
    const textSpan = (
      <span className="text-[11px] sm:text-xs font-semibold tracking-wider font-sans uppercase">
        {currentItem.text}
      </span>
    );

    if (currentItem.link) {
      const isExternal = currentItem.link.startsWith("http");
      if (isExternal) {
        return (
          <a
            href={currentItem.link}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-white transition-all duration-200"
          >
            {textSpan}
          </a>
        );
      }
      return (
        <Link
          to={currentItem.link}
          className="hover:underline focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-white transition-all duration-200"
        >
          {textSpan}
        </Link>
      );
    }

    return textSpan;
  };

  return (
    <div
      style={{
        backgroundColor: settings.backgroundColor,
        color: settings.textColor,
      }}
      className="relative z-50 flex h-9 w-full items-center justify-between px-4 transition-colors duration-300 shadow-sm"
    >
      {/* Left Navigation */}
      {activeItems.length > 1 ? (
        <button
          onClick={handlePrev}
          className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-white/10 transition-colors focus:outline-none cursor-pointer"
          aria-label="Previous announcement"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      ) : (
        <div className="w-6" />
      )}

      {/* Slide Content */}
      <div
        className={`flex-1 text-center transition-opacity duration-200 ${
          isFading ? "opacity-0" : "opacity-100"
        }`}
      >
        {renderContent()}
      </div>

      {/* Right Navigation */}
      {activeItems.length > 1 ? (
        <button
          onClick={handleNext}
          className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-white/10 transition-colors focus:outline-none cursor-pointer"
          aria-label="Next announcement"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      ) : (
        <div className="w-6" />
      )}
    </div>
  );
}
