/**
 * 颜色对比度工具（WCAG 相对亮度口径）。
 *
 * 背景：命令面板/搜索历史的**选中态**以用户自定义主色（`epThemeColor`，hex）
 * 为底、此前写死白字——主色可经「设置面板 → 语义色」自定义，浅色主色
 * （金色/浅蓝系）上白字的对比度会跌破 WCAG 4.5:1。此处按底色亮度在
 * 消费方传入的两档语义前景（CSS 变量串）中取更安全的一档。
 */

/** hex（#rgb / #rrggbb）→ [r, g, b]（0~255）；不合法返回 null */
function hexToRgb(hex: string): [number, number, number] | null {
  const value = hex.trim().replace(/^#/, "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map(ch => ch + ch)
          .join("")
      : value;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16)
  ];
}

/** sRGB 通道 → 相对亮度用的线性值 */
function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG 相对亮度（0 黑 ~ 1 白）；不合法输入返回 null（调用方按暗底保守处理） */
export function relativeLuminance(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return (
    0.2126 * linearize(rgb[0]) +
    0.7152 * linearize(rgb[1]) +
    0.0722 * linearize(rgb[2])
  );
}

/** 两档候选的切换阈值：白（L=1）与近黑正文（L≈0.032）在任意底色上对比度的交点 */
const FLIP_LUMINANCE = 0.24;

/**
 * 选中态前景色：底色偏亮 → 取配亮底的前景（深色文字），偏暗 → 取配暗底的
 * 前景（浅色文字）。候选由消费方传入语义色（CSS 变量串，避免裸色值）；
 * 底色缺失或不合法（非 hex / 空值）时保守回落 darkForeground（= 修复前的
 * 白字行为）——入参允许 undefined，对齐 epThemeColor 存储值的类型面。
 */
export function pickSelectedForeground(
  backgroundHex: string | undefined,
  lightBackgroundForeground: string,
  darkBackgroundForeground: string
): string {
  const luminance = backgroundHex ? relativeLuminance(backgroundHex) : null;
  if (luminance === null) return darkBackgroundForeground;
  return luminance > FLIP_LUMINANCE
    ? lightBackgroundForeground
    : darkBackgroundForeground;
}
