import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { SiteBanner } from "@shared/siteBanner";

const columns = "message,link_url,is_visible";

export const siteBannerQuery = queryOptions({
  queryKey: ["site-banner"],
  queryFn: async (): Promise<SiteBanner> => {
    if (!supabase) throw new Error("배너 저장소가 설정되지 않았습니다.");
    const { data, error } = await supabase.from("site_banner_settings").select(columns).eq("id", 1).single();
    if (error) throw error;
    return data;
  },
  staleTime: 60_000,
  retry: false,
});

export async function saveSiteBanner(banner: SiteBanner): Promise<SiteBanner> {
  if (!supabase) throw new Error("배너 저장소가 설정되지 않았습니다.");
  const { data, error } = await supabase.from("site_banner_settings")
    .update(banner).eq("id", 1).select(columns).single();
  if (error) throw error;
  return data;
}
