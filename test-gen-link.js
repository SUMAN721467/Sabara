import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function test() {
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'signup',
    email: 'test_generate_link@example.com',
    password: 'password123',
    data: { full_name: 'Test User' }
  });
  console.log("Data:", data);
  console.log("Error:", error);
}

test();
