import { createClient, type User as SupabaseUser } from "@supabase/supabase-js";
import type { User } from "../../drizzle/schema";
import { ENV } from "./env";

const supabaseAuthClient =
  ENV.supabaseUrl && ENV.supabaseAnonKey
    ? createClient(ENV.supabaseUrl, ENV.supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : null;

function getBearerToken(authorization: string | undefined): string | null {
  if (!authorization) return null;
  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

function mapSupabaseUser(user: SupabaseUser): User {
  const metadata = user.user_metadata ?? {};
  const name =
    typeof metadata.full_name === "string"
      ? metadata.full_name
      : typeof metadata.name === "string"
        ? metadata.name
        : user.email ?? null;

  return {
    id: 0,
    openId: user.id,
    name,
    email: user.email ?? null,
    loginMethod: "supabase",
    role: "user",
    approvalStatus: "approved",
    createdAt: new Date(user.created_at),
    updatedAt: new Date(),
    lastSignedIn: user.last_sign_in_at ? new Date(user.last_sign_in_at) : new Date(),
    memberNo: 0,
  };
}

export async function authenticateSupabaseBearer(
  authorization: string | undefined,
): Promise<User | null> {
  if (!supabaseAuthClient) return null;

  const token = getBearerToken(authorization);
  if (!token) return null;

  const { data, error } = await supabaseAuthClient.auth.getUser(token);
  if (error || !data.user) return null;

  return mapSupabaseUser(data.user);
}
