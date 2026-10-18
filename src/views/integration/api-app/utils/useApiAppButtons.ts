import { shallowRef } from "vue";
import type { useI18n } from "vue-i18n";
import type { OperationProps } from "@/components/RePlusPage";
import type { ApiApplicationItem } from "@/api/identity/open";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * API 应用行操作按钮装配：只保留页面专属的「管理」。
 *
 * 新增 / 编辑由框架元数据表单提供（`auth.create/partialUpdate` 未关闭）；
 * 删除保持关闭（现状页面不提供删除入口）；应用资料由「管理」抽屉承载，
 * 默认「查看」入口关闭避免重复。
 */
export function useApiAppButtons({
  t,
  openApiAppPanel
}: {
  t: TFunction;
  openApiAppPanel: (row: ApiApplicationItem) => void;
}) {
  const operationButtonsProps = shallowRef<OperationProps>({
    // 行操作收敛后操作列只需容纳编辑 / 管理两个按钮
    width: 200,
    hideDetail: true,
    buttons: [
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

  return { operationButtonsProps };
}
