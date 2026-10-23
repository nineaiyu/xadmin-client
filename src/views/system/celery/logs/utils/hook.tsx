import { taskExecutionApi } from "@/api/task/task";
import { hasAuth } from "@/router/utils";
import { defineListPage } from "@/components/RePlusPage";
import { buildTaskExecutionColumns } from "./taskExecutionColumns";
import { createTaskExecutionActions } from "./taskExecutionActions";
import { useTaskExecutionButtons } from "./useTaskExecutionButtons";
import { useExecutionAutoRefresh } from "./useExecutionAutoRefresh";
import { PERM_CANCEL, PERM_RERUN } from "./taskExecutionTypes";

/**
 * 任务日志（执行历史）列表：所有 celery 任务一行一条。
 *
 * 导出/导入/报表产物任务与执行记录共用主键，列表按 pk 带出产物信息
 * （类型 / 业务名 / 进度 / 阶段 / 产物文件），因此同一件事只有一个入口：
 * 查看日志、取消、重跑、下载产物、删除/批量删除都在本页完成。
 *
 * 职责拆分：列渲染 taskExecutionColumns.tsx、行级动作 taskExecutionActions.ts、
 * 行操作按钮 useTaskExecutionButtons.ts、行字段口径 taskExecutionTypes.ts。
 */
export function useTaskExecution() {
  // 取消 / 重跑走聚合端点（/api/task/unified/{cancel,rerun}），权限点
  // 挂执行历史菜单下，直接按权限点判定（框架默认清单只覆盖组件名同源 action）
  const canCancel = hasAuth(PERM_CANCEL);
  const canRerun = hasAuth(PERM_RERUN);

  const page = defineListPage({
    api: taskExecutionApi,
    localeName: "systemTaskExecution",
    extraAuth: ["log"],
    columns: ({ t, columns }) =>
      buildTaskExecutionColumns({ t }).listColumnsFormat(columns),
    buttons: ({ t, auth, tableRef }) => {
      const actions = createTaskExecutionActions({ t, tableRef });
      return useTaskExecutionButtons({ t, auth, canCancel, canRerun, actions });
    }
  });
  const { t, tableRef } = page;

  const { searchColumnsFormat } = buildTaskExecutionColumns({ t });

  // 进行中的执行记录自动刷新（取消/重跑后不必手动点刷新）
  useExecutionAutoRefresh(tableRef);

  return {
    ...page,
    searchColumnsFormat
  };
}
