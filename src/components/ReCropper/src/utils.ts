import type { CSSProperties, PropType } from "vue";
import type Cropper from "cropperjs";

export type CropperOptions = Cropper.Options;
export type CroppedCanvasOptions = Cropper.GetCroppedCanvasOptions;

/** 裁剪器默认参数（组件级 options 会浅覆盖） */
export const defaultOptions: CropperOptions = {
  aspectRatio: 1,
  viewMode: 1,
  zoomable: true,
  zoomOnTouch: true,
  zoomOnWheel: true,
  cropBoxMovable: true,
  cropBoxResizable: true,
  toggleDragModeOnDblclick: true,
  autoCrop: true,
  background: true,
  highlight: true,
  center: true,
  responsive: true,
  restore: true,
  checkCrossOrigin: true,
  checkOrientation: true,
  scalable: true,
  autoCropArea: 1,
  modal: true,
  guides: true,
  movable: true,
  rotatable: true
};

/** 组件 props 声明（与 index.tsx 分离，便于类型复用） */
export const cropperProps = {
  src: { type: String, required: true },
  errSrc: { type: String, required: true },
  quality: { type: Number, required: false, default: 0.98 },
  type: { type: String, required: false, default: "image/png" },
  alt: { type: String },
  circled: { type: Boolean, default: false },
  /** 是否可以通过点击裁剪区域关闭右键弹出的功能菜单，默认 `true` */
  isClose: { type: Boolean, default: true },
  realTimePreview: { type: Boolean, default: true },
  height: { type: [String, Number], default: "360px" },
  crossorigin: {
    type: String as PropType<"" | "anonymous" | "use-credentials" | undefined>,
    default: "anonymous"
  },
  imageStyle: { type: Object as PropType<CSSProperties>, default: () => ({}) },
  options: { type: Object as PropType<CropperOptions>, default: () => ({}) },
  canvasOption: {
    type: Object as PropType<CroppedCanvasOptions>,
    default: () => ({ maxHeight: 1280, maxWidth: 960 })
  }
};

/**
 * quality=0 时的体积自适应策略：按画布像素数匹配档位（越大压缩越狠），
 * 返回最终使用的 quality 与 type。
 * https://developer.mozilla.org/zh-CN/docs/Web/API/HTMLCanvasElement/toBlob
 */
export function resolveImageQuality(
  canvas: HTMLCanvasElement,
  quality: number,
  type: string
): { quality: number; type: string } {
  if (quality != 0) {
    return { quality, type };
  }
  const rules = [
    { value: 0, type: "image/png", quality: 1 },
    { value: 0.1, type: "image/jpeg", quality: 0.98 },
    { value: 0.2, type: "image/jpeg", quality: 0.7 },
    { value: 1, type: "image/jpeg", quality: 0.6 },
    { value: 5, type: "image/jpeg", quality: 0.5 },
    { value: 10, type: "image/jpeg", quality: 0.2 }
  ];
  rules.sort((a, b) => {
    return b.value - a.value;
  });
  const size = canvas.width * canvas.height;
  for (let i = 0; i < rules.length; i++) {
    if (size > 1024 * 1024 * rules[i].value) {
      console.log("get quality", size / 1024, rules[i]);
      return { quality: rules[i].quality, type: rules[i].type };
    }
  }
  return { quality, type };
}

/** 圆形裁剪：把源画布按内切圆裁成透明底（destination-in 保留圆内像素） */
export function getRoundedCanvas(
  sourceCanvas: HTMLCanvasElement
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d")!;
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  canvas.width = width;
  canvas.height = height;
  context.imageSmoothingEnabled = true;
  context.drawImage(sourceCanvas, 0, 0, width, height);
  context.globalCompositeOperation = "destination-in";
  context.beginPath();
  context.arc(
    width / 2,
    height / 2,
    Math.min(width, height) / 2,
    0,
    2 * Math.PI,
    true
  );
  context.fill();
  return canvas;
}

/** 图片样式：height + 最大宽度 + 调用方覆盖 */
export function buildImageStyle(
  height: string | number,
  imageStyle: CSSProperties
): CSSProperties {
  return {
    height,
    maxWidth: "100%",
    ...imageStyle
  };
}

/** 外层容器样式：px 归一后作为行高撑满 */
export function buildWrapperStyle(height: string | number): CSSProperties {
  return { height: `${height}`.replace(/px/, "") + "px" };
}
