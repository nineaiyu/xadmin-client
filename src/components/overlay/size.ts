/**
 * 弹窗 / 抽屉尺寸档位（统一口径）。
 *
 * 背景：项目内弹窗宽度曾出现 15 档 px（420~960）与 7 档百分比散落各页；抽屉 size 同样
 * 散落（35%~80% 与 420~620px 并存），同类交互尺寸不一致。这里给出语义化档位，
 * **新弹层优先使用**，存量就近替换。
 *
 * 使用：
 * - 模板：`:width="dialogSize('md')"`
 * - addDialog options：`width: dialogSize('md')`
 * - 抽屉：`addDrawer({ size: drawerSize('md') })`；内容驱动的窄面板用 `DRAWER_NARROW_WIDTH`
 *
 * 历史路径 `@/components/ReDialog/size` 保留 re-export shim（存量 80+ 引用），
 * 新代码直接引用本模块，避免抽屉使用者依赖对话框目录。
 */
export const DIALOG_SIZES = {
  /** 轻量提示 / 确认（≤2 个字段） */
  sm: 480,
  /** 常规表单（两列布局、简单联动） */
  md: 640,
  /** 数据密集表单 / 预览面板 */
  lg: 760,
  /** 复杂编辑器 / 日志与长文本查看 */
  xl: 860,
  /** 宽表格 / 权限树 / 变更历史 */
  xxl: 960
} as const;

export type DialogSizeName = keyof typeof DIALOG_SIZES;

/** 尺寸档位 → CSS 宽度字符串（如 "640px"）。 */
export function dialogSize(name: DialogSizeName): string {
  return `${DIALOG_SIZES[name]}px`;
}

/** 抽屉宽度档位（占视口比例；详情 / 表单 / 配置面板统一口径） */
export const DRAWER_SIZES = {
  /** 只读详情 / 轻量面板 */
  sm: "40%",
  /** 表单编辑 / 数据面板 */
  md: "50%",
  /** 表格密集 / 权限预览 */
  lg: "60%",
  /** 配置总览 / 组织树 */
  xl: "75%",
  /** 移动端整屏 */
  full: "100%"
} as const;

export type DrawerSizeName = keyof typeof DRAWER_SIZES;

/** 抽屉档位 → CSS 宽度字符串（如 "50%"）。 */
export function drawerSize(name: DrawerSizeName): string {
  return DRAWER_SIZES[name];
}

/** 固定窄抽屉宽度（管理动作面板等「内容驱动的窄面板」，不随视口放大） */
export const DRAWER_NARROW_WIDTH = "480px";
