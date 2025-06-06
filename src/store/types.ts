import type { RouteRecordName } from "vue-router";
import type { WS } from "@/utils/websocket";

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
  meta: any;
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
  noticeCount?: number;
  websocket?: WS | null;
  clear?: any;
};
