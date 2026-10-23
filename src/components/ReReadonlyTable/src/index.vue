<script lang="ts" setup>
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { RecordType } from "plus-pro-components";
import ReEmpty from "@/components/ReEmpty";
import type { ReadonlyColumn } from "./types";
import { TABLE_HEADER_CELL_STYLE } from "@/utils/tableHeader";
import { syncTableA11y } from "@/utils/tableA11y";

/**
 * 只读明细表（展示型表格统一形态）。
 *
 * 适用：卡片/页签/面板内的「明细、日志、统计」表——数据由父级拉取，组件只负责渲染。
 * 不适用：可编辑列表（用 RePlusPage 或 plus-pro-components 的表格）。
 *
 * 统一的三件事（此前各页面手写易漂移）：
 * 1. 表头底纹与字色：与 RePlusPage 列表页同源（`--el-table-row-hover-bg-color`）；
 * 2. 空态：走表格 `#empty` 槽（不再「表格自带暂无数据 + 外层再挂一个 el-empty」双空态）；
 * 3. 尺寸：默认 `default`（与列表页行高一致，页级明细表直接对齐）；卡片内嵌的
 *    密集面板可显式传 `size="small"`（此时密度优先于对齐，需在调用处注明）。
 *
 * 分页与展开行：传 `pagination` 时在表下统一渲染分页器并抛出 `page-change`；
 * 提供 `expand` 具名插槽时自动追加展开列（作用域与 el-table 展开列一致）。
 */
defineOptions({ name: "ReReadonlyTable" });

const props = withDefaults(
  defineProps<{
    columns: ReadonlyColumn[];
    rows?: RecordType[];
    loading?: boolean;
    size?: "" | "default" | "small" | "large";
    border?: boolean;
    rowKey?: string;
    maxHeight?: string | number;
    /** 空态文案；缺省时用 EP 表格默认空文案 */
    emptyText?: string;
    /** 可访问名（读屏播报的表格标题）；缺省时用通用词条 */
    label?: string;
    /** 分页信息：传入即渲染表下分页器（翻页只抛事件，数据仍由父级拉取） */
    pagination?: { total: number; page: number; pageSize: number };
  }>(),
  {
    rows: () => [],
    loading: false,
    /** 与列表页同档；密集面板传 "small" */
    size: "default",
    border: false,
    rowKey: "pk",
    maxHeight: undefined,
    emptyText: "",
    label: "",
    pagination: undefined
  }
);

/** 具名插槽：列插槽名由 columns[].slot 声明，expand 为展开行内容 */
defineSlots<Record<string, ((_scope: RecordType) => unknown) | undefined>>();

const emit = defineEmits<{ "page-change": [page: number] }>();

const { t } = useI18n();

/** el-table 实例（仅取根元素做可访问名同步，不触碰内部状态） */
const tableRef = ref<{ $el?: HTMLElement } | null>(null);
const a11yLabel = computed(() => props.label || t("tableA11y.dataTable"));

function syncA11y() {
  nextTick(() => syncTableA11y(tableRef.value?.$el ?? null, a11yLabel.value));
}

onMounted(syncA11y);
watch(() => [props.rows, props.columns, a11yLabel.value], syncA11y, {
  flush: "post"
});
</script>

<template>
  <div class="flex flex-col">
    <el-table
      ref="tableRef"
      v-loading="props.loading"
      class="flex-1"
      :data="props.rows"
      :size="props.size"
      :border="props.border"
      :row-key="props.rowKey"
      :max-height="props.maxHeight"
      :header-cell-style="TABLE_HEADER_CELL_STYLE"
    >
      <!-- 展开行：仅在调用方提供 expand 插槽时出现，作用域与 el-table 展开列一致 -->
      <el-table-column v-if="$slots.expand" type="expand">
        <template #default="scope">
          <slot name="expand" v-bind="scope" />
        </template>
      </el-table-column>
      <el-table-column
        v-for="column in props.columns"
        :key="column.prop ?? column.slot"
        :prop="column.prop"
        :label="column.label"
        :width="column.width"
        :min-width="column.minWidth"
        :align="column.align"
        :show-overflow-tooltip="column.showOverflowTooltip"
        :fixed="column.fixed"
      >
        <!-- 复杂单元格（tag/进度/操作）由调用方插槽渲染：作用域与 el-table-column 一致 -->
        <template v-if="column.slot" #default="scope">
          <slot :name="column.slot" v-bind="scope" />
        </template>
      </el-table-column>
      <template #empty>
        <ReEmpty
          :description="props.emptyText || t('labels.noData')"
          size="small"
        />
      </template>
    </el-table>
    <!-- 分页器：数据与页码由父级持有，这里只上报翻页意图 -->
    <div v-if="props.pagination" class="mt-3 flex justify-end">
      <el-pagination
        layout="prev, pager, next"
        size="small"
        :total="props.pagination.total"
        :page-size="props.pagination.pageSize"
        :current-page="props.pagination.page"
        @current-change="page => emit('page-change', page)"
      />
    </div>
  </div>
</template>
