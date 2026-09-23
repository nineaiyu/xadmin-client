import { ref } from "vue";
import { message } from "@/utils/message";
// 仅类型引用（不进包）：下载实现按需动态加载（保持首屏体积）
import type { ExportedImage } from "@/utils/imageExport";
import type { useI18n } from "vue-i18n";
import type { DashboardCard } from "@/api/system/datasets";

type TFunction = ReturnType<typeof useI18n>["t"];

/** ChartCard 暴露的图片渲染句柄（number 卡无图表实例，返回 null） */
export type CardImageHandle = {
  renderImage?: () => Promise<ExportedImage | null>;
};

/**
 * 卡片图片导出：模板 ref 收集 ChartCard 句柄，单卡导出 PNG（转换失败回退 SVG）。
 * 抽出独立 composable 控制页面体积（dashboard/index.vue 行数门禁）。
 */
export function useCardImageExport(t: TFunction) {
  const cardRefs = ref<Record<string, CardImageHandle | undefined>>({});
  const setCardRef = (cardId: string) => (el: unknown) => {
    const handle = el as CardImageHandle | null;
    if (handle) cardRefs.value[cardId] = handle;
  };
  const exportingCard = ref("");

  /** 导出单张卡片为图片；指标卡（number）无图表实例 → 明确提示不可导出 */
  const exportCardImage = async (card: DashboardCard) => {
    if (exportingCard.value) return;
    exportingCard.value = card.id;
    try {
      const image = await cardRefs.value[card.id]?.renderImage?.();
      if (!image) {
        message(t("dashboard.exportNoChart"), { type: "warning" });
        return;
      }
      const { downloadBlob, safeFileName } =
        await import("@/utils/imageExport");
      downloadBlob(
        image.blob,
        `${safeFileName(String(card.title ?? ""), "chart")}.${image.extension}`
      );
    } finally {
      exportingCard.value = "";
    }
  };

  return { setCardRef, exportingCard, exportCardImage };
}
