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
  const e = error as { detail?: unknown; message?: unknown } | null | undefined;
  // 优先级：后端 detail（http 层 reject 的多为响应体对象）→ 异常 message → 入参本身。
  // 对象形态（既无 detail 也无 message，如仅含 code 的响应体）用 JSON 兜底——
  // 旧实现 String(对象) 会得到不可读的 "[object Object]"。
  const raw = e?.detail ?? e?.message ?? error;
  const detail =
    typeof raw === "string"
      ? raw
      : raw == null
        ? ""
        : typeof raw === "object"
          ? (JSON.stringify(raw) ?? "")
          : String(raw);
  return {
    code: -1,
    data: null,
    detail
  };
}
