// The times a daily reminder can be set to, shared by the phone and the server. Each is the hour
// on the phone's own clock, like 15 for 3pm.
export const DEFAULT_REMINDER_HOUR = 15;
export const EARLIEST_REMINDER_HOUR = 6;
// The reminder is about tonight's dinner, so 7pm is the latest.
export const LATEST_REMINDER_HOUR = 19;

export const REMINDER_HOURS = Array.from(
  { length: LATEST_REMINDER_HOUR - EARLIEST_REMINDER_HOUR + 1 },
  (_, i) => EARLIEST_REMINDER_HOUR + i,
);

export function isReminderHour(hour: unknown): hour is number {
  return typeof hour === "number" && REMINDER_HOURS.includes(hour);
}

// Like "7am", "12pm" or "3pm".
export function hourLabel(hour: number) {
  return `${hour % 12 || 12}${hour < 12 ? "am" : "pm"}`;
}
