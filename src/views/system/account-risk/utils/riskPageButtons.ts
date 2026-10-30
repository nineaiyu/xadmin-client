import { shallowRef } from "vue";
import type { Ref } from "vue";
import type { useI18n } from "vue-i18n";
import type { RecordType } from "plus-pro-components";
import type { OperationProps } from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import Search from "~icons/ep/search";
import Edit from "~icons/ep/edit";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 账号风险页按钮装配（自 hook 抽出，控制 hook 行数） */
export function buildRiskPageButtons({
  t,
  auth,
  tableRef,
  canBatchHandle,
  scan,
  handleDialog,
  openDetail
}: {
  t: TFunction;
  auth: Record<string, boolean | undefined>;
  tableRef: Ref;
  canBatchHandle: Ref<boolean>;
  scan: (loading?: { value: boolean }) => void;
  handleDialog: (pks: Array<string | number>) => void;
  openDetail: (row: RecordType) => void;
}) {
  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        text: t("accountRisk.scan"),
        code: "scan",
        props: { type: "primary", icon: useRenderIcon(Search) },
        onClick: ({ loading }) => scan(loading),
        show: Boolean(auth.scan && auth.scanStatus)
      },
      {
        text: t("accountRisk.batchHandle"),
        code: "batchHandle",
        props: { type: "warning", plain: true, icon: useRenderIcon(Edit) },
        onClick: () => {
          const pks = tableRef.value?.getSelectPks?.() ?? [];
          if (!pks.length) return;
          handleDialog(pks);
        },
        show: canBatchHandle
      }
    ]
  });

  const operationButtonsProps = shallowRef<OperationProps>({
    width: 180,
    buttons: [
      {
        text: t("accountRisk.detail"),
        code: "detail",
        props: { type: "primary", link: true },
        onClick: ({ row }) => openDetail(row as RecordType),
        show: true
      },
      {
        text: t("accountRisk.handle"),
        code: "handle",
        props: { type: "warning", link: true },
        onClick: ({ row }) => handleDialog([row.pk as string | number]),
        show: auth.handle
      }
    ]
  });

  return { tableBarButtonsProps, operationButtonsProps };
}
