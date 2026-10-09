import { shallowRef } from "vue";
import type { DatasetItem } from "@/api/dataset/datasets";
import type { OperationProps } from "@/components/RePlusPage";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 数据集按钮装配（自 hook.tsx 抽出）：行内（预览/编辑）与工具栏（新建）。
 * 删除保留框架默认入口（带二次确认）。
 */
export function useDatasetButtons({
  t,
  flags,
  actions
}: {
  t: TFunction;
  flags: { canCreate: boolean; canEdit: boolean; canExecute: boolean };
  actions: {
    openPreview: (
      row: DatasetItem,
      loading?: { value: boolean }
    ) => void | Promise<void>;
    openDialog: (row: DatasetItem | null) => void;
  };
}) {
  const operationButtonsProps = shallowRef<OperationProps>({
    showNumber: 4,
    width: 240,
    buttons: [
      {
        text: t("dataDataset.preview"),
        code: "preview",
        props: { type: "success", link: true },
        // 按钮级 loading：取数期间自旋，避免"点击无反馈"
        onClick: ({ row, loading }) =>
          actions.openPreview(row as DatasetItem, loading),
        index: 10,
        show: flags.canExecute
      },
      {
        text: t("dataDataset.edit"),
        code: "edit",
        props: { type: "primary", link: true },
        onClick: ({ row }) => actions.openDialog(row as DatasetItem),
        // 非创建者行不显示编辑（保存会被后端守卫拒绝）
        index: 20,
        show: row => flags.canEdit && row?.is_owner !== false
      }
    ]
  });

  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        text: t("dataDataset.create"),
        code: "create",
        props: { type: "primary" },
        onClick: () => actions.openDialog(null),
        show: flags.canCreate
      }
    ]
  });

  return { operationButtonsProps, tableBarButtonsProps };
}
