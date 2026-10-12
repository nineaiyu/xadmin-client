import reIconPicker from "./src/index.vue";
import { withInstall } from "@pureadmin/utils";

/** 图标选择器：薄封装 ReIcon 的离线图标选择器（对齐 vben IconPicker 命名） */
export const ReIconPicker = withInstall(reIconPicker);

export default ReIconPicker;
