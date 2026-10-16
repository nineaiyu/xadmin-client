import { computed, ref, type Ref } from "vue";
import { isEmpty } from "@pureadmin/utils";
import { createTablePagination } from "./plusPagePagination";
import { createSelectionHelpers } from "./plusPageSelection";
import type { PageColumn, RePlusPageProps } from "./types";
import type { useI18n } from "vue-i18n";
import type { RouteLocationNormalizedLoaded } from "vue-router";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 表格栏变更载荷（列集合 / 尺寸 / 渲染类名） */
type TableBarData = {
  size: string;
  dynamicColumns: PageColumn[];
  renderClass: string[];
};

/**
 * RePlusPage 视图状态容器（自 hook.tsx 抽出）：列表数据 / 加载态 / 树配置 /
 * 分页（见 plusPagePagination.ts）/ 选择态与表格栏尺寸变更。
 */
export function usePlusPageState({
  props,
  emit,
  tableRef,
  route,
  t,
  te,
  listColumns
}: {
  props: RePlusPageProps;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- EmitFn 交叉类型在参数逆变下需 any 才能收宽
  emit: (...args: any[]) => void;
  tableRef: Ref;
  route: RouteLocationNormalizedLoaded;
  t: TFunction;
  te: (key: string) => boolean;
  listColumns: Ref<PageColumn[]>;
}) {
  const { isTree } = props;

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

  const tablePagination = createTablePagination(props);
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

  const tableBarData = ref<TableBarData>({
    size: "default",
    dynamicColumns: listColumns.value,
    renderClass: []
  });

  const handleTableBarChange = ({
    dynamicColumns,
    size,
    renderClass
  }: TableBarData) => {
    tableBarData.value.dynamicColumns = dynamicColumns;
    tableBarData.value.size = size;
    tableBarData.value.renderClass = renderClass;
    tablePagination.value.size = size as typeof tablePagination.value.size;
  };

  const handleFullscreen = () => {
    tableRef.value.setAdaptive();
  };

  const { handleSelectionChange, onSelectionCancel, getSelectPks } =
    createSelectionHelpers({ emit, tableRef, selectedNum });

  return {
    dataList,
    loadingStatus,
    treeProps,
    selectedNum,
    defaultValue,
    switchLoadMap,
    routeParams,
    tablePagination,
    searchFields,
    pageTitle,
    tableBarData,
    handleTableBarChange,
    handleFullscreen,
    handleSelectionChange,
    onSelectionCancel,
    getSelectPks
  };
}
