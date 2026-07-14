import { createClient, type User as SupabaseUser } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export type AppAuthUser = {
  id: string;
  openId: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  loginMethod: "supabase";
  role: "user" | "admin";
  approvalStatus: "pending" | "approved" | "rejected";
};

export function normalizeSupabaseUser(user: SupabaseUser): AppAuthUser {
  const metadata = user.user_metadata ?? {};
  const fullName =
    typeof metadata.full_name === "string"
      ? metadata.full_name
      : typeof metadata.name === "string"
        ? metadata.name
        : null;
  const avatarUrl =
    typeof metadata.avatar_url === "string" ? metadata.avatar_url : null;

  return {
    id: user.id,
    openId: user.id,
    name: fullName || user.email || null,
    email: user.email ?? null,
    avatarUrl,
    loginMethod: "supabase",
    role: "user",
    approvalStatus: "approved",
  };
}

export async function signInWithGoogle() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/`,
    },
  });
}
