import { crontabScheduleApi } from "@/api/system/task";
import { getCurrentInstance, reactive } from "vue";
import { getDefaultAuths } from "@/router/utils";
import type { PageTableColumn } from "@/components/RePlusPage";
import { useI18n } from "vue-i18n";

export function useTaskCrontab() {
  // 权限判断，用于判断是否有该权限
  const api = reactive(crontabScheduleApi);
  const auth = reactive({ ...getDefaultAuths(getCurrentInstance()) });
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

  /**
   * 表格列操作
   */
  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "day_of_week":
          // 基础列默认带 v-copy cellRenderer，会覆盖 formatter，这里直接替换渲染
          column.cellRenderer = ({ row }) => formatWeekday(row.day_of_week);
          break;
      }
    });
    return columns;
  };

  return {
    api,
    auth,
    listColumnsFormat
  };
}
