/** 滚动到达态：四向是否已到边界 */
export interface ScrollArrivalState {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

export interface ReScrollbarProps {
  /** 固定高度（number 视为 px） */
  height?: number | string;
  /** 最大高度（number 视为 px） */
  maxHeight?: number | string;
  /** 使用原生滚动条（透传 el-scrollbar 的 native） */
  native?: boolean;
  /** 显示上/下遮罩阴影，提示还有未展示内容 */
  shadow?: boolean;
  /** 滚动条常驻显示（透传 el-scrollbar 的 always） */
  always?: boolean;
  /** 滚动区域的可访问名（屏幕阅读器标识该区域；缺省不设置） */
  label?: string;
}
