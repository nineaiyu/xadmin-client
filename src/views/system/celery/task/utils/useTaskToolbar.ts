import { shallowRef } from "vue";
import type { useI18n } from "vue-i18n";
import type { periodicTaskApi } from "@/api/task/task";
import { buildTaskToolbarButtons } from "./taskToolbarButtons";
import type { OperationProps } from "@/components/RePlusPage";
import type { Ref } from "vue";

type TFunction = ReturnType<typeof useI18n>["t"];
type TaskApiLike = Pick<
  typeof periodicTaskApi,
  "batchRun" | "batchEnable" | "batchDisable"
>;
type TaskAuth = {
  [key: string]: boolean | undefined;
  batchRun?: boolean;
  batchEnable?: boolean;
  batchDisable?: boolean;
};

/**
 * 定时任务工具栏：批量执行 / 批量启用 / 批量停用
 * （按钮声明与空勾选流程见 taskToolbarButtons.ts）。
 */
export function useTaskToolbar({
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
  /** 新增表格标题栏批量按钮，作用于勾选行 */
  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: buildTaskToolbarButtons({
      t,
      api,
      auth,
      tableRef
    })
  });

  return {
    tableBarButtonsProps
  };
}
