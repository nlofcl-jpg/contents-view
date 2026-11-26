export const commerceLinks = [
  { id: "shopping", label: "쇼핑 트렌드 비교", href: "/commerce" },
  { id: "coupang", label: "쿠팡 트렌드", href: "/commerce?tab=coupang" },
] as const;

export function getCommerceTab(search: string) {
  return new URLSearchParams(search).get("tab") === "coupang" ? "coupang" : "shopping";
}
