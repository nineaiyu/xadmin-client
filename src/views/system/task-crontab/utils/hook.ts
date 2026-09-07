import { useI18n } from "vue-i18n";
import type { PageTableColumn } from "@/components/RePlusPage";

export function useTaskCrontab() {
  const { t, locale } = useI18n();

  /**
   * day_of_week 可读化：'*' → 每周；纯数字逗号列表 → 周X（0=周日，7 视同周日）；
   * 区间、步长等复杂 cron 片段保持原样
   */
  const formatWeekday = (value: unknown): string => {
    const text = String(value ?? "").trim();
    if (!text) return "";
    if (text === "*") return t("systemTaskCrontab.cronEveryWeek");
    const tokens = text.split(",");
    if (!tokens.every(token => /^\d$/.test(token.trim()))) return text;
    const joiner = locale.value === "zh" ? "、" : ", ";
    return tokens
      .map(token => {
        const weekday = Number(token.trim()) % 7;
        return t(`systemTaskCrontab.cronWeekday${weekday}`);
      })
      .join(joiner);
  };

  const listColumnsFormat = (columns: PageTableColumn[]) => {
    const dayOfWeek = columns.find(column => column.prop === "day_of_week");
    if (dayOfWeek) {
      // 基础列默认带 v-copy cellRenderer，会覆盖 formatter，这里直接替换渲染
      dayOfWeek.cellRenderer = ({ row }) => formatWeekday(row.day_of_week);
    }
    return columns;
  };

  return { listColumnsFormat };
}
