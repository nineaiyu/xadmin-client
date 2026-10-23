import { describe, expect, it } from "vitest";
import {
  emptyProvider,
  formatGroupRoleMap,
  normalizeProvider,
  parseGroupRoleMap,
  providerPayload
} from "./oauthProvider";

describe("oauthProvider", () => {
  it("空 provider 带 OIDC 默认 scope/subject，OAuth2 不注入 OIDC 字段", () => {
    expect(emptyProvider("oidc").scope).toBe("openid profile email");
    expect(emptyProvider("oidc").subject_field).toBe("sub");
    expect(emptyProvider("oauth2").scope).toBe("");
  });

  it("归一化保留已配置标记且不会凭空生成密钥", () => {
    const provider = normalizeProvider({
      key: "corp",
      name: "Corp",
      flavor: "oidc",
      enabled: true,
      client_id: "cid",
      client_secret_configured: true
    });
    expect(provider.client_secret_configured).toBe(true);
    expect(provider.client_secret).toBe("");
    expect(provider.key).toBe("corp");
  });

  it("提交载荷去掉只读标记与空密钥，留空表示沿用", () => {
    const payload = providerPayload(
      normalizeProvider({
        key: "corp",
        name: "Corp",
        flavor: "oauth2",
        enabled: true,
        client_id: "cid",
        client_secret_configured: true,
        group_role_map: {}
      })
    );
    expect("client_secret" in payload).toBe(false);
    expect("client_secret_configured" in payload).toBe(false);
    expect("group_role_map" in payload).toBe(false);
  });

  it("填写新密钥时随载荷提交", () => {
    const payload = providerPayload(
      normalizeProvider({
        key: "corp",
        name: "Corp",
        flavor: "oauth2",
        enabled: true,
        client_id: "cid",
        client_secret: "new-secret"
      })
    );
    expect(payload.client_secret).toBe("new-secret");
  });

  it("组映射 JSON 解析失败返回 null，合法对象归一为字符串值", () => {
    expect(parseGroupRoleMap("{bad")).toBeNull();
    expect(parseGroupRoleMap("[]")).toBeNull();
    expect(parseGroupRoleMap('{"admins": "admin"}')).toEqual({
      admins: "admin"
    });
    expect(parseGroupRoleMap("")).toEqual({});
  });

  it("组映射格式化回显为缩进 JSON", () => {
    const provider = emptyProvider("oidc");
    provider.group_role_map = { admins: "admin" };
    expect(formatGroupRoleMap(provider)).toContain('"admins": "admin"');
  });
});
