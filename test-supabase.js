import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const supabaseUrl = "https://auzyzlrimtjmzbkimtvz.supabase.co";
const supabaseKey = "sb_publishable_g15UbEEsyvgfSvDcIrZ-pA_janbKVxv";
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.from("site_settings").select("value").eq("key", "hero").single();
  if (error) {
    console.error("Error fetching hero settings:", error);
    return;
  }
  
  const originalUrl = data.value.imageUrl || (data.value.slides && data.value.slides[0]?.imageUrl);
  if (!originalUrl) {
    console.error("No image URL found in hero settings");
    return;
  }
  
  console.log("Original URL:", originalUrl);
  
  // Transform URL
  // https://[PROJECT].supabase.co/storage/v1/object/public/[BUCKET]/[FILE]
  // to
  // https://[PROJECT].supabase.co/storage/v1/render/image/public/[BUCKET]/[FILE]?width=800&format=webp
  const transformedUrl = originalUrl.replace("/object/public/", "/render/image/public/") + "?width=800&format=webp";
  console.log("Transformed URL:", transformedUrl);
  
  // Fetch the transformed URL
  try {
    const res = await fetch(transformedUrl);
    console.log("Status:", res.status);
    console.log("Content-Type:", res.headers.get("content-type"));
    console.log("Cache-Control:", res.headers.get("cache-control"));
    
    // Save to disk to verify visually later if needed
    const buffer = await res.arrayBuffer();
    fs.writeFileSync("test-transformed.webp", Buffer.from(buffer));
    console.log("Saved test-transformed.webp, size:", buffer.byteLength);
  } catch (e) {
    console.error("Fetch failed:", e);
  }
}

test();
