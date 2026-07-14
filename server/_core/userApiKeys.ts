import { createClient } from "@supabase/supabase-js";
import type { User } from "../../drizzle/schema";
import * as legacyDb from "../db";
import { ENV } from "./env";

type ApiKeyTestStatus = "untested" | "success" | "failed";

export type StoredUserApiKey = {
  apiKey: string;
  testStatus: ApiKeyTestStatus;
  testError: string | null;
  lastTestedAt: string | Date | null;
  createdAt: string | Date | null;
  updatedAt: string | Date | null;
};

const supabaseAdmin =
  ENV.supabaseUrl && ENV.supabaseServiceRoleKey
    ? createClient(ENV.supabaseUrl, ENV.supabaseServiceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : null;

function isSupabaseUser(user: User) {
  return user.loginMethod === "supabase" && user.openId && user.openId.includes("-");
}

function maskApiKey(apiKey: string) {
  return apiKey.length > 10
    ? `${apiKey.substring(0, 6)}${"*".repeat(Math.max(1, apiKey.length - 10))}${apiKey.substring(apiKey.length - 4)}`
    : `${"*".repeat(Math.max(1, apiKey.length - 4))}${apiKey.substring(Math.max(0, apiKey.length - 4))}`;
}

function requireSupabaseAdmin() {
  if (!supabaseAdmin) {
    throw new Error("Supabase service role key is not configured.");
  }

  return supabaseAdmin;
}

export async function saveUserApiKey(
  user: User,
  provider: string,
  apiKey: string,
) {
  if (!isSupabaseUser(user)) {
    return legacyDb.saveUserApiKey(user.id, provider, apiKey);
  }

  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    throw new Error("API key cannot be empty or whitespace only");
  }

  const supabase = requireSupabaseAdmin();
  const { error } = await supabase.from("user_api_keys").upsert(
    {
      user_id: user.openId,
      provider,
      encrypted_key: trimmedKey,
      masked_key: maskApiKey(trimmedKey),
      test_status: "untested",
      test_error: null,
      last_tested_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" },
  );

  if (error) throw new Error(error.message);
}

export async function deleteUserApiKey(user: User, provider: string) {
  if (!isSupabaseUser(user)) {
    return legacyDb.deleteUserApiKey(user.id, provider);
  }

  const supabase = requireSupabaseAdmin();
  const { error } = await supabase
    .from("user_api_keys")
    .delete()
    .eq("user_id", user.openId)
    .eq("provider", provider);

  if (error) throw new Error(error.message);
}

export async function getUserApiKey(
  user: User,
  provider: string,
): Promise<StoredUserApiKey | undefined> {
  if (!isSupabaseUser(user)) {
    const apiKey = await legacyDb.getUserApiKey(user.id, provider);
    if (!apiKey) return undefined;

    return {
      apiKey: apiKey.apiKey,
      testStatus: apiKey.testStatus as ApiKeyTestStatus,
      testError: apiKey.testError,
      lastTestedAt: apiKey.lastTestedAt,
      createdAt: apiKey.createdAt,
      updatedAt: apiKey.updatedAt,
    };
  }

  const supabase = requireSupabaseAdmin();
  const { data, error } = await supabase
    .from("user_api_keys")
    .select("encrypted_key,test_status,test_error,last_tested_at,created_at,updated_at")
    .eq("user_id", user.openId)
    .eq("provider", provider)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return undefined;

  return {
    apiKey: data.encrypted_key,
    testStatus: data.test_status,
    testError: data.test_error,
    lastTestedAt: data.last_tested_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function updateApiKeyTestStatus(
  user: User,
  provider: string,
  testStatus: ApiKeyTestStatus,
  testError: string | null = null,
) {
  if (!isSupabaseUser(user)) {
    return legacyDb.updateApiKeyTestStatus(user.id, provider, testStatus, testError ?? undefined);
  }

  const supabase = requireSupabaseAdmin();
  const { error } = await supabase
    .from("user_api_keys")
    .update({
      test_status: testStatus,
      test_error: testError,
      last_tested_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.openId)
    .eq("provider", provider);

  if (error) throw new Error(error.message);
}

export { maskApiKey };
