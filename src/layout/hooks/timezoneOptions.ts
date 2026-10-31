/**
 * 时区候选项（纯函数域）：优先取浏览器提供的完整时区清单
 * （`Intl.supportedValuesOf("timeZone")`），不可用时回落内置常用时区，
 * 保证弹层在旧内核下仍可切换。
 */

export interface TimezoneOption {
  label: string;
  value: string;
}

/** 内置常用时区（`Intl.supportedValuesOf` 不可用时的兜底，含常见办公时区） */
export const FALLBACK_TIMEZONES: string[] = [
  "UTC",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Taipei",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Singapore",
  "Asia/Bangkok",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Europe/Moscow",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/London",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Australia/Sydney"
];

/** 浏览器支持的时区清单（保持 IANA 名顺序，`UTC` 排首位便于快速选择） */
export function resolveTimezoneOptions(): TimezoneOption[] {
  const supported = (
    Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }
  ).supportedValuesOf;
  const zones =
    typeof supported === "function"
      ? supported.call(Intl, "timeZone")
      : FALLBACK_TIMEZONES;
  const list = ["UTC", ...zones.filter(zone => zone !== "UTC")];
  return list.map(zone => ({ label: zone, value: zone }));
}

/**
 * 目标时区相对 UTC 的偏移（分钟）。
 *
 * 用 Intl.formatToParts 把目标时区的墙上时间重组为 UTC 时间戳再相减：
 * 不依赖 `toLocaleString` 的往返解析，DST 与半小时/45 分钟时区都能正确取整。
 */
export function timezoneOffsetMinutes(
  zone: string,
  date: Date = new Date()
): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).formatToParts(date);
    const pick = (type: string) =>
      Number(parts.find(part => part.type === type)?.value ?? 0);
    const asUtc = Date.UTC(
      pick("year"),
      pick("month") - 1,
      pick("day"),
      pick("hour"),
      pick("minute"),
      pick("second")
    );
    return Math.round((asUtc - date.getTime()) / 60000);
  } catch {
    return -date.getTimezoneOffset();
  }
}
