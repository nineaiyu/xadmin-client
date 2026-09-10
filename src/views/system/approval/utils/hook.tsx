import { h, reactive, shallowRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElForm, ElFormItem, ElInput, ElTag } from "element-plus";
import { addDialog } from "@/components/ReDialog";
import { getDefaultAuths } from "@/router/utils";
import { approvalApi } from "@/api/system/approval";
import {
  handleOperation,
  type OperationProps,
  type PageTableColumn
} from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { message } from "@/utils/message";
import { statusTagProps, type StatusTagType } from "@/utils/dict";
import Check from "~icons/ep/check";
import Close from "~icons/ep/close";
import RefreshLeft from "~icons/ep/refresh-left";

export type ApprovalScope = "pending" | "mine";

/** 字典色失效时的 EP tag 语义色兜底（审批状态） */
const APPROVAL_STATUS_TAG_TYPE: Record<string, StatusTagType> = {
  APPROVED: "success",
  REJECTED: "danger",
  FAILED: "danger",
  PENDING: "warning"
};

/**
 * 审批中心面板公共装配：待我审批 / 我发起的两页签同构，唯一差异是
 * scope 过滤与操作按钮（通过/驳回 vs 撤回）。权限码挂页面组件名
 * SystemApprovalRequest 下（页签无独立菜单，显式传字符串后缀）。
 */
export function useApprovalPanel(scope: ApprovalScope, tableRef: Ref) {
  const componentName = "SystemApprovalRequest";
  const auth = reactive(
    getDefaultAuths(componentName, [
      "approve",
      "reject",
      "cancel",
      "batchApprove"
    ])
  );
  const { t } = useI18n();

  // 作用域隔离：列表请求按页签追加 scope 参数（后端 ApprovalScopeFilter 收口取值域）
  const api = reactive(
    Object.assign(Object.create(approvalApi), {
      list: (params?: object) =>
        approvalApi.request("get", { scope, ...params }, {})
    })
  );

  const refresh = () => tableRef.value?.handleGetData();

  /** 驳回弹窗：原因必填（hook 内联表单，走 addDialog 标准范式） */
  const rejectForm = reactive({ reason: "" });
  const openReject = row => {
    addDialog({
      title: t("approval.rejectTitle", {
        no: String(row.pk).slice(0, 8).toUpperCase()
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
                message: t("approval.rejectReasonRequired"),
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
              placeholder={t("approval.reasonPlaceholder")}
            />
          </ElFormItem>
        </ElForm>
      ),
      closeCallBack: () => (rejectForm.reason = ""),
      beforeSure: (done, { closeLoading }) => {
        const reason = rejectForm.reason.trim();
        // ReDialog 只回调 beforeSure，不触发表单校验：原因必填在此显式收口
        if (!reason) {
          message(t("approval.rejectReasonRequired"), { type: "error" });
          return;
        }
        // 统一走 handleOperation：成功/失败提示、异常 catch、loading 收口齐全
        // （手写 then 时后端 400 会让 done() 不执行 → 弹窗卡死）
        handleOperation({
          t,
          apiReq: approvalApi.reject(row.pk, reason),
          success: () => {
            done();
            refresh();
          },
          requestEnd: closeLoading
        });
      }
    });
  };

  /** 行内按钮：待我审批页签 = 通过/驳回；我发起的页签 = 撤回（仅 PENDING） */
  const operationButtonsProps = shallowRef<OperationProps>({
    showNumber: 3,
    buttons:
      scope === "pending"
        ? [
            {
              text: t("approval.approve"),
              code: "approve",
              props: {
                type: "primary",
                icon: useRenderIcon(Check),
                link: true
              },
              confirm: {
                // renderString 以 (row, buttonRow) 直传首参，不能写 ({ row }) 解构
                title: row =>
                  t("approval.approveConfirm", {
                    no: String(row.pk).slice(0, 8).toUpperCase()
                  })
              },
              onClick: ({ row, loading }) => {
                loading.value = true;
                handleOperation({
                  t,
                  apiReq: approvalApi.approve(row.pk),
                  success: () => refresh(),
                  requestEnd: () => (loading.value = false)
                });
              },
              show: auth.approve && 4
            },
            {
              text: t("approval.reject"),
              code: "reject",
              props: {
                type: "danger",
                icon: useRenderIcon(Close),
                link: true
              },
              onClick: ({ row }) => openReject(row),
              show: auth.reject && 5
            }
          ]
        : [
            {
              text: t("approval.cancel"),
              code: "cancel",
              props: {
                type: "info",
                icon: useRenderIcon(RefreshLeft),
                link: true
              },
              confirm: {
                title: row =>
                  t("approval.cancelConfirm", {
                    no: String(row.pk).slice(0, 8).toUpperCase()
                  })
              },
              onClick: ({ row, loading }) => {
                loading.value = true;
                handleOperation({
                  t,
                  apiReq: approvalApi.cancel(row.pk),
                  success: () => refresh(),
                  requestEnd: () => (loading.value = false)
                });
              },
              show: row =>
                auth.cancel && (row.status?.value ?? row.status) === "PENDING"
            }
          ]
  });

  /** 工具栏批量通过（仅待我审批页签，作用于勾选行） */
  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        text: t("approval.batchApprove"),
        code: "batchApprove",
        confirm: {
          title: t("approval.batchApproveConfirm")
        },
        props: {
          type: "primary",
          icon: useRenderIcon(Check),
          plain: true
        },
        onClick: ({ loading }) => {
          const pks = tableRef.value?.getSelectPks("pk") ?? [];
          if (!pks.length) {
            message(t("results.noSelectedData"), { type: "error" });
            return;
          }
          loading.value = true;
          handleOperation({
            t,
            apiReq: approvalApi.batchApprove(pks),
            success: () => refresh(),
            requestEnd: () => (loading.value = false)
          });
        },
        show: auth.batchApprove
      }
    ]
  });

  /** 状态列：字典驱动（approval_status）颜色/文案，字典未配置回退页面 i18n */
  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "status":
          column.cellRenderer = data => {
            const row = data.row;
            const status = row.status?.value ?? row.status;
            return h(
              ElTag,
              statusTagProps(row.status, APPROVAL_STATUS_TAG_TYPE),
              () => row.status?.label ?? t(`approval.status${status}`)
            );
          };
          break;
      }
    });
    return columns;
  };

  return {
    api,
    auth,
    operationButtonsProps,
    tableBarButtonsProps,
    listColumnsFormat
  };
}
