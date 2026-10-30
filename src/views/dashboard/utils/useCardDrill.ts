import { computed, ref } from "vue";

/**
 * 卡片下钻状态机（自 index.vue 拆分，行数门禁）：
 * 图表点击（带维度点）或「查看明细」（无点全量）打开数据集明细抽屉。
 *
 * 维度过滤：趋势序列（无 raw）与无分组卡回落为全量明细——后端 execute
 * 的 extra_filters 只在「分组字段 + 原始值」齐备时下发。
 */

type DrillCard = { dataset: string; title?: string | null; group_by?: string };
type DrillPoint = { name: string; raw?: unknown };

export function useCardDrill() {
  const drillVisible = ref(false);
  const drillCard = ref<DrillCard | null>(null);
  const drillPoint = ref<DrillPoint | null>(null);

  function openDrill(card: DrillCard, point: DrillPoint | null) {
    drillCard.value = card;
    drillPoint.value = point;
    drillVisible.value = true;
  }

  /** 维度过滤：趋势序列（无 raw）与无分组卡回落为全量明细 */
  const drillFilter = computed(() => {
    const card = drillCard.value;
    const point = drillPoint.value;
    if (!card?.group_by || !point || point.raw === undefined) return null;
    return { field: card.group_by, label: point.name, value: point.raw };
  });

  return { drillVisible, drillCard, drillPoint, openDrill, drillFilter };
}
