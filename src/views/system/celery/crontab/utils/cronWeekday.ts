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

/**
 * day_of_week 可读化：支持 `*`、数字/别名列表、区间 `1-5`、步长 `* /2` / `1/2`。
 * 任一片段无法解析时整体回退原文，避免展示半截翻译。
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
  const parts: string[] = [];
  for (const rawToken of text.split(",")) {
    const token = rawToken.trim();
    if (!token) return text;
    if (token === "*" || token.startsWith("*/")) {
      const step = token === "*" ? 1 : Number(token.slice(2));
      if (!step) return text;
      parts.push(
        step === 1
          ? t("systemTaskCrontab.cronEveryWeek")
          : t("systemTaskCrontab.cronEveryNWeeks", { n: step })
      );
      continue;
    }
    if (token.includes("-")) {
      const [startRaw, endRaw] = token.split("-");
      const start = weekdayNumber(startRaw.trim());
      const end = weekdayNumber(endRaw.trim());
      if (start == null || end == null) return text;
      parts.push(
        `${t(`systemTaskCrontab.cronWeekday${start}`)}-${t(
          `systemTaskCrontab.cronWeekday${end}`
        )}`
      );
      continue;
    }
    if (token.includes("/")) {
      const [startRaw, stepRaw] = token.split("/");
      const start = weekdayNumber(startRaw.trim());
      const step = Number(stepRaw.trim());
      if (start == null || !Number.isInteger(step) || step <= 0) return text;
      parts.push(
        t("systemTaskCrontab.cronFromWeekdayStep", {
          day: t(`systemTaskCrontab.cronWeekday${start}`),
          step
        })
      );
      continue;
    }
    const weekday = weekdayNumber(token);
    if (weekday == null) return text;
    parts.push(t(`systemTaskCrontab.cronWeekday${weekday}`));
  }
  return parts.join(joiner);
}
