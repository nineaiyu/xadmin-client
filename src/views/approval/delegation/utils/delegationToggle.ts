import type { useI18n } from "vue-i18n";
import { isSuccess } from "@/api/types";
import { normalizeError } from "@/utils/apiError";
import { useConfirm } from "@/hooks/useConfirm";
import type { approvalDelegationApi } from "@/api/approval/approvalDelegation";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 委托启停守卫（自 hook 抽出，控制 hook 行数）：停用前查询在途待办，
 * 有影响时二次确认；取消则抛出以让通用开关回滚。
 */
export function createDelegationToggleGuard({
  t,
  api,
  canImpact
}: {
  t: TFunction;
  api: Pick<typeof approvalDelegationApi, "impact" | "partialUpdate">;
  canImpact: boolean;
}) {
  const confirm = useConfirm();
  const guardDisable = async (pk: string | number) => {
    if (!canImpact) return true;
    const res = await api.impact(String(pk)).catch(normalizeError);
    if (!isSuccess(res) || !res.data?.total) return true;
    return confirm(
      t("systemApprovalDelegation.impactConfirm", {
        count: res.data.total,
        delegator: res.data.delegator_pending,
        delegate: res.data.delegate_pending
      }),
      {
        title: t("systemApprovalDelegation.impactTitle"),
        type: "warning"
      }
    );
  };

  return async (pk: string | number, data: object) => {
    const active = (data as { is_active?: boolean }).is_active;
    if (active === false && !(await guardDisable(pk))) {
      // 抛出让 renderSwitch 走 exception 分支回滚开关，不再发请求
      throw new Error("cancel");
    }
    return api.partialUpdate(pk, data);
  };
}
