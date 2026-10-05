import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Optimizes a Supabase Storage public URL using Supabase Image Transformations.
 * Returns the original URL if it's not a Supabase storage URL.
 */
export function getOptimizedImageUrl(originalUrl: string | null | undefined, width: number, quality: number = 80): string {
  if (!originalUrl) return "";
  
  if (originalUrl.includes(".supabase.co/storage/v1/object/public/")) {
    return originalUrl.replace("/object/public/", "/render/image/public/") + `?width=${width}&format=webp&quality=${quality}`;
  }
  
  return originalUrl;
}
