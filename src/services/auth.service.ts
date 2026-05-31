import { supabase } from "@/integrations/supabase/client";

export type UserProfileData = {
  fullName: string;
  age: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
};

export const AuthService = {
  signInWithGoogle: async () => {
    return supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Redirect back to the home page after Google auth.
        // The AuthProvider's onAuthStateChange handler will:
        //   1. Detect the ?code= / #access_token= in the URL
        //   2. Show the "logged in" popup
        //   3. Clean the URL and keep the user on /
        redirectTo: window.location.origin,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
  },

  saveProfile: async (profileData: UserProfileData) => {
    // We retrieve the active session token to pass to our protected API
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    
    if (!token) throw new Error("No active session to save profile");

    const response = await fetch("/api/users/profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(profileData)
    });

    if (!response.ok) {
      throw new Error("Failed to save user profile");
    }

    return response.json();
  }
};
