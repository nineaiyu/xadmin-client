import { onMounted, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import type { RePlusPageProps } from "./types";
import { useBaseColumns } from "./columns";
import { usePlusPageColumns } from "./usePlusPageColumns";
import { usePlusPageData } from "./usePlusPageData";
import { usePlusPageForm } from "./usePlusPageForm";
import { usePlusPageButtons } from "./usePlusPageButtons";
import { useTableSort } from "./useTableSort";
import { usePlusPageState } from "./usePlusPageState";

/** RePlusPage 视图组装入口（行为与返回契约不变）：六个子 hook 的接线 */
export function usePlusPage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Vue EmitFn 交叉类型在参数逆变下需 any 才能收宽
  emit: (...args: any[]) => void,
  tableRef: Ref,
  props: RePlusPageProps
) {
  const { immediate, localeName } = props;

  const route = useRoute();
  const { t, te } = useI18n();
  const baseCols = useBaseColumns(localeName ?? "");
  const { listColumns, searchColumns } = baseCols;

  const state = usePlusPageState({
    props,
    emit,
    tableRef,
    route,
    t,
    te,
    listColumns
  });
  const { switchLoadMap, routeParams, ...viewState } = state;

  // 列表列渲染：操作列需要按钮集合，而 buttons 子 hook 依赖 data/form 的动作，
  // 故经 getter 延迟取值（formatColumnsRender 仅在挂载后执行，无初始化顺序风险）
  const { formatColumnsRender } = usePlusPageColumns({
    props,
    t,
    te,
    ...baseCols,
    switchLoadMap,
    getOperationButtons: () => buttons.operationButtons.value
  });

  // 请求与分页（数据与分页态取自视图状态容器）
  const {
    handleReset,
    handleSearch,
    handleSizeChange,
    handleCurrentChange,
    handleGetData,
    getPageColumn
  } = usePlusPageData({
    props,
    emit,
    t,
    ...viewState,
    routeParams,
    getColumnData: baseCols.getColumnData,
    searchDefaultValue: baseCols.searchDefaultValue,
    columnsInitCallback: formatColumnsRender
  });

  // 表头排序：与搜索区 ordering 同源（未声明 sortable 的页面零变化）
  const { handleSortChange } = useTableSort({
    ...viewState,
    tableRef,
    handleGetData
  });

  // 表单与详情（pageTitle / selectedNum / onSelectionCancel / getSelectPks 取自视图状态）
  const { handleAddOrEdit, handleDetail, handleDelete, handleManyDelete } =
    usePlusPageForm({
      props,
      t,
      ...baseCols,
      ...viewState,
      handleGetData
    });

  // 默认按钮组
  const buttons = usePlusPageButtons({
    props,
    t,
    treeProps: state.treeProps,
    searchFields: state.searchFields,
    handleGetData,
    getSelectPks: state.getSelectPks,
    handleAddOrEdit,
    handleDelete,
    handleDetail
  });

  onMounted(() => getPageColumn(!!immediate));

  return {
    t,
    ...viewState,
    listColumns,
    searchColumns,
    tableBarButtons: buttons.tableBarButtons,
    operationButtons: buttons.operationButtons,
    handleReset,
    handleSearch,
    getPageColumn,
    handleGetData,
    handleAddOrEdit,
    handleManyDelete,
    handleSizeChange,
    handleCurrentChange,
    handleSortChange
  };
}
