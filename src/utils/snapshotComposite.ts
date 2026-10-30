import type { ExportedImage } from "@/utils/imageExport";

/**
 * 仪表盘 / 大屏快照合成（纯前端，零新依赖）：逐卡图表位图（renderEchartsImage
 * 产物）合成为单张 PNG 长图，叠加标题 / 时间戳 / 水印，浏览器直接下载。
 *
 * 两种布局：
 * - flow  纵向流式（等宽逐卡下排）——大屏 ZIP 导出的同源图像序列复用；
 * - grid  坐标还原（按卡片在页面上的实际矩形摆放）——仪表盘按 el-card rect 采样。
 *
 * canvas 绘制链路依赖浏览器环境（jsdom 无 2d 上下文），纯逻辑（flow 布局计算、
 * 水印网格参数）独立导出供 vitest 覆盖。
 */

export interface SnapshotTile {
  /** 卡片标题（绘制在图块上方） */
  title: string;
  /** 图表位图（null = 无图表的占位卡，画空框明示降级） */
  image: ExportedImage | null;
  /** grid 布局坐标（相对内容区，px）；flow 布局忽略 */
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface SnapshotOptions {
  title: string;
  /** 已格式化的时间戳文本（缺省取当前时间） */
  timestamp?: string;
  /** 水印文本（空 = 不叠加） */
  watermark?: string;
  /** 降级说明（如「2 个卡未含图表」），画在页眉右侧 */
  note?: string;
  /** 画布与卡片底色（跟随主题的 exportBg，保证与图表底色一致） */
  background: string;
  /** 页眉 / 卡片标题文本色（亮暗主题分别传） */
  textColor: string;
  /** 次级色（时间戳 / 卡片描边 / 占位符 / 水印），取配色方案 textSecondary */
  mutedColor: string;
  layout: "flow" | "grid";
  /** flow 布局内容宽度（默认 1080） */
  targetWidth?: number;
  /** grid 布局内容区尺寸（rect 空间的宽高，必传） */
  canvasWidth?: number;
  canvasHeight?: number;
}

const FLOW_DEFAULT_WIDTH = 1080;
const PADDING = 24;
const HEADER_HEIGHT = 72;
const TILE_TITLE_HEIGHT = 34;
const TILE_GAP = 16;
const PLACEHOLDER_MIN_HEIGHT = 200;
/** canvas 单边像素上限（Chromium 16384 截断保护，留余量） */
const CANVAS_MAX_EDGE = 15_000;
/** 水印平铺网格参数（独立导出供测试） */
export const WATERMARK_GRID = {
  gapX: 260,
  gapY: 170,
  rotate: -0.38,
  alpha: 0.05,
  fontSize: 15
};

interface TileBox {
  tile: SnapshotTile;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** flow 布局计算（纯函数）：返回每卡盒位与内容总高（不含页眉 / 内边距） */
export function layoutFlowTiles(
  tiles: { title: string; aspect: number | null }[],
  targetWidth: number
): {
  boxes: { x: number; y: number; width: number; height: number }[];
  totalHeight: number;
} {
  const boxes: { x: number; y: number; width: number; height: number }[] = [];
  let y = 0;
  tiles.forEach(item => {
    // 无图（指标卡占位）给固定最小高度；有图按等比换算
    const imageHeight = item.aspect
      ? Math.max(Math.round(targetWidth / item.aspect), PLACEHOLDER_MIN_HEIGHT)
      : PLACEHOLDER_MIN_HEIGHT;
    boxes.push({
      x: 0,
      y,
      width: targetWidth,
      height: TILE_TITLE_HEIGHT + imageHeight
    });
    y += TILE_TITLE_HEIGHT + imageHeight + TILE_GAP;
  });
  return { boxes, totalHeight: Math.max(y - TILE_GAP, 0) };
}

/** blob → HTMLImageElement（objectURL 方式，Safari/WebKit 稳定）；失败返回 null */
function loadImage(blob: Blob): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    const done = (result: HTMLImageElement | null) => {
      URL.revokeObjectURL(url);
      resolve(result);
    };
    image.onload = () => done(image);
    image.onerror = () => done(null);
    image.src = url;
  });
}

function drawRoundedCard(
  ctx: CanvasRenderingContext2D,
  box: TileBox,
  background: string,
  textColor: string,
  mutedColor: string
) {
  const radius = 10;
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(box.x, box.y, box.width, box.height, radius);
  } else {
    // 旧 WebKit 无 roundRect：直角矩形降级（仅圆角视觉差异）
    ctx.rect(box.x, box.y, box.width, box.height);
  }
  ctx.fillStyle = background;
  ctx.fill();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = mutedColor;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.globalAlpha = 1;
  // 卡片标题（超宽截断，避免长标题压住图表区）
  ctx.fillStyle = textColor;
  ctx.font = "600 15px system-ui, -apple-system, sans-serif";
  ctx.textBaseline = "middle";
  const maxTitleWidth = box.width - 24;
  let title = String(box.tile.title ?? "");
  while (ctx.measureText(title).width > maxTitleWidth && title.length > 1) {
    title = `${title.slice(0, -2)}…`;
  }
  ctx.fillText(title, box.x + 12, box.y + TILE_TITLE_HEIGHT / 2 + 4);
}

function drawTileContent(
  ctx: CanvasRenderingContext2D,
  box: TileBox,
  image: HTMLImageElement | null,
  mutedColor: string
) {
  const areaX = box.x + 10;
  const areaY = box.y + TILE_TITLE_HEIGHT;
  const areaW = box.width - 20;
  const areaH = box.height - TILE_TITLE_HEIGHT - 10;
  if (!image) {
    // 占位卡：明示「无图表」（指标卡等非图表内容不在快照内）
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = mutedColor;
    ctx.font = "13px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("—", areaX + areaW / 2, areaY + areaH / 2);
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;
    return;
  }
  // contain：等比缩放并居中绘制到图区
  const scale = Math.min(areaW / image.width, areaH / image.height, 1);
  const w = image.width * scale;
  const h = image.height * scale;
  ctx.drawImage(image, areaX + (areaW - w) / 2, areaY + (areaH - h) / 2, w, h);
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  options: SnapshotOptions,
  width: number,
  textColor: string,
  mutedColor: string
) {
  ctx.fillStyle = textColor;
  ctx.font = "700 22px system-ui, -apple-system, sans-serif";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(options.title, PADDING, PADDING + 26);
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = mutedColor;
  ctx.font = "13px system-ui, -apple-system, sans-serif";
  const timestamp =
    options.timestamp ?? new Date().toLocaleString("sv-SE").replace("T", " ");
  ctx.fillText(timestamp, PADDING, PADDING + 50);
  if (options.note) {
    ctx.textAlign = "right";
    ctx.fillText(options.note, width - PADDING, PADDING + 50);
    ctx.textAlign = "left";
  }
  ctx.globalAlpha = 1;
}

/** 水印平铺（斜排网格；与站点水印同思路的低干扰参数） */
function drawWatermark(
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number,
  height: number,
  mutedColor: string
) {
  ctx.save();
  ctx.globalAlpha = WATERMARK_GRID.alpha;
  ctx.fillStyle = mutedColor;
  ctx.font = `${WATERMARK_GRID.fontSize}px system-ui, -apple-system, sans-serif`;
  ctx.rotate(WATERMARK_GRID.rotate);
  const diagonal = width + height;
  for (let x = -height; x < diagonal; x += WATERMARK_GRID.gapX) {
    for (let y = 0; y < diagonal; y += WATERMARK_GRID.gapY) {
      ctx.fillText(text, x, y);
    }
  }
  ctx.restore();
}

/**
 * 合成快照 PNG；tiles 全部无图或 canvas 不可用时返回 null（调用方提示）。
 */
export async function composeSnapshotPng(
  tiles: SnapshotTile[],
  options: SnapshotOptions
): Promise<Blob | null> {
  if (tiles.length === 0) return null;
  const { background, textColor, mutedColor } = options;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // 位图先行加载（布局需要图像宽高比）
  const images = await Promise.all(
    tiles.map(tile => (tile.image ? loadImage(tile.image.blob) : null))
  );

  let contentWidth: number;
  let boxes: TileBox[];
  let contentHeight: number;
  if (options.layout === "grid") {
    contentWidth = options.canvasWidth ?? 0;
    boxes = tiles.map(tile => ({
      tile,
      x: tile.x ?? 0,
      y: tile.y ?? 0,
      width: tile.width ?? 0,
      height: tile.height ?? 0
    }));
    contentHeight =
      options.canvasHeight ??
      boxes.reduce((max, box) => Math.max(max, box.y + box.height), 0);
  } else {
    contentWidth = options.targetWidth ?? FLOW_DEFAULT_WIDTH;
    const aspects = tiles.map((_tile, index) => {
      const image = images[index];
      return image && image.height > 0 ? image.width / image.height : null;
    });
    const { boxes: flowBoxes, totalHeight } = layoutFlowTiles(
      tiles.map((tile, index) => ({
        title: tile.title,
        aspect: aspects[index]
      })),
      contentWidth
    );
    boxes = flowBoxes.map((box, index) => ({ tile: tiles[index], ...box }));
    contentHeight = totalHeight;
  }

  const fullWidth = contentWidth + PADDING * 2;
  const fullHeight = HEADER_HEIGHT + contentHeight + PADDING * 2;
  // 超高长图整体缩放（浏览器 canvas 尺寸上限），清晰度优先保宽
  const scale = Math.min(
    1,
    CANVAS_MAX_EDGE / fullWidth,
    CANVAS_MAX_EDGE / fullHeight
  );
  canvas.width = Math.round(fullWidth * scale);
  canvas.height = Math.round(fullHeight * scale);
  ctx.scale(scale, scale);

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, fullWidth, fullHeight);
  drawHeader(ctx, options, fullWidth, textColor, mutedColor);
  ctx.translate(PADDING, HEADER_HEIGHT);
  boxes.forEach((box, index) => {
    drawRoundedCard(ctx, box, background, textColor, mutedColor);
    drawTileContent(ctx, box, images[index], mutedColor);
  });
  if (options.watermark) {
    ctx.translate(-PADDING, -HEADER_HEIGHT);
    drawWatermark(ctx, options.watermark, fullWidth, fullHeight, mutedColor);
  }
  return await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
}
