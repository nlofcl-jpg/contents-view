import { createClient } from "@supabase/supabase-js";
import type { User } from "../../drizzle/schema";
import { ENV } from "./env";

type SupabaseUser = {
  id: string;
  email?: string | null;
  created_at: string;
  last_sign_in_at?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

const supabaseAuthKey = ENV.supabaseAnonKey || ENV.supabaseServiceRoleKey;

const supabaseAuthClient =
  ENV.supabaseUrl && supabaseAuthKey
    ? createClient(ENV.supabaseUrl, supabaseAuthKey, {
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

  const { data, error } = await (supabaseAuthClient.auth as {
    getUser: (jwt: string) => Promise<{ data: { user: SupabaseUser | null }; error: unknown }>;
  }).getUser(token);
  if (error || !data.user) return null;

  return mapSupabaseUser(data.user);
}

export async function inspectSupabaseBearer(authorization: string | undefined) {
  const token = getBearerToken(authorization);
  const claims = decodeJwtPayload(token);

  if (!supabaseAuthClient || !token) {
    return {
      user: null,
      error: !supabaseAuthClient ? "supabase_auth_client_missing" : "token_missing",
      claims,
    };
  }

  const { data, error } = await (supabaseAuthClient.auth as {
    getUser: (jwt: string) => Promise<{ data: { user: SupabaseUser | null }; error: unknown }>;
  }).getUser(token);

  return {
    user: data.user ? mapSupabaseUser(data.user) : null,
    error: error ? normalizeSupabaseError(error) : null,
    claims,
  };
}

function decodeJwtPayload(token: string | null) {
  if (!token) return null;

  try {
    const [, payload] = token.split(".");
    if (!payload) return null;

    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(normalizedPayload, "base64").toString("utf8");
    const decoded = JSON.parse(json) as {
      iss?: string;
      aud?: string | string[];
      exp?: number;
      sub?: string;
      role?: string;
    };
    const now = Math.floor(Date.now() / 1000);

    return {
      issHost: decoded.iss ? safeHost(decoded.iss) : null,
      aud: decoded.aud ?? null,
      exp: decoded.exp ?? null,
      expired: typeof decoded.exp === "number" ? decoded.exp <= now : null,
      secondsUntilExpiry: typeof decoded.exp === "number" ? decoded.exp - now : null,
      subPrefix: decoded.sub ? decoded.sub.slice(0, 8) : null,
      role: decoded.role ?? null,
      length: token.length,
    };
  } catch {
    return {
      invalid: true,
      length: token.length,
    };
  }
}

function normalizeSupabaseError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message?: unknown }).message);
  }
  return "unknown_error";
}

function safeHost(value: string) {
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}
