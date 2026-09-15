import type { Ref } from "vue";
import { computed, shallowRef } from "vue";
import type { useI18n } from "vue-i18n";
import type { OperationButtonsRow } from "@/components/RePlusPage";
import type { RePlusPageProps } from "./types";
import { handleExportData, handleImportData } from "./handle";
import { handleShowChangeHistory } from "./handle-history";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";

import View from "~icons/ep/view";
import Delete from "~icons/ep/delete";
import Upload from "~icons/ep/upload";
import Download from "~icons/ep/download";
import EditPen from "~icons/ep/edit-pen";
import AddFill from "~icons/ri/add-circle-line";
import FileList from "~icons/ri/file-list-3-line";

type TFunction = ReturnType<typeof useI18n>["t"];

type TreeProps = Ref<{
  hasChildren: string;
  children: string;
  checkStrictly: boolean;
}>;

/** 默认按钮组：操作列（编辑/变更历史/删除/详情）与工具栏（父子联动/新增/导入/导出）（拆分自 hook.tsx，行为不变） */
export function usePlusPageButtons({
  props,
  t,
  treeProps,
  searchFields,
  handleGetData,
  getSelectPks,
  handleAddOrEdit,
  handleDelete,
  handleDetail
}: {
  props: RePlusPageProps;
  t: TFunction;
  treeProps: TreeProps;
  searchFields: Ref<{ size?: number; page?: number }>;
  handleGetData: (queryParams?: object) => void;
  getSelectPks: (key?: string) => (string | number)[];
  handleAddOrEdit: (isAdd?: boolean, row?: Record<string, unknown>) => void;
  handleDelete: (
    row: { pk?: string | number; id?: string | number },
    requestEnd?: (options?: object) => void
  ) => void;
  handleDetail: (row: Record<string, unknown>) => void;
}) {
  const {
    api,
    auth,
    isTree,
    allowAsyncExport,
    operationButtonsProps,
    tableBarButtonsProps
  } = props;

  // 默认操作按钮
  const defaultOperationButtons = shallowRef<OperationButtonsRow[]>([]);
  defaultOperationButtons.value = [
    {
      text: t("buttons.edit"),
      code: "update",
      props: {
        type: "primary",
        icon: useRenderIcon(EditPen),
        link: true
      },
      onClick: ({ row }) => {
        handleAddOrEdit(false, row);
      },
      show: auth.partialUpdate || auth.update ? -30 : false
    },
    {
      text: t("buttons.delete"),
      code: "delete",
      confirm: { title: t("buttons.confirmDelete") },
      props: {
        type: "danger",
        icon: useRenderIcon(Delete),
        link: true
      },
      onClick: ({ row, loading }) => {
        loading.value = true;
        handleDelete(row, () => {
          loading.value = false;
        });
      },
      show: auth.destroy ? -20 : false
    },
    {
      code: "detail",
      props: {
        type: "primary",
        icon: useRenderIcon(View),
        link: true,
        // icon-only 按钮：tooltip 不产生可编程可访问名（axe button-name critical），
        // 必须显式提供 aria-label（种子/演示数据让列表有行后，a11y 扩面扫描即暴露）；
        // 键名用 "aria-label" 字符串：ariaLabel 驼峰透传到 DOM 会丢失连字符而失效
        "aria-label": t("buttons.detail")
      },
      onClick: ({ row }) => {
        handleDetail(row);
      },
      tooltip: { content: t("buttons.detail") },
      show: auth.list || auth.retrieve ? -10 : false
    },
    {
      text: t("buttons.changeHistory"),
      code: "changeHistory",
      props: {
        type: "info",
        icon: useRenderIcon(FileList),
        link: true
      },
      onClick: ({ row }) => {
        handleShowChangeHistory({ t, api, row });
      },
      tooltip: { content: t("buttons.changeHistory") },
      // 页面在 getDefaultAuths 中声明 changeHistory 且菜单授予
      // changeHistory:<ComponentName> 权限码时显示（用户管理页已开启示范）
      show: auth.changeHistory ? -5 : false
    }
  ];

  const operationButtons = computed(() => {
    return [
      ...defaultOperationButtons.value,
      ...(operationButtonsProps?.buttons ?? [])
    ];
  });

  // 默认tableBar按钮
  const defaultTableBarButtons = shallowRef<OperationButtonsRow[]>([]);

  defaultTableBarButtons.value = [
    {
      text: computed(() =>
        treeProps.value.checkStrictly
          ? t("buttons.checkUnStrictly")
          : t("buttons.checkStrictly")
      ),
      code: "checkStrictly",
      props: {
        type: "success",
        plain: true
      },
      onClick: () => {
        treeProps.value.checkStrictly = !treeProps.value.checkStrictly;
      },
      show: isTree ? -30 : false
    },
    {
      text: t("buttons.add"),
      code: "create",
      props: {
        type: "primary",
        icon: useRenderIcon(AddFill)
      },
      onClick: ({ row }) => {
        handleAddOrEdit(true, row);
      },
      show: auth.create ? -30 : false
    },
    {
      code: "export",
      props: {
        type: "primary",
        icon: useRenderIcon(Download),
        plain: true
      },
      onClick: () => {
        const pks = getSelectPks();
        handleExportData({
          t,
          pks,
          api,
          searchFields,
          // 未显式设置时按页面导出权限自动显示异步开关（与导出按钮同源判定），
          // 保证所有支持导出的页面都提供大数据量异步导出入口
          allowAsync: allowAsyncExport ?? Boolean(auth.exportData)
        });
      },
      tooltip: { content: t("exportImport.export") },
      show: auth.exportData ? -20 : false
    },
    {
      code: "import",
      props: {
        type: "primary",
        icon: useRenderIcon(Upload),
        plain: true
      },
      onClick: () => {
        handleImportData({
          t,
          api,
          success: () => {
            handleGetData();
          }
        });
      },
      tooltip: { content: t("exportImport.import") },
      show: auth.importData ? -10 : false
    }
  ];

  const tableBarButtons = computed(() => {
    return [
      ...defaultTableBarButtons.value,
      ...(tableBarButtonsProps?.buttons ?? [])
    ];
  });

  return { operationButtons, tableBarButtons };
}
