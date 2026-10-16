import { shallowRef } from "vue";
import FileList from "~icons/ri/file-list-3-line";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import type { OperationProps } from "@/components/RePlusPage";
import { asExecutionRow } from "./taskExecutionTypes";
import type { createTaskExecutionActions } from "./taskExecutionActions";
import type { useI18n } from "vue-i18n";
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
        text: t("taskCenter.cancel"),
        code: "cancel",
        props: { type: "warning", link: true },
        index: -40,
        show: (row: RecordType) =>
          canCancel && !!asExecutionRow(row).can_cancel,
        onClick: ({ row }) =>
          actions.runCenterAction(asExecutionRow(row), "cancel")
      },
      {
        text: t("taskCenter.rerun"),
        code: "rerun",
        props: { type: "primary", link: true },
        index: -30,
        show: (row: RecordType) => canRerun && !!asExecutionRow(row).can_rerun,
        onClick: ({ row }) =>
          actions.runCenterAction(asExecutionRow(row), "rerun")
      },
      {
        text: t("taskCenter.download"),
        code: "download",
        props: { type: "primary", link: true },
        index: -20,
        show: (row: RecordType) => !!asExecutionRow(row).product_has_file,
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
