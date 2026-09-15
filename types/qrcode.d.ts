/**
 * `qrcode` 包未随包发布类型声明，这里补最小宽松声明（本项目仅使用渲染 API）。
 * 需要更严格类型时可引入 `@types/qrcode`，届时删除本文件即可。
 */
declare module "qrcode" {
  export type QRCodeRenderersOptions = Record<string, unknown>;
  export type QRCodeToDataURLOptions = Record<string, unknown>;
  export function toDataURL(...args: unknown[]): Promise<string>;
  export function toCanvas(...args: unknown[]): Promise<void>;
  export function toString(...args: unknown[]): Promise<string>;
  const QRCode: {
    toDataURL: typeof toDataURL;
    toCanvas: typeof toCanvas;
    toString: typeof toString;
  };
  export default QRCode;
}
