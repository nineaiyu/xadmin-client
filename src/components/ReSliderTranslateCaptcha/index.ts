import reSliderTranslateCaptcha from "./src/index.vue";
import { withInstall } from "@pureadmin/utils";

/** 拼图验证码：拖动滑条使拼图块对齐缺口（复用 ReSliderCaptcha） */
export const ReSliderTranslateCaptcha = withInstall(reSliderTranslateCaptcha);

export default ReSliderTranslateCaptcha;
export * from "./src/types";
export {
  isTranslatePassing,
  pieceLeftFromMove,
  pieceMaxOffset,
  randomOffset
} from "./src/geometry";
