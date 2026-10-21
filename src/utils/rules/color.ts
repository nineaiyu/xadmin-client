/**
 * 颜色值校验（唯一入口）。
 *
 * 口径与服务端 `ColorField`（`common/core/validators.py::COLOR_PATTERN`）对齐：
 * `#rgb` / `#rgba` / `#rrggbb` / `#rrggbbaa`、`rgb()/rgba()/hsl()/hsla()`、
 * CSS 颜色名。空值由调用方按 required 语义接管。
 */
const COLOR_PATTERN =
  /^(#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})|(rgb|rgba|hsl|hsla)\([^)]*\)|[a-z]+)$/i;

/** 颜色值判定 */
export function isColorValue(value: unknown): boolean {
  return COLOR_PATTERN.test(String(value ?? "").trim());
}
