import { cn } from "@/lib/utils";
import roundLogo from "@/assets/round logo.png";

export interface LogoSpinnerProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  label?: string;
  ringColor?: string;
  trackColor?: string;
  speed?: "slow" | "normal" | "fast";
}

const sizeMap = {
  xs: {
    container: "h-5 w-5",
    logo: "h-3.5 w-3.5 p-[1px]",
    stroke: 1.6,
  },
  sm: {
    container: "h-7 w-7",
    logo: "h-5 w-5 p-[1px]",
    stroke: 1.5,
  },
  md: {
    container: "h-11 w-11",
    logo: "h-8 w-8 p-[1.5px]",
    stroke: 1.4,
  },
  lg: {
    container: "h-14 w-14",
    logo: "h-10 w-10 p-0.5",
    stroke: 1.4,
  },
  xl: {
    container: "h-18 w-18",
    logo: "h-13 w-13 p-1",
    stroke: 1.3,
  },
};

const speedMap = {
  slow: "duration-[2000ms]",
  normal: "duration-[1100ms]",
  fast: "duration-[750ms]",
};

/**
 * LogoSpinner - Elegant branded loading spinner where a delicate, thin circular ring rotates
 * around the Sabara round logo.
 */
export function LogoSpinner({
  size = "md",
  className,
  label,
  ringColor = "text-primary",
  trackColor = "text-primary/10",
  speed = "normal",
}: LogoSpinnerProps) {
  const currentSize = sizeMap[size] || sizeMap.md;
  const currentSpeed = speedMap[speed] || speedMap.normal;

  return (
    <div className={cn("inline-flex flex-col items-center justify-center gap-2.5", className)}>
      <div className={cn("relative flex items-center justify-center shrink-0", currentSize.container)}>
        {/* Outer Rotating Circular Loading Ring - Thin and Delicate */}
        <svg
          className={cn("absolute inset-0 h-full w-full animate-spin transition-all", ringColor, currentSpeed)}
          viewBox="0 0 44 44"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Faint guide track */}
          <circle
            cx="22"
            cy="22"
            r="20"
            stroke="currentColor"
            strokeWidth={currentSize.stroke}
            className={trackColor}
          />
          {/* Slender spinning accent arc */}
          <circle
            cx="22"
            cy="22"
            r="20"
            stroke="currentColor"
            strokeWidth={currentSize.stroke}
            strokeLinecap="round"
            strokeDasharray="36 90"
          />
        </svg>

        {/* Center Round Logo (Stationary, upright and crisp) */}
        <div
          className={cn(
            "relative z-10 flex items-center justify-center rounded-full bg-card shadow-2xs ring-1 ring-border/50 overflow-hidden",
            currentSize.logo,
          )}
        >
          <img
            src={roundLogo}
            alt="Loading..."
            width={64}
            height={64}
            className="h-full w-full rounded-full object-cover select-none pointer-events-none"
          />
        </div>
      </div>

      {label && (
        <p className="text-xs sm:text-sm font-medium tracking-wide text-muted-foreground animate-pulse font-serif">
          {label}
        </p>
      )}
    </div>
  );
}

/** Full-screen or full-container centered logo loader */
export function LogoPageLoader({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex min-h-[300px] w-full flex-col items-center justify-center py-16">
      <LogoSpinner size="lg" label={label} />
    </div>
  );
}
