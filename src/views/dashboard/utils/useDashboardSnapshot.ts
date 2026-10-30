import { ref, type Ref, type ComputedRef } from "vue";
import { useI18n } from "vue-i18n";
import { useDark } from "@pureadmin/utils";
import { message } from "@/utils/message";
import { chartColorScheme } from "@/utils/chartTheme";
import { useUserStoreHook } from "@/store/modules/user";
import { formatWatermarkTime } from "@/utils/watermark";
import type { DashboardItem } from "@/api/dataset/datasets";
import type { SnapshotTile } from "@/utils/snapshotComposite";
import type { CardImageHandle } from "./useCardImageExport";

/**
 * 仪表盘快照导出：按卡片在页面上的实际矩形（grid 布局）把逐卡图表位图
 * 合成为单张 PNG 长图（标题 / 时间戳 / 水印叠加），浏览器直接下载。
 * 指标卡（无图表实例）以占位框导出并在页眉注明数量——分享场景「有图可看」
 * 优先，不为快照引入服务端渲染。
 */
export function useDashboardSnapshot(deps: {
  layout: ComputedRef<{ id: string; title?: string | null }[]>;
  current: Ref<DashboardItem | null>;
  cardRefs: Ref<Record<string, CardImageHandle | undefined>>;
  rowEl: () => HTMLElement | null;
}) {
  const { t } = useI18n();
  // 必须用 @pureadmin/utils 的 useDark：@vueuse/core 的 useDark 会自行切换
  // documentElement 的 dark class，进入仪表盘即把站点主题改成黑色。
  const { isDark: dark } = useDark();
  const exporting = ref(false);
  const { layout, current, cardRefs, rowEl } = deps;

  const exportDashboardSnapshot = async () => {
    if (exporting.value || !layout.value.length) return;
    exporting.value = true;
    try {
      const row = rowEl();
      if (!row) return;
      const origin = row.getBoundingClientRect();
      const tiles: SnapshotTile[] = [];
      let missing = 0;
      for (const card of layout.value) {
        const el = row.querySelector(`[data-card-id="${card.id}"]`);
        const rect = el?.getBoundingClientRect();
        // 无 DOM（卡片未挂载）跳过；有 DOM 无图表（指标卡）按占位导出
        if (!rect) continue;
        const image = (await cardRefs.value[card.id]?.renderImage?.()) ?? null;
        if (!image) missing += 1;
        tiles.push({
          title: String(card.title ?? ""),
          image,
          x: rect.left - origin.left,
          y: rect.top - origin.top,
          width: rect.width,
          height: rect.height
        });
      }
      if (tiles.length === 0) {
        message(t("dashboard.exportNoChart"), { type: "warning" });
        return;
      }
      const scheme = chartColorScheme(dark.value);
      const user = useUserStoreHook();
      const { composeSnapshotPng } = await import("@/utils/snapshotComposite");
      const blob = await composeSnapshotPng(tiles, {
        layout: "grid",
        title: String(current.value?.name ?? t("dashboard.title")),
        canvasWidth: origin.width,
        canvasHeight: tiles.reduce(
          (max, tile) => Math.max(max, (tile.y ?? 0) + (tile.height ?? 0)),
          0
        ),
        background: scheme.exportBg,
        textColor: scheme.text,
        mutedColor: scheme.textSecondary,
        watermark: `${user.nickname || user.username} ${formatWatermarkTime()}`,
        note: missing
          ? t("dashboard.exportSnapshotNote", { count: missing })
          : undefined
      });
      if (!blob) {
        message(t("dashboard.exportNoChart"), { type: "warning" });
        return;
      }
      const { downloadBlob, safeFileName } =
        await import("@/utils/imageExport");
      downloadBlob(
        blob,
        `${safeFileName(String(current.value?.name ?? "dashboard"), "dashboard")}-snapshot.png`
      );
    } finally {
      exporting.value = false;
    }
  };

  return { exporting, exportDashboardSnapshot };
}
