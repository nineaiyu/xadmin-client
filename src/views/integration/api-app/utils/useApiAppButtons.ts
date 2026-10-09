import { shallowRef } from "vue";
import type { useI18n } from "vue-i18n";
import type { OperationProps } from "@/components/RePlusPage";
import type { ApiApplicationItem } from "@/api/system/open";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * API 应用按钮装配（自 api-app/utils/hook 抽出）：行操作只留编辑 / 管理
 * （应用资料由「管理」抽屉承载，默认「查看」入口关闭）；删除保持关闭
 * （现状页面不提供删除入口，迁移不改行为）。
 */
export function useApiAppButtons({
  t,
  flags: { canCreate, canEdit },
  openDialog,
  openApiAppPanel
}: {
  t: TFunction;
  flags: { canCreate: boolean; canEdit: boolean };
  openDialog: (row: ApiApplicationItem | null) => void;
  openApiAppPanel: (row: ApiApplicationItem) => void;
}) {
  const operationButtonsProps = shallowRef<OperationProps>({
    // 行操作收敛后操作列只需容纳编辑 / 管理两个按钮
    width: 200,
    // 应用资料由「管理」抽屉承载，关闭框架默认详情入口避免重复
    hideDetail: true,
    buttons: [
      {
        text: t("apiApp.edit"),
        code: "edit",
        props: { type: "primary", link: true },
        onClick: ({ row }) => openDialog(row as ApiApplicationItem),
        index: -25,
        show: canEdit
      },
      {
        text: t("apiApp.manage"),
        code: "manage",
        props: { type: "primary", link: true },
        onClick: ({ row }) => openApiAppPanel(row as ApiApplicationItem),
        index: -15,
        show: true
      }
    ]
  });

  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        text: t("apiApp.create"),
        code: "create",
        props: { type: "primary", "data-testid": "api-app-create" },
        onClick: () => openDialog(null),
        show: canCreate
      }
    ]
  });

  return { operationButtonsProps, tableBarButtonsProps };
}
