import { shallowRef } from "vue";
import type { OperationProps } from "@/components/RePlusPage";
import type { SubmissionItem } from "@/api/dataset/dform";
import type { RecordType } from "plus-pro-components";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 提交状态（审批回写）取值 */
const statusOf = (row: unknown) => (row as SubmissionItem).status?.value ?? "";

/**
 * 可编辑 / 可删除的状态：仅草稿与驳回态。
 * 审批中（PENDING）按流程快照推进，终态（APPROVED / CANCELLED）是审批留痕，
 * 两者都只读——后端 `_creator_guard` 同口径拒绝，前端不再渲染入口。
 */
const EDITABLE_STATUSES = new Set(["DRAFT", "REJECTED"]);
const isEditable = (row: RecordType) => EDITABLE_STATUSES.has(statusOf(row));

/**
 * 我的填报行操作（自 useFormMyColumns.ts 抽出）：行操作全部自定义
 * （详情/编辑/提交/重新提交/删除），故关闭框架默认的编辑与删除按钮；
 * 导出沿用框架工具栏默认按钮。
 */
export function useFormMyRowButtons({
  t,
  flags,
  actions
}: {
  t: TFunction;
  flags: {
    canEdit: boolean;
    canDestroy: boolean;
    canResubmit: boolean;
    canSubmit: boolean;
    canCancel: boolean;
  };
  actions: {
    openDetail: (row: SubmissionItem) => void;
    openEdit: (row: SubmissionItem) => void;
    submitDraft: (row: SubmissionItem) => void;
    resubmit: (row: SubmissionItem) => void;
    remove: (row: SubmissionItem) => void;
    cancel: (row: SubmissionItem) => void;
  };
}) {
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
        index: -50,
        show: true,
        onClick: ({ row }) => actions.openDetail(row as SubmissionItem)
      },
      {
        text: (row: RecordType) =>
          statusOf(row) === "DRAFT" ? t("dform.continueEdit") : t("dform.edit"),
        code: "my-edit",
        props: { type: "primary", link: true },
        index: -40,
        show: (row: RecordType) => flags.canEdit && isEditable(row),
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
        index: -30,
        show: (row: RecordType) => flags.canSubmit && statusOf(row) === "DRAFT",
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
        index: -20,
        show: (row: RecordType) =>
          flags.canResubmit && statusOf(row) === "REJECTED",
        onClick: ({ row }) => actions.resubmit(row as SubmissionItem)
      },
      {
        text: t("dform.withdraw"),
        code: "my-withdraw",
        props: { type: "warning", link: true },
        index: -15,
        show: (row: RecordType) =>
          flags.canCancel &&
          statusOf(row) === "PENDING" &&
          Boolean(row.instance),
        onClick: ({ row }) => actions.cancel(row as SubmissionItem)
      },
      {
        text: t("dform.delete"),
        code: "my-delete",
        props: { type: "danger", link: true },
        index: -10,
        show: (row: RecordType) => flags.canDestroy && isEditable(row),
        onClick: ({ row }) => actions.remove(row as SubmissionItem)
      }
    ]
  });

  return { operationButtonsProps };
}
