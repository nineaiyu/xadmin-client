/** 验证码业务动作常量（与后端 captcha/const.py 单源登记表同值）。 */

import type { CaptchaScene } from "@/api/auth";

/** 账密登录（scene=login） */
export const CAPTCHA_ACTION_LOGIN = "identity.login.basic";
/** 邀请激活（scene=invite） */
export const CAPTCHA_ACTION_INVITE_ACCEPT = "invite.accept";

/** 发码动作：按场景派生（auth.verify_code.send:<scene>） */
export function verifyCodeSendAction(scene: CaptchaScene): string {
  return `auth.verify_code.send:${scene}`;
}
