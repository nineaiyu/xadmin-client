import { computed, onMounted, ref, type Ref } from "vue";
import { getKeyList, isEmpty } from "@pureadmin/utils";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import type { RePlusPageProps } from "./types";
import { useBaseColumns } from "./columns";
import { usePlusPageColumns } from "./usePlusPageColumns";
import { usePlusPageData } from "./usePlusPageData";
import { usePlusPageForm } from "./usePlusPageForm";
import { usePlusPageButtons } from "./usePlusPageButtons";

/**
 * RePlusPage 视图组装入口（拆分自 720 行单体，行为与返回契约不变）：
 * - usePlusPageColumns 列表列渲染（开关列、多选/操作列注入、三类列格式化出口）
 * - usePlusPageData    请求与分页（搜索字段装配、请求序号防过期、首开元数据编排）
 * - usePlusPageForm    表单与详情（新增/编辑、脱敏原文回取、详情、删除）
 * - usePlusPageButtons 默认操作列与工具栏按钮组
 */
export function usePlusPage(
  emit: (event: string, ...args: unknown[]) => void,
  tableRef: Ref,
  props: RePlusPageProps
) {
  const { isTree, immediate, pagination, localeName } = props;

  const route = useRoute();
  const { t, te } = useI18n();
  const dataList = ref([]);
  const loadingStatus = ref(false);
  // 显式对齐 @pureadmin/table 的 treeProps 期望形状（其 default 字面量类型三字段全必填）
  const treeProps = ref<{
    hasChildren: string;
    children: string;
    checkStrictly: boolean;
  }>({
    hasChildren: "hasChildren",
    children: "children",
    checkStrictly: isTree ?? false
  });
  const selectedNum = ref(0);
  const defaultValue = ref({});
  const switchLoadMap = ref({});
  const routeParams = isEmpty(route.params) ? route.query : route.params;
  const defaultPagination: RePlusPageProps["pagination"] = {
    total: 0,
    pageSize: 15,
    currentPage: 1,
    pageSizes: [5, 10, 15, 30, 50, 100],
    background: true,
    size: "default"
  };
  if (isTree) {
    defaultPagination.pageSize = 1000;
    defaultPagination.pageSizes = [100, 500, 1000];
  }
  const tablePagination = ref<RePlusPageProps["pagination"]>({
    ...defaultPagination,
    ...pagination
  });
  const {
    listColumns,
    detailColumns,
    searchColumns,
    getColumnData,
    addOrEditRules,
    addOrEditColumns,
    searchDefaultValue,
    addOrEditDefaultValue
  } = useBaseColumns(localeName);
  const searchFields = ref({
    size: tablePagination.value.pageSize,
    page: tablePagination.value.currentPage
  });

  const pageTitle = computed(() => {
    if (te(route.meta.title)) {
      return t(route.meta.title);
    }
    return route.meta.title;
  });

  const tableBarData = ref({
    size: "default",
    dynamicColumns: listColumns.value,
    renderClass: []
  });

  const handleTableBarChange = ({ dynamicColumns, size, renderClass }) => {
    tableBarData.value.dynamicColumns = dynamicColumns;
    tableBarData.value.size = size;
    tableBarData.value.renderClass = renderClass;
    tablePagination.value.size = size;
  };

  const handleFullscreen = () => {
    tableRef.value.setAdaptive();
  };

  const handleSelectionChange = val => {
    selectedNum.value = val.length;
    emit("selectionChange", tableRef.value.getTableRef().getSelectionRows());
  };

  const onSelectionCancel = () => {
    selectedNum.value = 0;
    tableRef.value.getTableRef().clearSelection();
  };

  const getSelectPks = (key = "pk") => {
    const manySelectData = tableRef.value.getTableRef().getSelectionRows();
    return getKeyList(manySelectData, key);
  };

  // 列表列渲染：操作列需要按钮集合，而 buttons 子 hook 依赖 data/form 的动作，
  // 故经 getter 延迟取值（formatColumnsRender 仅在挂载后执行，无初始化顺序风险）
  const { formatColumnsRender } = usePlusPageColumns({
    props,
    t,
    te,
    listColumns,
    detailColumns,
    searchColumns,
    addOrEditRules,
    addOrEditColumns,
    searchDefaultValue,
    addOrEditDefaultValue,
    switchLoadMap,
    getOperationButtons: () => buttons.operationButtons.value
  });

  // 请求与分页
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
    routeParams,
    dataList,
    loadingStatus,
    searchFields,
    defaultValue,
    tablePagination,
    getColumnData,
    searchDefaultValue,
    columnsInitCallback: formatColumnsRender
  });

  // 表单与详情
  const { handleAddOrEdit, handleDetail, handleDelete, handleManyDelete } =
    usePlusPageForm({
      props,
      t,
      pageTitle,
      detailColumns,
      addOrEditColumns,
      addOrEditRules,
      addOrEditDefaultValue,
      selectedNum,
      onSelectionCancel,
      getSelectPks,
      handleGetData
    });

  // 默认按钮组
  const buttons = usePlusPageButtons({
    props,
    t,
    treeProps,
    searchFields,
    handleGetData,
    getSelectPks,
    handleAddOrEdit,
    handleDelete,
    handleDetail
  });

  onMounted(() => {
    getPageColumn(immediate);
  });

  return {
    t,
    dataList,
    pageTitle,
    treeProps,
    listColumns,
    selectedNum,
    defaultValue,
    tableBarData,
    searchFields,
    searchColumns,
    loadingStatus,
    tablePagination,
    tableBarButtons: buttons.tableBarButtons,
    operationButtons: buttons.operationButtons,
    handleReset,
    handleSearch,
    getSelectPks,
    getPageColumn,
    handleGetData,
    handleAddOrEdit,
    handleManyDelete,
    handleSizeChange,
    handleFullscreen,
    onSelectionCancel,
    handleCurrentChange,
    handleTableBarChange,
    handleSelectionChange
  };
}
