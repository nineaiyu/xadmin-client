import { describe, expect, it, vi } from "vitest";

const auths: Record<string, boolean> = {
  "list:SystemConfig": true,
  "list:AiAssistantConfig": false,
  "list:SystemSetting": true
};
vi.mock("@/router/utils", () => ({
  hasAuth: (code: string) => Boolean(auths[code])
}));

import {
  canOpenChangeEntry,
  credentialRowKey,
  credentialStatus,
  filterCredentialRows
} from "./credentialDisplay";

const t = ((key: string) => key) as never;

describe("credentialDisplay", () => {
  it("轮换 loading 按 scope + name 分行", () => {
    expect(credentialRowKey({ scope: "setting", name: "SCIM_TOKEN" })).toBe(
      "setting:SCIM_TOKEN"
    );
  });

  it("明文优先于已配置判定", () => {
    expect(
      credentialStatus({ status: "plaintext", configured: true }, t).type
    ).toBe("danger");
  });

  it("模型字段级与普通行使用同一状态口径", () => {
    expect(
      credentialStatus({ scope: "model_field", configured: true }, t)
    ).toEqual({ type: "success", text: "credential.encrypted" });
    expect(credentialStatus({ scope: "model_field" }, t)).toEqual({
      type: "info",
      text: "credential.empty"
    });
  });

  it("更换入口按目标页权限显隐", () => {
    expect(canOpenChangeEntry("/system/config/system/index")).toBe(true);
    expect(canOpenChangeEntry("/settings/ledger/index")).toBe(true);
    expect(canOpenChangeEntry("/settings/ldap")).toBe(true);
    expect(canOpenChangeEntry("/integration/ai/config")).toBe(false);
    expect(canOpenChangeEntry("/unknown/entry")).toBe(true);
    expect(canOpenChangeEntry("")).toBe(false);
  });

  it("关键字过滤名称/使用方/分类", () => {
    const rows = [
      { name: "SCIM_TOKEN", used_by: "SCIM" },
      { name: "AI_KEY", category: "ai" },
      { name: "MAIL_KEY", used_by: "SMTP" }
    ];
    expect(filterCredentialRows(rows, "ai_key")).toEqual([rows[1]]);
    expect(filterCredentialRows(rows, "smtp")).toEqual([rows[2]]);
    expect(filterCredentialRows(rows, "  ")).toEqual(rows);
  });
});
