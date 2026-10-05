import { SUCCESS_CODE } from "@/api/types";
import { h, reactive, shallowRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElTag } from "element-plus";
import { LEAVE_DRAFT_SAVED_CODE, leaveApi } from "@/api/approval/leave";
import { usePageAuth } from "@/router/utils";
import { useConfirm } from "@/hooks/useConfirm";
import { statusTagProps, type StatusTagType } from "@/utils/dict";
import { message } from "@/utils/message";
import { SOLID_TAG_STYLE } from "@/utils/tagTone";
import type {
  OperationProps,
  PageTableColumn,
  RePlusPageProps
} from "@/components/RePlusPage";
import { formatPageColumns, handleOperation } from "@/components/RePlusPage";
import { applyServerErrors } from "@/components/RePlusPage/src/utils/serverErrors";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import Check from "~icons/ep/check";
import RefreshLeft from "~icons/ep/refresh-left";

/** 请假状态语义色兜底（字典 leave_status 未配 color 时使用） */
const LEAVE_STATUS_TAG_TYPE: Record<string, StatusTagType> = {
  DRAFT: "info",
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "info"
};

/** labeled_choice 可能是 {value,label,color} 或裸字符串 */
const statusOf = (row: Record<string, unknown>) => {
  const status = row?.status;
  return status && typeof status === "object"
    ? String((status as { value?: string }).value ?? "")
    : String(status ?? "");
};

/** 可重新提交的状态（草稿 / 已驳回 / 已撤回） */
const RESUBMITTABLE = ["DRAFT", "REJECTED", "CANCELLED"];

/**
 * 请假申请页：RePlusPage 元数据驱动列表 + 申请人侧「提交 / 撤回」。
 *
 * 审批动作不在本页：审批人统一在「流程审批」中心处理，避免出现第二套审批入口；
 * 本页只展示审批进度（当前节点 / 驳回原因），点击详情可看到流程轨迹。
 */
export function useLeave(
  tableRef: Ref,
  statsRef?: Ref<{ refresh: () => void } | null>
) {
  const api = reactive(leaveApi);
  const auth = usePageAuth(["submit", "cancel"]);
  const { t } = useI18n();
  const confirm = useConfirm();

  // 状态列 / 操作按钮 / 统计卡随业务单状态联动（提交 → 审批中、撤回 → 已撤回）
  const refresh = () => {
    tableRef.value?.handleGetData();
    statsRef?.value?.refresh();
  };

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
    // 200 + 业务码非 1000（已在审批中 / 区间冲突 / 未配置流程等）：全局拦截器只处理
    // HTTP 层错误，业务失败必须显式展示后端 detail，否则用户点击后完全无反馈
    message(String(res.detail || t("results.failed")), { type: "error" });
  };

  const operationButtonsProps = shallowRef<OperationProps>({
    // showNumber 6：内置 编辑/删除/查看 + 本页 提交审批/撤回 同排展示，
    // 否则超出默认 3 个会被折叠进「更多」下拉（用例与用户都要多点一次）
    width: 300,
    showNumber: 6,
    buttons: [
      {
        code: "submit",
        text: t("leaveApply.submit"),
        props: { type: "primary", link: true, icon: useRenderIcon(Check) },
        // 排序索引避开内置按钮（编辑 -30 / 删除 -20 / 详情 -10 / 变更历史 -5）：
        // 与「删除」同索引时两者先后不确定
        show: (row: Record<string, unknown>) =>
          auth.submit && RESUBMITTABLE.includes(statusOf(row)) && -25,
        onClick: ({ row }) =>
          confirmAndRun(
            row as Record<string, unknown>,
            "submitConfirm",
            pk => api.submit(pk),
            "submitSuccess"
          )
      },
      {
        code: "cancel",
        text: t("leaveApply.cancel"),
        props: {
          type: "warning",
          link: true,
          icon: useRenderIcon(RefreshLeft)
        },
        show: (row: Record<string, unknown>) =>
          auth.cancel && statusOf(row) === "PENDING" && -15,
        onClick: ({ row }) =>
          confirmAndRun(
            row as Record<string, unknown>,
            "cancelConfirm",
            pk => api.cancel(pk),
            "cancelSuccess"
          )
      }
    ]
  });

  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      leave_type: column => {
        column.cellRenderer = ({ row }) => {
          const raw = row.leave_type;
          if (raw === null || raw === undefined || raw === "") return "—";
          if (typeof raw === "string") return raw;
          const item = raw as { label?: string; color?: string };
          return h(
            ElTag,
            item.color ? { color: item.color, style: SOLID_TAG_STYLE } : {},
            () => item.label ?? "—"
          );
        };
      },
      status: column => {
        column.cellRenderer = ({ row }) =>
          h(
            ElTag,
            statusTagProps(row.status, LEAVE_STATUS_TAG_TYPE),
            () =>
              (row.status as { label?: string })?.label ??
              t(`leaveApply.status${statusOf(row)}`)
          );
      },
      current_node_name: column => {
        column.cellRenderer = ({ row }) =>
          row.current_node_name ||
          (statusOf(row) === "REJECTED" ? t("leaveApply.rejectedTip") : "—");
      }
    });

  const addOrEditOptions = shallowRef<RePlusPageProps["addOrEditOptions"]>({
    props: {
      columns: {
        // 事由用多行输入（后端是 CharField，默认渲染单行）
        reason: ({ column }) => {
          column.valueType = "textarea";
          column["fieldProps"] = {
            ...(column["fieldProps"] ?? {}),
            autosize: { minRows: 3 }
          };
          return column;
        },
        // 天数支持半天步进（后端 DecimalField 1 位小数）
        days: ({ column }) => {
          column.valueType = "input-number";
          column["fieldProps"] = {
            ...(column["fieldProps"] ?? {}),
            min: 0.5,
            step: 0.5,
            precision: 1
          };
          return column;
        },
        start_date: ({ column }) => {
          column.fieldProps = {
            ...(column["fieldProps"] ?? {}),
            valueFormat: "YYYY-MM-DD"
          };
          return column;
        },
        end_date: ({ column }) => {
          column.fieldProps = {
            ...(column["fieldProps"] ?? {}),
            valueFormat: "YYYY-MM-DD"
          };
          return column;
        }
      },
      saveCallback: ({
        formData,
        done,
        closeLoading,
        formRef,
        setActiveName,
        success: notifySuccess,
        failed: notifyFailed
      }) => {
        // 新增即提交：成功 / 已存草稿 / 失败三种口径分别提示（覆盖框架默认保存回调）
        handleOperation({
          t,
          showSuccessMsg: false,
          showFailedMsg: false,
          apiReq: leaveApi.create(formData),
          success: res => {
            refresh();
            notifySuccess(String(res?.detail || t("leaveApply.submitSuccess")));
          },
          failed: res => {
            if (res?.code === LEAVE_DRAFT_SAVED_CODE) {
              // 已存草稿：既非成功也非失败，黄色警示避免误当已提交；关闭表单并刷新列表
              message(String(res?.detail || t("leaveApply.savedAsDraft")), {
                type: "warning"
              });
              closeLoading();
              done();
              refresh();
              return;
            }
            notifyFailed(String(res?.detail || t("results.failed")));
            applyServerErrors(formRef, res?.errors, {
              activateTab: setActiveName
            });
          },
          exception: err => {
            // 校验失败（HTTP 400）：提示由拦截器统一处理，错误内联到表单项
            applyServerErrors(formRef, err?.errors, {
              activateTab: setActiveName
            });
          }
        });
      },
      minWidth: "560px"
    }
  });

  return {
    api,
    auth,
    operationButtonsProps,
    listColumnsFormat,
    addOrEditOptions
  };
}
