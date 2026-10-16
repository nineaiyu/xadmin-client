/**
 * 颜色换算：hex ⇄ HSL 三元组。
 *
 * 设计令牌层（tokens/primitives.scss）与运行期主题色都以 HSL 三元组表达颜色，
 * 而颜色选择器 / 站点配置 / 存储沿用的是 hex 字面量；本模块负责两个表示之间的
 * 无损换算（换算结果经浏览器 hsl() 解析后与输入 hex 逐通道一致）。
 */

interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** `#rgb` / `#rrggbb`（可带 `#` 或裸写）→ RGB；非法输入返回 null */
export function hexToRgb(hex: string): Rgb | null {
  const raw = hex.trim().replace(/^#/, "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map(char => char + char)
          .join("")
      : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16)
  };
}

function rgbToHsl({ r, g, b }: Rgb): [number, number, number] {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l * 100];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rr) h = 60 * (((gg - bb) / d) % 6);
  else if (max === gg) h = 60 * ((bb - rr) / d + 2);
  else h = 60 * ((rr - gg) / d + 4);
  if (h < 0) h += 360;
  return [h, s * 100, l * 100];
}

/** 三元组 → RGB（CSS hsl() 的取整口径：逐通道四舍五入） */
export function hslTripletToRgb(triplet: string): Rgb | null {
  const match = triplet.trim().match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  if (!match) return null;
  const h = ((Number(match[1]) % 360) + 360) % 360;
  const s = Number(match[2]) / 100;
  const l = Number(match[3]) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rgb: [number, number, number];
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return {
    r: Math.round((rgb[0] + m) * 255),
    g: Math.round((rgb[1] + m) * 255),
    b: Math.round((rgb[2] + m) * 255)
  };
}

function toHex({ r, g, b }: Rgb): string {
  const part = (value: number) => value.toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

/**
 * hex → `"H S% L%"`（hsl() 的参数列表）。
 *
 * 精度自适应：先按 1 位小数取整，若回代成 RGB 后与输入不一致则提高精度，
 * 保证浏览器按 `hsl(<三元组>)` 解析出的颜色与输入 hex 逐通道一致。
 */
export function hexToHslTriplet(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "";
  const [h, s, l] = rgbToHsl(rgb);
  const matches = (values: number[]) => {
    const back = hslTripletToRgb(`${values[0]} ${values[1]}% ${values[2]}%`);
    return back && back.r === rgb.r && back.g === rgb.g && back.b === rgb.b;
  };
  for (const precision of [1, 2, 3, 4]) {
    const values = [h, s, l].map(value => Number(value.toFixed(precision)));
    if (matches(values)) return `${values[0]} ${values[1]}% ${values[2]}%`;
  }
  const values = [h, s, l].map(value => Number(value.toFixed(4)));
  return `${values[0]} ${values[1]}% ${values[2]}%`;
}

/** `"H S% L%"` → `#RRGGBB`（换算不可解时返回空串） */
export function hslTripletToHex(triplet: string): string {
  const rgb = hslTripletToRgb(triplet);
  return rgb ? toHex(rgb) : "";
}
