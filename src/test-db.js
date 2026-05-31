import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase URL or Key in env files.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  try {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .limit(1);

    if (error) {
      console.error("Error fetching profiles:", error);
    } else {
      console.log("Success! Columns in user_profiles:");
      if (data && data.length > 0) {
        console.log(Object.keys(data[0]));
        console.log("Sample profile row:", data[0]);
      } else {
        console.log("Table is empty, trying to fetch single schema metadata...");
      }
    }
  } catch (err) {
    console.error("Caught error:", err);
  }
}

test();
