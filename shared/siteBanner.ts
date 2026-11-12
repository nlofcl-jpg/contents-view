export const MAX_BANNER_MESSAGE_LENGTH = 160;
export const MAX_BANNER_LINK_LENGTH = 500;

export type SiteBanner = {
  message: string;
  link_url: string;
  is_visible: boolean;
};

export const DEFAULT_SITE_BANNER: SiteBanner = {
  message: "컨텐츠뷰에 가입 하고 다양한 컨텐츠 트렌드를 한 곳에서 확인하세요.",
  link_url: "",
  is_visible: true,
};

export function getBannerLink(value: string): string | null {
  const link = value.trim();
  if (link.length > MAX_BANNER_LINK_LENGTH || /[\x00-\x20\x7f\\]/.test(link)) return null;
  if (/^\/(?!\/)/.test(link)) return link;
  if (!/^https:\/\//i.test(link)) return null;
  try {
    const url = new URL(link);
    return url.protocol === "https:" && !url.username && !url.password ? link : null;
  } catch {
    return null;
  }
}
