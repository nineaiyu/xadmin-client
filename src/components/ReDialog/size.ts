/**
 * 弹窗/抽屉尺寸档位（T6 治理）。
 *
 * 背景：项目内弹窗宽度曾出现 15 档 px（420~960）与 7 档百分比散落各页，交互尺寸不一致。
 * 这里给出 4 档语义化档位（收敛方向），**新弹窗优先使用**；存量页面随迭代就近替换
 * （首个收敛示例：账户页 AccessToken 的 5 档 → 3 档）。
 *
 * 使用：
 * - 模板：`:width="dialogSize('md')"`
 * - addDialog options：`width: dialogSize('md')`
 */
export const DIALOG_SIZES = {
  /** 轻量提示 / 确认（≤2 个字段） */
  sm: 480,
  /** 常规表单（两列布局、简单联动） */
  md: 640,
  /** 数据密集表单 / 预览面板 */
  lg: 760,
  /** 复杂编辑器 / 日志与长文本查看 */
  xl: 860
} as const;

export type DialogSizeName = keyof typeof DIALOG_SIZES;

/** 尺寸档位 → CSS 宽度字符串（如 "640px"）。 */
export function dialogSize(name: DialogSizeName): string {
  return `${DIALOG_SIZES[name]}px`;
}
