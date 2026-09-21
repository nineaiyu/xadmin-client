import { h, reactive, type Ref } from "vue";
import { ElForm, ElFormItem, ElInput } from "element-plus";
import { addDialog } from "@/components/ReDialog";
import { approvalInstanceApi } from "@/api/system/approvalFlow";
import type { NodeProgress } from "@/api/system/approvalFlow";
import { handleOperation } from "@/components/RePlusPage";
import { hasAuth } from "@/router/utils";
import SearchUser from "@/views/system/components/SearchUser.vue";
import { message } from "@/utils/message";

import {
  pickUsername,
  pickUsernames,
  rowTitle,
  type TFunction
} from "./instanceFormShared";
import { useInstanceBatchActions } from "./useInstanceBatchActions";

/** 审批动作弹窗：通过（意见选填）/ 驳回（原因必填）/ 加签 / 转交 / 催办 / 重新提交（批量见 useInstanceBatchActions） */
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
              // h() 形式 + 带引号的 "onUpdate:modelValue" 是项目 TSX 惯例：
              // JSX 属性位置写 onUpdate:modelValue 会被解析为命名空间属性而不生效（历史缺陷）
              h(SearchUser, {
                modelValue: addSignForm.users,
                multiple: true,
                style: { width: "100%" },
                "onUpdate:modelValue": (value: unknown) => {
                  addSignForm.users = Array.isArray(value)
                    ? (value as Array<{ pk: string; username: string }>)
                    : [];
                  // 选择器产出 {pk, label}：统一回填用户名，提交时按 usernames 走服务端校验
                  addSignForm.usernames = pickUsernames(value).join(",");
                }
              })
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
        // 选择器分支：onUpdate 已回填用户名（结构差异由 pickUsernames 兜底）；输入框分支直接取值
        const usernames =
          addSignForm.usernames.trim() ||
          pickUsernames(addSignForm.users).join(",");
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
          success: res => {
            done();
            refresh();
            // 加签抬高节点任务总数：用服务端回带的新达标线提示（比例会签透明可预期）
            const progress = (
              res?.data as { node_progress?: NodeProgress } | undefined
            )?.node_progress;
            if (progress && progress.required > 1) {
              message(
                t("systemApprovalInstance.addSignThreshold", {
                  approved: progress.approved,
                  required: progress.required,
                  total: progress.total
                }),
                { type: "info" }
              );
            }
          },
          requestEnd: closeLoading
        });
      }
    });
  };

  /** 转交弹窗：把我的当前待办交给他人处理（一次性，区别于「委托」的长期代理）。
   *  选人复用 SearchUser 单选；无 list:SearchUser 权限时回退用户名输入。 */
  const transferForm = reactive({
    user: undefined as { pk: string; username: string } | undefined,
    username: "",
    comment: ""
  });
  const openTransfer = (row: { pk?: string | number; title?: string }) => {
    addDialog({
      title: t("systemApprovalInstance.transferTitle", {
        title: rowTitle(row)
      }),
      width: "440px",
      draggable: true,
      closeOnClickModal: false,
      contentRenderer: () => (
        <ElForm model={transferForm}>
          <ElFormItem
            label={t("systemApprovalInstance.transferTarget")}
            prop="user"
            required
          >
            {hasAuth("list:SearchUser") ? (
              // 同加签：h() + 字符串键事件（JSX 属性位置的 onUpdate:modelValue 不生效）
              h(SearchUser, {
                modelValue: transferForm.user ?? "",
                multiple: false,
                style: { width: "100%" },
                "onUpdate:modelValue": (value: unknown) => {
                  const picked = Array.isArray(value) ? value[0] : value;
                  transferForm.user = (picked || undefined) as
                    { pk: string; username: string } | undefined;
                  // 兜底：选择器产出 {pk, label} 时按 label 取用户名，保证提交可用
                  transferForm.username = pickUsername(value);
                }
              })
            ) : (
              <ElInput
                v-model={transferForm.username}
                placeholder={t("systemApprovalInstance.transferPlaceholder")}
              />
            )}
          </ElFormItem>
          <ElFormItem prop="comment">
            <ElInput
              type="textarea"
              rows={2}
              maxlength={200}
              v-model={transferForm.comment}
              placeholder={t("systemApprovalInstance.commentPlaceholder")}
            />
          </ElFormItem>
        </ElForm>
      ),
      closeCallBack: () => {
        transferForm.user = undefined;
        transferForm.username = "";
        transferForm.comment = "";
      },
      beforeSure: (done, { closeLoading }) => {
        const username = hasAuth("list:SearchUser")
          ? transferForm.username.trim() || pickUsername(transferForm.user)
          : transferForm.username.trim();
        if (!username) {
          message(t("systemApprovalInstance.transferRequired"), {
            type: "error"
          });
          return;
        }
        handleOperation({
          t,
          apiReq: approvalInstanceApi.transfer(
            row.pk ?? "",
            username,
            transferForm.comment.trim()
          ),
          success: () => {
            message(t("systemApprovalInstance.transferOk"), {
              type: "success"
            });
            done();
            refresh();
          },
          requestEnd: closeLoading
        });
      }
    });
  };

  // 批量动作（通过/驳回/转交）拆在 useInstanceBatchActions，这里转发保持调用面不变
  const batchActions = useInstanceBatchActions({ t, refresh, tableRef });

  return {
    openApprove,
    openUrge,
    openReject,
    openAddSign,
    openTransfer,
    ...batchActions
  };
}
