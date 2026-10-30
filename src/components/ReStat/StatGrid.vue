<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { ReNormalCountTo } from "@/components/ReCountTo";
import type { StatItem } from "./types";

defineOptions({ name: "ReStatGrid" });

/**
 * 统计网格：`el-statistic` 等分网格（替代手写 `grid-cols-*` + el-statistic）。
 *
 * - `columns` 为 md 以上列数，`smColumns` 为 sm~md 列数，窄屏统一 2 列；
 * - `text` 分支用于空值占位 / 带单位文本，数值分支可开 `animate` 做数字滚动。
 */
const props = withDefaults(
  defineProps<{
    items: StatItem[];
    /** md 以上列数 */
    columns?: number;
    /** sm~md 列数 */
    smColumns?: number;
    /** 数值项启用数字滚动动画（text 分支不受影响） */
    animate?: boolean;
  }>(),
  {
    columns: 4,
    smColumns: 2,
    animate: false
  }
);

const { t } = useI18n();

const gridStyle = computed(() => ({
  "--re-stat-cols": String(props.columns),
  "--re-stat-cols-sm": String(props.smColumns)
}));
</script>

<template>
  <div class="re-stat-grid" :style="gridStyle">
    <p
      v-if="!items.length"
      class="text-sm text-(--el-text-color-secondary)"
      data-testid="stat-empty"
    >
      {{ t("reStat.empty") }}
    </p>
    <el-statistic
      v-for="item in items"
      :key="item.key"
      :title="item.label"
      :data-testid="`stat-${item.key}`"
    >
      <template #default>
        <span v-if="item.text !== undefined">{{ item.text }}</span>
        <ReNormalCountTo
          v-else-if="animate && typeof item.value === 'number'"
          :duration="600"
          :endVal="item.value"
        />
        <span v-else>{{ item.value ?? "" }}</span>
      </template>
    </el-statistic>
  </div>
</template>

<style lang="scss" scoped>
@use "@/style/tokens/breakpoints" as bp;

.re-stat-grid {
  @include bp.below("md") {
    grid-template-columns: repeat(var(--re-stat-cols-sm, 2), minmax(0, 1fr));
  }

  @include bp.below("sm") {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  display: grid;
  grid-template-columns: repeat(var(--re-stat-cols, 4), minmax(0, 1fr));
  gap: var(--space-3);
}
</style>
