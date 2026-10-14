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
  /** 滚动行为（与 el-backtop 同口径，默认平滑；系统开启「减弱动态效果」时自动退化为立即） */
  behavior?: ScrollBehavior;
}
