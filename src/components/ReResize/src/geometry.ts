/** 绝对定位盒模型（单位 px，相对父容器左上角） */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 尺寸 / 边界约束 */
export interface BoxConstraints {
  minw: number;
  minh: number;
  /** 等比缩放（保持起手时宽高比） */
  aspectRatio: boolean;
  /** 限制在父容器内 */
  parentLimitation: boolean;
  parentW: number;
  parentH: number;
}

const hasR = (dir: string) => dir.includes("r");
const hasL = (dir: string) => dir.includes("l");
const hasT = (dir: string) => dir.includes("t");
const hasB = (dir: string) => dir.includes("b");

/** 尺寸不超父容器、位置不越界 */
export function clampToParent(box: Box, parentW: number, parentH: number): Box {
  const w = Math.min(box.w, parentW);
  const h = Math.min(box.h, parentH);
  return {
    w,
    h,
    x: Math.min(Math.max(box.x, 0), Math.max(parentW - w, 0)),
    y: Math.min(Math.max(box.y, 0), Math.max(parentH - h, 0))
  };
}

/**
 * 拖动：在起手盒模型上叠加位移，受父容器约束时钳制在边界内。
 */
export function dragBox(
  start: Box,
  dx: number,
  dy: number,
  opts: BoxConstraints
): Box {
  let nx = start.x + dx;
  let ny = start.y + dy;
  if (opts.parentLimitation) {
    nx = Math.min(Math.max(nx, 0), Math.max(opts.parentW - start.w, 0));
    ny = Math.min(Math.max(ny, 0), Math.max(opts.parentH - start.h, 0));
  }
  return { x: nx, y: ny, w: start.w, h: start.h };
}

/**
 * 缩放：`dir` 为方位（tl/tm/tr/mr/br/bm/bl/ml 的组合，含 l/r/t/b 即含该边），
 * 依次施加位移 → 等比 → 最小尺寸 → 父容器约束。
 */
export function resizeBox(
  start: Box,
  dir: string,
  dx: number,
  dy: number,
  opts: BoxConstraints
): Box {
  const { x, y, w, h } = start;
  let nx = x;
  let ny = y;
  let nw = w;
  let nh = h;

  if (hasR(dir)) nw = w + dx;
  if (hasL(dir)) {
    nw = w - dx;
    nx = x + dx;
  }
  if (hasB(dir)) nh = h + dy;
  if (hasT(dir)) {
    nh = h - dy;
    ny = y + dy;
  }

  if (opts.aspectRatio && w > 0 && h > 0) {
    const ratio = w / h;
    if (hasL(dir) || hasR(dir)) {
      nh = nw / ratio;
      if (hasT(dir)) ny = y + (h - nh);
    } else {
      nw = nh * ratio;
    }
  }

  if (nw < opts.minw) {
    if (hasL(dir)) nx = x + (w - opts.minw);
    nw = opts.minw;
  }
  if (nh < opts.minh) {
    if (hasT(dir)) ny = y + (h - opts.minh);
    nh = opts.minh;
  }

  if (opts.parentLimitation) {
    if (nx < 0) {
      nw += nx;
      nx = 0;
    }
    if (ny < 0) {
      nh += ny;
      ny = 0;
    }
    if (nx + nw > opts.parentW) nw = opts.parentW - nx;
    if (ny + nh > opts.parentH) nh = opts.parentH - ny;
    nw = Math.max(nw, opts.minw);
    nh = Math.max(nh, opts.minh);
  }

  return { x: nx, y: ny, w: nw, h: nh };
}
