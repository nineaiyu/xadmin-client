import { intervalScheduleApi } from "@/api/task/task";
import { defineListPage, formatPageColumns } from "@/components/RePlusPage";
import { useScheduleDelete } from "../../components/useScheduleDelete";
import { buildIntervalEveryText } from "./everyText";

/**
 * 固定间隔调度管理（django_celery_beat IntervalSchedule）。
 *
 * 列表/表单完全由服务端元数据驱动：period 为 labeled_choice，
 * 行内值形如 {value:"minutes", label:"分钟"}，由 RePlusPage 内置
 * 渲染器直出可读标签，无需前端二次格式化。
 */
export function useTaskInterval() {
  return defineListPage({
    api: intervalScheduleApi,
    localeName: "systemTaskInterval",
    columns: ({ t, columns }) =>
      formatPageColumns(columns, {
        every: column => {
          // 周期数保留原值 + 单位，并追加下次触发时间；microseconds 按 1000µs=1ms 换算
          column["cellRenderer"] = ({ row }) =>
            buildIntervalEveryText(row as never, t as never);
        }
      }),
    buttons: ({ t, api, auth, tableRef }) =>
      useScheduleDelete({
        t,
        api,
        auth,
        tableRef,
        kind: "interval"
      })
  });
}
