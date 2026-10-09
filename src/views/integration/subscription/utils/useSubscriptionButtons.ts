import { shallowRef } from "vue";
import type { useI18n } from "vue-i18n";
import type { OperationProps } from "@/components/RePlusPage";
import type { WebhookSubscriptionItem } from "@/api/task/webhook";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * Webhook 订阅按钮装配（自 subscription/utils/hook 抽出）：工具栏「新增」与
 * 行操作「测试 / 编辑」（删除保留框架默认入口，带二次确认）。
 */
export function useSubscriptionButtons({
  t,
  flags: { canCreate, canEdit, canTest },
  testSubscription,
  openDialog
}: {
  t: TFunction;
  flags: { canCreate: boolean; canEdit: boolean; canTest: boolean };
  testSubscription: (row: WebhookSubscriptionItem) => Promise<void>;
  openDialog: (row: WebhookSubscriptionItem | null) => void;
}) {
  const operationButtonsProps = shallowRef<OperationProps>({
    width: 200,
    // 页面自绘表单承载编辑，详情抽屉没有适配;补充 retrieve 权限点后框架的详情按钮会
    // 自动出现并挤占操作列（测试按钮被收进「更多」下拉），故此处显式收敛
    hideDetail: true,
    buttons: [
      {
        text: t("webhook.test"),
        code: "test",
        props: { type: "success", link: true },
        onClick: ({ row }) => testSubscription(row as WebhookSubscriptionItem),
        index: 10,
        show: canTest
      },
      {
        text: t("webhook.edit"),
        code: "edit",
        props: { type: "primary", link: true },
        onClick: ({ row }) => openDialog(row as WebhookSubscriptionItem),
        index: 20,
        show: canEdit
      }
    ]
  });

  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        text: t("webhook.create"),
        code: "create",
        props: { type: "primary" },
        onClick: () => openDialog(null),
        show: canCreate
      }
    ]
  });

  return { operationButtonsProps, tableBarButtonsProps };
}
