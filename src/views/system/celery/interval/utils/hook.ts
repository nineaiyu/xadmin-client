import { intervalScheduleApi } from "@/api/task/task";
import dayjs from "dayjs";
import { defineListPage, formatPageColumns } from "@/components/RePlusPage";
import { useScheduleDelete } from "../../components/useScheduleDelete";

/**
 * 固定间隔调度管理（django_celery_beat IntervalSchedule）。
 *
 * 列表/表单完全由服务端元数据驱动：period 为 labeled_choice，
 * 行内值形如 {value:"minutes", label:"分钟"}，由 RePlusPage 内置
 * 渲染器直出可读标签，无需前端二次格式化。
 */
const PERIOD_UNITS: Record<string, dayjs.ManipulateType> = {
  days: "day",
  hours: "hour",
  minutes: "minute",
  seconds: "second",
  microseconds: "millisecond"
};

export function useTaskInterval() {
  return defineListPage({
    api: intervalScheduleApi,
    localeName: "systemTaskInterval",
    columns: ({ t, columns }) =>
      formatPageColumns(columns, {
        every: column => {
          column["cellRenderer"] = ({ row }) => {
            const period = String(
              (row as { period?: { value?: string } }).period?.value ?? ""
            );
            const unit = PERIOD_UNITS[period];
            const every = Number((row as { every?: number }).every ?? 0);
            if (!unit || !every) return String(every);
            const next = dayjs().add(every, unit).format("MM-DD HH:mm:ss");
            return t("systemTaskInterval.nextApprox", { time: next });
          };
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
