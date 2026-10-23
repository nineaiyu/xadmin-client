<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { StatItem } from "./types";

defineOptions({ name: "ReStatBar" });

/**
 * 统计条：浅底 + 描边的轻量横条，承载指标 chips（label + value / el-tag）。
 *
 * - 与列表主体争视觉的统计（图表、趋势）不放这里，走详情抽屉；
 * - `group` 相同的相邻项聚成一组，组标题即 `group` 文本；
 * - `#prefix` / `#extra` 承载进度条、详情入口等条内扩展，条内边距与间距
 *   由本组件统一提供，调用方只传业务内容。
 */
const props = defineProps<{
  items: StatItem[];
}>();

const emit = defineEmits<{
  /** chip 点击（仅 clickable 项） */
  itemClick: [item: StatItem];
}>();

const { t } = useI18n();

interface StatGroup {
  key: string;
  title?: string;
  items: StatItem[];
}

/** 相邻同组项聚合（未设 group 的项自成一组） */
const groups = computed<StatGroup[]>(() => {
  const rows: StatGroup[] = [];
  props.items.forEach(item => {
    const last = rows[rows.length - 1];
    if (last && last.key === (item.group ?? "")) {
      last.items.push(item);
    } else {
      rows.push({ key: item.group ?? "", title: item.group, items: [item] });
    }
  });
  return rows;
});

/** 展示值：text 优先（空值占位 / 带单位） */
const displayOf = (item: StatItem) => item.text ?? item.value ?? "";

/** chip 文案：「标签 值」；值缺失时只留标签（0 是有效值，照常展示） */
const chipText = (item: StatItem) => {
  const value = displayOf(item);
  return value === "" ? item.label : `${item.label} ${value}`;
};

const onClick = (item: StatItem) => {
  if (item.clickable) emit("itemClick", item);
};
</script>

<template>
  <div
    class="re-stat-bar flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2"
  >
    <div v-if="$slots.prefix" class="flex items-center">
      <slot name="prefix" />
    </div>

    <p
      v-if="!items.length"
      class="text-sm text-(--el-text-color-secondary)"
      data-testid="stat-empty"
    >
      {{ t("reStat.empty") }}
    </p>

    <div
      v-for="group in groups"
      :key="group.key"
      class="flex flex-wrap items-center gap-2"
    >
      <span v-if="group.title" class="text-sm text-(--el-text-color-secondary)">
        {{ group.title }}
      </span>
      <template v-for="item in group.items" :key="item.key">
        <el-tag
          v-if="item.tag"
          :type="item.type"
          size="small"
          effect="plain"
          :class="{ 'cursor-pointer': item.clickable }"
          :role="item.clickable ? 'button' : undefined"
          :tabindex="item.clickable ? 0 : undefined"
          :title="item.title"
          :data-testid="`stat-${item.key}`"
          @click="onClick(item)"
          @keydown.enter="onClick(item)"
        >
          {{ chipText(item) }}
        </el-tag>
        <span
          v-else
          class="flex items-baseline gap-1.5"
          :title="item.title ?? String(displayOf(item))"
        >
          <span class="text-xs text-(--el-text-color-secondary)">
            {{ item.label }}
          </span>
          <span
            class="max-w-40 truncate text-sm font-medium"
            :data-testid="`stat-${item.key}`"
          >
            {{ displayOf(item) }}
          </span>
        </span>
      </template>
    </div>

    <div v-if="$slots.extra" class="ml-auto">
      <slot name="extra" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
/* 与页面提示条同风格：浅底 + 描边的轻量横条，不与表格/列表主体争视觉 */
.re-stat-bar {
  background: var(--el-fill-color-light);
  border: 1px solid var(--divider);
  border-radius: var(--radius-sm);
}
</style>
