import { shallowRef } from "vue";
import type { FormDataItem } from "@/api/dataset/dform";
import type { OperationProps } from "@/components/RePlusPage";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 表单数据行操作（自 hook.tsx 抽出）：只读，仅「详情」入口（提交与改动在「我的填报」） */
export function useFormDataButtons({
  t,
  openDetail
}: {
  t: TFunction;
  openDetail: (row: FormDataItem) => void;
}) {
  const operationButtonsProps = shallowRef<OperationProps>({
    width: 120,
    showNumber: 2,
    hideDetail: true,
    buttons: [
      { code: "update", show: false },
      { code: "delete", show: false },
      {
        text: t("dform.detail"),
        code: "data-detail",
        props: {
          type: "primary",
          link: true,
          "data-testid": "form-data-detail"
        },
        index: -10,
        show: true,
        onClick: ({ row }) => openDetail(row as FormDataItem)
      }
    ]
  });

  return { operationButtonsProps };
}
