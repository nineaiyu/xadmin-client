import rePictureUpload from "./src/index.vue";
import { withInstall } from "@pureadmin/utils";

/** 图片裁剪预览组件 */
export const RePictureUpload = withInstall(rePictureUpload);

/** cropper 事件载荷：组件 emit 与消费侧回调共用同一形状（单一出处） */
export interface CropperPayload {
  base64: string;
  blob: Blob;
  info: Record<string, unknown>;
}

export default RePictureUpload;
