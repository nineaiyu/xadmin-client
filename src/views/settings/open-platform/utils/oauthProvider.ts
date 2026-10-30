/** 第三方登录 Provider 的表单模型与请求载荷归一。 */

export interface OAuthProvider {
  key: string;
  name: string;
  flavor: string;
  enabled: boolean;
  client_id: string;
  client_secret?: string;
  client_secret_configured?: boolean;
  authorize_url?: string;
  token_url?: string;
  userinfo_url?: string;
  issuer?: string;
  discovery_url?: string;
  jwks_uri?: string;
  scope?: string;
  subject_field?: string;
  auto_create?: boolean;
  groups_field?: string;
  group_role_map?: Record<string, string>;
  nickname_claim?: string;
  email_claim?: string;
  phone_claim?: string;
  agent_id?: string;
  [key: string]: unknown;
}

export interface OAuthFlavor {
  key: string;
  required_keys: string[];
  preset: Record<string, unknown>;
}

export const FLAVOR_LABELS: Record<string, string> = {
  oauth2: "OAuth 2.0",
  oidc: "OIDC",
  dingtalk: "DingTalk",
  wecom: "WeCom",
  feishu: "Feishu"
};

export function emptyProvider(flavor = "oauth2"): OAuthProvider {
  return {
    key: "",
    name: "",
    flavor,
    enabled: false,
    client_id: "",
    client_secret: "",
    scope: flavor === "oidc" ? "openid profile email" : "",
    subject_field: flavor === "oidc" ? "sub" : "",
    auto_create: false,
    groups_field: "groups",
    group_role_map: {},
    nickname_claim: "name",
    email_claim: "email",
    phone_claim: "phone_number"
  };
}

export function normalizeProvider(row: Record<string, unknown>): OAuthProvider {
  return {
    ...emptyProvider(String(row.flavor ?? "oauth2")),
    ...row,
    key: String(row.key ?? ""),
    name: String(row.name ?? ""),
    flavor: String(row.flavor ?? "oauth2"),
    enabled: Boolean(row.enabled),
    client_id: String(row.client_id ?? ""),
    client_secret: String(row.client_secret ?? ""),
    client_secret_configured: Boolean(row.client_secret_configured)
  };
}

/** 提交载荷：去掉只读标记；密钥留空 = 沿用已存值。 */
export function providerPayload(provider: OAuthProvider): OAuthProvider {
  const payload: OAuthProvider = { ...provider };
  delete payload.client_secret_configured;
  if (!payload.client_secret) {
    delete payload.client_secret;
  }
  if (
    !payload.group_role_map ||
    Object.keys(payload.group_role_map).length === 0
  ) {
    delete payload.group_role_map;
  }
  return payload;
}

export function parseGroupRoleMap(text: string): Record<string, string> | null {
  if (!text.trim()) return {};
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return null;
    return Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [key, String(value)])
    );
  } catch {
    return null;
  }
}

export function formatGroupRoleMap(provider: OAuthProvider): string {
  return JSON.stringify(provider.group_role_map ?? {}, null, 2);
}
