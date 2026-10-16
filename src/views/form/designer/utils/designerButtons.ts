import { shallowRef } from "vue";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import SchemaHistoryDialog from "../components/SchemaHistoryDialog.vue";
import { h } from "vue";
import type { DynamicFormItem } from "@/api/dataset/dform";
import type { OperationProps } from "@/components/RePlusPage";
import type { Ref } from "vue";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 「版本」入口：schema 历史查看与回滚（行级主键可用，独立于设计器弹窗） */
export function createHistoryOpener({
  t,
  tableRef,
  canRollback
}: {
  t: TFunction;
  tableRef: Ref;
  canRollback: boolean;
}) {
  return (row: DynamicFormItem) => {
    addDialog({
      title: t("dform.historyTitle", { name: row.name }),
      width: dialogSize("lg"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      hideFooter: true,
      contentRenderer: () =>
        h(SchemaHistoryDialog, {
          row,
          canRollback,
          onDone: () => tableRef.value?.handleGetData()
        })
    });
  };
}

/** 表单设计按钮装配（自 hook.tsx 抽出）：行内（编辑/版本/存为模板）+ 工具栏（新建/从模板新建） */
export function useDesignerButtons({
  t,
  flags,
  actions
}: {
  t: TFunction;
  flags: {
    canCreate: boolean;
    canEdit: boolean;
    canHistory: boolean;
  };
  actions: {
    openDialog: (row: DynamicFormItem | null) => void;
    openHistory: (row: DynamicFormItem) => void;
    saveAsTemplate: (row: DynamicFormItem) => void;
    openTemplatePicker: () => void;
  };
}) {
  const operationButtonsProps = shallowRef<OperationProps>({
    // 5 个按钮（框架「查看/删除」+ 编辑/版本/存为模板）全部内联，避免折叠进「更多」
    showNumber: 5,
    width: 320,
    buttons: [
      {
        text: t("dform.edit"),
        code: "edit",
        props: { type: "primary", link: true },
        onClick: ({ row }) => actions.openDialog(row as DynamicFormItem),
        // 非创建者行不显示编辑（保存会被后端守卫拒绝）
        index: 20,
        show: row => flags.canEdit && row?.is_owner !== false
      },
      {
        text: t("dform.history"),
        code: "history",
        props: { type: "primary", link: true },
        onClick: ({ row }) => actions.openHistory(row as DynamicFormItem),
        index: 15,
        show: flags.canHistory
      },
      {
        text: t("dform.saveAsTemplate"),
        code: "template",
        props: { type: "primary", link: true },
        onClick: ({ row }) => actions.saveAsTemplate(row as DynamicFormItem),
        index: 10,
        show: flags.canCreate
      }
    ]
  });

  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        text: t("dform.create"),
        code: "create",
        props: { type: "primary" },
        onClick: () => actions.openDialog(null),
        show: flags.canCreate
      },
      {
        text: t("dform.fromTemplate"),
        code: "fromTemplate",
        props: { type: "primary", plain: true },
        onClick: actions.openTemplatePicker,
        show: flags.canCreate
      }
    ]
  });

  return { operationButtonsProps, tableBarButtonsProps };
}
