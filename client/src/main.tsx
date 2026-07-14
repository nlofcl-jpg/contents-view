import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";
import { setSupabaseAccessTokenCookie, supabase } from "./lib/supabase";

const queryClient = new QueryClient();

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    // Extract query key for better debugging
    const queryKey = event.query.queryKey;
    let queryPath = "unknown";
    if (Array.isArray(queryKey)) {
      // Filter out non-string elements (like objects) from the path
      queryPath = queryKey.filter(k => typeof k === 'string').join(".");
    } else if (typeof queryKey === 'string') {
      queryPath = queryKey;
    }
    // Always log errors with full details for debugging
    const logMessage = queryPath ? `[API Query Error] path: ${queryPath}` : `[API Query Error] queryKey: ${JSON.stringify(event.query.queryKey)}`;
    console.error(logMessage, error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    // Extract mutation key for better debugging
    const mutationKey = event.mutation.options.mutationKey;
    let mutationPath = "unknown";
    if (Array.isArray(mutationKey)) {
      // Filter out non-string elements (like objects) from the path
      mutationPath = mutationKey.filter(k => typeof k === 'string').join(".");
    } else if (typeof mutationKey === 'string') {
      mutationPath = mutationKey;
    }
    console.error(`[API Mutation Error] path: ${mutationPath}`, error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      async headers() {
        if (!supabase) return {};

        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        setSupabaseAccessTokenCookie(token ?? null);
        if (!token) return {};

        return {
          Authorization: `Bearer ${token}`,
          "x-supabase-access-token": token,
        };
      },
      async fetch(input, init) {
        const headers = new Headers(init?.headers);
        if (supabase) {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          setSupabaseAccessTokenCookie(token ?? null);
          if (token) {
            headers.set("Authorization", `Bearer ${token}`);
            headers.set("x-supabase-access-token", token);
          }
        }

        return globalThis.fetch(input, {
          ...(init ?? {}),
          headers,
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
