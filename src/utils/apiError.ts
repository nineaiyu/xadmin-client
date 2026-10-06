import type { Envelope } from "@/api/types";

/** 失败形态的响应结果：与成功结果组成联合类型后，data 仍可统一访问（恒为 null） */
export type ApiFailureResult = Envelope & { data: null };

/**
 * 请求异常 → 统一响应信封（失败形态）：`code: -1` + 可读 detail。
 *
 * 挂在 api 调用尾部（`.catch(normalizeError)`）把网络异常 / HTTP 层错误归一为
 * 与业务失败同构的结果，调用方只走一套 code/detail 分支——弹窗 beforeSure 里
 * 兜住异常可避免按钮 loading 悬挂，事件回调里兜住可避免 unhandled rejection。
 * detail 优先后端下发的 error.detail（http 层 reject 的是响应错误体），
 * 缺失时回退异常本身的可读字符串。
 */
export function normalizeError(error: unknown): ApiFailureResult {
  const detail = (error as { detail?: unknown } | null | undefined)?.detail;
  return {
    code: -1,
    data: null,
    detail: String(detail ?? error ?? "")
  };
}
