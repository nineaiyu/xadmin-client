import { shallowRef } from "vue";
import type { OperationProps } from "@/components/RePlusPage";
import type { WebhookSubscriptionItem } from "@/api/task/webhook";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * Webhook 订阅行操作按钮装配：只保留页面专属的「测试」。
 *
 * 新增 / 编辑由框架元数据表单提供（`auth.create/partialUpdate` 未关闭），
 * 删除保留框架默认入口（带二次确认）；详情入口沿用页面既有收敛（hideDetail）。
 */
export function useSubscriptionButtons({
  t,
  canTest,
  testSubscription
}: {
  t: TFunction;
  canTest: boolean;
  testSubscription: (row: WebhookSubscriptionItem) => Promise<void>;
}) {
  const operationButtonsProps = shallowRef<OperationProps>({
    width: 200,
    // 详情抽屉没有适配本页表单结构；补充 retrieve 权限点后框架详情按钮会
    // 自动出现并挤占操作列，故此处显式收敛
    hideDetail: true,
    buttons: [
      {
        text: t("webhook.test"),
        code: "test",
        props: { type: "success", link: true },
        onClick: ({ row }) => testSubscription(row as WebhookSubscriptionItem),
        index: 10,
        show: canTest
      }
    ]
  });

  return { operationButtonsProps };
}
