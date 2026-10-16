import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ registeredKeysMock: vi.fn() }));

vi.mock("@/api/system/config/system", () => ({
  systemConfigApi: { registeredKeys: state.registeredKeysMock }
}));
// hook 依赖的框架件与本测试无关，替换整包引入（避免拉起 plugins/i18n 初始化）
vi.mock("@/components/RePlusPage", () => ({
  formatPageColumns: (columns: unknown) => columns,
  handleOperation: vi.fn()
}));
vi.mock("@/components/ReIcon/src/hooks", () => ({
  useRenderIcon: () => ""
}));
vi.mock("@/router/utils", () => ({
  usePageAuth: () => ({ invalid: true })
}));
vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string) => key })
}));

import { filterRegisteredKeys, registeredTypeLabelKey } from "../hook";
import type { RegisteredConfigKey } from "@/api/system/config/system";

/**
 * 系统配置页注册键枚举提示的纯函数单测：
 * 类型名 → i18n 文案 key 映射、键候选的前缀过滤。
 */

describe("registeredTypeLabelKey 类型文案映射", () => {
  it("六种注册类型各自映射到 configSystem 文案 key", () => {
    expect(registeredTypeLabelKey("boolean")).toBe("configSystem.typeBoolean");
    expect(registeredTypeLabelKey("integer")).toBe("configSystem.typeInteger");
    expect(registeredTypeLabelKey("number")).toBe("configSystem.typeNumber");
    expect(registeredTypeLabelKey("string")).toBe("configSystem.typeString");
    expect(registeredTypeLabelKey("array")).toBe("configSystem.typeArray");
    expect(registeredTypeLabelKey("object")).toBe("configSystem.typeObject");
  });

  it("未知类型回退 string 文案（不渲染空标签）", () => {
    expect(registeredTypeLabelKey("mystery")).toBe("configSystem.typeString");
  });
});

describe("filterRegisteredKeys 键候选前缀过滤", () => {
  const keys: RegisteredConfigKey[] = [
    { key: "SLOW_REQUEST_THRESHOLD", type: "number" },
    { key: "slow_request_enabled", type: "boolean" },
    { key: "SITE_WATERMARK_ENABLED", type: "boolean" }
  ];

  it("按输入前缀过滤（大小写不敏感）", () => {
    expect(filterRegisteredKeys(keys, "SLOW")).toEqual([
      { key: "SLOW_REQUEST_THRESHOLD", type: "number" },
      { key: "slow_request_enabled", type: "boolean" }
    ]);
    expect(filterRegisteredKeys(keys, "slow_request_t")).toEqual([
      { key: "SLOW_REQUEST_THRESHOLD", type: "number" }
    ]);
  });

  it("非前缀命中不入选（前缀语义而非包含）", () => {
    expect(filterRegisteredKeys(keys, "REQUEST")).toEqual([]);
  });

  it("空输入返回全量候选（聚焦即给完整枚举）", () => {
    expect(filterRegisteredKeys(keys, "  ")).toEqual(keys);
  });
});
