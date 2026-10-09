import { useI18n } from "vue-i18n";
import { createPasskeyAssert } from "./passkeyAssert";
import { createPasskeyRegister } from "./passkeyRegister";

export type { PasskeyAssertionPayload } from "./webauthnTypes";

/**
 * Passkey 浏览器仪式收敛（登录 MFA、全局二次验证、个人凭据注册共用）。
 *
 * 断言：`challengeApi` 取一次性挑战 → `navigator.credentials.get` → 组装断言载荷；
 * 注册：`challengeApi` 取注册挑战 → `navigator.credentials.create` → 提交证明。
 * 失败（不支持 / 挑战失败 / 用户取消）就地提示并返回空值，不向调用方抛出，
 * 以便调用方在 `finally` 中统一复位 loading。
 *
 * 断言与注册链路分别见 passkeyAssert.ts / passkeyRegister.ts，契约见 webauthnTypes.ts。
 */
export function useWebAuthn() {
  const { t } = useI18n();

  return {
    assertPasskey: createPasskeyAssert(t),
    registerPasskey: createPasskeyRegister(t)
  };
}
