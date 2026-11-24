function FlipDigit({ digit, previous }: { digit: string; previous?: string }) {
  return (
    <span className="studioFlipDigit">
      <span className="studioFlipHalf studioFlipTop"><span>{digit}</span></span>
      <span className="studioFlipHalf studioFlipBottom"><span>{digit}</span></span>
      {previous && previous !== digit && (
        <span key={digit} className="studioFlipLayers">
          <span className="studioFlipHalf studioFlipBottom studioFlipOldBottom"><span>{previous}</span></span>
          <span className="studioFlipFlap">
            <span className="studioFlipHalf studioFlipTop studioFlipFlapFace"><span>{previous}</span></span>
            <span className="studioFlipHalf studioFlipBottom studioFlipFlapFace studioFlipFlapBack"><span>{digit}</span></span>
          </span>
        </span>
      )}
    </span>
  );
}

export default function FlipClockFace({ time = "10:10:34", previousTime, showSeconds = true }: {
  time?: string;
  previousTime?: string;
  showSeconds?: boolean;
}) {
  const previousParts = previousTime?.split(":");
  const parts = time.split(":").slice(0, showSeconds ? 3 : 2);

  return (
    <div
      className="studioFlipClock"
      data-seconds={showSeconds}
      role={previousTime ? "img" : undefined}
      aria-label={previousTime ? parts.join(":") : undefined}
      aria-hidden={previousTime ? undefined : true}
    >
      {parts.map((part, index) => (
        <div key={index} className="studioFlipPair" aria-hidden="true">
          <FlipDigit digit={part[0]} previous={previousParts?.[index]?.[0]} />
          <FlipDigit digit={part[1]} previous={previousParts?.[index]?.[1]} />
        </div>
      ))}
    </div>
  );
}
