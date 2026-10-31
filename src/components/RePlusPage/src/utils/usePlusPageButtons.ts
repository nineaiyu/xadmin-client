import type { Ref } from "vue";
import { computed } from "vue";
import type { useI18n } from "vue-i18n";
import type { RePlusPageProps } from "./types";
// 导入顺序有语义：工具栏模块（经 ./handle）先于操作列模块（经 ./handle-history）
// 求值，与拆分前的单文件顺序一致。倒序会让 handle-history 链路先拉起 api/base
// 与 store/notice 的环，单测在模块求值期报 "Class extends value undefined"。
import { buildDefaultToolbarButtons } from "./plusPageToolbarButtons";
import { buildDefaultOperationButtons } from "./plusPageOperationButtons";
import { useViewedRowBinding } from "./useViewedRowBinding";

type TFunction = ReturnType<typeof useI18n>["t"];

type TreeProps = Ref<{
  hasChildren: string;
  children: string;
  checkStrictly: boolean;
}>;

/**
 * 默认按钮组：操作列（编辑/变更历史/删除/详情）与工具栏（父子联动/新增/导入/导出）。
 * 按钮声明见 plusPageOperationButtons.ts / plusPageToolbarButtons.ts，
 * 本文件负责与页面自定义按钮合并。
 */
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
  handleDetail: (row: Record<string, unknown>) => void | Promise<void>;
}) {
  // 默认按钮的页面级开关：页面用自有面板承载详情/记录时逐项收敛，
  // 未声明时保持原行为（按钮按权限点显隐）
  // 编辑按钮与 boolean 列内联开关共用 auth.partialUpdate/update 位：
  // 页面只要自有编辑弹窗、但要保留内联开关时，须用 hideEdit 而非关权限位

  // 表格已读行（默认关）：操作命中后标记行已读（行类 is-viewed）
  const {
    rowClassName: viewedRowClassName,
    onRowAction,
    wrapButtons
  } = useViewedRowBinding(props);

  const operationButtons = computed(() => {
    const operationProps = props.operationButtonsProps;
    return [
      ...buildDefaultOperationButtons({
        t,
        api: props.api,
        auth: props.auth,
        hideEdit: operationProps?.hideEdit === true,
        editAllowed: operationProps?.editAllowed,
        hideDetail: operationProps?.hideDetail === true,
        hideChangeHistory: operationProps?.hideChangeHistory === true,
        hasDetailFetch: Boolean(props.detailRowFetch),
        handleAddOrEdit,
        handleDelete,
        handleDetail,
        onRowAction
      }),
      ...wrapButtons(operationProps?.buttons ?? [])
    ];
  });

  const tableBarButtons = computed(() => {
    return [
      ...buildDefaultToolbarButtons({
        t,
        api: props.api,
        auth: props.auth,
        isTree: props.isTree,
        treeProps,
        searchFields,
        allowAsyncExport: props.allowAsyncExport,
        getSelectPks,
        handleGetData,
        handleAddOrEdit
      }),
      ...(props.tableBarButtonsProps?.buttons ?? [])
    ];
  });

  return { operationButtons, tableBarButtons, viewedRowClassName };
}
