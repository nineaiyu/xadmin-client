/**
 * PAT 接口范围载荷的公共校验与组装（创建表单与行内编辑器共用）。
 *
 * 空范围不再默认等于不限：必须显式确认（unrestricted: true）才允许提交，
 * 与后端创建 / PATCH 校验同字段同口径；选了范围时 unrestricted 恒为 false
 * （两个入口的开关都会自动复位并禁用）。校验未通过返回 null，由调用方
 * 提示并保持弹窗打开（useDialogForm 的 null 契约）。
 */
export interface TokenScopePayload {
  scopes: string[];
  unrestricted: boolean;
}

/** 空范围未显式确认 → null；否则组装 PATCH / 创建共用的范围载荷 */
export function resolveTokenScopePayload(
  scopes: string[],
  unrestricted: boolean
): TokenScopePayload | null {
  if (!scopes.length && !unrestricted) return null;
  return {
    scopes,
    unrestricted: scopes.length ? false : unrestricted
  };
}
