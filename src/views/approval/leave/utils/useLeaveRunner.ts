import type { useI18n } from "vue-i18n";
import { SUCCESS_CODE } from "@/api/types";
import { message } from "@/utils/message";
import { useConfirm } from "@/hooks/useConfirm";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 请假提交/撤回的「确认 + 执行」链路（自 hook.tsx 抽出，行数门禁）。
 *
 * 口径：确认取消则静默返回；HTTP 层异常由拦截器统一提示；200 + 业务码非成功
 * 必须显式展示后端 detail（已在审批中 / 区间冲突 / 未配置流程等），否则用户点击后
 * 完全无反馈；成功后刷新列表与统计卡（状态列/按钮随业务单状态联动）。
 */
export function useLeaveRunner({
  t,
  refresh
}: {
  t: TFunction;
  refresh: () => void;
}) {
  const confirm = useConfirm();

  const confirmAndRun = async (
    row: Record<string, unknown>,
    titleKey: string,
    run: (pk: string | number) => Promise<{ code: number; detail?: string }>,
    successKey: string
  ) => {
    if (
      !(await confirm(t(`leaveApply.${titleKey}`), {
        title: t("leaveApply.confirmTitle"),
        confirmButtonClass: "el-button--danger"
      }))
    ) {
      return;
    }
    // HTTP 层异常：提示由拦截器统一处理，这里静默返回
    const res = await run(row.pk as string | number).catch(() => undefined);
    if (!res) return;
    if (res.code === SUCCESS_CODE) {
      message(t(`leaveApply.${successKey}`), { type: "success" });
      // 状态列/操作按钮随业务单状态联动（提交 → 审批中、撤回 → 已撤回），必须刷新
      refresh();
      return;
    }
    // 200 + 业务码非 1000：全局拦截器只处理 HTTP 层错误，业务失败必须显式展示
    // 后端 detail，否则用户点击后完全无反馈
    message(String(res.detail || t("results.failed")), { type: "error" });
  };

  return { confirmAndRun };
}
