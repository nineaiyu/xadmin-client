import { shallowRef } from "vue";
import type { useI18n } from "vue-i18n";
import type { OperationProps } from "@/components/RePlusPage";
import type { AiProfileItem } from "@/api/ai/ai";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * AI 档案按钮装配（自 useAiProfiles 抽出）：行内保留在线处置（激活/停用、测试）
 * + 「管理」抽屉入口（列宽由 430 收窄到 240）；工具栏「新建」走自定义弹窗。
 */
export function useAiProfileButtons({
  t,
  flags: { canCreate, canActivate, canDeactivate, canTest },
  activate,
  deactivate,
  testProfile,
  openDialog,
  openProfilePanel
}: {
  t: TFunction;
  flags: {
    canCreate: boolean;
    canActivate: boolean;
    canDeactivate: boolean;
    canTest: boolean;
  };
  activate: (row: AiProfileItem) => Promise<void>;
  deactivate: (row: AiProfileItem) => Promise<void>;
  testProfile: (row: AiProfileItem) => Promise<void>;
  openDialog: (row: AiProfileItem | null) => void;
  openProfilePanel: (row: AiProfileItem) => void;
}) {
  const operationButtonsProps = shallowRef<OperationProps>({
    // 行内保留在线处置（激活/停用、测试）+ 管理抽屉入口：列宽由 430 收窄
    width: 240,
    // 档案资料/参数与能力画像由「管理」抽屉承载，关闭框架默认详情入口避免重复
    hideDetail: true,
    buttons: [
      {
        text: t("aiConfig.activate"),
        code: "activate",
        props: { type: "warning", link: true },
        onClick: ({ row }) => activate(row as AiProfileItem),
        index: -40,
        show: row => Boolean(canActivate && !(row as AiProfileItem).is_active)
      },
      {
        text: t("aiConfig.deactivate"),
        code: "deactivate",
        props: { type: "info", link: true },
        onClick: ({ row }) => deactivate(row as AiProfileItem),
        index: -40,
        show: row => Boolean(canDeactivate && (row as AiProfileItem).is_active)
      },
      {
        text: t("aiConfig.test"),
        code: "test",
        props: { type: "success", link: true },
        onClick: ({ row }) => testProfile(row as AiProfileItem),
        index: -30,
        show: canTest
      },
      {
        text: t("aiConfig.manage"),
        code: "manage",
        props: { type: "primary", link: true },
        onClick: ({ row }) => openProfilePanel(row as AiProfileItem),
        index: -15,
        show: true
      }
    ]
  });

  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        text: t("aiConfig.create"),
        code: "create",
        props: { type: "primary" },
        onClick: () => openDialog(null),
        show: canCreate
      }
    ]
  });

  return { operationButtonsProps, tableBarButtonsProps };
}
