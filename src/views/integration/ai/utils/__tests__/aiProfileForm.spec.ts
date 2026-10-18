import { describe, expect, it } from "vitest";
import type { AiProfileItem } from "@/api/ai/ai";
import {
  AI_PROFILE_DEFAULTS,
  buildAiProfilePayload,
  createAiProfileForm
} from "../aiProfileForm";

const row = (overrides: Partial<AiProfileItem> = {}): AiProfileItem => ({
  pk: "profile-1",
  name: "主档案",
  base_url: "https://ai.example.com/v1",
  api_key_set: true,
  model: "deepseek-chat",
  temperature: null,
  max_tokens: null,
  top_p: null,
  frequency_penalty: null,
  presence_penalty: null,
  stop: "",
  seed: null,
  timeout: 60,
  max_retries: 0,
  context_limit: 20,
  persona: "",
  purpose: "chat",
  is_active: false,
  remark: "",
  updated_time: "2026-10-18T00:00:00Z",
  created_time: "2026-10-18T00:00:00Z",
  ...overrides
});

describe("createAiProfileForm", () => {
  it("新建档案预填全部推荐默认值", () => {
    const form = createAiProfileForm();

    expect(form).toMatchObject({
      temperature: 0.2,
      max_tokens: 2048,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      seed: null,
      timeout: 60,
      max_retries: 2,
      context_limit: 20,
      purpose: "chat",
      is_active: false
    });
    expect(form).toEqual({ ...AI_PROFILE_DEFAULTS });
  });

  it("编辑历史档案时 null 采样参数回填默认值，且不回显密钥", () => {
    const form = createAiProfileForm(row({ purpose: "embedding" }));

    expect(form.api_key).toBe("");
    expect(form.temperature).toBe(0.2);
    expect(form.max_tokens).toBe(2048);
    expect(form.top_p).toBe(1);
    expect(form.frequency_penalty).toBe(0);
    expect(form.presence_penalty).toBe(0);
    expect(form.purpose).toBe("embedding");
  });

  it("保留显式 0 采样值，仅把无意义的 0 行为值回填默认", () => {
    const form = createAiProfileForm(
      row({
        temperature: 0,
        top_p: 0,
        frequency_penalty: 0,
        presence_penalty: 0,
        max_tokens: 0,
        timeout: 0,
        context_limit: 0
      })
    );

    expect(form.temperature).toBe(0);
    expect(form.top_p).toBe(0);
    expect(form.frequency_penalty).toBe(0);
    expect(form.presence_penalty).toBe(0);
    expect(form.max_tokens).toBe(2048);
    expect(form.timeout).toBe(60);
    expect(form.context_limit).toBe(20);
  });
});

describe("buildAiProfilePayload", () => {
  it("新建载荷包含默认参数与密钥", () => {
    const form = createAiProfileForm();
    Object.assign(form, {
      name: "  新档案  ",
      base_url: "  https://ai.example.com/v1  ",
      api_key: "sk-test",
      model: "  deepseek-chat  "
    });

    const payload = buildAiProfilePayload(form, false);

    expect(payload).toMatchObject({
      name: "新档案",
      base_url: "https://ai.example.com/v1",
      model: "deepseek-chat",
      api_key: "sk-test",
      temperature: 0.2,
      max_tokens: 2048,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      seed: null,
      timeout: 60,
      max_retries: 2,
      context_limit: 20,
      purpose: "chat"
    });
  });

  it("编辑时密钥留空不下发，填了新密钥才覆盖", () => {
    const form = createAiProfileForm(row());

    expect(buildAiProfilePayload(form, true)).not.toHaveProperty("api_key");

    form.api_key = "sk-new";
    expect(buildAiProfilePayload(form, true).api_key).toBe("sk-new");
  });
});
