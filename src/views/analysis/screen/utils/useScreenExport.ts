import { ref, type ComputedRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import { chartColorScheme } from "@/utils/chartTheme";
import { useUserStoreHook } from "@/store/modules/user";
import { formatWatermarkTime } from "@/utils/watermark";
import type { DashboardCard } from "@/api/dataset/datasets";
import {
  buildScreenZipEntries,
  collectScreenImages,
  type CardRenderHandle,
  type PaneRenderHandle
} from "./screenExportFiles";

/**
 * 大屏导出（自 display.vue 抽出，行数门禁）：收集当前屏全部卡片图片，
 * 两种出口——ZIP 打包（逐卡文件，一次下载规避浏览器拦截）与单张 PNG 长图
 * （快照合成：标题 / 时间戳 / 水印叠加，flow 等宽纵向堆叠）。
 * 画布模式逐窗格（ScreenPane.renderImages）、轮播模式逐卡（ChartCard.renderImage）；
 * 收集与 ZIP 组装下沉 screenExportFiles（实现域纯函数），本 hook 只留接线。
 * 图片导出实现按需动态加载（保持首屏体积）。
 */
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

  /** 导出当前屏：逐卡渲染图片并按 ZIP 打包（一次下载，规避浏览器对连续下载的拦截） */
  const exportScreen = async () => {
    if (exporting.value) return;
    exporting.value = true;
    try {
      const { buildZipStore, downloadBlob } =
        await import("@/utils/imageExport");
      const { images, total } = await collectScreenImages({
        isCanvas: deps.isCanvas.value,
        currentCards: deps.currentCards.value,
        cardRefs: deps.cardRefs.value,
        paneRefs: deps.paneRefs.value,
        layoutPanes: deps.layoutPanes.value,
        paneCards: deps.paneCards
      });
      if (images.length === 0) {
        message(t("dataScreen.exportNoChart"), { type: "warning" });
        return;
      }
      downloadBlob(
        buildZipStore(await buildScreenZipEntries(images)),
        `screen-${Date.now()}.zip`
      );
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
      const { images } = await collectScreenImages({
        isCanvas: deps.isCanvas.value,
        currentCards: deps.currentCards.value,
        cardRefs: deps.cardRefs.value,
        paneRefs: deps.paneRefs.value,
        layoutPanes: deps.layoutPanes.value,
        paneCards: deps.paneCards
      });
      if (images.length === 0) {
        message(t("dataScreen.exportNoChart"), { type: "warning" });
        return;
      }
      const scheme = chartColorScheme(deps.isDark());
      const user = useUserStoreHook();
      const { composeSnapshotPng } = await import("@/utils/snapshotComposite");
      const blob = await composeSnapshotPng(
        images.map(item => ({ title: item.title, image: item.image })),
        {
          layout: "flow",
          title: deps.screenTitle(),
          background: scheme.exportBg,
          textColor: scheme.text,
          mutedColor: scheme.textSecondary,
          watermark: `${user.nickname || user.username} ${formatWatermarkTime()}`
        }
      );
      const { downloadBlob, safeFileName } =
        await import("@/utils/imageExport");
      if (!blob) {
        message(t("dataScreen.exportNoChart"), { type: "warning" });
        return;
      }
      downloadBlob(
        blob,
        `${safeFileName(deps.screenTitle(), "screen")}-snapshot.png`
      );
    } finally {
      exporting.value = false;
    }
  };

  return { exporting, exportScreen, exportScreenSnapshot };
}
