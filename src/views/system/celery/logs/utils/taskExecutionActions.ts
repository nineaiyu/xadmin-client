import { SUCCESS_CODE } from "@/api/types";
import { message } from "@/utils/message";
import { normalizeError } from "@/utils/apiError";
import { taskCenterApi, type TaskCenterKind } from "@/api/system/task";
import { exportRecordApi } from "@/api/system/export";
import { importRecordApi } from "@/api/system/import";
import { openTaskLogDialog } from "@/views/system/components/taskLogDialog";
import type { Ref } from "vue";
import type { useI18n } from "vue-i18n";
import type { ExecutionRow } from "./taskExecutionTypes";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 执行历史行级动作（自 hook.tsx 抽出）：实时日志弹窗、取消/重跑（走任务中心
 * 聚合端点）、产物下载。
 */
export function createTaskExecutionActions({
  t,
  tableRef
}: {
  t: TFunction;
  tableRef?: Ref;
}) {
  const refresh = () => tableRef?.value?.handleGetData?.();

  /** 打开某条执行记录的实时日志弹窗（WebSocket 增量推送） */
  const openLog = (row: ExecutionRow) => {
    const name = row.product_name || row.name || "";
    openTaskLogDialog(
      row.pk ?? row.id ?? "",
      `${name} ${t("systemTask.logTitle")}`
    );
  };

  /** 取消 / 重跑：走任务中心聚合端点（产物类型取行上注解，非产物任务为 task） */
  const runCenterAction = async (
    row: ExecutionRow,
    action: "cancel" | "rerun"
  ) => {
    const kind = (row.product_type || "task") as TaskCenterKind;
    const res = await taskCenterApi[action](kind, String(row.pk ?? "")).catch(
      normalizeError
    );
    if (res.code === SUCCESS_CODE) {
      message(
        String(
          res.detail ??
            t(
              action === "cancel"
                ? "taskCenter.cancelDone"
                : "taskCenter.rerunDone"
            )
        ),
        { type: "success" }
      );
      refresh();
    } else if (res.detail) {
      message(String(res.detail), { type: "warning" });
    }
  };

  /** 产物下载：导出 / 导入记录各自端点（与下载中心同一 http 链路，失败走拦截器归一提示） */
  const download = async (row: ExecutionRow) => {
    const api =
      row.product_type === "import" ? importRecordApi : exportRecordApi;
    try {
      await api.download(row.pk ?? row.id ?? "");
    } catch {
      // 失败提示由 http 拦截器统一处理，这里只吞掉 rejection
    }
  };

  return { openLog, runCenterAction, download };
}
