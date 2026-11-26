import SectionMobileNav from "@/components/SectionMobileNav";
import { AppWindow, Clapperboard, CodeXml, Wrench } from "lucide-react";
import { useSearch } from "wouter";

const studioLinks = [
  { href: "/ai-studio/video", label: "콘텐츠 제작", Icon: Clapperboard },
  { href: "/ai-studio/programs", label: "프로그램", Icon: AppWindow },
  { href: "/ai-studio/open-source", label: "오픈소스", Icon: CodeXml },
  { href: "/ai-studio/resources", label: "도구", Icon: Wrench },
];

export default function StudioMobileNav({ path }: { path: string }) {
  const search = useSearch();
  const section = studioLinks.find(({ href }) => path === href || path.startsWith(`${href}/`));
  const isLegacyProduction = path === "/ai-studio" && new URLSearchParams(search).get("tab") === "upcoming";
  const activeHref = section?.href ?? (isLegacyProduction ? "/ai-studio/video" : "/ai-studio/programs");

  return <SectionMobileNav label="스튜디오 하단 메뉴" activeHref={activeHref} items={studioLinks} />;
}
