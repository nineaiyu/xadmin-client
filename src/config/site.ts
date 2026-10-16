/**
 * 站点对外链接：about 页、登录页版权与布局页脚共用。
 * 平台配置（public/platform-config.json）不承载链接类信息，这里以具名常量收敛，
 * 避免上游地址在视图里四处散落。
 */
export const SITE_LINKS = {
  /** 前端仓库 */
  webRepo: "https://github.com/nineaiyu/xadmin-client",
  /** 后端仓库 */
  serverRepo: "https://github.com/nineaiyu/xadmin-server",
  /** 使用文档 */
  docs: "https://docs.dvcloud.xin",
  /** 演示站 */
  demo: "https://xadmin.dvcloud.xin",
  /** 作者主页（页脚与登录页版权署名链接） */
  author: "https://github.com/nineaiyu"
} as const;
