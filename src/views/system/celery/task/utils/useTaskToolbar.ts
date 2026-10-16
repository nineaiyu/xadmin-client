import { shallowRef } from "vue";
import type { useI18n } from "vue-i18n";
import type { periodicTaskApi } from "@/api/task/task";
import { useBatchUpdate } from "@/views/system/components/useBatchUpdate";
import { buildTaskToolbarButtons } from "./taskToolbarButtons";
import type { OperationProps } from "@/components/RePlusPage";
import type { Ref } from "vue";

type TFunction = ReturnType<typeof useI18n>["t"];
type TaskApiLike = Pick<
  typeof periodicTaskApi,
  "batchRun" | "batchEnable" | "batchUpdate"
>;
type TaskAuth = {
  [key: string]: boolean | undefined;
  batchRun?: boolean;
  batchEnable?: boolean;
  batchDisable?: boolean;
};

/**
 * 定时任务工具栏：批量执行 / 批量启用 / 批量停用 / 批量更新
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
  // 批量更新：勾选行后统一写入同组字段（字段白名单：启用状态）
  const { batchUpdateButton } = useBatchUpdate({
    t,
    api,
    tableRef,
    fields: [
      { key: "enabled", label: t("systemTask.enabled"), input_type: "boolean" }
    ]
  });

  /** 新增表格标题栏批量按钮，作用于勾选行 */
  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: buildTaskToolbarButtons({
      t,
      api,
      auth,
      tableRef,
      batchUpdateButton
    })
  });

  return {
    tableBarButtonsProps
  };
}
