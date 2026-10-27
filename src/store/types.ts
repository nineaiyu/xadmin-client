import type { RouteMeta, RouteRecordName } from "vue-router";
import type { AuthCapabilitiesResult, ImpersonatorInfo } from "@/api/auth";
import type { SiteWatermarkConfig } from "@/utils/watermark";

export type cacheType = {
  mode: string;
  name?: RouteRecordName;
};

export type positionType = {
  startIndex?: number;
  length?: number;
};

export type appType = {
  sidebar: {
    opened: boolean;
    withoutAnimation: boolean;
    // 判断是否手动点击Collapse
    isClickCollapse: boolean;
  };
  layout: string;
  device: string;
  viewportSize: { width: number; height: number };
  sortSwap: boolean;
};

export type multiType = {
  path: string;
  name: string;
  meta: RouteMeta & Record<string, unknown>;
  query?: object;
  params?: object;
};

export type setType = {
  title: string;
  fixedHeader: boolean;
  hiddenSideBar: boolean;
};

export type userType = {
  avatar?: string;
  username?: string;
  nickname?: string;
  email?: string;
  phone?: string;
  /** 用户唯一标识（userinfo 下发；水印模板 {pk} 占位符取值） */
  pk?: string | number;
  roles?: Array<string>;
  /**
   * 平台超管标记（userinfo 下发）。「非本人也可管理」类入口据此同口径放行
   * （如流程实例讨论区评论删除）；旧持久化副本可能缺该字段，按非超管处理。
   */
  is_superuser?: boolean;
  /**
   * 巡检处置联动：管理员要求改密（userinfo 下发）；
   * App.vue 观察本字段后引导到个人配置页，改密成功由服务端清除标记。
   */
  mustChangePassword?: boolean;
  /**
   * 用户模拟态（userinfo 下发）：当前 token 以该用户身份登录。
   * 顶栏横幅据此渲染「模拟用户中」，点击退出后由服务端重签发起人 token 并整页刷新。
   */
  impersonator?: ImpersonatorInfo | null;
};

/** 登录页 UI 态（子页面切换、免登录勾选与天数），与认证身份解耦 */
export type loginPageType = {
  /** 判断登录页面显示哪个组件（0：账密登录（默认）、1：验证码登录、3：注册、4：忘记密码） */
  currentPage?: number;
  /** 登录页的免登录 */
  isRemembered?: boolean;
  /** 登录页的免登录存储几天，默认7天 */
  loginDay?: number;
  /** 登录页能力清单（后端下发,登录页外壳一次性拉取,子页共享）：未就绪为 null */
  capabilities?: AuthCapabilitiesResult["data"] | null;
  /** 能力清单加载状态（外壳据此渲染 loading / 失败重试,就绪前不渲染子页） */
  capabilitiesStatus?: "loading" | "success" | "failed";
};

/** 站点水印配置 store 态；挂载/刷新由 src/App.vue 观察本字段执行 */
export type watermarkType = {
  /** 站点水印配置（用户信息接口下发） */
  siteWatermark?: SiteWatermarkConfig;
};
