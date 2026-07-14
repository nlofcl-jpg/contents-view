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

export type AppProfile = {
  role?: "user" | "admin" | null;
  approval_status?: "pending" | "approved" | "rejected" | null;
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
};

export function normalizeSupabaseUser(
  user: SupabaseUser,
  profile?: AppProfile | null,
): AppAuthUser {
  const metadata = user.user_metadata ?? {};
  const fullName =
    profile?.name ||
    (typeof metadata.full_name === "string"
      ? metadata.full_name
      : typeof metadata.name === "string"
        ? metadata.name
        : null);
  const avatarUrl =
    profile?.avatar_url ||
    (typeof metadata.avatar_url === "string" ? metadata.avatar_url : null);

  return {
    id: user.id,
    openId: user.id,
    name: fullName || profile?.email || user.email || null,
    email: profile?.email || user.email || null,
    avatarUrl,
    loginMethod: "supabase",
    role: profile?.role === "admin" ? "admin" : "user",
    approvalStatus: profile?.approval_status || "approved",
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
