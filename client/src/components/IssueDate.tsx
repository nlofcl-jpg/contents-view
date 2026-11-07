import React from "react";

const formatter = new Intl.DateTimeFormat("en", {
  year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Seoul",
});

export default function IssueDate({ value }: { value: string }) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = formatter.formatToParts(date);
  const label = ["year", "month", "day"].map(type => parts.find(part => part.type === type)?.value).join(".");
  return <time className="issueRegistrationDate" dateTime={value} aria-label={`등록일 ${label}`}>{label}</time>;
}
