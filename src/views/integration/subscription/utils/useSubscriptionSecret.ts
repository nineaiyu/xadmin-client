import { ElMessageBox } from "element-plus";
import type { useI18n } from "vue-i18n";
import { isSuccess } from "@/api/types";
import {
  webhookSubscriptionApi,
  type WebhookSubscriptionItem
} from "@/api/task/webhook";
import { normalizeError } from "@/utils/apiError";
import { message } from "@/utils/message";
import { useConfirm } from "@/hooks/useConfirm";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 订阅密钥轮换：二次确认 → 只展示一次的新密钥明文 → 行内 has_secret 置真 */
export function useSubscriptionSecret({ t }: { t: TFunction }) {
  const confirm = useConfirm();
  const rotateSecret = async (row: WebhookSubscriptionItem) => {
    if (
      !(await confirm(t("webhook.rotateSecretConfirm"), {
        title: t("webhook.rotateSecret"),
        type: "warning"
      }))
    ) {
      return;
    }
    const res = await webhookSubscriptionApi
      .rotateSecret(row.pk)
      .catch(normalizeError);
    if (isSuccess(res)) {
      row.has_secret = true;
      await ElMessageBox.alert(
        `${t("webhook.rotateSecretHint")}\n${res.data?.secret ?? ""}`,
        t("webhook.rotateSecretTitle"),
        { confirmButtonText: t("webhook.confirm") }
      );
      message(t("webhook.rotateSecretOk"), { type: "success" });
      return;
    }
    if (res.detail) message(String(res.detail), { type: "warning" });
  };

  return { rotateSecret };
}
