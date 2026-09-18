import { reactive, type Ref } from "vue";
import type { useI18n } from "vue-i18n";
import { ElForm, ElFormItem, ElInput } from "element-plus";
import { addDialog } from "@/components/ReDialog";
import { approvalInstanceApi } from "@/api/system/approvalFlow";
import { handleOperation } from "@/components/RePlusPage";
import { hasAuth } from "@/router/utils";
import SearchUser from "@/views/system/components/SearchUser.vue";
import { message } from "@/utils/message";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 行简化标题（无标题时回退单号前 8 位） */
const rowTitle = (row: { pk?: string | number; title?: string }) =>
  row.title ?? String(row.pk).slice(0, 8).toUpperCase();

/** 审批动作弹窗：通过（意见选填）/ 驳回（原因必填）/ 加签 / 批量 / 催办 / 重新提交 */
export function useInstanceActions({
  t,
  refresh,
  tableRef
}: {
  t: TFunction;
  refresh: () => void;
  tableRef: Ref;
}) {
  /** 通过弹窗：审批意见选填（会签/多级场景下意见随任务留痕，进审批轨迹） */
  const approveForm = reactive({ comment: "" });
  const openApprove = (row: { pk?: string | number; title?: string }) => {
    addDialog({
      title: t("systemApprovalInstance.approveTitle", {
        title: rowTitle(row)
      }),
      width: "440px",
      draggable: true,
      closeOnClickModal: false,
      contentRenderer: () => (
        <ElForm model={approveForm}>
          <ElFormItem prop="comment">
            <ElInput
              type="textarea"
              rows={3}
              maxlength={200}
              show-word-limit
              v-model={approveForm.comment}
              placeholder={t("systemApprovalInstance.commentPlaceholder")}
            />
          </ElFormItem>
        </ElForm>
      ),
      closeCallBack: () => (approveForm.comment = ""),
      beforeSure: (done, { closeLoading }) => {
        handleOperation({
          t,
          apiReq: approvalInstanceApi.approve(
            row.pk ?? "",
            undefined,
            approveForm.comment.trim()
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

  /** 催办弹窗：留言选填（通知当前节点审批人；服务端 10 分钟节流） */
  const urgeForm = reactive({ message: "" });
  const openUrge = (row: { pk?: string | number; title?: string }) => {
    addDialog({
      title: t("systemApprovalInstance.urgeTitle", { title: rowTitle(row) }),
      width: "440px",
      draggable: true,
      closeOnClickModal: false,
      contentRenderer: () => (
        <ElForm model={urgeForm}>
          <ElFormItem prop="message">
            <ElInput
              type="textarea"
              rows={3}
              maxlength={200}
              show-word-limit
              v-model={urgeForm.message}
              placeholder={t("systemApprovalInstance.urgeMessagePlaceholder")}
            />
          </ElFormItem>
        </ElForm>
      ),
      closeCallBack: () => (urgeForm.message = ""),
      beforeSure: (done, { closeLoading }) => {
        handleOperation({
          t,
          apiReq: approvalInstanceApi.urge(
            row.pk ?? "",
            urgeForm.message.trim()
          ),
          success: () => {
            message(t("systemApprovalInstance.urgeOk"), { type: "success" });
            done();
            refresh();
          },
          requestEnd: closeLoading
        });
      }
    });
  };

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

  /** 加签弹窗：SearchUser 多选选人（复用权限表单同款的表格面板选择器）；
   *  无 list:SearchUser 权限的审批人回退用户名逗号输入，保证加签始终可用 */
  const addSignForm = reactive({
    users: [] as Array<{ pk: string; username: string }>,
    usernames: "",
    comment: ""
  });
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
          <ElFormItem prop="users" required>
            {hasAuth("list:SearchUser") ? (
              <SearchUser
                modelValue={addSignForm.users}
                multiple
                style={{ width: "100%" }}
                onUpdate:modelValue={(value: unknown) => {
                  addSignForm.users = Array.isArray(value)
                    ? (value as Array<{ pk: string; username: string }>)
                    : [];
                }}
              />
            ) : (
              <ElInput
                v-model={addSignForm.usernames}
                placeholder={t("systemApprovalInstance.addSignPlaceholder")}
              />
            )}
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
        addSignForm.users = [];
        addSignForm.usernames = "";
        addSignForm.comment = "";
      },
      beforeSure: (done, { closeLoading }) => {
        const usernames = hasAuth("list:SearchUser")
          ? addSignForm.users
              .map(user => user.username)
              .filter(Boolean)
              .join(",")
          : addSignForm.usernames.trim();
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

  return {
    openApprove,
    openBatchApprove,
    openUrge,
    openReject,
    openAddSign,
    openBatchReject
  };
}
