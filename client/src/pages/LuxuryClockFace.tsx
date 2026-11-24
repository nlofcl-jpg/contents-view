import { useId } from "react";

const minuteIndices = Array.from({ length: 60 }, (_, index) => index);
const hourIndices = Array.from({ length: 12 }, (_, index) => index);

function FacetedHand({ angle, tip, width }: { angle: number; tip: number; width: number }) {
  const shoulder = Math.min(76, tip + 14);

  return (
    <g transform={`rotate(${angle} 80 80)`}>
      <path d={`M80 ${tip} L${80 + width} ${shoulder} L${80 + width * 0.68} 86 H${80 - width * 0.68} L${80 - width} ${shoulder} Z`} fill="#d7e1e8" stroke="#090d10" strokeWidth="0.9" />
      <path d={`M80 ${tip} L${80 + width} ${shoulder} L${80 + width * 0.68} 86 H80 Z`} fill="#758693" />
      <path d={`M80 ${tip + 8} L${80 + width * 0.32} ${shoulder + 2} L${80 + width * 0.22} 74 H${80 - width * 0.22} L${80 - width * 0.32} ${shoulder + 2} Z`} fill="#f3f6f4" />
    </g>
  );
}

export default function LuxuryClockFace({ time }: { time?: { hours: number; minutes: number; seconds: number; label: string } }) {
  const finishId = useId();
  const seconds = time?.seconds ?? 34;
  const minutes = time ? time.minutes + seconds / 60 : 10;
  const hours = time ? time.hours % 12 + minutes / 60 : 10 + 10 / 60;

  return (
    <svg className="studioAnalogClock" viewBox="0 0 160 160" role={time ? "img" : undefined} aria-label={time?.label} aria-hidden={time ? undefined : true}>
      <defs>
        <linearGradient id={finishId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop stopColor="#edf2f4" />
          <stop offset=".24" stopColor="#6c7780" />
          <stop offset=".48" stopColor="#b7c2ca" />
          <stop offset=".73" stopColor="#3a424a" />
          <stop offset="1" stopColor="#c5cfd5" />
        </linearGradient>
      </defs>
      <g aria-hidden="true">
        <circle cx="80" cy="80" r="77" fill="#000" />
        {minuteIndices.map(index => (
          <line key={index} x1="80" y1="12" x2="80" y2={index % 5 === 0 ? "16" : "14.5"} transform={`rotate(${index * 6} 80 80)`} stroke="#aebbc3" strokeOpacity={index % 5 === 0 ? ".9" : ".52"} strokeWidth=".65" />
        ))}
        {hourIndices.map(index => (
          <g key={index} transform={`rotate(${index * 30} 80 80)`}>
            <path d="M76.8 18H83.2L82.4 26.8L80 28.5L77.6 26.8Z" fill={`url(#${finishId})`} stroke="#0a0d10" strokeWidth=".55" />
            <path d="M78.2 19.3H81.8L81.15 26.2L80 27L78.85 26.2Z" fill="#d9e1e4" />
            {index === 0 && <line x1="80" x2="80" y1="18.7" y2="27.1" stroke="#454e55" strokeWidth=".7" />}
          </g>
        ))}
        <text x="80" y="54" textAnchor="middle" fill="#e9eef2" fontSize="7" fontWeight="600">CONTENTS VIEW</text>
        <FacetedHand angle={hours * 30} tip={42} width={4.3} />
        <FacetedHand angle={minutes * 6} tip={23} width={3.2} />
        <g transform={`rotate(${seconds * 6} 80 80)`}>
          <path d="M80 12.5V97" stroke="#8eb6d1" strokeWidth="1.15" strokeLinecap="round" />
          <circle cx="80" cy="92" r="2.2" fill="#13191d" stroke="#8eb6d1" strokeWidth=".85" />
        </g>
        <circle cx="80" cy="80" r="3.6" fill={`url(#${finishId})`} stroke="#14181c" strokeWidth=".7" />
        <circle cx="80" cy="80" r="1.25" fill="#f0f4f7" />
      </g>
    </svg>
  );
}
