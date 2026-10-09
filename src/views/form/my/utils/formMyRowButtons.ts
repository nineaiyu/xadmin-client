import { shallowRef } from "vue";
import type { OperationProps } from "@/components/RePlusPage";
import type { SubmissionItem } from "@/api/dataset/dform";
import type { RecordType } from "plus-pro-components";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 提交状态（审批回写）取值 */
const statusOf = (row: unknown) => (row as SubmissionItem).status?.value ?? "";

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
  };
  actions: {
    openDetail: (row: SubmissionItem) => void;
    openEdit: (row: SubmissionItem) => void;
    submitDraft: (row: SubmissionItem) => void;
    resubmit: (row: SubmissionItem) => void;
    remove: (row: SubmissionItem) => void;
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
        show: (row: RecordType) => flags.canEdit && statusOf(row) !== "PENDING",
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
        text: t("dform.delete"),
        code: "my-delete",
        props: { type: "danger", link: true },
        index: -10,
        show: (row: RecordType) =>
          flags.canDestroy && statusOf(row) !== "PENDING",
        onClick: ({ row }) => actions.remove(row as SubmissionItem)
      }
    ]
  });

  return { operationButtonsProps };
}
