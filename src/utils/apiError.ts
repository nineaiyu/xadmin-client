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
/**
 * 本地即时失败 → 统一响应信封（失败形态）。
 *
 * 用于「不经过 axios、但需要以同一个 code/detail 契约返回」的场景
 * （弹窗 beforeSure、本地校验、组件内 catch）：避免逐处手写 `{code:-1,...}`
 * 时漏掉 detail 归一或形状漂移。`data` 可传调用点需要的占位形状（默认 null）。
 */
export type ApiFailure<T = null> = Envelope & { data: T; detail: string };

export function apiFailure<T = null>(
  error: unknown,
  data: T = null as T,
  extra: Record<string, unknown> = {}
): ApiFailure<T> & Record<string, unknown> {
  const detail =
    typeof error === "string" ? error : normalizeError(error).detail;
  // `type` 是业务协议字段（如 approval_required），调用方靠它分流；随失败壳保留
  const type =
    error && typeof error === "object" && "type" in error
      ? { type: (error as { type?: unknown }).type }
      : {};
  return {
    code: -1,
    data,
    detail,
    ...type,
    ...extra
  } as ApiFailure<T> & Record<string, unknown>;
}

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
