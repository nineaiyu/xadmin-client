import dayjs from "dayjs";

type TFunction = (key: string, params?: Record<string, unknown>) => string;

/** 间隔周期 → dayjs 单位与换算系数（microseconds 需按 1000µs = 1ms 缩放） */
const PERIOD_UNITS: Record<
  string,
  { unit: dayjs.ManipulateType; factor: number }
> = {
  days: { unit: "day", factor: 1 },
  hours: { unit: "hour", factor: 1 },
  minutes: { unit: "minute", factor: 1 },
  seconds: { unit: "second", factor: 1 },
  microseconds: { unit: "millisecond", factor: 1 / 1000 }
};

export type IntervalScheduleRow = {
  every?: number | string;
  period?: { value?: string; label?: string | null };
};

/**
 * 间隔调度「周期数」列的展示文本：保留真实数值 + 周期单位，并追加下次触发时间。
 *
 * 原实现把整列替换成「下次约 …」——表头仍是「周期数」却看不到间隔数值，
 * 语义丢失；microseconds 又被当成毫秒（1000 倍误差）。
 */
export function buildIntervalEveryText(
  row: IntervalScheduleRow,
  t: TFunction,
  now: dayjs.Dayjs = dayjs()
): string {
  const every = Number(row.every ?? 0);
  const period = String(row.period?.value ?? "");
  const periodLabel = String(row.period?.label ?? period);
  const base = `${every} ${periodLabel}`.trim();
  const meta = PERIOD_UNITS[period];
  if (!meta || !Number.isFinite(every) || every <= 0) return base;
  const next = now.add(every * meta.factor, meta.unit).format("MM-DD HH:mm:ss");
  return `${base} · ${t("systemTaskInterval.nextApprox", { time: next })}`;
}
