import type { RouteMeta, RouteRecordName } from "vue-router";
import type { ImpersonatorInfo } from "@/api/auth";
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
  roles?: Array<string>;
  verifyCodeLength?: number;
  currentPage?: number;
  isRemembered?: boolean;
  loginDay?: number;
  /** 站点水印配置（用户信息接口下发）；挂载/刷新由 src/App.vue 观察本字段执行 */
  siteWatermark?: SiteWatermarkConfig;
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
