/**
 * 布局 iframe 沙箱令牌解析。
 *
 * frameSrc 由后台菜单配置（meta.frameSrc），不能假定其一定跨源：
 * 同源文档在 allow-scripts + allow-same-origin 组合下可摘除自身 sandbox
 * 并访问父页 DOM，等于无沙箱。因此同源地址自动去掉 allow-same-origin，
 * 跨源保持完整能力；解析失败按同源兜底（fail-closed）。
 */
const FRAME_SANDBOX =
  "allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads";

const SANDBOX_WITHOUT_SAME_ORIGIN = FRAME_SANDBOX.replace(
  "allow-same-origin ",
  ""
);

/** frameSrc 为同源（或无法解析）时不携带 allow-same-origin，其余令牌保持不变 */
export function resolveFrameSandbox(src: string, origin: string): string {
  let parsed: URL;
  try {
    parsed = new URL(src, origin);
  } catch {
    return SANDBOX_WITHOUT_SAME_ORIGIN;
  }
  if (parsed.origin === origin) {
    return SANDBOX_WITHOUT_SAME_ORIGIN;
  }
  return FRAME_SANDBOX;
}
