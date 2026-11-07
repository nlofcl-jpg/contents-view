import React from "react";

export default function IssueThumbnail({ src, credit }: { src: string | null; credit?: string | null }) {
  if (!src) return null;
  const caption = credit?.trim();
  return (
    <figure className="issueDetailFigure">
      <img className="issueDetailImage" src={src} alt="" />
      {caption && <figcaption className="issueDetailImageCredit">{caption}</figcaption>}
    </figure>
  );
}
