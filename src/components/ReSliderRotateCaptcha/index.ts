import reSliderRotateCaptcha from "./src/index.vue";
import { withInstall } from "@pureadmin/utils";

/** 旋转验证码：拖动滑条把随机倾斜的图片转正（复用 ReSliderCaptcha） */
export const ReSliderRotateCaptcha = withInstall(reSliderRotateCaptcha);

export default ReSliderRotateCaptcha;
export * from "./src/types";
export { isRotatePassing, randomRotate, rotateFromMove } from "./src/geometry";
