import { ref, type ComputedRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import { chartColorScheme } from "@/utils/chartTheme";
import { useUserStoreHook } from "@/store/modules/user";
import { formatWatermarkTime } from "@/utils/watermark";
import type { ExportedImage } from "@/utils/imageExport";
import type { DashboardCard } from "@/api/dataset/datasets";

/**
 * 大屏导出（自 display.vue 抽出，行数门禁）：收集当前屏全部卡片图片，
 * 两种出口——ZIP 打包（逐卡文件，一次下载规避浏览器拦截）与单张 PNG 长图
 * （快照合成：标题 / 时间戳 / 水印叠加，flow 等宽纵向堆叠）。
 * 画布模式逐窗格（ScreenPane.renderImages）、轮播模式逐卡（ChartCard.renderImage）；
 * 收集结果同时返回应有卡片数 total，供「跳过数」提示计算未渲染成功的卡片。
 * 图片导出实现按需动态加载（保持首屏体积）。
 */

/** 收集句柄按需最小化（只要求渲染图片能力）：轮播卡与窗格宿主按结构化类型兼容 */
type CardRenderHandle = {
  renderImage?: () => Promise<ExportedImage | null>;
};

type PaneRenderHandle = {
  renderImages: () => Promise<{ title: string; image: ExportedImage }[]>;
};

export function useScreenExport(deps: {
  isCanvas: ComputedRef<boolean>;
  /** 轮播模式：当前看板卡片（应有图片数 = 卡片数） */
  currentCards: ComputedRef<Pick<DashboardCard, "id" | "title">[]>;
  cardRefs: Ref<Record<string, CardRenderHandle | undefined>>;
  paneRefs: Ref<Record<string, PaneRenderHandle | null>>;
  /** 画布模式：可见窗格与其卡片列表（应有图片数 = 窗格卡片数之和） */
  layoutPanes: ComputedRef<{ dashboard?: string }[]>;
  paneCards: (_pane: { dashboard?: string }) => DashboardCard[];
  /** 快照长图的标题与大屏主题（底色/文本色跟随，而非站点主题） */
  screenTitle: () => string;
  isDark: () => boolean;
}) {
  const { t } = useI18n();
  const exporting = ref(false);
  const {
    isCanvas,
    currentCards,
    cardRefs,
    paneRefs,
    layoutPanes,
    paneCards,
    screenTitle,
    isDark
  } = deps;

  /**
   * 收集当前屏的卡片图片：画布模式逐窗格、轮播模式逐卡
   * （导出 ZIP 与「跳过数」共用；返回 total 用于算未渲染成功的卡片数）。
   */
  const collectImages = async () => {
    const images: { title: string; image: ExportedImage }[] = [];
    if (isCanvas.value) {
      const total = layoutPanes.value.reduce(
        (count, pane) => count + paneCards(pane).length,
        0
      );
      for (const handle of Object.values(paneRefs.value)) {
        if (!handle) continue;
        for (const item of await handle.renderImages()) {
          images.push({ title: item.title, image: item.image });
        }
      }
      return { images, total };
    }
    for (const card of currentCards.value) {
      const image = await cardRefs.value[card.id]?.renderImage?.();
      if (image) images.push({ title: card.title, image });
    }
    return { images, total: currentCards.value.length };
  };

  /** 导出当前屏：逐卡渲染图片并按 ZIP 打包（一次下载，规避浏览器对连续下载的拦截） */
  const exportScreen = async () => {
    if (exporting.value) return;
    exporting.value = true;
    try {
      const { buildZipStore, downloadBlob, safeFileName } =
        await import("@/utils/imageExport");
      const { images, total } = await collectImages();
      if (images.length === 0) {
        message(t("dataScreen.exportNoChart"), { type: "warning" });
        return;
      }
      const files: { name: string; data: Uint8Array }[] = [];
      for (const item of images) {
        const base = safeFileName(
          String(item.title ?? ""),
          `card-${files.length + 1}`
        );
        files.push({
          name: `${base}.${item.image.extension}`,
          data: new Uint8Array(await item.image.blob.arrayBuffer())
        });
      }
      downloadBlob(buildZipStore(files), `screen-${Date.now()}.zip`);
      const skipped = total - images.length;
      if (skipped > 0) {
        message(t("dataScreen.exportSkipped", { count: skipped }), {
          type: "warning"
        });
      }
    } finally {
      exporting.value = false;
    }
  };

  /** 导出当前屏快照：逐卡位图合成为单张 PNG 长图（标题/时间戳/水印叠加） */
  const exportScreenSnapshot = async () => {
    if (exporting.value) return;
    exporting.value = true;
    try {
      const { images } = await collectImages();
      if (images.length === 0) {
        message(t("dataScreen.exportNoChart"), { type: "warning" });
        return;
      }
      const dark = isDark();
      const scheme = chartColorScheme(dark);
      const user = useUserStoreHook();
      const { composeSnapshotPng } = await import("@/utils/snapshotComposite");
      const blob = await composeSnapshotPng(
        images.map(item => ({ title: item.title, image: item.image })),
        {
          layout: "flow",
          title: screenTitle(),
          background: scheme.exportBg,
          textColor: scheme.text,
          mutedColor: scheme.textSecondary,
          watermark: `${user.nickname || user.username} ${formatWatermarkTime()}`
        }
      );
      if (!blob) {
        message(t("dataScreen.exportNoChart"), { type: "warning" });
        return;
      }
      const { downloadBlob, safeFileName } =
        await import("@/utils/imageExport");
      downloadBlob(
        blob,
        `${safeFileName(screenTitle(), "screen")}-snapshot.png`
      );
    } finally {
      exporting.value = false;
    }
  };

  return { exporting, exportScreen, exportScreenSnapshot };
}
