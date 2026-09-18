/**
 * 站点水印工具：配置由服务端「基本设置 → 前端页面水印」下发，
 * 应用与刷新时机在 `src/App.vue`（按当前路由是否命中生效范围决定挂载/清除）。
 *
 * 设计口径：
 * - 文案默认「用户名-昵称-时间」，配置了自定义文案时拼接时间（保留可追溯性）；
 * - 生效范围为路由路径前缀列表，空列表 = 全部页面；
 * - 时间到分钟粒度，页面停留期间每分钟刷新一次（见 App.vue 的定时器）。
 */

/** 站点水印配置（用户信息接口下发） */
export interface SiteWatermarkConfig {
  /** 是否开启站点水印 */
  enabled: boolean;
  /** 自定义文案（留空 = 用户名-昵称-时间） */
  text: string;
  /** 生效页面路由路径前缀（空数组 = 全部页面） */
  paths: string[];
}

export const defaultSiteWatermark: SiteWatermarkConfig = {
  enabled: false,
  text: "",
  paths: []
};

/** 解析服务端下发的逗号分隔路径配置（容忍中文逗号与空白） */
export function parseWatermarkPaths(raw?: string | null): string[] {
  return String(raw ?? "")
    .split(/[,，]/)
    .map(item => item.trim())
    .filter(Boolean);
}

/** 当前路由是否在站点水印生效范围内（空范围 = 全部页面） */
export function isWatermarkPath(path: string, paths: string[] = []): boolean {
  if (!paths.length) return true;
  return paths.some(prefix => path === prefix || path.startsWith(prefix));
}

/**
 * 站点水印是否应在当前路由展示：
 * 总开关命中 + 非登录页 +（菜单级开关置顶强制 或 命中路径前缀范围）。
 * 菜单级开关来自后端菜单 meta（菜单管理 → 页面水印），是「路径范围」的补充而非替代。
 */
export function isSiteWatermarkVisible(options: {
  enabled: boolean;
  paths?: string[];
  path: string;
  onLoginPage?: boolean;
  menuWatermark?: boolean;
}): boolean {
  const {
    enabled,
    paths = [],
    path,
    onLoginPage = false,
    menuWatermark = false
  } = options;
  if (!enabled || onLoginPage) return false;
  return menuWatermark || isWatermarkPath(path, paths);
}

/** 水印时间戳：YYYY-MM-DD HH:mm（分钟粒度，便于定位泄露时点） */
export function formatWatermarkTime(date: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    ` ${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** 水印文案：自定义文案优先，否则「用户名-昵称」，末尾统一拼接时间 */
export function buildWatermarkText(options: {
  username?: string;
  nickname?: string;
  customText?: string;
  time?: string;
}): string {
  const { username = "", nickname = "", customText = "", time } = options;
  const identity = nickname ? `${username}-${nickname}` : username;
  return `${customText || identity}-${time || formatWatermarkTime()}`;
}
