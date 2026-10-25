// 仅类型引用（不进包）：下载实现按需动态加载（保持首屏体积）
import type { ExportedImage } from "@/utils/imageExport";
import type { DashboardCard } from "@/api/dataset/datasets";

/**
 * 大屏导出的实现域（纯函数下沉，useScreenExport 只留接线）：
 * 图片收集（画布逐窗格 / 轮播逐卡）与 ZIP 组装（安全文件名 + 逐卡条目）。
 */

/** 收集句柄按需最小化（只要求渲染图片能力）：轮播卡与窗格宿主按结构化类型兼容 */
export type CardRenderHandle = {
  renderImage?: () => Promise<ExportedImage | null>;
};

export type PaneRenderHandle = {
  renderImages: () => Promise<{ title: string; image: ExportedImage }[]>;
};

export type CollectedImage = { title: string; image: ExportedImage };

/** 收集当前屏的卡片图片：返回 total 供「跳过数」提示计算未渲染成功的卡片数 */
export async function collectScreenImages(deps: {
  isCanvas: boolean;
  /** 轮播模式：当前看板卡片（应有图片数 = 卡片数） */
  currentCards: Pick<DashboardCard, "id" | "title">[];
  cardRefs: Record<string, CardRenderHandle | undefined>;
  paneRefs: Record<string, PaneRenderHandle | null>;
  /** 画布模式：可见窗格与其卡片列表（应有图片数 = 窗格卡片数之和） */
  layoutPanes: { dashboard?: string }[];
  paneCards: (_pane: { dashboard?: string }) => DashboardCard[];
}): Promise<{ images: CollectedImage[]; total: number }> {
  const images: CollectedImage[] = [];
  if (deps.isCanvas) {
    const total = deps.layoutPanes.reduce(
      (count, pane) => count + deps.paneCards(pane).length,
      0
    );
    for (const handle of Object.values(deps.paneRefs)) {
      if (!handle) continue;
      for (const item of await handle.renderImages()) {
        images.push({ title: item.title, image: item.image });
      }
    }
    return { images, total };
  }
  for (const card of deps.currentCards) {
    const image = await deps.cardRefs[card.id]?.renderImage?.();
    if (image) images.push({ title: card.title, image });
  }
  return { images, total: deps.currentCards.length };
}

/** 逐卡图片组装为 ZIP 条目（安全文件名 + 序号兜底，重名不互相覆盖） */
export async function buildScreenZipEntries(
  images: CollectedImage[]
): Promise<{ name: string; data: Uint8Array }[]> {
  const { safeFileName } = await import("@/utils/imageExport");
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
  return files;
}
