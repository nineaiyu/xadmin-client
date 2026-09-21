import { h, reactive, type Ref } from "vue";
import { ElForm, ElFormItem, ElInput } from "element-plus";
import { addDialog } from "@/components/ReDialog";
import { approvalInstanceApi } from "@/api/system/approvalFlow";
import { handleOperation } from "@/components/RePlusPage";
import { hasAuth } from "@/router/utils";
import SearchUser from "@/views/system/components/SearchUser.vue";
import { message } from "@/utils/message";

import { pickUsername, type TFunction } from "./instanceFormShared";

/**
 * 实例**批量**动作弹窗（自 useInstanceActions 拆出，仅因文件行数门禁）：
 * 批量通过 / 批量驳回 / 批量转交——都以「勾选的行（getSelectPks）」为作用域，
 * 服务端逐条独立校验（部分失败给明细，不整体拒绝）。
 */
export function useInstanceBatchActions({
  t,
  refresh,
  tableRef
}: {
  t: TFunction;
  refresh: () => void;
  tableRef: Ref;
}) {
  /** 批量通过弹窗：意见选填（逐单落同一意见） */
  const batchApproveForm = reactive({ comment: "" });
  const openBatchApprove = () => {
    const pks = tableRef.value?.getSelectPks("pk") ?? [];
    if (!pks.length) {
      message(t("results.noSelectedData"), { type: "error" });
      return;
    }
    addDialog({
      title: t("systemApprovalInstance.batchApproveTitle", { n: pks.length }),
      width: "440px",
      draggable: true,
      closeOnClickModal: false,
      contentRenderer: () => (
        <ElForm model={batchApproveForm}>
          <ElFormItem prop="comment">
            <ElInput
              type="textarea"
              rows={3}
              maxlength={200}
              show-word-limit
              v-model={batchApproveForm.comment}
              placeholder={t("systemApprovalInstance.commentPlaceholder")}
            />
          </ElFormItem>
        </ElForm>
      ),
      closeCallBack: () => (batchApproveForm.comment = ""),
      beforeSure: (done, { closeLoading }) => {
        handleOperation({
          t,
          apiReq: approvalInstanceApi.batchApprove(
            pks,
            batchApproveForm.comment.trim()
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

  /** 批量转交弹窗：把勾选的多条待办一次性交给同一人（逐条独立，部分失败给明细） */
  const batchTransferForm = reactive({
    user: undefined as { pk: string; username: string } | undefined,
    username: "",
    comment: ""
  });
  const openBatchTransfer = () => {
    const pks = tableRef.value?.getSelectPks("pk") ?? [];
    if (!pks.length) {
      message(t("results.noSelectedData"), { type: "error" });
      return;
    }
    addDialog({
      title: t("systemApprovalInstance.batchTransferTitle", { n: pks.length }),
      width: "440px",
      draggable: true,
      closeOnClickModal: false,
      contentRenderer: () => (
        <ElForm model={batchTransferForm}>
          <ElFormItem
            label={t("systemApprovalInstance.transferTarget")}
            prop="user"
            required
          >
            {hasAuth("list:SearchUser") ? (
              // 同单行转交：h() + 字符串键事件（JSX 属性位置的 onUpdate:modelValue 不生效）
              h(SearchUser, {
                modelValue: batchTransferForm.user ?? "",
                multiple: false,
                style: { width: "100%" },
                "onUpdate:modelValue": (value: unknown) => {
                  const picked = Array.isArray(value) ? value[0] : value;
                  batchTransferForm.user = (picked || undefined) as
                    { pk: string; username: string } | undefined;
                  batchTransferForm.username = pickUsername(value);
                }
              })
            ) : (
              <ElInput
                v-model={batchTransferForm.username}
                placeholder={t("systemApprovalInstance.transferPlaceholder")}
              />
            )}
          </ElFormItem>
          <ElFormItem prop="comment">
            <ElInput
              type="textarea"
              rows={2}
              maxlength={200}
              v-model={batchTransferForm.comment}
              placeholder={t("systemApprovalInstance.commentPlaceholder")}
            />
          </ElFormItem>
        </ElForm>
      ),
      closeCallBack: () => {
        batchTransferForm.user = undefined;
        batchTransferForm.username = "";
        batchTransferForm.comment = "";
      },
      beforeSure: (done, { closeLoading }) => {
        const username = hasAuth("list:SearchUser")
          ? batchTransferForm.username.trim() ||
            pickUsername(batchTransferForm.user)
          : batchTransferForm.username.trim();
        if (!username) {
          message(t("systemApprovalInstance.transferRequired"), {
            type: "error"
          });
          return;
        }
        handleOperation({
          t,
          apiReq: approvalInstanceApi.batchTransfer(
            pks,
            username,
            batchTransferForm.comment.trim()
          ),
          // 成功文案由服务端 detail 给出（「X 条已转交，Y 条失败」）；部分失败再补明细
          success: res => {
            done();
            const failures =
              (
                res?.data as {
                  failures?: Array<{ pk: string; detail: string }>;
                }
              )?.failures ?? [];
            if (failures.length) {
              message(
                t("systemApprovalInstance.batchTransferPartial", {
                  n: failures.length,
                  detail: failures
                    .slice(0, 3)
                    .map(item => item.detail)
                    .join("；")
                }),
                { type: "warning" }
              );
            }
            refresh();
          },
          failed: res => {
            // 全失败：服务端带首个失败原因，弹窗保持打开便于改人重试
            const failures =
              (
                res?.data as {
                  failures?: Array<{ pk: string; detail: string }>;
                }
              )?.failures ?? [];
            if (failures.length) {
              message(failures[0].detail, { type: "error" });
            }
          },
          requestEnd: closeLoading
        });
      }
    });
  };

  return { openBatchApprove, openBatchTransfer, openBatchReject };
}
