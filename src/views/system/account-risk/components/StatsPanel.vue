<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { StatBar, type StatItem } from "@/components/ReStat";
import type { StatsGroup } from "../utils/stats";

/**
 * 风险统计面板（纯展示）：概览 / 等级 / 状态 / 类型四组计数 chips。
 * 数据与文案由 useAccountRisk 组装，加载失败时父级不渲染本组件。
 *
 * 容器与 chips 版式由 ReStatBar 统一提供（浅底 + 描边），本组件只负责把
 * 「分组 + chip」映射为扁平条目，并把 chip 点击还原为列表筛选条件。
 */
defineOptions({ name: "AccountRiskStatsPanel" });

const { t } = useI18n();

const props = defineProps<{
  groups: StatsGroup[];
  /** 当前快捷筛选 chip 的原始 key（无筛选为空） */
  activeKey?: string;
}>();

const emit = defineEmits<{
  /** chip 点击：按分组映射为列表筛选条件 */
  chipClick: [payload: { group: string; chip: { key: string } }];
  /** 清除快捷筛选 */
  clear: [];
}>();

const activeKeyIncludes = (group: string, key: string) =>
  props.activeKey === key || props.activeKey === `${group}.${key}`;

/** key 以分组前缀，跨组同名 chip 不冲突 */
const items = computed<StatItem[]>(() =>
  props.groups.flatMap(group =>
    group.chips.map(chip => ({
      key: `${group.key}.${chip.key}`,
      label: chip.label,
      value: chip.count,
      type: chip.type,
      tag: true,
      clickable: true,
      active: activeKeyIncludes(group.key, chip.key),
      group: group.title
    }))
  )
);

/** `分组.芯片` → 原 payload（组名与芯片名本身不含点） */
const onItemClick = (item: StatItem) => {
  const dot = item.key.indexOf(".");
  emit("chipClick", {
    group: item.key.slice(0, dot),
    chip: { key: item.key.slice(dot + 1) }
  });
};
</script>

<template>
  <StatBar
    :items="items"
    class="mb-3 gap-x-8! px-3!"
    data-testid="account-risk-stats"
    @item-click="onItemClick"
  >
    <template v-if="activeKey" #extra>
      <el-button link type="primary" size="small" @click="emit('clear')">
        {{ t("accountRisk.clearQuickFilter") }}
      </el-button>
    </template>
  </StatBar>
</template>
