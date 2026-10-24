<script setup lang="ts">
import { onMounted, useAttrs, watch } from "vue";
import { ref } from "vue";

import { syncTableA11y } from "@/utils/tableA11y";
import { TABLE_HEADER_CELL_STYLE } from "@/utils/tableHeader";

/**
 * 手写表格的统一封装（自各页面裸 `el-table` 收敛）：
 * - 表头样式单一来源（`TABLE_HEADER_CELL_STYLE`，与 RePlusPage / 只读表同款）；
 * - 表格可访问名 / 说明关联（`syncTableA11y`，裸表缺 caption/aria-label）；
 * - `v-bind="$attrs"` 透传 `data / v-loading / data-testid` 等既有用法，槽位原样转发。
 *
 * 只读表（列少 + 分页独立）继续用 `ReReadonlyTable`；本组件面向页面级手写表格。
 */
defineOptions({ name: "DataTable", inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    /** 表格可访问名（aria-label；读屏逐格浏览的上下文） */
    label?: string;
    /** 表格说明（以 `data-table-a11y-desc` 节点建立 aria-describedby 关联） */
    desc?: string;
  }>(),
  { label: "", desc: "" }
);

const root = ref<HTMLElement>();
const attrs = useAttrs();

const applyA11y = () => {
  syncTableA11y(root.value, props.label);
};

watch(
  () => [props.label, props.desc, attrs.data],
  () => applyA11y(),
  { deep: false }
);
onMounted(applyA11y);
</script>

<template>
  <div ref="root" :data-table-a11y-desc="props.desc || undefined">
    <el-table v-bind="{ ...attrs, headerCellStyle: TABLE_HEADER_CELL_STYLE }">
      <template v-for="(_, name) in $slots" #[name]="slotProps" :key="name">
        <slot :name="name" v-bind="slotProps ?? {}" />
      </template>
    </el-table>
  </div>
</template>
