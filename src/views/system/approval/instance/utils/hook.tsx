import { h, reactive, shallowRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElForm, ElFormItem, ElInput, ElTag } from "element-plus";
import {
  addDialog,
  closeDialog,
  type DialogOptions
} from "@/components/ReDialog";
import { addDrawer } from "@/components/ReDrawer";
import StartInstanceDialog from "../components/StartInstanceDialog.vue";
import { getDefaultAuths } from "@/router/utils";
import { approvalInstanceApi } from "@/api/system/approvalFlow";
import {
  handleOperation,
  type OperationButtonsRow,
  type OperationProps,
  type PageTableColumn
} from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { message } from "@/utils/message";
import { statusTagProps, type StatusTagType } from "@/utils/dict";
import InstanceDetail from "../components/InstanceDetail.vue";
import Check from "~icons/ep/check";
import Close from "~icons/ep/close";
import Plus from "~icons/ep/plus";
import RefreshLeft from "~icons/ep/refresh-left";
import View from "~icons/ep/view";

export type InstanceScope = "pending" | "mine" | "done";

/** 字典色失效时的 EP tag 语义色兜底（approval_status 同集：PENDING/APPROVED/REJECTED/CANCELLED） */
const FLOW_STATUS_TAG_TYPE: Record<string, StatusTagType> = {
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "info",
  PENDING: "warning"
};

/**
 * 打开「发起申请」弹窗：选择流程 + 动态表单，提交成功即关弹层并回调刷新。
 *
 * 放在 .tsx 里以承载 contentRenderer 的 JSX；标题由调用方传入（i18n 需在 setup 内取）。
 */
export function openStartInstanceDialog(
  title: string,
  onSubmitted: () => void
) {
  const handleSubmitted = () => {
    closeDialog(options, 0);
    onSubmitted();
  };
  const options: DialogOptions = {
    title,
    width: "560px",
    draggable: true,
    closeOnClickModal: false,
    hideFooter: true,
    contentRenderer: () =>
      h(StartInstanceDialog, { onSubmitted: handleSubmitted })
  };
  addDialog(options);
}

/** 详情抽屉：只读展示表单数据与审批轨迹 */
export function openInstanceDetail(row: {
  pk?: string | number;
  title?: string;
}) {
  addDrawer({
    title:
      `${row.title ?? ""} - ${String(row.pk).slice(0, 8).toUpperCase()}`.replace(
        /^-\s*/,
        ""
      ),
    size: "45%",
    destroyOnClose: true,
    closeOnClickModal: true,
    hideFooter: true,
    props: { pk: row.pk },
    contentRenderer: () => h(InstanceDetail)
  });
}

/**
 * 流程审批面板公共装配（待我审批 / 我的申请 / 已办三页签同构）。
 *
 * 唯一差异：scope 过滤（后端 ApprovalInstanceScopeFilter 收口取值域）与行内
 * 操作按钮；权限码挂页面组件名 SystemApprovalInstance 下。
 */
export function useInstancePanel(scope: InstanceScope, tableRef: Ref) {
  const componentName = "SystemApprovalInstance";
  const baseAuth = getDefaultAuths(componentName, [
    "approve",
    "reject",
    "cancel",
    "addSign",
    "batchApprove",
    "batchReject"
  ]);
  // 自定义权限码先声明默认值再展开（与 demo/book、system/role 同范式）：
  // UnwrapNestedRefs 会丢掉索引签名，不显式声明时 auth.approve 等取用会报 TS2339；
  // 展开在后保证 hasAuth 的真实取值覆盖默认值
  const auth = reactive({
    approve: false,
    reject: false,
    cancel: false,
    addSign: false,
    batchApprove: false,
    batchReject: false,
    ...baseAuth,
    // 隐藏内置「新增」入口：发起申请由页面顶部的专用按钮承载（弹窗内选流程 + 动态表单）
    create: false
  });
  const { t } = useI18n();

  // 作用域隔离：列表请求按页签追加 scope 参数
  const api = reactive(
    Object.assign(Object.create(approvalInstanceApi), {
      list: (params?: object) =>
        approvalInstanceApi.request("get", { scope, ...params }, {})
    })
  );

  const refresh = () => tableRef.value?.handleGetData();

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

  const detailButton: OperationButtonsRow = {
    // 与内置「查看」（通用记录详情）区分：本按钮展示表单数据 + 审批轨迹
    text: t("systemApprovalInstance.detailRich"),
    code: "detail",
    props: {
      type: "primary",
      icon: useRenderIcon(View),
      link: true
    },
    onClick: ({ row }) => openInstanceDetail(row),
    show: 10
  };

  const approveButton: OperationButtonsRow = {
    text: t("systemApprovalInstance.approve"),
    code: "approve",
    props: {
      type: "primary",
      icon: useRenderIcon(Check),
      link: true
    },
    confirm: {
      title: (row: { title?: string }) =>
        t("systemApprovalInstance.approveConfirm", {
          title: row?.title ?? ""
        })
    },
    onClick: ({ row, loading }) => {
      loading.value = true;
      handleOperation({
        t,
        apiReq: approvalInstanceApi.approve(row.pk, row.my_task?.pk),
        success: () => refresh(),
        requestEnd: () => (loading.value = false)
      });
    },
    show: auth.approve && 6
  };

  const rejectButton: OperationButtonsRow = {
    text: t("systemApprovalInstance.reject"),
    code: "reject",
    props: {
      type: "danger",
      icon: useRenderIcon(Close),
      link: true
    },
    onClick: ({ row }) => openReject(row),
    show: auth.reject && 5
  };

  const addSignButton: OperationButtonsRow = {
    text: t("systemApprovalInstance.addSign"),
    code: "addSign",
    props: {
      type: "warning",
      icon: useRenderIcon(Plus),
      link: true
    },
    onClick: ({ row }) => openAddSign(row),
    show: auth.addSign && 4
  };

  const cancelButton: OperationButtonsRow = {
    text: t("systemApprovalInstance.cancel"),
    code: "cancel",
    props: {
      type: "info",
      icon: useRenderIcon(RefreshLeft),
      link: true
    },
    confirm: {
      title: (row: { title?: string }) =>
        t("systemApprovalInstance.cancelConfirm", { title: row?.title ?? "" })
    },
    onClick: ({ row, loading }) => {
      loading.value = true;
      handleOperation({
        t,
        apiReq: approvalInstanceApi.cancel(row.pk),
        success: () => refresh(),
        requestEnd: () => (loading.value = false)
      });
    },
    show: (row: { status?: { value?: string } | string }) =>
      auth.cancel &&
      ((row.status as { value?: string })?.value ?? row.status) === "PENDING"
  };

  /** 行内按钮：待办=通过/驳回/加签；我的申请=撤回；已办/详情=只读 */
  const operationButtonsProps = shallowRef<OperationProps>({
    // 5 个按钮（内置查看 + 通过/驳回/加签/申请详情）全部内联，避免折叠进「更多」
    showNumber: 5,
    buttons:
      scope === "pending"
        ? [approveButton, rejectButton, addSignButton, detailButton]
        : scope === "mine"
          ? [cancelButton, detailButton]
          : [detailButton]
  });

  /** 工具栏批量（仅待办页签） */
  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons:
      scope === "pending"
        ? [
            {
              text: t("systemApprovalInstance.batchApprove"),
              code: "batchApprove",
              confirm: {
                title: t("systemApprovalInstance.batchApproveConfirm")
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
                  apiReq: approvalInstanceApi.batchApprove(pks),
                  success: () => refresh(),
                  requestEnd: () => (loading.value = false)
                });
              },
              show: auth.batchApprove
            },
            {
              text: t("systemApprovalInstance.batchReject"),
              code: "batchReject",
              props: {
                type: "danger",
                icon: useRenderIcon(Close),
                plain: true
              },
              onClick: () => openBatchReject(),
              show: auth.batchReject
            }
          ]
        : []
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
              statusTagProps(row.status, FLOW_STATUS_TAG_TYPE),
              () =>
                row.status?.label ?? t(`systemApprovalInstance.status${status}`)
            );
          };
          break;
        case "current_node_name":
          // 已结束实例 current_node 为空：统一显示占位符，避免列空白
          column.cellRenderer = data => data.row.current_node_name || "-";
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
    listColumnsFormat,
    refresh
  };
}
