/** 交互式验证码组件共享类型（barrel 再导出）。 */
import type {
  CaptchaChallengeData,
  CaptchaScene,
  CaptchaTrackPoint,
  CaptchaType
} from "@/api/auth";

export type CaptchaAnswer =
  { x: number } | { angle: number } | { points: { x: number; y: number }[] };

export type CaptchaSubmitPayload = {
  answer: CaptchaAnswer;
  track: CaptchaTrackPoint[];
};

export type ReCaptchaChallengeProps = {
  scene: CaptchaScene;
  /** 当前启用题型（来自 capabilities / verify 配置）；为空时由服务端随机 */
  types?: CaptchaType[];
  title?: string;
  /** 无障碍回退：是否展示「使用图片验证码」入口 */
  imageFallback?: boolean;
  inline?: boolean;
};

export type CaptchaChildExpose = {
  reset: () => void;
  markSuccess: () => void;
};

export type { CaptchaChallengeData, CaptchaTrackPoint, CaptchaType };
