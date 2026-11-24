import React from "react";

const formatter = new Intl.DateTimeFormat("en", {
  year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Seoul",
});

export default function IssueDate({ value, omitYearOnMobile = false }: { value: string; omitYearOnMobile?: boolean }) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = formatter.formatToParts(date);
  const [year, month, day] = ["year", "month", "day"].map(type => parts.find(part => part.type === type)?.value);
  const monthDay = `${month}.${day}`;
  const label = `${year}.${monthDay}`;
  return <time className="issueRegistrationDate" dateTime={value} aria-label={`등록일 ${label}`}>
    {omitYearOnMobile ? <><span className="issueDateDesktopYear">{year}.</span>{monthDay}</> : label}
  </time>;
}
