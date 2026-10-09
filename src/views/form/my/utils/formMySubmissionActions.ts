import { h } from "vue";
import { SUCCESS_CODE } from "@/api/types";
import { addDrawer } from "@/components/ReDrawer";
import { message } from "@/utils/message";
import { normalizeError } from "@/utils/apiError";
import { submissionApi } from "@/api/dataset/dform";
import SubmissionDetail from "../../components/SubmissionDetail.vue";
import type { useConfirm } from "@/hooks/useConfirm";
import type { SubmissionItem } from "@/api/dataset/dform";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 填报行级动作（自 useFormMyActions.ts 抽出）：详情抽屉、删除、提交草稿、
 * 驳回后重新提交。
 */
export function createSubmissionActions({
  t,
  refresh,
  confirm
}: {
  t: TFunction;
  refresh: () => void;
  confirm: ReturnType<typeof useConfirm>;
}) {
  /** 提交详情抽屉：字段明细 + 审批轨迹（只读） */
  const openDetail = (row: SubmissionItem) => {
    addDrawer({
      title: `${row.form_name} - ${String(row.pk).slice(0, 8).toUpperCase()}`,
      size: "45%",
      destroyOnClose: true,
      closeOnClickModal: true,
      hideFooter: true,
      props: { row },
      contentRenderer: () => h(SubmissionDetail)
    });
  };

  const remove = async (row: SubmissionItem) => {
    if (
      !(await confirm(t("dform.removeConfirm", { name: row.form_name }), {
        confirmButtonClass: "el-button--danger",
        draggable: true
      }))
    ) {
      return;
    }
    // 异常归一为可读失败结果：请求异常不再产生 unhandled rejection
    const res = await submissionApi.destroy(row.pk).catch(normalizeError);
    if (res.code === SUCCESS_CODE) {
      refresh();
      return;
    }
    // 200 + 业务码非 1000：全局拦截器只处理 HTTP 层错误，业务失败必须显式提示
    message(String(res.detail || t("results.failed")), { type: "warning" });
  };

  /** 提交草稿（仅草稿态）：服务端按 schema 严格校验后进入审批/直接生效 */
  const submitDraft = async (row: SubmissionItem) => {
    const res = await submissionApi.submit(row.pk).catch(normalizeError);
    if (res.code === SUCCESS_CODE) {
      message(t("dform.submitDraftOk"), { type: "success" });
      refresh();
      return;
    }
    message(String(res.detail || t("results.failed")), { type: "warning" });
  };

  /** 重新提交被驳回的填报（仅申请人、仅驳回态：按当前数据重新发起流程实例） */
  const resubmit = async (row: SubmissionItem) => {
    const res = await submissionApi.resubmit(row.pk).catch(normalizeError);
    if (res.code === SUCCESS_CODE) {
      message(t("dform.resubmitOk"), { type: "success" });
      refresh();
      return;
    }
    message(String(res.detail || t("results.failed")), { type: "warning" });
  };

  return { openDetail, remove, submitDraft, resubmit };
}
