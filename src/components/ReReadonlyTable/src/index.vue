<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import type { RecordType } from "plus-pro-components";
import ReEmpty from "@/components/ReEmpty";
import type { ReadonlyColumn } from "./types";

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
  }>(),
  {
    rows: () => [],
    loading: false,
    /** 与列表页同档；密集面板传 "small" */
    size: "default",
    border: false,
    rowKey: "pk",
    maxHeight: undefined,
    emptyText: ""
  }
);

const { t } = useI18n();

/** 表头底纹与字色：与 RePlusPage 列表页一致（同一变量，主题切换自动跟随） */
const HEADER_CELL_STYLE = {
  background: "var(--el-table-row-hover-bg-color)",
  color: "var(--el-text-color-primary)"
};
</script>

<template>
  <el-table
    v-loading="props.loading"
    :data="props.rows"
    :size="props.size"
    :border="props.border"
    :row-key="props.rowKey"
    :max-height="props.maxHeight"
    :header-cell-style="HEADER_CELL_STYLE"
  >
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
</template>
