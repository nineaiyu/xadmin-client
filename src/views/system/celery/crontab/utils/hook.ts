import { crontabScheduleApi } from "@/api/task/task";
import { shallowRef } from "vue";
import type { RePlusPageProps } from "@/components/RePlusPage";
import { defineListPage } from "@/components/RePlusPage";
import { formatCronWeekday } from "./cronWeekday";
import { createCronFormOptions } from "./cronForm";
import { useScheduleDelete } from "../../components/useScheduleDelete";

export function useTaskCrontab() {
  return defineListPage({
    api: crontabScheduleApi,
    localeName: "systemTaskCrontab",
    formOptions: ({ t }) =>
      shallowRef<RePlusPageProps["addOrEditOptions"]>({
        props: createCronFormOptions({ t }).props
      }),
    columns: ({ t, locale, columns }) => {
      /** day_of_week 可读化：支持列表、区间、步长与别名；无法解析时回退原文 */
      const formatWeekday = (value: unknown): string =>
        formatCronWeekday(value, t, locale.value);

      columns.forEach(column => {
        switch (column._column?.key) {
          case "day_of_week":
            // 基础列默认带 v-copy cellRenderer，会覆盖 formatter，这里直接替换渲染
            column.cellRenderer = ({ row }) => formatWeekday(row.day_of_week);
            break;
        }
      });
      return columns;
    },
    buttons: ({ t, api, auth, tableRef }) =>
      useScheduleDelete({
        t,
        api,
        auth,
        tableRef,
        kind: "crontab"
      })
  });
}
