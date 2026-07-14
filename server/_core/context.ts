import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { SUPABASE_ACCESS_TOKEN_COOKIE } from "@shared/const";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { authenticateSupabaseBearer } from "./supabase";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  if (!user) {
    const req = opts.req as unknown as {
      headers?: Record<string, string | string[] | undefined>;
    };
    const authorizationHeader = req.headers?.["authorization"];
    const supabaseTokenHeader = req.headers?.["x-supabase-access-token"];
    const authorization = Array.isArray(authorizationHeader)
      ? authorizationHeader[0]
      : authorizationHeader;
    const supabaseToken = Array.isArray(supabaseTokenHeader)
      ? supabaseTokenHeader[0]
      : supabaseTokenHeader;
    const cookieToken = getCookieValue(
      req.headers?.cookie,
      SUPABASE_ACCESS_TOKEN_COOKIE,
    );
    user = await authenticateSupabaseBearer(
      authorization ||
        (supabaseToken ? `Bearer ${supabaseToken}` : undefined) ||
        (cookieToken ? `Bearer ${cookieToken}` : undefined),
    );
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}

function getCookieValue(
  cookieHeader: string | string[] | undefined,
  name: string,
) {
  const cookie = Array.isArray(cookieHeader) ? cookieHeader.join("; ") : cookieHeader;
  if (!cookie) return null;

  const match = cookie
    .split(";")
    .map(part => part.trim())
    .find(part => part.startsWith(`${name}=`));
  if (!match) return null;

  return decodeURIComponent(match.slice(name.length + 1));
}
