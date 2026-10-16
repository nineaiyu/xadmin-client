import reSliderCaptcha from "./src/index.vue";
import { withInstall } from "@pureadmin/utils";

/** 滑块验证码（拖到末端通过；isSlot 时交由外部校验） */
export const ReSliderCaptcha = withInstall(reSliderCaptcha);

export default ReSliderCaptcha;
