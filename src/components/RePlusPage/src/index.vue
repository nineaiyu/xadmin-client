<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref, watch, type Ref } from "vue";
import PureTable from "@pureadmin/table";
import { usePlusPage } from "./utils/hook";
import { RePlusPageProps, type RecycleBinColumn } from "./utils/types";
import ReRecycleBin from "./components/ReRecycleBin.vue";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { cloneDeep, deviceDetection, getKeyList } from "@pureadmin/utils";
import Delete from "~icons/ep/delete";
import { PlusSearch, type RecordType } from "plus-pro-components";
import type { ComponentSize } from "element-plus";
import type { BaseApi } from "@/api/base";

import ButtonOperation, {
  ButtonsCallBackParams
} from "./components/ButtonOperation";

defineOptions({ name: "RePlusPage" });

const props = withDefaults(defineProps<RePlusPageProps>(), {
  api: undefined,
  title: undefined,
  isTree: false,
  tableBar: true,
  localeName: "",
  selection: true,
  immediate: true,
  operation: true,
  searchResultFormat: undefined,
  listColumnsFormat: undefined,
  detailColumnsFormat: undefined,
  baseColumnsFormat: undefined,
  searchColumnsFormat: undefined,
  beforeSearchSubmit: undefined,
  auth: () => ({}),
  addOrEditOptions: () => ({}),
  pagination: () => ({}),
  pureTableProps: () => ({}),
  pureTableBarProps: () => ({}),
  plusSearchProps: () => ({}),
  plusDescriptionsProps: () => ({}),
  operationButtonsProps: () => ({}),
  tableBarButtonsProps: () => ({}),
  // undefined 时由 hook 按页面导出权限（auth.exportData）自动显示异步开关，false 可显式关闭
  allowAsyncExport: undefined
});
const emit = defineEmits<{
  /** 行点击：row 为动态接口数据行 */
  rowClick: [row: RecordType];
  /** 搜索完成：usePlusPage 内 handleGetData 发出的载荷 */
  searchComplete: [
    payload: {
      /** 路由参数（route.params / route.query） */
      routeParams: RecordType;
      /** 搜索字段响应式引用 */
      searchFields: Ref<RecordType>;
      /** 列表数据响应式引用 */
      dataList: Ref<RecordType[]>;
      /** 列表接口响应 */
      res: RecordType;
    }
  ];
  /** 多选变化：选中的数据行集合 */
  selectionChange: [rows: RecordType[]];
  tableBarClickAction: [data: ButtonsCallBackParams];
  operationClickAction: [data: ButtonsCallBackParams];
}>();

const tableRef = ref();
const rootRef = ref<HTMLElement>();

/**
 * 表格 adaptive 高度仅在挂载与窗口 resize 时测量：搜索区依赖后端字段元数据
 * 异步渲染、或用户展开/收起搜索行时，上方高度变化不会触发重测，过时的高度
 * 会把分页挤出视口造成页面级滚动条。观察根节点高度变化后重跑 setAdaptive
 * （表格自身高度变化会再触发一次观察，但重算结果一致，随后自然收敛）。
 */
let rootResizeObserver: ResizeObserver | undefined;

onMounted(() => {
  const el = rootRef.value;
  if (!el || typeof ResizeObserver === "undefined") return;
  rootResizeObserver = new ResizeObserver(() => {
    tableRef.value?.setAdaptive();
  });
  rootResizeObserver.observe(el);
});

onUnmounted(() => {
  rootResizeObserver?.disconnect();
  cancelAnimationFrame(layoutRaf);
});

const {
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
  tableBarButtons,
  operationButtons,
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
} = usePlusPage(emit, tableRef, props);

/**
 * pure-table 的 treeProps 期望三字段全必填的形状（其 default 字面量类型），
 * 模板层对 setup ref 的类型展开会丢失 checkStrictly，经由此处显式签名传递。
 */
/** 搜索列类型变化（select/date-picker 等）后自动触发查询（模板内联类型注解会触发 eslint 解析错误，改 script 函数） */
const onSearchColumnChange = (_: unknown, column: { valueType?: string }) => {
  const canChangeType = ["select", "date-picker", "time-picker", "time-select"];
  if (canChangeType.indexOf(column.valueType ?? "") > -1) handleSearch();
};

/** 行点击透传（同上：模板内联类型注解不可用） */
const onRowClick = (row: Record<string, unknown>) => emit("rowClick", row);

/**
 * 表格列首帧的瞬态规避（体验基线 U1 / 列表页 CLS 主因）：
 * el-table 在列挂载后用 rAF 才计算列宽（EP `requestAnimationFrame(doLayout)`），
 * 列挂载后的第一帧仍是浏览器对未定宽列的均分宽度——长表头换行（实测表头
 * 155px → 41px）、单元格变高（86px → 53px），下一帧才回到真实列宽；该中间帧
 * 会被真实绘制并产生位移（visibility: hidden 的元素不参与 layout-shift 统计）。
 * 列集合每次变化（元数据到达 / 列设置调整）时隐藏表格两帧，待布局落位后再显示。
 */
const tableLayoutPending = ref(false);
let layoutRaf = 0;

const holdTableUntilLaidOut = () => {
  tableLayoutPending.value = true;
  cancelAnimationFrame(layoutRaf);
  layoutRaf = requestAnimationFrame(() => {
    layoutRaf = requestAnimationFrame(() => {
      tableLayoutPending.value = false;
    });
  });
};

// 同一列集合既可能整体替换（RePureTableBar 深拷贝回写），也可能被就地
// splice/push（列元数据装配路径），两个来源都要盯
watch(
  [() => tableBarData.value.dynamicColumns, () => listColumns.value.length],
  holdTableUntilLaidOut,
  { flush: "pre" }
);

function getTreeProps() {
  // pure-table 的 treeProps 期望三字段全必填（其 default 字面量类型），
  // setup ref 展开会丢可选性，这里显式签名传递（与组件内注记一致）
  return treeProps.value as {
    hasChildren: string;
    children: string;
    checkStrictly: boolean;
  };
}

function getTableRef() {
  return tableRef.value;
}

/**
 * 内建回收站入口。recycleBin prop 开启且具备 recycleList 权限时
 * 渲染通用回收站抽屉，数据变动直接联动本组件的 handleGetData，
 * 调用方无需再经 barButtons 插槽自行接线。
 */
const recycleBinEnabled = computed(
  () => !!props.recycleBin && !!props.auth?.recycleList
);
/**
 * recycleBin 传数组 = 自定义列；传 true = 与主列表同字段展示
 * （回收站接口与 list 同口径序列化，剔除多选/操作列、透传 cellRenderer）
 */
const recycleBinColumns = computed<RecycleBinColumn[]>(() => {
  if (Array.isArray(props.recycleBin)) return props.recycleBin;
  if (props.recycleBin !== true) return [];
  return listColumns.value
    .filter(
      column =>
        column.prop &&
        !["selection", "operation"].includes(column._column?.key ?? "")
    )
    .map(column => ({
      prop: column.prop,
      label: column.label,
      cellRenderer: column.cellRenderer as unknown as
        RecycleBinColumn["cellRenderer"] | undefined
    }));
});
// recycleBin 仅应配置在完整 BaseApi（含 recycle 三方法）的页面；
// api prop 声明为 Partial<BaseApi> 以宽容各类页面，在此边界收窄
const recycleBinApi = computed(() => props.api as BaseApi);

defineExpose({
  dataList,
  searchFields,
  getTableRef,
  getSelectPks,
  getPageColumn,
  handleGetData,
  handleAddOrEdit
});
</script>

<template>
  <div v-if="auth?.list" ref="rootRef" class="main re-plus-page">
    <div
      v-if="api?.fields"
      class="re-plus-search-card bg-bg_color w-99/100 px-6 py-3"
    >
      <PlusSearch
        v-model="searchFields"
        :col-props="{
          xs: 24,
          sm: 12,
          md: 6,
          lg: 6,
          xl: 6
        }"
        :columns="searchColumns as never"
        :default-values="cloneDeep(defaultValue)"
        :row-props="{
          gutter: 24
        }"
        :search-loading="loadingStatus"
        :show-number="deviceDetection() ? 1 : 3"
        :needValidate="true"
        label-width="100px"
        v-bind="plusSearchProps"
        @change="onSearchColumnChange"
        @reset="handleReset"
        @search="handleSearch"
        @keyup.enter="handleSearch"
      />
    </div>
    <div :class="tableBarData.renderClass">
      <el-scrollbar class="max-h-15!">
        <PureTableBar
          v-if="tableBar"
          :columns="listColumns"
          v-bind="pureTableBarProps"
          @refresh="handleGetData"
          @change="handleTableBarChange"
          @fullscreen="handleFullscreen"
        >
          <template #title>
            <el-space>
              <p class="font-bold truncate mr-3">
                {{ title ?? pageTitle }}
              </p>
              <div
                v-if="selectedNum > 0"
                v-motion-fade
                class="bg-(--el-fill-color-light) w-40 h-10 m-2 pl-4 flex items-center rounded-md"
              >
                <span class="text-text_color_secondary" style="font-size: 14px">
                  {{ t("buttons.selected", { count: selectedNum }) }}
                </span>
                <el-button text type="primary" @click="onSelectionCancel">
                  {{ t("buttons.cancel") }}
                </el-button>
              </div>
            </el-space>
          </template>
          <template #buttons>
            <div class="flex">
              <div v-if="selectedNum > 0" v-motion-fade class="mr-3 flex">
                <el-popconfirm
                  v-if="auth.batchDestroy"
                  :title="
                    t('buttons.batchDeleteConfirm', { count: selectedNum })
                  "
                  @confirm="handleManyDelete"
                >
                  <template #reference>
                    <el-button
                      :icon="useRenderIcon(Delete)"
                      plain
                      type="danger"
                    >
                      {{ t("buttons.batchDestroy") }}
                    </el-button>
                  </template>
                </el-popconfirm>
              </div>
              <button-operation
                :show-number="99"
                v-bind="tableBarButtonsProps"
                :buttons="tableBarButtons"
                @clickAction="
                  data => {
                    emit('tableBarClickAction', data);
                  }
                "
              />
              <re-recycle-bin
                v-if="recycleBinEnabled"
                :api="recycleBinApi"
                :locale-name="localeName"
                :columns="recycleBinColumns"
                @changed="handleGetData"
              />
              <slot name="barButtons" />
            </div>
          </template>
        </PureTableBar>
      </el-scrollbar>
      <pure-table
        ref="tableRef"
        :class="{ 're-plus-table-layout-pending': tableLayoutPending }"
        :adaptiveConfig="{ offsetBottom: 110 }"
        :columns="tableBarData.dynamicColumns as never"
        :data="dataList"
        :header-cell-style="{
          background: 'var(--el-table-row-hover-bg-color)',
          color: 'var(--el-text-color-primary)'
        }"
        :loading="loadingStatus"
        :pagination="tablePagination"
        :size="tableBarData.size as ComponentSize"
        adaptive
        align-whole="center"
        default-expand-all
        row-key="pk"
        table-layout="fixed"
        v-bind="pureTableProps as unknown as Record<string, unknown>"
        :tree-props="getTreeProps()"
        @selection-change="handleSelectionChange"
        @row-click="onRowClick"
        @page-size-change="handleSizeChange"
        @page-current-change="handleCurrentChange"
      >
        <template #operation="{ row }">
          <button-operation
            :row="row"
            :size="tableBarData.size as ComponentSize"
            v-bind="operationButtonsProps"
            :buttons="operationButtons"
            @clickAction="
              data => {
                emit('operationClickAction', data);
              }
            "
          />
          <slot name="extOperation" v-bind="{ row, size: tableBarData.size }" />
        </template>
        <template
          v-for="item in getKeyList(listColumns, 'slot').filter(x => {
            return x !== 'operation';
          })"
          :key="item"
          #[item]="{ row, size }"
        >
          <slot :key="item" :name="item" v-bind="{ row, size }" />
        </template>
      </pure-table>
    </div>
  </div>
</template>

<style lang="scss">
/* 列表页主内容底边距归零：.main-content 类由 layout 注入到路由组件根节点，
   页面包 div 或 el-tabs 时本组件 scoped 属性带不上该节点（实测 var 永远为空），
   改用全局块并以本组件根类锚定——自身即根时类落同一节点，包裹时经 :has 命中 */
.main-content.re-plus-page,
.main-content:has(.re-plus-page) {
  --main-content-margin: 24px 24px 0;
}
</style>

<style scoped lang="scss">
/* 搜索卡片高度占位（体验基线 U1 / CLS 主因修复）：
   搜索列元数据随列表首包（with_meta=1）到达，此前卡片只渲染按钮行（56px），
   到达后叠加一行字段（+50px）；同帧还伴随 el-table 列宽首绘与自适应高度重算，
   中间帧会被真实绘制（表头换行 155px → 41px 的瞬态位移）。
   这里按「按钮行 + 一行字段」预留最小高度，让页面结构在元数据到达前后不变。
   数值 = py-3(12+12) + 按钮行(32) + 行间距与字段行(50) = 106px；
   字段多于一行（窄屏 2 行）时自然更高，仅预留下限、不影响布局。 */
.re-plus-search-card {
  min-height: 106px;
}

/* 列首帧隐藏（同上）：el-table 列宽在 rAF 内才落位，隐藏这一两帧即可
   消除「表头换行 → 回弹」的瞬态位移；visibility 保留占位、不影响自适应高度测量 */
.re-plus-table-layout-pending {
  visibility: hidden;
}
</style>
