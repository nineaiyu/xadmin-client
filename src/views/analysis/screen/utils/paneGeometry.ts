import type { PaneBox } from "./layout";

/**
 * 旋转窗格的几何（纯函数 + 单测）：**视觉盒参与框选 / 对齐 / 吸附**。
 *
 * 两条口径（写死在代码里，调用方只消费）：
 * - **框选命中**：轴对齐选择框与窗格**旋转矩形**做相交（SAT）——只看真正覆盖到的像素；
 * - **对齐 / 分布 / 组拖动夹取 / 移动吸附**：用旋转矩形的**外接轴对齐盒（AABB）**，
 *   并只平移（不改尺寸），因此可以把「视觉盒上的位移」原样施加到未旋转的 x / y 上。
 *
 * 轴对齐角度（0 / ±360…）一律走原路径并**恒等返回**：既避免浮点漂移，也保证
 * 「不旋转时与历史行为逐值一致」（既有 E2E 期望不漂移）。
 */
export type Point = { x: number; y: number };

/** 角度是否等价于 0（含 360 的整数倍）：等价时全部几何退化为轴对齐路径 */
export function isAxisAligned(rotate = 0): boolean {
  return !rotate || Math.abs(Math.round(rotate) % 360) === 0;
}

/** 轴对齐矩形四角（顺时针） */
function cornersOf(box: PaneBox): Point[] {
  return [
    { x: box.x, y: box.y },
    { x: box.x + box.w, y: box.y },
    { x: box.x + box.w, y: box.y + box.h },
    { x: box.x, y: box.y + box.h }
  ];
}

/** 旋转矩形四角（绕几何中心旋转，角度制） */
export function rotatedCorners(box: PaneBox, rotate = 0): Point[] {
  if (isAxisAligned(rotate)) return cornersOf(box);
  const rad = (rotate * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const dx = box.w / 2;
  const dy = box.h / 2;
  return [
    [-dx, -dy],
    [dx, -dy],
    [dx, dy],
    [-dx, dy]
  ].map(([ox, oy]) => ({
    x: cx + ox * cos - oy * sin,
    y: cy + ox * sin + oy * cos
  }));
}

/** 旋转矩形的外接轴对齐盒（轴对齐角度时恒等返回原盒） */
export function rotatedBounds(box: PaneBox, rotate = 0): PaneBox {
  if (isAxisAligned(rotate)) return { ...box };
  const points = rotatedCorners(box, rotate);
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    x: minX,
    y: minY,
    w: Math.max(...xs) - minX,
    h: Math.max(...ys) - minY
  };
}

/** 轴对齐矩形相交判定（**相切算相交**：框选「碰到即选中」更符合直觉） */
export function rectsIntersect(first: PaneBox, second: PaneBox): boolean {
  return !(
    first.x + first.w < second.x ||
    second.x + second.w < first.x ||
    first.y + first.h < second.y ||
    second.y + second.h < first.y
  );
}

/** 多边形各边的法线（SAT 的候选分离轴；矩形只需要 2 条唯一轴，这里按边取即可） */
function edgeNormals(points: Point[]): Point[] {
  const axes: Point[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const next = points[(index + 1) % points.length];
    const current = points[index];
    axes.push({ x: -(next.y - current.y), y: next.x - current.x });
  }
  return axes;
}

/** 把多边形投影到轴上，返回 [min, max] */
function project(points: Point[], axis: Point): [number, number] {
  const values = points.map(point => point.x * axis.x + point.y * axis.y);
  return [Math.min(...values), Math.max(...values)];
}

/**
 * 轴对齐矩形 与 旋转矩形 是否相交（SAT：全部候选轴上都重叠才算相交）。
 * 轴对齐角度走 AABB 快路径（与历史行为逐值一致）。
 */
export function rectIntersectsPane(
  rect: PaneBox,
  box: PaneBox,
  rotate = 0
): boolean {
  if (isAxisAligned(rotate)) return rectsIntersect(rect, box);
  const rectPoints = cornersOf(rect);
  const panePoints = rotatedCorners(box, rotate);
  const axes = [...edgeNormals(rectPoints), ...edgeNormals(panePoints)];
  return axes.every(axis => {
    if (axis.x === 0 && axis.y === 0) return true;
    const [minA, maxA] = project(rectPoints, axis);
    const [minB, maxB] = project(panePoints, axis);
    return minA <= maxB && minB <= maxA;
  });
}
