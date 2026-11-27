import { ChevronDown, ChevronLeft, ChevronRight, Globe, Maximize, Minimize } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import StudioSubnav from "@/components/StudioSubnav";
import StudioSectionHeader from "@/components/StudioSectionHeader";
import DeskClockFace from "./DeskClockFace";
import FlipClockFace from "./FlipClockFace";
import LuxuryClockFace from "./LuxuryClockFace";
import "./studioResources.css";

const clocks = [
  { id: "classic", name: "기본 시계" },
  { id: "numbered", name: "아날로그 숫자 시계" },
  { id: "dotted", name: "도트 시계" },
  { id: "flip", name: "플립 시계" },
  { id: "desk", name: "탁상 전자시계" },
  { id: "digits", name: "숫자 전자시계" },
  { id: "world", name: "세계 시간" },
  { id: "luxury", name: "프리미엄 손목시계" },
] as const;
type ClockStyle = typeof clocks[number]["id"];
type ClockTime = { hours: number; minutes: number; seconds: number; label: string };

const clockMarks = Array.from({ length: 60 }, (_, index) => index);
const hourPositions = Array.from({ length: 12 }, (_, index) => {
  const hour = index + 1;
  const angle = hour * Math.PI / 6;
  return { hour, x: Math.sin(angle), y: -Math.cos(angle) };
});
const clockZones = [
  { value: "", label: "현지 시간", countryCode: "" },
  { value: "Asia/Seoul", label: "대한민국", countryCode: "KR" },
  { value: "Asia/Tokyo", label: "일본", countryCode: "JP" },
  { value: "Asia/Shanghai", label: "중국", countryCode: "CN" },
  { value: "Asia/Singapore", label: "싱가포르", countryCode: "SG" },
  { value: "Europe/London", label: "영국", countryCode: "GB" },
  { value: "Europe/Paris", label: "프랑스", countryCode: "FR" },
  { value: "America/New_York", label: "미국 동부", countryCode: "US" },
  { value: "America/Los_Angeles", label: "미국 서부", countryCode: "US" },
  { value: "Australia/Sydney", label: "호주 시드니", countryCode: "AU" },
].map(zone => ({
  ...zone,
  flag: Array.from(zone.countryCode, letter => String.fromCodePoint(0x1f1e6 + letter.charCodeAt(0) - 65)).join(""),
  timeFormat: new Intl.DateTimeFormat("ko-KR", {
    timeZone: zone.value || undefined,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }),
}));

function createClockTimeFormatter(zone: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: zone || undefined,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
}

function createClockDateFormatter(zone: string, weekday?: "long") {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: zone || undefined,
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday,
  });
}

function getClockTime(formatter: Intl.DateTimeFormat, now: Date): ClockTime {
  const parts = formatter.formatToParts(now);
  const readPart = (type: "hour" | "minute" | "second") => parts.find(part => part.type === type)?.value ?? "00";
  const hours = readPart("hour");
  const minutes = readPart("minute");
  const seconds = readPart("second");

  return { hours: Number(hours), minutes: Number(minutes), seconds: Number(seconds), label: `${hours}:${minutes}:${seconds}` };
}

const worldClockZoneIds = new Set([
  "Asia/Seoul", "Asia/Tokyo", "Asia/Shanghai", "Asia/Singapore",
  "Europe/London", "Europe/Paris", "America/New_York", "Australia/Sydney",
]);
const worldClockZones = clockZones
  .filter(({ value }) => worldClockZoneIds.has(value))
  .map(({ label, value }) => ({
    label,
    value,
    timeFormatter: createClockTimeFormatter(value),
    dateFormatter: createClockDateFormatter(value, "long"),
  }));

function AnalogClockFace({ time, clockStyle = "classic" }: {
  time?: ClockTime;
  clockStyle?: "classic" | "numbered" | "dotted";
}) {
  const showNumerals = clockStyle === "numbered";
  const seconds = time?.seconds ?? 34;
  const minutes = time ? time.minutes + seconds / 60 : 10;
  const hours = time ? time.hours % 12 + minutes / 60 : 10 + 10 / 60;

  return (
    <svg
      className="studioAnalogClock"
      data-numerals={showNumerals}
      viewBox="0 0 160 160"
      role={time ? "img" : undefined}
      aria-label={time?.label}
      aria-hidden={time ? undefined : true}
    >
      <circle className="studioClockFace" cx="80" cy="80" r="76" />
      {clockStyle === "dotted" ? (
        <g className="studioClockDots" aria-hidden="true">
          {hourPositions.map(({ hour, x, y }) => (
            <circle key={hour} cx={80 + 64 * x} cy={80 + 64 * y} r={hour % 3 === 0 ? 2 : 1.4} />
          ))}
        </g>
      ) : clockMarks.map(mark => (
        <line
          key={mark}
          className={mark % 5 === 0 ? "studioClockHourMark" : "studioClockMinuteMark"}
          x1="80" x2="80" y1="12" y2={mark % 5 === 0 ? (showNumerals ? "16" : "20") : (showNumerals ? "14" : "15")}
          transform={`rotate(${mark * 6} 80 80)`}
          aria-hidden="true"
        />
      ))}
      {showNumerals && (
        <g className="studioClockNumerals" aria-hidden="true">
          {hourPositions.map(({ hour, x, y }) => (
            <text key={hour} x={80 + 55 * x} y={80 + 55 * y} textAnchor="middle" dominantBaseline="central">{hour}</text>
          ))}
        </g>
      )}
      <g className="studioClockHands" aria-hidden="true">
        <line x1="80" x2="80" y1="80" y2="46" strokeWidth="5" transform={`rotate(${hours * 30} 80 80)`} />
        <line x1="80" x2="80" y1="80" y2="29" strokeWidth="3" transform={`rotate(${minutes * 6} 80 80)`} />
        <line className="studioClockSecondHand" x1="80" x2="80" y1="90" y2="24" strokeWidth="2" transform={`rotate(${seconds * 6} 80 80)`} />
        <circle className="studioClockHub" cx="80" cy="80" r="4" />
      </g>
    </svg>
  );
}

function ClockFace({ clockStyle, time, previousTime, showSeconds }: {
  clockStyle: ClockStyle;
  time?: ClockTime;
  previousTime?: string;
  showSeconds?: boolean;
}) {
  if (clockStyle === "world") return <Globe className="studioWorldClockThumbnail" aria-hidden="true" />;
  if (clockStyle === "luxury") return <LuxuryClockFace time={time} />;
  if (clockStyle === "desk") return <DeskClockFace time={time?.label} />;
  if (clockStyle === "flip") return <FlipClockFace time={time?.label} previousTime={previousTime} showSeconds={showSeconds} />;
  if (clockStyle === "digits") {
    return <span className="studioClockDigits" aria-hidden={time ? undefined : true}>{time?.label ?? "10:10:34"}</span>;
  }
  return <AnalogClockFace time={time} clockStyle={clockStyle} />;
}

function useClockNow() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return now;
}

function LiveClockFace({ zone, showDate, neon, clockStyle, showSeconds }: {
  zone: string;
  showDate: boolean;
  neon: boolean;
  clockStyle: ClockStyle;
  showSeconds: boolean;
}) {
  const now = useClockNow();
  const formatter = useMemo(() => createClockTimeFormatter(zone), [zone]);
  const dateFormatter = useMemo(() => createClockDateFormatter(zone), [zone]);

  if (clockStyle === "world") {
    return (
      <div className="studioClockReadout studioClockWorldReadout" data-neon={neon}>
        <ul className="studioWorldClockGrid" aria-label="세계 시간">
          {worldClockZones.map(({ value, label, timeFormatter, dateFormatter }) => (
            <li className="studioWorldClock" key={value}>
              <h2 className="studioWorldClockName">{label}</h2>
              <AnalogClockFace time={getClockTime(timeFormatter, now)} />
              <span className="studioWorldClockDate" aria-hidden={!showDate}>{dateFormatter.format(now)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="studioClockReadout" data-neon={neon}>
      <div className="studioClockFaceStage">
        <ClockFace
          time={getClockTime(formatter, now)}
          clockStyle={clockStyle}
          previousTime={clockStyle === "flip" ? formatter.format(now.getTime() - 1000) : undefined}
          showSeconds={showSeconds}
        />
      </div>
      <div className="studioClockDate">{showDate && dateFormatter.format(now)}</div>
    </div>
  );
}

function ClockCountryList({ selected, onSelect }: { selected: string; onSelect: (zone: string) => void }) {
  const now = useClockNow();

  return (
    <ul className="studioClockCountryList">
      {clockZones.map(({ value, label, flag, timeFormat }) => (
        <li key={value}>
          <button type="button" className="studioClockCountryOption" aria-pressed={value === selected} onClick={() => onSelect(value)}>
            <span className="studioClockCountryFlag" aria-hidden="true">{flag || <Globe size={17} />}</span>
            <span>{label}</span>
            <span className="studioClockCountryTime">{timeFormat.format(now)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function ClockGallery() {
  const [selectedClockId, setSelectedClockId] = useState<ClockStyle>(clocks[0].id);
  const [zone, setZone] = useState("");
  const [showDate, setShowDate] = useState(true);
  const [showWorldDate, setShowWorldDate] = useState(true);
  const [neon, setNeon] = useState(false);
  const [showSeconds, setShowSeconds] = useState(true);
  const [themeOpen, setThemeOpen] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [fullscreenFallback, setFullscreenFallback] = useState(false);
  const [fullscreenControlsVisible, setFullscreenControlsVisible] = useState(false);
  const fullscreenControlsTimer = useRef<number | undefined>(undefined);
  const previewRef = useRef<HTMLElement>(null);
  const fullscreenButtonRef = useRef<HTMLButtonElement>(null);
  const exitFullscreenButtonRef = useRef<HTMLButtonElement>(null);
  const selectedClock = clocks.find(clock => clock.id === selectedClockId) ?? clocks[0];
  const isWorldClock = selectedClock.id === "world";
  const dateVisible = isWorldClock ? showWorldDate : showDate;
  const fullscreenLightControl = (
    <label className="studioClockFullscreenLight">
      조명
      <Switch checked={neon} onCheckedChange={setNeon} />
    </label>
  );

  function revealFullscreenControls() {
    setFullscreenControlsVisible(true);
    window.clearTimeout(fullscreenControlsTimer.current);
    fullscreenControlsTimer.current = window.setTimeout(() => {
      setFullscreenControlsVisible(false);
    }, 2500);
  }

  function onNativeFullscreenActivity() {
    if (document.fullscreenElement === previewRef.current) revealFullscreenControls();
  }

  async function openFullscreen() {
    const preview = previewRef.current;
    if (preview?.requestFullscreen) {
      try {
        await preview.requestFullscreen();
        revealFullscreenControls();
        exitFullscreenButtonRef.current?.focus();
        return;
      } catch {
        // Use an in-page fullscreen view when the browser blocks native fullscreen.
      }
    }
    revealFullscreenControls();
    setFullscreenFallback(true);
  }

  useEffect(() => {
    function restoreFocus() {
      if (!document.fullscreenElement) fullscreenButtonRef.current?.focus();
    }
    document.addEventListener("fullscreenchange", restoreFocus);
    return () => {
      document.removeEventListener("fullscreenchange", restoreFocus);
      window.clearTimeout(fullscreenControlsTimer.current);
    };
  }, []);

  return (
    <div className="studioClockGallery">
      <figure
        ref={previewRef}
        className="studioClockPreview"
        aria-label={selectedClock.name}
        data-controls-visible={fullscreenControlsVisible}
        onPointerMove={onNativeFullscreenActivity}
        onPointerDown={onNativeFullscreenActivity}
        onKeyDown={onNativeFullscreenActivity}
      >
        <LiveClockFace zone={zone} showDate={dateVisible} neon={neon} clockStyle={selectedClock.id} showSeconds={showSeconds} />
        <button ref={exitFullscreenButtonRef} type="button" className="studioClockControl studioClockExit" aria-label="전체화면 닫기" title="전체화면 닫기" onClick={() => void document.exitFullscreen()}>
          <Minimize size={19} aria-hidden="true" />
        </button>
        {fullscreenLightControl}
      </figure>
      <div className="studioClockToolbar">
        <Dialog open={themeOpen} onOpenChange={setThemeOpen}>
          <DialogTrigger className="studioClockControl studioClockThemeTrigger">
            스타일 <ChevronDown size={14} aria-hidden="true" />
          </DialogTrigger>
          <DialogContent className="studioClockThemeDialog" aria-describedby={undefined}>
            <DialogTitle>시계 스타일</DialogTitle>
            <ul className="studioClockThemeGrid">
              {clocks.map(clock => (
                <li key={clock.id}>
                  <button
                    type="button"
                    className="studioClockOption"
                    aria-pressed={selectedClockId === clock.id}
                    onClick={() => {
                      setSelectedClockId(clock.id);
                      setThemeOpen(false);
                    }}
                  >
                    <span className="studioResourceThumbnail">
                      <ClockFace clockStyle={clock.id} />
                    </span>
                    <span className="studioResourceCaption">{clock.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </DialogContent>
        </Dialog>
        <button ref={fullscreenButtonRef} type="button" className="studioClockControl" aria-label="전체화면" title="전체화면" onClick={() => void openFullscreen()}>
          <Maximize size={20} aria-hidden="true" />
        </button>
        {!isWorldClock && (
          <Dialog open={countryOpen} onOpenChange={setCountryOpen}>
            <DialogTrigger className="studioClockControl studioClockCountry" aria-label={zone ? `국가: ${clockZones.find(item => item.value === zone)?.label}` : "국가"}>
              {zone ? clockZones.find(item => item.value === zone)?.label : "국가"} <ChevronDown size={14} aria-hidden="true" />
            </DialogTrigger>
            <DialogContent className="studioClockThemeDialog" aria-describedby={undefined}>
              <DialogTitle>국가 및 시간대</DialogTitle>
              <ClockCountryList selected={zone} onSelect={value => {
                setZone(value);
                setCountryOpen(false);
              }} />
            </DialogContent>
          </Dialog>
        )}
        <div className="studioClockDisplayToggles">
          <label>
            날짜
            <Switch checked={dateVisible} onCheckedChange={isWorldClock ? setShowWorldDate : setShowDate} />
          </label>
          <label>
            조명
            <Switch checked={neon} onCheckedChange={setNeon} />
          </label>
          {selectedClock.id === "flip" && (
            <label>
              초
              <Switch checked={showSeconds} onCheckedChange={setShowSeconds} />
            </label>
          )}
        </div>
      </div>
      <Dialog open={fullscreenFallback} onOpenChange={setFullscreenFallback}>
        <DialogContent
          className="studioClockFullscreenDialog"
          data-controls-visible={fullscreenControlsVisible}
          onPointerMove={revealFullscreenControls}
          onPointerDown={revealFullscreenControls}
          onKeyDown={revealFullscreenControls}
          aria-describedby={undefined}
          showCloseButton={false}
          onCloseAutoFocus={event => {
            event.preventDefault();
            fullscreenButtonRef.current?.focus();
          }}
        >
          <DialogTitle className="sr-only">{selectedClock.name}</DialogTitle>
          <figure className="studioClockPreview">
            <LiveClockFace zone={zone} showDate={dateVisible} neon={neon} clockStyle={selectedClock.id} showSeconds={showSeconds} />
          </figure>
          <DialogClose className="studioClockControl studioClockExit" aria-label="전체화면 닫기" title="전체화면 닫기">
            <Minimize size={19} aria-hidden="true" />
          </DialogClose>
          {fullscreenLightControl}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function StudioResources({ showClocks = false }: { showClocks?: boolean }) {
  return (
    <div className="aiStudioPageContainer">
      {!showClocks && <StudioSectionHeader title="도구">콘텐츠 제작에 필요한 도구를 한곳에서</StudioSectionHeader>}
      <section className="aiStudioVideoCatalog" aria-label={showClocks ? "시계" : "도구 목록"}>
        {showClocks && (
          <>
            <header className="studioResourceHeader">
              <Link href="/ai-studio/resources" className="issueBackButton">
                <ChevronLeft size={15} aria-hidden="true" />도구
              </Link>
              <h1 className="sr-only">시계</h1>
            </header>
            <StudioSubnav />
          </>
        )}
        {showClocks ? <ClockGallery /> : (
          <ul className="studioResourceGrid">
            <li>
              <Link href="/ai-studio/resources/analog-clocks" className="studioResourceItem studioResourceLink">
                <div className="studioResourceThumbnail"><AnalogClockFace /></div>
                <span className="studioResourceCaption">시계 <ChevronRight size={16} aria-hidden="true" /></span>
              </Link>
            </li>
          </ul>
        )}
      </section>
    </div>
  );
}
