import { computed, ref, type ComputedRef } from "vue";
import type { DashboardCard } from "@/api/dataset/datasets";
import type { ScreenLayoutPane } from "@/api/dataset/analysis";
import type { ExportedImage } from "@/utils/imageExport";

/** ChartCard 组件句柄：loadData 刷新 + applyData 帧注入 + renderImage 图片导出 */
type CardHandle = {
  loadData?: () => void;
  applyData?: (_entry: {
    kind?: string;
    data?: unknown;
    detail?: string;
  }) => Promise<void> | void;
  renderImage?: () => Promise<ExportedImage | null>;
};

/**
 * 窗格内卡片的数据动作契约（自 ScreenPane 抽出，行数门禁）。
 *
 * 指标卡窗格 → 合成卡（复用 ChartCard 的取数/WS 注入内核；card id 即窗格 pk，
 * 与服务端 screen_data 对 metric 窗格的合成口径一致）。「实际持有卡片的清单」
 * = 仪表盘窗格取 cards / 指标卡取合成卡，刷新 / 注入 / 导出共用同一口径。
 */
export function usePaneCards(deps: {
  pane: ComputedRef<ScreenLayoutPane>;
  cards: ComputedRef<DashboardCard[] | undefined>;
  paneTitle: ComputedRef<string>;
}) {
  const cardRefs = ref<Record<string, CardHandle | undefined>>({});
  const setCardRef = (cardId: string) => (el: unknown) => {
    const handle = el as CardHandle | null;
    if (handle) cardRefs.value[cardId] = handle;
  };

  const metricCard = computed<DashboardCard | null>(() => {
    const pane = deps.pane.value;
    if (pane.type !== "metric" || !pane.dataset) return null;
    return {
      id: pane.pk,
      dataset: pane.dataset,
      title: deps.paneTitle.value || "",
      chart_type: "metric",
      metric: pane.metric ?? "count",
      value_field: pane.value_field ?? ""
    };
  });

  const innerCards = computed<DashboardCard[]>(() =>
    deps.pane.value.type === "metric"
      ? metricCard.value
        ? [metricCard.value]
        : []
      : (deps.cards.value ?? [])
  );

  /** 定时刷新可见卡片（投屏 refresh / 设计器「刷新数据」） */
  const refresh = () => {
    for (const card of innerCards.value) cardRefs.value[card.id]?.loadData?.();
  };

  /** 注入单卡数据帧（screen_data 推送通道）：窗格持有该卡时渲染并返回 true */
  const applyCardData = (
    cardId: string,
    entry: { kind?: string; data?: unknown; detail?: string }
  ) => {
    if (!innerCards.value.some(card => card.id === cardId)) return false;
    void cardRefs.value[cardId]?.applyData?.(entry);
    return true;
  };

  /** 逐卡渲染图片（投屏导出 ZIP 用；非图表卡返回 null 由调用方计入跳过数） */
  const renderImages = async () => {
    const images: { cardId: string; title: string; image: ExportedImage }[] =
      [];
    for (const card of innerCards.value) {
      const image = await cardRefs.value[card.id]?.renderImage?.();
      if (image) images.push({ cardId: card.id, title: card.title, image });
    }
    return images;
  };

  return { setCardRef, innerCards, refresh, applyCardData, renderImages };
}
