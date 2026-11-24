const segments = [
  "8,3 32,3 36,7 32,11 8,11 4,7",
  "34,12 38,8 42,12 42,29 38,33 34,29",
  "34,39 38,35 42,39 42,56 38,60 34,56",
  "8,57 32,57 36,61 32,65 8,65 4,61",
  "0,39 4,35 8,39 8,56 4,60 0,56",
  "0,12 4,8 8,12 8,29 4,33 0,29",
  "8,30 32,30 36,34 32,38 8,38 4,34",
];

const litSegments = ["012345", "12", "01346", "01236", "1256", "02356", "023456", "012", "0123456", "012356"];

function DeskDigit({ digit, x, y, scale = 1 }: { digit: string; x: number; y: number; scale?: number }) {
  const lit = litSegments[Number(digit)] ?? "";

  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {segments.map((points, index) => (
        <polygon key={index} points={points} fill={lit.includes(String(index)) ? "#fff" : "#171717"} />
      ))}
    </g>
  );
}

export default function DeskClockFace({ time }: { time?: string }) {
  const digits = (time ?? "10:10:34").replaceAll(":", "");

  return (
    <svg
      className="studioDeskClock"
      viewBox="0 0 400 144"
      role={time ? "img" : undefined}
      aria-label={time}
      aria-hidden={time ? undefined : true}
    >
      <g aria-hidden="true">
        <rect x="42" y="127" width="44" height="9" rx="3" fill="#0e1216" />
        <rect x="314" y="127" width="44" height="9" rx="3" fill="#0e1216" />
        <rect x="7" y="10" width="386" height="122" rx="16" fill="#171c22" stroke="#414953" strokeWidth="2" />
        <rect x="16" y="19" width="368" height="104" rx="10" fill="#0b0e11" />
        <rect x="25" y="26" width="350" height="90" rx="6" fill="#000" stroke="#242424" />
        <path d="M31 30H369" stroke="#202020" strokeLinecap="round" />
        <g>
          <DeskDigit digit={digits[0]} x={59} y={36} />
          <DeskDigit digit={digits[1]} x={111} y={36} />
          <rect x="165" y="55" width="6" height="6" rx="1" fill="#fff" />
          <rect x="165" y="78" width="6" height="6" rx="1" fill="#fff" />
          <DeskDigit digit={digits[2]} x={183} y={36} />
          <DeskDigit digit={digits[3]} x={235} y={36} />
          <DeskDigit digit={digits[4]} x={294} y={64} scale={0.57} />
          <DeskDigit digit={digits[5]} x={325} y={64} scale={0.57} />
        </g>
      </g>
    </svg>
  );
}
