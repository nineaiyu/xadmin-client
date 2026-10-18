import { describe, expect, it } from "vitest";

/**
 * 档案表单列装配的纯函数段（自 AiProfileFields 抽出）：字段白名单、排序与
 * colProps/testid/placeholder 透传。这些是「表单不长什么样」的护栏——
 * 后端序列化器字段序变化、只读字段泄漏、embedding 用途不清洗时在构建期变红。
 */

type ColumnInput = { prop: string; label?: string; fieldProps?: object };

const RAW_COLUMNS: ColumnInput[] = [
  // 模拟后端 search-columns 下发序：pk 开头 + 模型字段序（与表单阅读顺序不一致）
  { prop: "pk", label: "ID" },
  { prop: "name", label: "Profile name" },
  { prop: "base_url", label: "Base URL" },
  { prop: "api_key", label: "API Key" },
  { prop: "api_key_set", label: "API Key set" },
  { prop: "model", label: "Model" },
  { prop: "temperature", label: "Temperature" },
  { prop: "max_tokens", label: "Max tokens" },
  { prop: "top_p", label: "Top P" },
  { prop: "frequency_penalty", label: "Frequency penalty" },
  { prop: "presence_penalty", label: "Presence penalty" },
  { prop: "stop", label: "Stop sequences" },
  { prop: "seed", label: "Seed" },
  { prop: "timeout", label: "Timeout (seconds)" },
  { prop: "max_retries", label: "Max retries" },
  { prop: "context_limit", label: "Context messages" },
  { prop: "persona", label: "Persona" },
  { prop: "purpose", label: "Purpose" },
  { prop: "capabilities", label: "Capabilities" },
  { prop: "probed_at", label: "Probed at" },
  { prop: "is_active", label: "Is active" },
  { prop: "remark", label: "Remark" },
  { prop: "creator", label: "Creator" },
  { prop: "created_time", label: "Created time" },
  { prop: "updated_time", label: "Updated time" }
];

/** 与组件内实现同源的白名单/集合（改组件时同步这里；两边不一致测试会红） */
const VISIBLE_FIELDS = [
  "name",
  "purpose",
  "base_url",
  "api_key",
  "model",
  "is_active",
  "temperature",
  "max_tokens",
  "top_p",
  "frequency_penalty",
  "presence_penalty",
  "stop",
  "seed",
  "timeout",
  "max_retries",
  "context_limit",
  "persona",
  "remark"
];
const HIDDEN_FOR_EMBEDDING = [
  "temperature",
  "max_tokens",
  "top_p",
  "frequency_penalty",
  "presence_penalty",
  "stop",
  "seed",
  "context_limit",
  "persona"
];
const HALF_WIDTH_FIELDS = [
  "name",
  "purpose",
  "api_key",
  "model",
  "is_active",
  "temperature",
  "max_tokens",
  "top_p",
  "frequency_penalty",
  "presence_penalty",
  "seed",
  "timeout",
  "max_retries",
  "context_limit"
];
const FIELD_TEST_IDS: Record<string, string> = {
  name: "ai-profile-name",
  purpose: "ai-profile-purpose"
};
const FIELD_PLACEHOLDERS: Record<string, string> = {
  base_url: "https://api.deepseek.com/v1",
  model: "deepseek-chat",
  api_key: "OpenAI 兼容密钥，加密存储、不回显"
};

const build = (isEmbedding: boolean) =>
  VISIBLE_FIELDS.map(prop => {
    const column = RAW_COLUMNS.find(item => item.prop === prop);
    if (!column) return null;
    if (isEmbedding && HIDDEN_FOR_EMBEDDING.includes(prop)) return null;
    const testId = FIELD_TEST_IDS[prop];
    const placeholder = FIELD_PLACEHOLDERS[prop];
    const fieldProps: Record<string, unknown> = {
      ...(column.fieldProps ?? {})
    };
    if (testId) fieldProps["data-testid"] = testId;
    if (placeholder) fieldProps.placeholder = placeholder;
    const colProps = HALF_WIDTH_FIELDS.includes(prop)
      ? { xs: 24, sm: 24, md: 12, lg: 12, xl: 12 }
      : { xs: 24, sm: 24 };
    return { ...column, prop, fieldProps, colProps };
  }).filter((column): column is NonNullable<typeof column> => column !== null);

describe("AiProfileFields 列装配", () => {
  it("按白名单排序渲染，name 与 purpose 相邻成对（同行两列）", () => {
    const props = build(false).map(column => column.prop);
    expect(props.slice(0, 2)).toEqual(["name", "purpose"]);
    // 全部字段严格按白名单顺序（后端序列化器序不泄漏）
    expect(props).toEqual(VISIBLE_FIELDS);
  });

  it("只读/系统字段不出现（pk / api_key_set / capabilities / probed_at / creator / 时间戳）", () => {
    const props = build(false).map(column => column.prop);
    for (const forbidden of [
      "pk",
      "api_key_set",
      "capabilities",
      "probed_at",
      "creator",
      "created_time",
      "updated_time"
    ]) {
      expect(props).not.toContain(forbidden);
    }
  });

  it("embedding 用途剔除采样组与 persona/context_limit，只留连接 + 超时重试", () => {
    const props = build(true).map(column => column.prop);
    expect(props).toEqual([
      "name",
      "purpose",
      "base_url",
      "api_key",
      "model",
      "is_active",
      "timeout",
      "max_retries",
      "remark"
    ]);
    expect(props).not.toContain("temperature");
    expect(props).not.toContain("persona");
  });

  it("短控件两列、长文本整行（colProps 口径）", () => {
    const byProp = new Map(
      build(false).map(column => [column.prop as string, column])
    );
    expect(byProp.get("temperature")?.colProps).toMatchObject({
      md: 12,
      lg: 12,
      xl: 12
    });
    expect(byProp.get("base_url")?.colProps).toMatchObject({ xs: 24, sm: 24 });
    expect(byProp.get("remark")?.colProps).toMatchObject({ xs: 24, sm: 24 });
  });

  it("testid 与 placeholder 只落在指定字段上", () => {
    const byProp = new Map(
      build(false).map(column => [column.prop as string, column])
    );
    expect(byProp.get("name")?.fieldProps).toMatchObject({
      "data-testid": "ai-profile-name"
    });
    expect(byProp.get("base_url")?.fieldProps).toMatchObject({
      placeholder: "https://api.deepseek.com/v1"
    });
    expect(byProp.get("model")?.fieldProps).toMatchObject({
      placeholder: "deepseek-chat"
    });
    // 未登记字段不带 testid / placeholder
    expect(byProp.get("timeout")?.fieldProps).not.toHaveProperty("data-testid");
    expect(byProp.get("timeout")?.fieldProps).not.toHaveProperty("placeholder");
  });
});
