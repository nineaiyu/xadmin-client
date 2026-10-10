/**
 * 主题常量：默认主色的唯一来源。
 *
 * 背景：默认主色原先散落在 store 初始化 / 站点配置兜底 / 响应式配置 / 主题模式复位
 * 4 处，调整默认主色需全仓搜索且易漏；统一在此定义（颜色值大小写不敏感，采用小写口径）。
 *
 * 取值与设计令牌同源：`src/style/tokens/primitives.scss` 的 `--primary` 为
 * `212 100% 45%`（hsl 三元组，浏览器解析为 #006be6，与 vue-vben-admin 默认主色一致）；
 * 本常量是其 hex 表示，供颜色选择器 / 站点配置（EpThemeColor）/ 存储使用。
 * 两者一致性由 `src/utils/color.spec.ts` 守护。
 */
export const DEFAULT_EP_THEME_COLOR = "#006be6";

/** 默认主色的 HSL 三元组（与 primitives.scss 的 `--primary` 保持一致） */
export const DEFAULT_PRIMARY_TRIPLET = "212 100% 45%";

/**
 * 语义色偏好（成功 / 警告 / 危险）的可覆盖键：值存 hex，空串 = 跟随内置默认。
 * `cssVar` 为 `tokens/primitives.scss` 中的基础令牌（EP 色阶由 ep-bridge 派生）。
 */
export const SEMANTIC_COLOR_FIELDS = [
  {
    key: "successColor",
    cssVar: "--success",
    labelKey: "layout.semanticColorSuccess",
    defaultColor: "#67c23a"
  },
  {
    key: "warningColor",
    cssVar: "--warning",
    labelKey: "layout.semanticColorWarning",
    defaultColor: "#e6a23c"
  },
  {
    key: "dangerColor",
    cssVar: "--danger",
    labelKey: "layout.semanticColorDanger",
    defaultColor: "#f56c6c"
  }
] as const;

/** 语义色偏好键（供登记守卫与面板遍历） */
export type SemanticColorKey = (typeof SEMANTIC_COLOR_FIELDS)[number]["key"];
