/**
 * 敏感操作审批（code=1002）一次性令牌暂存。
 *
 * 独立成模块的理由：http 拦截器与用户 store（登出清理）都要用它，放在
 * `utils/http/index.ts` 会让 store ↔ http 形成模块循环依赖。
 *
 * 契约：
 * - 后端拦截点返回 412 + type=approval_required 时写入（key = method+url+body 指纹）；
 * - 审批通过后重发同一请求时由请求拦截器取出并携带 `X-Approval-Id` 头；
 * - 消费成功（业务码 1000）或被拒（403）后清除；一次性通行令牌，跨指纹不串用。
 *
 * 实现要点：
 * - 指纹用「键排序后的稳定序列化 + 短哈希」，与后端 canonical_params（sort_keys）
 *   口径对齐，且不把原始请求体（可能含敏感字段）长驻内存；
 * - 消费/删除按请求拦截器写入的 `config._approvalKey`：axios 会在 dispatchRequest
 *   里把 config.data 改写成序列化字符串，响应期重算 key 必然与写入期不一致
 *   （历史缺陷：令牌清不掉，下次同请求误带已消费令牌 → 403）；
 * - 条目带 TTL 与容量上限：用户放弃审批（不重发）的条目会被淘汰。
 */

type PendingApproval = { approvalId: string; ts: number };

const pendingApprovals = new Map<string, PendingApproval>();

/** 暂存条目 TTL 与容量上限（Map 保插入序，超限淘汰最旧） */
const APPROVAL_STORE_TTL = 30 * 60 * 1000;
const APPROVAL_STORE_MAX = 50;

/** 键排序的稳定序列化（对齐后端 canonical_params 的 sort_keys 口径） */
const stableStringify = (data: unknown): string => {
  try {
    return (
      JSON.stringify(data, (_key, value) => {
        if (value && typeof value === "object" && !Array.isArray(value)) {
          return Object.keys(value)
            .sort()
            .reduce<Record<string, unknown>>((acc, key) => {
              acc[key] = (value as Record<string, unknown>)[key];
              return acc;
            }, {});
        }
        return value;
      }) ?? ""
    );
  } catch {
    return "";
  }
};

/** djb2 短哈希：只保留指纹摘要，不驻留原始请求体 */
const hashFingerprint = (input: string): string => {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
};

/**
 * 仅普通对象/数组参与指纹：FormData/Blob/ArrayBuffer 序列化结果恒为 "{}"，
 * 不同上传会互相碰撞，故不暂存（后端 multipart 场景也不开放审批，登记边界）。
 * 字符串（axios 已序列化的 body）同样不参与，避免二次计算得到不同 key。
 */
const isFingerprintable = (data: unknown): boolean =>
  data === undefined ||
  data === null ||
  (typeof data === "object" &&
    !(data instanceof FormData) &&
    !(data instanceof Blob) &&
    !(data instanceof ArrayBuffer));

/** 请求指纹 key：不参与指纹的载荷返回空串（调用方需按空串跳过） */
export const approvalKey = (
  method: string,
  url: string,
  data?: unknown
): string => {
  if (!isFingerprintable(data)) return "";
  return `${(method ?? "get").toUpperCase()}:${url}:${hashFingerprint(
    stableStringify(data)
  )}`;
};

/** 过期条目清理 + 容量保护 */
const prunePendingApprovals = () => {
  const now = Date.now();
  for (const [key, entry] of pendingApprovals) {
    if (now - entry.ts > APPROVAL_STORE_TTL) pendingApprovals.delete(key);
  }
  while (pendingApprovals.size >= APPROVAL_STORE_MAX) {
    const oldest = pendingApprovals.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    pendingApprovals.delete(oldest);
  }
};

/** 暂存审批令牌（key 为空表示该载荷不参与指纹，直接跳过） */
export const setPendingApproval = (
  key: string | undefined,
  approvalId: string
) => {
  if (!key) return;
  prunePendingApprovals();
  pendingApprovals.set(key, { approvalId, ts: Date.now() });
};

/** 取出审批令牌（过期条目顺带淘汰） */
export const takePendingApproval = (key: string): string | undefined => {
  if (!key) return undefined;
  const entry = pendingApprovals.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > APPROVAL_STORE_TTL) {
    pendingApprovals.delete(key);
    return undefined;
  }
  return entry.approvalId;
};

/** 删除指定指纹的暂存令牌（消费成功 / 被拒后调用） */
export const deletePendingApproval = (key: string | undefined) => {
  if (key) pendingApprovals.delete(key);
};

/** 清空暂存的审批令牌（登出/会话切换时调用：令牌绑定申请人，跨会话无效） */
export function clearPendingApprovals() {
  pendingApprovals.clear();
}
