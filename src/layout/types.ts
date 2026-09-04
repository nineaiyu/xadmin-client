import type { FunctionalComponent } from "vue";
import type { LocationQueryRaw, RouteParamsRaw } from "vue-router";
const { VITE_HIDE_HOME } = import.meta.env;

export const routerArrays: Array<RouteConfigs> =
  VITE_HIDE_HOME === "false"
    ? [
        {
          path: "/welcome",
          name: "Welcome",
          meta: {
            title: "menus.home",
            icon: "ep/home-filled"
          }
        }
      ]
    : [];

export type routeMetaType = {
  title?: string;
  icon?: string | FunctionalComponent;
  showLink?: boolean;
  savedPosition?: boolean;
  auths?: Array<string>;
  /** 不参与标签页（多标签场景下隐藏） */
  hiddenTag?: boolean;
  /** 动态路由可打开的最大数量 */
  dynamicLevel?: number;
};

export type RouteConfigs = {
  path?: string;
  query?: LocationQueryRaw;
  params?: RouteParamsRaw;
  meta?: routeMetaType;
  children?: RouteConfigs[];
  name?: string;
};

export type multiTagsType = {
  tags: Array<RouteConfigs>;
};

export type tagsViewsType = {
  icon: string | FunctionalComponent;
  text: string;
  divided: boolean;
  disabled: boolean;
  show: boolean;
};

export interface setType {
  sidebar: {
    opened: boolean;
    withoutAnimation: boolean;
    isClickCollapse: boolean;
  };
  device: string;
  fixedHeader: boolean;
  classes: {
    hideSidebar: boolean;
    openSidebar: boolean;
    withoutAnimation: boolean;
    mobile: boolean;
  };
  hideTabs: boolean;
}

export type menuType = {
  id?: number;
  name?: string;
  path?: string;
  noShowingChildren?: boolean;
  children?: menuType[];
  value: unknown;
  meta?: {
    icon?: string;
    title?: string;
    rank?: number;
    showParent?: boolean;
    extraIcon?: string;
  };
  showTooltip?: boolean;
  parentId?: number;
  pathList?: number[];
  redirect?: string;
};

export type themeColorsType = {
  color: string;
  themeColor: string;
};

export interface scrollbarDomType extends HTMLElement {
  wrap?: {
    offsetWidth: number;
  };
}
