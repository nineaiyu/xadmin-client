type Translate = (key: string, params?: Record<string, unknown>) => string;

const WEEKDAY_ALIASES: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6
};

function weekdayNumber(token: string): number | null {
  const lower = token.toLowerCase();
  if (lower in WEEKDAY_ALIASES) return WEEKDAY_ALIASES[lower];
  if (!/^\d$/.test(token)) return null;
  return Number(token) % 7;
}

const WEEKDAY_COUNT = 7;

/**
 * 步长的实际匹配日（cron 语义：从起始值起每 step 取一个，超出 7 回绕）。
 * 例：`* /2` → 周日/二/四/六；`1/2` → 周一/三/五/日。
 */
function weekdayStepValues(start: number, step: number): number[] {
  // cron 的 day_of_week 区间是 0-7（7 与 0 同为周日）：按区间展开后归一到 0-6
  const values: number[] = [];
  for (let value = start; value <= 7; value += step) {
    values.push(value % WEEKDAY_COUNT);
  }
  return [...new Set(values)];
}

/**
 * day_of_week 可读化：支持 `*`、数字/别名列表、区间 `1-5`、步长 `* /2` / `1/2`。
 * 步长不能解释成「每 N 周」（cron 的 day_of_week 步长是「每隔 N 天」），
 * 这里展开为实际命中的星期列表；任一片段无法解析时整体回退原文。
 */
export function formatCronWeekday(
  value: unknown,
  t: Translate,
  locale: string
): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (text === "*") return t("systemTaskCrontab.cronEveryWeek");
  const joiner = locale === "zh" ? "、" : ", ";
  const weekdayLabel = (day: number) =>
    t(`systemTaskCrontab.cronWeekday${day}`);
  const parts: string[] = [];
  for (const rawToken of text.split(",")) {
    const token = rawToken.trim();
    if (!token) return text;
    if (token === "*" || token.startsWith("*/")) {
      const step = token === "*" ? 1 : Number(token.slice(2));
      if (!Number.isInteger(step) || step <= 0) return text;
      parts.push(
        step === 1
          ? t("systemTaskCrontab.cronEveryWeek")
          : weekdayStepValues(0, step).map(weekdayLabel).join(joiner)
      );
      continue;
    }
    if (token.includes("-")) {
      const [startRaw, endRaw] = token.split("-");
      const start = weekdayNumber(startRaw.trim());
      const end = weekdayNumber(endRaw.trim());
      if (start == null || end == null) return text;
      parts.push(`${weekdayLabel(start)}-${weekdayLabel(end)}`);
      continue;
    }
    if (token.includes("/")) {
      const [startRaw, stepRaw] = token.split("/");
      const start = weekdayNumber(startRaw.trim());
      const step = Number(stepRaw.trim());
      if (start == null || !Number.isInteger(step) || step <= 0) return text;
      if (step === 1) {
        parts.push(t("systemTaskCrontab.cronEveryWeek"));
        continue;
      }
      parts.push(weekdayStepValues(start, step).map(weekdayLabel).join(joiner));
      continue;
    }
    const weekday = weekdayNumber(token);
    if (weekday == null) return text;
    parts.push(weekdayLabel(weekday));
  }
  return parts.join(joiner);
}
