import type { LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { useMobileNavScroll } from "@/hooks/useMobileNavScroll";

type SectionMobileNavProps = {
  label: string;
  activeHref: string;
  items: readonly { href: string; label: string; Icon?: LucideIcon }[];
};

export default function SectionMobileNav({ label, activeHref, items }: SectionMobileNavProps) {
  const navHidden = useMobileNavScroll();

  return (
    <nav aria-label={label} data-scroll-hidden={navHidden} className="sectionMobileNav fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-white/10 px-2 pb-[env(safe-area-inset-bottom,0px)] md:hidden">
      {items.map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={activeHref === href ? "page" : undefined}
          className="flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded text-xs font-medium text-slate-300 no-underline outline-sky-300 focus-visible:outline-2 aria-[current=page]:text-sky-300"
        >
          {Icon && <Icon size={18} aria-hidden="true" />}
          <span className="whitespace-pre-line text-center leading-4">{label}</span>
        </Link>
      ))}
    </nav>
  );
}
