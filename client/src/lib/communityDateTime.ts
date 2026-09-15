const pad = (value: number) => String(value).padStart(2, "0");

function isValidDateParts(year: number, month: number, day: number) {
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function formatDateParts(
  year: number,
  month: number,
  day: number,
  hour?: number,
  minute?: number
) {
  if (!isValidDateParts(year, month, day)) return "-";

  const date = `${year}.${pad(month)}.${pad(day)}`;
  if (hour === undefined || minute === undefined) return date;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return "-";

  return `${date} ${pad(hour)}:${pad(minute)}`;
}

function formatDate(date: Date) {
  return formatDateParts(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes()
  );
}

export function formatCommunityDateTime(
  value?: string | null,
  referenceDate = new Date()
) {
  const text = value?.replace(/\s+/g, " ").trim();
  if (!text || text === "-") return "-";

  if (/^(방금|방금 전)$/.test(text)) return formatDate(referenceDate);

  const relativeMatch = text.match(/^(\d+)\s*(분|시간|일)\s*전$/);
  if (relativeMatch) {
    const amount = Number(relativeMatch[1]);
    const unitMs =
      relativeMatch[2] === "분"
        ? 60_000
        : relativeMatch[2] === "시간"
          ? 3_600_000
          : 86_400_000;
    return formatDate(new Date(referenceDate.getTime() - amount * unitMs));
  }

  const todayMatch = text.match(/^오늘\s+(\d{1,2}):(\d{2})/);
  if (todayMatch) {
    return formatDateParts(
      referenceDate.getFullYear(),
      referenceDate.getMonth() + 1,
      referenceDate.getDate(),
      Number(todayMatch[1]),
      Number(todayMatch[2])
    );
  }

  const yesterdayMatch = text.match(/^어제\s+(\d{1,2}):(\d{2})/);
  if (yesterdayMatch) {
    const yesterday = new Date(referenceDate);
    yesterday.setDate(yesterday.getDate() - 1);
    return formatDateParts(
      yesterday.getFullYear(),
      yesterday.getMonth() + 1,
      yesterday.getDate(),
      Number(yesterdayMatch[1]),
      Number(yesterdayMatch[2])
    );
  }

  const fullDateMatch = text.match(
    /(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/
  );
  if (fullDateMatch) {
    return formatDateParts(
      Number(fullDateMatch[1]),
      Number(fullDateMatch[2]),
      Number(fullDateMatch[3]),
      fullDateMatch[4] === undefined ? undefined : Number(fullDateMatch[4]),
      fullDateMatch[5] === undefined ? undefined : Number(fullDateMatch[5])
    );
  }

  const shortDateMatch = text.match(
    /^(\d{1,2})[.\-/](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?$/
  );
  if (shortDateMatch) {
    const month = Number(shortDateMatch[1]);
    const day = Number(shortDateMatch[2]);
    let year = referenceDate.getFullYear();
    const candidate = new Date(year, month - 1, day);

    if (candidate.getTime() - referenceDate.getTime() > 86_400_000) {
      year -= 1;
    }

    return formatDateParts(
      year,
      month,
      day,
      shortDateMatch[3] === undefined ? undefined : Number(shortDateMatch[3]),
      shortDateMatch[4] === undefined ? undefined : Number(shortDateMatch[4])
    );
  }

  const timeMatch = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (timeMatch) {
    return formatDateParts(
      referenceDate.getFullYear(),
      referenceDate.getMonth() + 1,
      referenceDate.getDate(),
      Number(timeMatch[1]),
      Number(timeMatch[2])
    );
  }

  return "-";
}
