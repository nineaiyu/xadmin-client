export interface ReSliderTranslateCaptchaProps {
  /** 拼图背景图地址 */
  src?: string;
  /** 图片（正方形）边长（px） */
  imageSize?: number;
  /** 拼图块边长（px） */
  pieceSize?: number;
  /** 通过判定的位移容差（px） */
  diffX?: number;
  /** 滑条提示文案（留空取内置） */
  text?: string;
  /** 通过文案（留空取内置） */
  successText?: string;
}
