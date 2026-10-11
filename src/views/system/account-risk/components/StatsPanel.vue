<script lang="ts" setup>
import type { StatsGroup } from "../utils/stats";

/**
 * 风险统计面板（纯展示）：概览 / 等级 / 状态 / 类型四组计数 chips。
 * 数据与文案由 useAccountRisk 组装，加载失败时父级不渲染本组件。
 */
defineOptions({ name: "AccountRiskStatsPanel" });

defineProps<{
  groups: StatsGroup[];
}>();
</script>

<template>
  <div
    class="risk-stats mb-3 flex w-99/100 flex-wrap gap-x-8 gap-y-2 px-3 py-2"
    data-testid="account-risk-stats"
  >
    <div
      v-for="group in groups"
      :key="group.key"
      class="flex items-center gap-2"
    >
      <span class="text-sm text-(--el-text-color-secondary)">
        {{ group.title }}
      </span>
      <el-tag
        v-for="chip in group.chips"
        :key="chip.key"
        :type="chip.type"
        size="small"
        effect="plain"
      >
        {{ chip.label }} {{ chip.count }}
      </el-tag>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* 与页面提示条同风格：浅底 + 描边的轻量横条，不与表格主体争视觉 */
.risk-stats {
  background: var(--el-fill-color-light);
  border: 1px solid var(--divider);
  border-radius: var(--radius-sm);
}
</style>
