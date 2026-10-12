export interface ReSliderRotateCaptchaProps {
  /** 待旋转的图片地址 */
  src?: string;
  /** 图片（正方形）边长（px） */
  imageSize?: number;
  /** 随机初始旋转角下限（度） */
  minDegree?: number;
  /** 随机初始旋转角上限（度） */
  maxDegree?: number;
  /** 通过判定的角度容差（度） */
  diffDegree?: number;
  /** 滑条提示文案（留空取内置） */
  text?: string;
  /** 通过文案（留空取内置） */
  successText?: string;
}
