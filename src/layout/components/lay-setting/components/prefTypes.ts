import type { Component } from "vue";

/** 偏好选择卡选项（`PrefChoice`）：value 为落库值，label 为卡片文案，preview 走插槽自绘 */
export interface PrefChoiceOption {
  value: string;
  label: string;
  tip?: string;
  icon?: Component;
  /** 禁用项（如移动端不支持的布局），仍渲染但不可点 */
  disabled?: boolean;
}
