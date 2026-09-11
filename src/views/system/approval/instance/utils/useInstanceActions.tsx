import { reactive, type Ref } from "vue";
import type { useI18n } from "vue-i18n";
import { ElForm, ElFormItem, ElInput } from "element-plus";
import { addDialog } from "@/components/ReDialog";
import { approvalInstanceApi } from "@/api/system/approvalFlow";
import { handleOperation } from "@/components/RePlusPage";
import { message } from "@/utils/message";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 审批动作弹窗：驳回（原因必填）/ 加签 / 批量驳回（拆分自 hook.tsx，行为不变） */
export function useInstanceActions({
  t,
  refresh,
  tableRef
}: {
  t: TFunction;
  refresh: () => void;
  tableRef: Ref;
}) {
  /** 驳回弹窗：原因必填（驳回即终止申请） */
  const rejectForm = reactive({ reason: "" });
  const openReject = (row: { pk?: string | number; title?: string }) => {
    addDialog({
      title: t("systemApprovalInstance.rejectTitle", {
        title: row.title ?? String(row.pk).slice(0, 8).toUpperCase()
      }),
      width: "440px",
      draggable: true,
      closeOnClickModal: false,
      contentRenderer: () => (
        <ElForm model={rejectForm}>
          <ElFormItem
            prop="reason"
            rules={[
              {
                required: true,
                message: t("systemApprovalInstance.rejectReasonRequired"),
                trigger: "blur"
              }
            ]}
          >
            <ElInput
              type="textarea"
              rows={3}
              maxlength={200}
              show-word-limit
              v-model={rejectForm.reason}
              placeholder={t("systemApprovalInstance.reasonPlaceholder")}
            />
          </ElFormItem>
        </ElForm>
      ),
      closeCallBack: () => (rejectForm.reason = ""),
      beforeSure: (done, { closeLoading }) => {
        const reason = rejectForm.reason.trim();
        // ReDialog 只回调 beforeSure，不触发表单校验：原因必填在此显式收口
        if (!reason) {
          message(t("systemApprovalInstance.rejectReasonRequired"), {
            type: "error"
          });
          return;
        }
        handleOperation({
          t,
          apiReq: approvalInstanceApi.reject(row.pk ?? "", reason),
          success: () => {
            done();
            refresh();
          },
          requestEnd: closeLoading
        });
      }
    });
  };

  /** 加签弹窗：用户名逗号分隔（一期简版，不做用户选择器） */
  const addSignForm = reactive({ usernames: "", comment: "" });
  const openAddSign = (row: { pk?: string | number; title?: string }) => {
    addDialog({
      title: t("systemApprovalInstance.addSignTitle", {
        title: row.title ?? String(row.pk).slice(0, 8).toUpperCase()
      }),
      width: "440px",
      draggable: true,
      closeOnClickModal: false,
      contentRenderer: () => (
        <ElForm model={addSignForm}>
          <ElFormItem
            prop="usernames"
            rules={[
              {
                required: true,
                message: t("systemApprovalInstance.addSignRequired"),
                trigger: "blur"
              }
            ]}
          >
            <ElInput
              v-model={addSignForm.usernames}
              placeholder={t("systemApprovalInstance.addSignPlaceholder")}
            />
          </ElFormItem>
          <ElFormItem prop="comment">
            <ElInput
              type="textarea"
              rows={2}
              maxlength={200}
              v-model={addSignForm.comment}
              placeholder={t("systemApprovalInstance.commentPlaceholder")}
            />
          </ElFormItem>
        </ElForm>
      ),
      closeCallBack: () => {
        addSignForm.usernames = "";
        addSignForm.comment = "";
      },
      beforeSure: (done, { closeLoading }) => {
        const usernames = addSignForm.usernames.trim();
        if (!usernames) {
          message(t("systemApprovalInstance.addSignRequired"), {
            type: "error"
          });
          return;
        }
        handleOperation({
          t,
          apiReq: approvalInstanceApi.addSign(
            row.pk ?? "",
            usernames,
            addSignForm.comment.trim()
          ),
          success: () => {
            done();
            refresh();
          },
          requestEnd: closeLoading
        });
      }
    });
  };

  /** 批量驳回弹窗：原因必填，部分失败明细逐条提示（服务端逐单校验） */
  const batchRejectForm = reactive({ reason: "" });
  const openBatchReject = () => {
    const pks = tableRef.value?.getSelectPks("pk") ?? [];
    if (!pks.length) {
      message(t("results.noSelectedData"), { type: "error" });
      return;
    }
    addDialog({
      title: t("systemApprovalInstance.batchRejectTitle", { n: pks.length }),
      width: "440px",
      draggable: true,
      closeOnClickModal: false,
      contentRenderer: () => (
        <ElForm model={batchRejectForm}>
          <ElFormItem prop="reason">
            <ElInput
              type="textarea"
              rows={3}
              maxlength={200}
              show-word-limit
              v-model={batchRejectForm.reason}
              placeholder={t("systemApprovalInstance.reasonPlaceholder")}
            />
          </ElFormItem>
        </ElForm>
      ),
      closeCallBack: () => (batchRejectForm.reason = ""),
      beforeSure: (done, { closeLoading }) => {
        const reason = batchRejectForm.reason.trim();
        if (!reason) {
          message(t("systemApprovalInstance.rejectReasonRequired"), {
            type: "error"
          });
          return;
        }
        handleOperation({
          t,
          apiReq: approvalInstanceApi.batchReject(pks, reason),
          success: res => {
            done();
            const failed =
              (res?.data as { failed?: Array<{ no: string; reason: string }> })
                ?.failed ?? [];
            if (failed.length) {
              message(
                t("systemApprovalInstance.batchRejectPartial", {
                  n: failed.length,
                  detail: failed
                    .map(item => `${item.no}: ${item.reason}`)
                    .join("；")
                }),
                { type: "warning" }
              );
            }
            refresh();
          },
          requestEnd: closeLoading
        });
      }
    });
  };

  return { openReject, openAddSign, openBatchReject };
}
