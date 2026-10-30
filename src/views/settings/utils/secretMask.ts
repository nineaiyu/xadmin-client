/** 后端设置响应中 write_only 密文的占位掩码（与 settings/views/settings.py 的 MASK 同源）。 */
export const SETTING_SECRET_MASK = "••••••";

/**
 * 测试连接等「再次提交表单」的场景剔除掩码值：
 * 掩码只用于展示「已配置」，提交给后端会被当作真实密钥去建连。
 */
export function withoutMaskedSecrets<T extends Record<string, unknown>>(
  data: T
): Partial<T> {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== SETTING_SECRET_MASK)
  ) as Partial<T>;
}
