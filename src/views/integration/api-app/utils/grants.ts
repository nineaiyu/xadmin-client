import type { ApiApplicationGrant, RowFilterRule } from "@/api/identity/open";

/**
 * 资源授权载荷归一（自 ApiGrantEditor 抽出，供编辑器与元数据表单提交共用）：
 * `in` 匹配的值以逗号分隔数组提交，其余按原样字符串提交。
 */
export function normalizeRuleValue(rule: RowFilterRule) {
  const raw = String(rule.value ?? "").trim();
  if (rule.match === "in") {
    return raw
      .split(/[,，]/)
      .map(item => item.trim())
      .filter(Boolean);
  }
  return raw;
}

/** 提交前的授权清单归一：逐条规则的值按匹配方式转换 */
export function normalizeGrants(grants: ApiApplicationGrant[]) {
  return (grants ?? []).map(grant => ({
    ...grant,
    row_filter: (grant.row_filter ?? []).map(rule => ({
      ...rule,
      value: normalizeRuleValue(rule)
    }))
  }));
}
