import { shallowRef } from "vue";
import FileList from "~icons/ri/file-list-3-line";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { hasAuth } from "@/router/utils";
import type { useI18n } from "vue-i18n";
import type { OperationProps } from "@/components/RePlusPage";
import { asExecutionRow } from "./taskExecutionTypes";
import type { createTaskExecutionActions } from "./taskExecutionActions";
import type { RecordType } from "plus-pro-components";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 执行历史行操作按钮（自 hook.tsx 抽出）：取消 / 重跑 / 下载 / 日志。
 * 取消与重跑按显式权限点判定（框架 getDefaultAuths 只按组件名拼通用 action）。
 */
export function useTaskExecutionButtons({
  t,
  auth,
  canCancel,
  canRerun,
  actions
}: {
  t: TFunction;
  auth: { log?: boolean };
  canCancel: boolean;
  canRerun: boolean;
  actions: ReturnType<typeof createTaskExecutionActions>;
}) {
  const operationButtonsProps = shallowRef<OperationProps>({
    showNumber: 5,
    buttons: [
      {
        // 删除执行记录会经 pre_delete 物理删除日志文件，确认文案必须说明
        code: "delete",
        update: true,
        confirm: { title: t("systemTaskExecution.deleteConfirmLog") }
      },
      {
        // 取消是协作式终止：执行中的任务会被要求停下，已产生的中间结果丢弃，
        // 误触代价与删除同级 → 与 delete 同口径二次确认（同页删除已有 confirm）
        text: t("taskCenter.cancel"),
        code: "cancel",
        props: { type: "warning", link: true },
        index: -40,
        // 复用调度任务的既有取消文案（语义一致：在安全点停止）
        confirm: { title: t("taskCenter.cancelConfirm") },
        show: (row: RecordType) =>
          canCancel && !!asExecutionRow(row).can_cancel,
        onClick: ({ row }) =>
          actions.runCenterAction(asExecutionRow(row), "cancel")
      },
      {
        // 重跑会新建一条执行记录并重新派发（导出/导入类还会重跑一遍重任务），
        // 同样需要确认，避免列表里连点重复触发
        text: t("taskCenter.rerun"),
        code: "rerun",
        props: { type: "primary", link: true },
        index: -30,
        confirm: { title: t("taskCenter.rerunConfirm") },
        show: (row: RecordType) => canRerun && !!asExecutionRow(row).can_rerun,
        onClick: ({ row }) =>
          actions.runCenterAction(asExecutionRow(row), "rerun")
      },
      {
        text: t("taskCenter.download"),
        code: "download",
        props: { type: "primary", link: true },
        index: -20,
        show: (row: RecordType) => {
          const item = asExecutionRow(row);
          if (!item.product_has_file) return false;
          // 产物下载按类型走各自权限点（导出/导入记录），不再无权限也显示
          if (item.product_type === "export")
            return hasAuth("download:SystemExportRecord");
          if (item.product_type === "import")
            return hasAuth("download:SystemImportRecord");
          return true;
        },
        onClick: ({ row }) => actions.download(asExecutionRow(row))
      },
      {
        text: t("systemTaskExecution.log"),
        code: "log",
        props: {
          type: "primary",
          icon: useRenderIcon(FileList),
          link: true
        },
        index: -10,
        show: auth.log,
        onClick: ({ row }) => actions.openLog(asExecutionRow(row))
      }
    ]
  });

  return { operationButtonsProps };
}
