import { createClient } from "@supabase/supabase-js";

let _serverSupabase: any = null;

export function getServerSupabase() {
  if (_serverSupabase) return _serverSupabase;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase environment variables on server");
  }
  
  // Use a singleton for public queries to avoid re-instantiation overhead.
  // We disable auth persistence because this is used in server SSR/API routes
  // for public data. (User authentication is handled strictly on the client).
  _serverSupabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });

  return _serverSupabase;
}
