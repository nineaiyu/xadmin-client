import { h, shallowRef } from "vue";
import { ElTag } from "element-plus";
import { statusTagProps } from "@/utils/dict";
import { SUBMISSION_STATUS_TAG_TYPE } from "@/views/form/utils/submissionStatus";
import type { OperationProps, PageTableColumn } from "@/components/RePlusPage";
import type { RecordType } from "plus-pro-components";
import type { SubmissionItem } from "@/api/dataset/dform";
import { submissionDataText } from "./submissionData";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 提交状态（审批回写）语义色兜底：字典未配 color 时按审批结果取 EP 语义色，
 * tag props 统一经 `statusTagProps`（与列表/详情同口径，禁止页面自建映射函数） */
const asRow = (row: unknown) => row as SubmissionItem;
const statusOf = (row: unknown) => asRow(row).status?.value ?? "";

/**
 * 我的填报列渲染：状态列语义色 tag、提交数据摘要列、搜索区裁剪与行操作按钮。
 * 行为动作（详情/编辑/提交/重新提交/删除）由 useFormMyActions 提供，注入装配。
 */
export function useFormMyColumns({
  t,
  canEdit,
  canDestroy,
  canResubmit,
  canSubmit,
  actions
}: {
  t: TFunction;
  canEdit: boolean;
  canDestroy: boolean;
  canResubmit: boolean;
  canSubmit: boolean;
  actions: {
    openDetail: (row: SubmissionItem) => void;
    openEdit: (row: SubmissionItem) => void;
    submitDraft: (row: SubmissionItem) => void;
    resubmit: (row: SubmissionItem) => void;
    remove: (row: SubmissionItem) => void;
  };
}) {
  /** 状态列：字典色优先、缺省按状态语义兜底；无状态（无需审批）不留空 */
  const renderStatus = (row: SubmissionItem) => {
    const status = row.status;
    if (!status?.value) {
      return h(
        "span",
        { class: "text-xs text-(--el-text-color-secondary)" },
        t("dform.noApprovalNeeded")
      );
    }
    return h(
      ElTag,
      {
        size: "small",
        "data-testid": "submission-status-tag",
        ...statusTagProps(status, SUBMISSION_STATUS_TAG_TYPE)
      },
      () => status.label
    );
  };

  const listColumnsFormat = (columns: PageTableColumn[]) => {
    const formatted: PageTableColumn[] = [];
    columns.forEach(column => {
      const key = column._column?.key as string;
      // 个人页不展示提交人列（全部为本人），减少噪声
      if (key === "creator") return;
      if (key === "status") {
        column["width"] = 120;
        column["cellRenderer"] = ({ row }) =>
          renderStatus(row as SubmissionItem);
      }
      if (key === "created_time") column["width"] = 170;
      formatted.push(column);
      if (key === "form_name") {
        // 提交数据摘要列：后端 table_fields 不含 data，由页面注入
        formatted.push({
          _column: { key: "data" },
          label: t("dform.submissionData"),
          minWidth: 240,
          cellRenderer: ({ row }: { row: RecordType }) =>
            h(
              "span",
              { class: "text-xs" },
              submissionDataText((row as SubmissionItem).data ?? {})
            )
        } as PageTableColumn);
      }
    });
    return formatted;
  };

  /** 搜索区：提交人筛选对个人页无意义，移除 */
  const searchColumnsFormat = (columns: PageTableColumn[]) =>
    columns.filter(column => column._column?.key !== "creator");

  // 行操作全部自定义（详情/编辑/提交/重新提交/删除），故关闭框架默认的编辑与删除按钮；
  // 导出沿用框架工具栏默认按钮（api.exportData + 选中行/异步开关，由 auth.exportData 控制）
  const operationButtonsProps = shallowRef<OperationProps>({
    width: 320,
    showNumber: 5,
    hideDetail: true,
    buttons: [
      { code: "update", show: false },
      { code: "delete", show: false },
      {
        text: t("dform.detail"),
        code: "my-detail",
        props: {
          type: "primary",
          link: true,
          "data-testid": "submission-detail"
        },
        show: () => -50,
        onClick: ({ row }) => actions.openDetail(row as SubmissionItem)
      },
      {
        text: (row: RecordType) =>
          statusOf(row) === "DRAFT" ? t("dform.continueEdit") : t("dform.edit"),
        code: "my-edit",
        props: { type: "primary", link: true },
        show: (row: RecordType) =>
          canEdit && statusOf(row) !== "PENDING" ? -40 : false,
        onClick: ({ row }) => actions.openEdit(row as SubmissionItem)
      },
      {
        text: t("dform.submitDraft"),
        code: "my-submit",
        props: {
          type: "success",
          link: true,
          "data-testid": "submission-submit-draft"
        },
        show: (row: RecordType) =>
          canSubmit && statusOf(row) === "DRAFT" ? -30 : false,
        onClick: ({ row }) => actions.submitDraft(row as SubmissionItem)
      },
      {
        text: t("dform.resubmit"),
        code: "my-resubmit",
        props: {
          type: "primary",
          link: true,
          "data-testid": "submission-resubmit"
        },
        show: (row: RecordType) =>
          canResubmit && statusOf(row) === "REJECTED" ? -20 : false,
        onClick: ({ row }) => actions.resubmit(row as SubmissionItem)
      },
      {
        text: t("dform.delete"),
        code: "my-delete",
        props: { type: "danger", link: true },
        show: (row: RecordType) =>
          canDestroy && statusOf(row) !== "PENDING" ? -10 : false,
        onClick: ({ row }) => actions.remove(row as SubmissionItem)
      }
    ]
  });

  return { listColumnsFormat, searchColumnsFormat, operationButtonsProps };
}
