import { shallowRef } from "vue";
import type { OperationProps } from "@/components/RePlusPage";
import type { TagItem } from "@/api/system/tag";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 标签页工具栏（新建）与行操作（编辑）按钮装配（自 hook.tsx 抽出） */
export function useTagButtons({
  t,
  canCreate,
  canEdit,
  openDialog
}: {
  t: TFunction;
  canCreate: boolean;
  canEdit: boolean;
  openDialog: (row: TagItem | null) => void;
}) {
  const operationButtonsProps = shallowRef<OperationProps>({
    showNumber: 4,
    width: 200,
    buttons: [
      {
        text: t("tag.edit"),
        code: "edit",
        props: { type: "primary", link: true },
        onClick: ({ row }) => openDialog(row as TagItem),
        show: canEdit,
        index: 10
      }
    ]
  });

  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        text: t("tag.create"),
        code: "create",
        props: { type: "primary" },
        onClick: () => openDialog(null),
        show: canCreate
      }
    ]
  });

  return { tableBarButtonsProps, operationButtonsProps };
}
