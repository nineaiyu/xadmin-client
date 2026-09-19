<script lang="ts" setup>
import { computed, nextTick, onUnmounted, ref, watch, type Ref } from "vue";
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
import { useTableLayout } from "./utils/useTableLayout";
import { useTableMeasure } from "./utils/useTableMeasure";

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

const { tableElWidth, measureTableWidth, ensureRootObserver } =
  useTableMeasure(rootRef);

onUnmounted(() => {
  cancelAnimationFrame(searchCardPollRaf);
  searchCardAnimation?.cancel();
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
 * 搜索卡片高度占位是否生效（体验基线 U1 / CLS 主因修复）：
 * 搜索列元数据随列表首包（with_meta=1）到达，此前卡片只渲染按钮行（56px），
 * 到达后叠加一行字段（+50px），中间帧会被真实绘制产生位移。
 * 这里在「元数据到达前」按「按钮行 + 一行字段」预留高度；到达后必须撤掉占位
 * 改由内容自适应——字段与按钮同行的页面实际只有约 74px，固定 106px 会在卡片
 * 底部留出可见空白（2026-09-18 用户反馈「搜索框变高」回归修复）。
 * 到达信号与表格列首帧规避共用同一组列装配来源（dynamicColumns / listColumns）。
 */
const searchMetaReady = computed(
  () =>
    (tableBarData.value.dynamicColumns?.length ?? 0) > 0 ||
    listColumns.value.length > 0
);

// 元数据到达前根节点可能尚未渲染（auth 依赖异步数据时）：到达后补偿测量与观察
watch(searchMetaReady, ready => {
  if (!ready) return;
  nextTick(() => {
    ensureRootObserver();
    measureTableWidth();
  });
});

const { tableLayoutPending } = useTableLayout({
  tableElWidth,
  dynamicColumns: computed(() => tableBarData.value.dynamicColumns),
  listColumnsLength: computed(() => listColumns.value.length),
  operationMinWidth: () => Number(props.operationButtonsProps?.width ?? 200)
});

/**
 * 搜索区展开/收起的过渡。PlusSearch 的展开就是「增删搜索列」，两处都会让卡片高度瞬跳：
 * 展开时新列当帧插入、但高度要下一帧才落位（首帧仅 1px，异步渲染的字段更晚）；
 * 收起时离场列被库内过渡滞留约 200ms 才移除，高度先在原地不动再整块塌掉。
 * 这里统一处理为「冻结起始高度 → 轮询到真实高度落定 → 在两者之间补一段高度过渡」，
 * 过渡期用 clip-path 裁掉溢出内容（不能用 overflow: hidden：它会改变卡片自身的高度
 * 计算，量出的目标高度偏小），展开时新增行像从卡片下缘被揭开，收起时反向收拢。
 * 表格自适应用 ResizeObserver 逐帧跟随，无需在此同步。
 */
const searchCardRef = ref<HTMLElement>();
let searchCardAnimation: Animation | undefined;
let searchCardPollRaf = 0;

const onSearchCollapse = (expanded: boolean) => {
  const card = searchCardRef.value;
  if (!card) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  // 连点：起始高度取在途动画的当前帧值，再停掉它
  const from = card.getBoundingClientRect().height;
  searchCardAnimation?.cancel();
  searchCardAnimation = undefined;
  cancelAnimationFrame(searchCardPollRaf);
  card.style.height = `${from}px`;
  card.style.clipPath = "inset(0)";

  const release = () => {
    card.style.height = "";
    card.style.clipPath = "";
    searchCardAnimation?.cancel();
    searchCardAnimation = undefined;
  };
  /** 量真实高度：同帧内解除冻结再恢复，不产生中间绘制 */
  const naturalHeight = () => {
    card.style.height = "";
    const height = card.getBoundingClientRect().height;
    card.style.height = `${from}px`;
    return height;
  };
  /** 收起时离场列仍留在布局里占位，量目标高度时先把它们排除 */
  const excludeLeavingColumns = () => {
    if (expanded) return () => {};
    const leaving = Array.from(
      card.querySelectorAll<HTMLElement>(".plus-form__row > .el-col")
    ).filter(el => el.style.opacity === "0");
    leaving.forEach(el => (el.style.display = "none"));
    return () => leaving.forEach(el => (el.style.display = ""));
  };

  let last = -1;
  let stable = 0;
  const startedAt = performance.now();
  const step = () => {
    if (!card.isConnected) return;
    const restoreColumns = excludeLeavingColumns();
    const target = naturalHeight();
    restoreColumns();
    // 连续两帧不变才动手，避开列内容未落位的中间高度
    stable = Math.abs(target - last) < 0.5 ? stable + 1 : 0;
    last = target;
    if (stable < 2 && performance.now() - startedAt < 400) {
      searchCardPollRaf = requestAnimationFrame(step);
      return;
    }
    if (Math.abs(target - from) < 1) {
      release();
      return;
    }
    searchCardAnimation = card.animate(
      [{ height: `${from}px` }, { height: `${target}px` }],
      {
        duration: 260,
        easing: "cubic-bezier(0.4, 0, 0.2, 1)",
        // 终态由动画持有：结束事件若晚一帧到达，也不会先回落到起始高度
        fill: "forwards"
      }
    );
    searchCardAnimation.onfinish = release;
  };
  searchCardPollRaf = requestAnimationFrame(step);
};

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
      ref="searchCardRef"
      :class="[
        're-plus-search-card bg-bg_color w-99/100 px-6 py-3',
        { 're-plus-search-card--pending': !searchMetaReady }
      ]"
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
        @collapse="onSearchCollapse"
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
/* 搜索卡片高度占位（体验基线 U1 / CLS 主因修复）：**仅在列元数据到达前生效**。
   搜索列元数据随列表首包（with_meta=1）到达，此前卡片只渲染按钮行（56px），
   到达后叠加一行字段（+50px）；同帧还伴随 el-table 列宽首绘与自适应高度重算，
   中间帧会被真实绘制（表头换行 155px → 41px 的瞬态位移）。
   数值 = py-3(12+12) + 按钮行(32) + 行间距与字段行(50) = 106px；
   字段多于一行（窄屏 2 行）时自然更高，仅预留下限、不影响布局。
   元数据到达后必须撤掉占位改由内容自适应：字段与按钮同行的页面实际约 74px，
   固定 106px 会在卡片底部留出可见空白（2026-09-18 反馈回归修复）。 */
.re-plus-search-card--pending {
  min-height: 106px;
}

/* 列首帧隐藏（同上）：el-table 列宽在 rAF 内才落位，隐藏这一两帧即可
   消除「表头换行 → 回弹」的瞬态位移；visibility 保留占位、不影响自适应高度测量 */
.re-plus-table-layout-pending {
  visibility: hidden;
}
</style>
