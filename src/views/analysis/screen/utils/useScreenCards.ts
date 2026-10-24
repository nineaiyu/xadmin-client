import { ref, type ComputedRef } from "vue";
import type { DashboardCard, DashboardItem } from "@/api/dataset/datasets";
import type { ScreenDataPayload } from "@/utils/websocket/protocol";
// 仅类型引用（不进包）：导出实现按需动态加载（保持首屏体积）
import type { ExportedImage } from "@/utils/imageExport";
import type ScreenPane from "../components/ScreenPane.vue";

/** 卡片组件句柄：模板 ref 收集 ChartCard（loadData 刷新 + applyData 注入 + renderImage 图片导出） */
type CardHandle = {
  loadData?: () => void;
  applyData?: (_entry: CardDataEntry) => Promise<void> | void;
  renderImage?: () => Promise<ExportedImage | null>;
};

/** screen_data 帧的卡片级条目（cards[] 原样 / errors[] 转错误提示口径） */
type CardDataEntry = {
  card: string;
  kind?: string;
  data?: unknown;
  detail?: string;
};

/** 服务端逐卡错误 → 与卡片同一条注入通道（ChartCard 按 detail 渲染错误态） */
const toErrorEntry = (error: {
  card: string;
  detail: string;
}): CardDataEntry => ({
  card: error.card,
  detail: error.detail
});

/**
 * 投屏页的卡片 / 窗格句柄收集与数据帧应用（自 display.vue 抽出，行数门禁）。
 *
 * 三件事：
 * 1. 模板 ref 收集：轮播态收 ChartCard 句柄，画布态收 ScreenPane 句柄
 *    （刷新与导出共用同一接口，实现见各组件 defineExpose）；
 * 2. refreshVisible：按形态分派刷新（画布逐窗格 / 轮播逐卡）；
 * 3. applyScreenData：应用服务端聚合数据帧（screen_data）——轮播帧按仪表盘分发
 *    （dashboard 与当前页不一致的帧不应用，其卡片未渲染）；画布帧单帧 dashboard=null，
 *    逐窗格路由（窗格持有该卡才应用；同一仪表盘可放多个窗格，不能短路）。
 */
export function useScreenCards(deps: {
  /** 画布态（栅格 / 自由）：刷新与帧应用走窗格句柄 */
  isStage: ComputedRef<boolean>;
  currentCards: ComputedRef<DashboardCard[]>;
  currentDashboard: ComputedRef<DashboardItem | null>;
}) {
  const cardRefs = ref<Record<string, CardHandle | undefined>>({});
  const setCardRef = (cardId: string) => (el: unknown) => {
    const handle = el as CardHandle | null;
    if (handle) cardRefs.value[cardId] = handle;
  };

  const paneRefs = ref<Record<string, InstanceType<typeof ScreenPane> | null>>(
    {}
  );
  const setPaneRef = (pk: string) => (el: unknown) => {
    paneRefs.value[pk] = el as InstanceType<typeof ScreenPane> | null;
  };

  const refreshVisible = () => {
    if (deps.isStage.value) {
      Object.values(paneRefs.value).forEach(handle => handle?.refresh?.());
      return;
    }
    for (const card of deps.currentCards.value) {
      cardRefs.value[card.id]?.loadData?.();
    }
  };

  const applyScreenData = (frame: ScreenDataPayload) => {
    if (deps.isStage.value) {
      for (const entry of [...frame.cards, ...frame.errors.map(toErrorEntry)]) {
        Object.values(paneRefs.value).forEach(handle =>
          handle?.applyCardData?.(entry.card, entry)
        );
      }
      return;
    }
    if (frame.dashboard && frame.dashboard !== deps.currentDashboard.value?.pk)
      return;
    for (const entry of frame.cards) {
      cardRefs.value[entry.card]?.applyData?.(entry);
    }
    for (const error of frame.errors) {
      cardRefs.value[error.card]?.applyData?.(toErrorEntry(error));
    }
  };

  return {
    cardRefs,
    setCardRef,
    paneRefs,
    setPaneRef,
    refreshVisible,
    applyScreenData
  };
}
