import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ScrollRevealProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: "fade" | "fade-up" | "fade-down" | "fade-left" | "fade-right" | "zoom-in" | "zoom-out";
  duration?: number; // in ms
  delay?: number; // in ms
  threshold?: number;
  once?: boolean;
}

export function ScrollReveal({
  children,
  variant = "fade-up",
  duration = 800,
  delay = 0,
  threshold = 0.05,
  once = true,
  className,
  ...props
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only run on client-side
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once && ref.current) {
            observer.unobserve(ref.current);
          }
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { threshold }
    );

    const currentRef = ref.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [threshold, once]);

  const variantStyles = {
    fade: "opacity-0 data-[visible=true]:opacity-100",
    "fade-up": "opacity-0 translate-y-8 data-[visible=true]:opacity-100 data-[visible=true]:translate-y-0",
    "fade-down": "opacity-0 -translate-y-8 data-[visible=true]:opacity-100 data-[visible=true]:translate-y-0",
    "fade-left": "opacity-0 translate-x-8 data-[visible=true]:opacity-100 data-[visible=true]:translate-x-0",
    "fade-right": "opacity-0 -translate-x-8 data-[visible=true]:opacity-100 data-[visible=true]:translate-x-0",
    "zoom-in": "opacity-0 scale-[0.97] data-[visible=true]:opacity-100 data-[visible=true]:scale-100",
    "zoom-out": "opacity-0 scale-[1.03] data-[visible=true]:opacity-100 data-[visible=true]:scale-100",
  };

  return (
    <div
      ref={ref}
      data-visible={isVisible}
      className={cn(
        "transition-all ease-[cubic-bezier(0.21,0.6,0.35,1)]",
        variantStyles[variant],
        className
      )}
      style={{
        transitionDuration: `${duration}ms`,
        transitionDelay: `${delay}ms`,
        willChange: "transform, opacity",
        ...props.style
      }}
      {...props}
    >
      {children}
    </div>
  );
}
