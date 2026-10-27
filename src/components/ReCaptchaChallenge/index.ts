import ReCaptchaChallenge from "./src/index.vue";
import {
  CAPTCHA_ACTION_INVITE_ACCEPT,
  CAPTCHA_ACTION_LOGIN,
  verifyCodeSendAction
} from "./src/actions";
import type {
  CaptchaAnswer,
  CaptchaSubmitPayload,
  ReCaptchaChallengeProps
} from "./src/types";

export {
  CAPTCHA_ACTION_INVITE_ACCEPT,
  CAPTCHA_ACTION_LOGIN,
  ReCaptchaChallenge,
  verifyCodeSendAction
};
export type { CaptchaAnswer, CaptchaSubmitPayload, ReCaptchaChallengeProps };
