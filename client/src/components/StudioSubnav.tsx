import { Link } from "wouter";

type StudioSection = "production" | "programs" | "openSource";

const sections: { id: StudioSection; label: string; href: string }[] = [
  { id: "production", label: "콘텐츠 제작", href: "/ai-studio/video" },
  { id: "programs", label: "프로그램", href: "/ai-studio/programs" },
  { id: "openSource", label: "오픈소스", href: "/ai-studio/open-source" },
];

export default function StudioSubnav({ active }: { active: StudioSection }) {
  return (
    <nav className="studioSubnav" aria-label="스튜디오 하위 메뉴">
      {sections.map(section => (
        <Link
          key={section.id}
          href={section.href}
          className={`studioSubnavLink${active === section.id ? " active" : ""}`}
          aria-current={active === section.id ? "page" : undefined}
        >
          {section.label}
        </Link>
      ))}
    </nav>
  );
}
