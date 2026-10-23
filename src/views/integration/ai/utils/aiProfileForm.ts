import type { AiProfileItem } from "@/api/ai/ai";

/** 档案用途（与后端 AiProfile.Purpose 同口径） */
export type AiProfilePurpose = "chat" | "structured" | "embedding";

/**
 * 档案表单模型：字段与后端 AiProfile 一一对应。
 *
 * 采样参数统一给出推荐默认值（而非 null）：新建档案开箱即用。
 * 编辑历史档案时保留库内 null（面板显示「未设置」），避免仅打开编辑就
 * 把「未配置」悄悄写成推荐值、改变模型实际行为。
 */
export type AiProfileFormModel = {
  name: string;
  base_url: string;
  api_key: string;
  model: string;
  temperature: number | null;
  max_tokens: number | null;
  top_p: number | null;
  frequency_penalty: number | null;
  presence_penalty: number | null;
  stop: string;
  seed: number | null;
  timeout: number;
  max_retries: number;
  context_limit: number;
  persona: string;
  purpose: AiProfilePurpose;
  is_active: boolean;
  remark: string;
};

/** 推荐默认值：与 OpenAI 兼容接口的常用口径及后端结构化上限保持一致 */
export const AI_PROFILE_DEFAULTS: Readonly<AiProfileFormModel> = {
  name: "",
  base_url: "",
  api_key: "",
  model: "",
  temperature: 0.2,
  max_tokens: 2048,
  top_p: 1,
  frequency_penalty: 0,
  presence_penalty: 0,
  stop: "",
  seed: null,
  timeout: 60,
  max_retries: 2,
  context_limit: 20,
  persona: "",
  purpose: "chat",
  is_active: false,
  remark: ""
};

const positiveOr = (
  value: number | null | undefined,
  fallback: number,
  min: number
): number =>
  value === null || value === undefined || value < min ? fallback : value;

/**
 * 行数据 → 表单模型。
 *
 * - 编辑时 api_key 永远留空（后端不回传明文，留空 = 沿用原密钥）；
 * - 可空采样参数保持库内 null（不写回推荐值），保存载荷原样提交 null；
 * - 0 值按字段语义处理：temperature / penalty 的 0 合法保留，
 *   timeout / context_limit 的 0 视为未配置（模型层非空字段）。
 */
export function createAiProfileForm(
  row?: AiProfileItem | null
): AiProfileFormModel {
  if (!row) return { ...AI_PROFILE_DEFAULTS };

  const maxTokens = row.max_tokens;
  return {
    name: row.name ?? "",
    base_url: row.base_url ?? "",
    api_key: "",
    model: row.model ?? "",
    temperature: row.temperature ?? null,
    max_tokens:
      typeof maxTokens === "number" ? positiveOr(maxTokens, 2048, 1) : null,
    top_p: row.top_p ?? null,
    frequency_penalty: row.frequency_penalty ?? null,
    presence_penalty: row.presence_penalty ?? null,
    stop: row.stop ?? "",
    seed: row.seed ?? null,
    timeout: positiveOr(row.timeout, AI_PROFILE_DEFAULTS.timeout, 5),
    max_retries: positiveOr(
      row.max_retries,
      AI_PROFILE_DEFAULTS.max_retries,
      0
    ),
    context_limit: positiveOr(
      row.context_limit,
      AI_PROFILE_DEFAULTS.context_limit,
      2
    ),
    persona: row.persona ?? "",
    purpose: (row.purpose as AiProfilePurpose) ?? "chat",
    is_active: Boolean(row.is_active),
    remark: row.remark ?? ""
  };
}

/** 表单模型 → 提交载荷；编辑时 api_key 留空表示沿用原密钥（不下发） */
export function buildAiProfilePayload(
  form: AiProfileFormModel,
  isEdit: boolean
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: form.name.trim(),
    base_url: form.base_url.trim(),
    model: form.model.trim(),
    temperature: form.temperature,
    max_tokens: form.max_tokens,
    top_p: form.top_p,
    frequency_penalty: form.frequency_penalty,
    presence_penalty: form.presence_penalty,
    stop: form.stop,
    seed: form.seed,
    timeout: form.timeout,
    max_retries: form.max_retries,
    context_limit: form.context_limit,
    persona: form.persona,
    purpose: form.purpose,
    is_active: form.is_active,
    remark: form.remark
  };
  if (!isEdit || form.api_key) {
    payload.api_key = form.api_key;
  }
  return payload;
}
