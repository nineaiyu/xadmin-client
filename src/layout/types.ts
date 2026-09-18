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
  /** 固定标签页：不可关闭（标签操作按此禁用） */
  fixedTag?: boolean;
  /** iframe 内嵌页面地址（lay-frame 多标签缓存按此识别） */
  frameSrc?: string;
  /** 菜单排序（后端菜单 rank 透传） */
  rank?: number;
  /** 菜单树展开时是否显示父级（SidebarItem 折叠判定） */
  showParent?: boolean;
  /** 菜单右侧附加图标 */
  extraIcon?: string;
  /** 当前激活的父级菜单路径 */
  activePath?: string;
  /** 菜单级水印开关（后端菜单 meta 透传，置顶强制挂载） */
  watermark?: boolean;
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
  meta?: routeMetaType;
  showTooltip?: boolean;
  /** 右键菜单项禁用态（标签页右键菜单透传） */
  disabled?: boolean;
  parentId?: number;
  pathList?: number[];
  redirect?: string;
  /** 路由查询/路径参数（标签页等场景透传） */
  query?: LocationQueryRaw;
  params?: RouteParamsRaw;
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
