import { useState, ImgHTMLAttributes } from "react";

interface OptimizedImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  originalSrc?: string;
  width: number;
}

export function getOptimizedImageUrl(originalUrl: string, width: number): string {
  if (!originalUrl) return originalUrl;
  if (originalUrl.includes(".supabase.co/storage/v1/object/public/")) {
    return originalUrl.replace("/object/public/", "/render/image/public/") + `?width=${width}&format=webp&quality=80`;
  }
  return originalUrl;
}

export function OptimizedImage({ src, originalSrc, width, alt, ...props }: OptimizedImageProps) {
  const [imgSrc, setImgSrc] = useState(() => {
    // If it's a Supabase URL, try the optimized one first
    return getOptimizedImageUrl(src, width);
  });
  
  const actualOriginalSrc = originalSrc || src;

  return (
    <img
      {...props}
      src={imgSrc}
      alt={alt || ""}
      width={width}
      onError={() => {
        // Graceful fallback to original URL if the transformation fails (e.g. not on Pro plan)
        if (imgSrc !== actualOriginalSrc) {
          setImgSrc(actualOriginalSrc);
        }
      }}
    />
  );
}
