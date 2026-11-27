import type { ReactNode } from "react";
import StudioSubnav from "@/components/StudioSubnav";

export default function StudioSectionHeader({
  title = "STUDIO",
  children,
  image,
}: {
  title?: string;
  children: ReactNode;
  image?: string;
}) {
  return (
    <header className="aiStudioHero">
      <div className="aiStudioHeroHeading">
        <div className="aiStudioHeroContent">
          <span className="aiStudioHeroEyebrow">CONTENTS VIEW</span>
          <h1 className="aiStudioHeroTitle">{title}</h1>
          <p className="aiStudioHeroDescription">{children}</p>
        </div>
        {image && <img className="aiStudioHeroMedia" src={image} alt="" />}
      </div>
      <StudioSubnav />
    </header>
  );
}
