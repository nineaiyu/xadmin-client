import { hasAuth } from "@/router/utils";

/** SettingItem 显隐开关消费的按钮权限位（test 位由「测试连通性」类页签启用） */
export interface SettingAuth {
  partialUpdate: boolean;
  retrieve: boolean;
  test?: boolean;
}

/**
 * 设置页签按钮权限装配：SettingItem 只消费 partialUpdate / retrieve / test
 * 三位。sms / security / message / ldap / basic 等设置页原先各写一份三行
 * hasAuth 映射，收敛于此统一生成，返回值与逐页手写完全一致。
 *
 * @param suffix 权限码模型后缀（如 "SettingBasic"）
 * @param withTest 是否装配 test 位（权限码为 create:后缀，对应测试按钮）
 */
export function settingAuth(suffix: string, withTest = false): SettingAuth {
  return {
    partialUpdate: hasAuth(`partialUpdate:${suffix}`),
    retrieve: hasAuth(`retrieve:${suffix}`),
    ...(withTest ? { test: hasAuth(`create:${suffix}`) } : {})
  };
}
