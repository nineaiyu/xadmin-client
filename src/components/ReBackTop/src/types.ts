export interface ReBackTopProps {
  /** 触发滚动的目标（CSS 选择器）；留空取本项目布局内容区滚动容器 */
  target?: string;
  /** 滚动超过该高度后才显示（px） */
  visibilityHeight?: number;
  /** 距右距离（px） */
  right?: number;
  /** 距底距离（px） */
  bottom?: number;
  /** 按钮 title（留空取内置文案） */
  title?: string;
}
