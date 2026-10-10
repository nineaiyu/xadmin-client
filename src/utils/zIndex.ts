/**
 * z-index 阶梯（JS 侧；与 src/style/index.scss 的 `--pure-z-index-*` 变量同源）。
 *
 * 分层约定（新增固定层 / 浮层一律取自本表，禁止直接写魔法数字）：
 * - layout 1000：侧栏/头部等布局固定层；
 * - settingMask 1005 / settingPanel 1010：设置面板——必须低于 Element Plus
 *   弹层起点 2000，否则打开的面板会遮挡 dialog/confirm；
 * - Element Plus 弹层：2000 起动态递增（dialog/message-box/popper，不干预）；
 * - lockScreen 2500：锁屏遮罩——必须盖住 EP 弹层（含设置面板与已打开的弹窗），
 *   否则被遮挡的界面仍可交互；解锁结果以遮罩内联提示表达，不依赖 EP 消息层；
 * - tippy 9999：v-tippy 是独立于 EP 的 popper 引擎，必须高于 EP 弹层。
 */
export const Z_INDEX = {
  layout: 1000,
  settingMask: 1005,
  settingPanel: 1010,
  lockScreen: 2500,
  tippy: 9999
} as const;
