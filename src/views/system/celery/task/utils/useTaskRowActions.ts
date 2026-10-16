import { shallowRef } from "vue";
import type { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import { type periodicTaskApi, taskExecutionApi } from "@/api/task/task";
import { openTaskLogDialog } from "@/views/system/components/taskLogDialog";
import { buildTaskRowButtons } from "./taskRowButtons";
import type { OperationProps } from "@/components/RePlusPage";
import type { Ref } from "vue";

type TFunction = ReturnType<typeof useI18n>["t"];
type TaskApiLike = Pick<typeof periodicTaskApi, "run" | "clone">;
type TaskAuth = {
  [key: string]: boolean | undefined;
  run?: boolean;
  log?: boolean;
  clone?: boolean;
};

/** 定时任务行（run/log 按钮行内使用的字段） */
type TaskRow = {
  pk?: string | number;
  id?: string | number;
  name?: string;
};

/**
 * 定时任务行内动作：立即执行 / 实时日志 / 克隆（含执行记录日志弹窗编排）。
 * 自 useTask 拆出（行为不变）：run 派发成功后自动打开实时日志弹窗；
 * 行内按钮声明见 taskRowButtons.ts。
 */
export function useTaskRowActions({
  t,
  api,
  auth,
  tableRef
}: {
  t: TFunction;
  api: TaskApiLike;
  auth: TaskAuth;
  tableRef: Ref;
}) {
  /** 打开某条执行记录的实时日志弹窗（WebSocket 增量推送） */
  const openLog = (pk: string | number, name: string) => {
    openTaskLogDialog(pk, `${name} ${t("systemTask.logTitle")}`);
  };

  /** 打开该定时任务最近一次执行的日志 */
  const openLatestLog = async (row: TaskRow) => {
    const res = await taskExecutionApi.list({
      periodic_task: row?.pk ?? row?.id,
      page: 1,
      size: 1
    });
    const latest = res.data?.results?.[0] as
      { pk: string; name: string } | undefined;
    if (!latest) {
      message(t("systemTask.noExecution"), { type: "warning" });
      return;
    }
    openLog(latest.pk, latest.name);
  };

  const operationButtonsProps = shallowRef<OperationProps>({
    // 6 个按钮全部内联（编辑/删除/详情/立即执行/最新日志/克隆）：任意折叠
    // 都会让既有操作路径多点一次；列宽收敛到刚好容纳单行按钮，表头不再被
    // 固定列裁切由 RePlusPage 的覆盖区边界对齐机制保证（见其组件注释）
    width: 440,
    showNumber: 6,
    buttons: buildTaskRowButtons({
      t,
      api,
      auth,
      tableRef,
      openLog,
      openLatestLog
    })
  });

  return {
    operationButtonsProps
  };
}
