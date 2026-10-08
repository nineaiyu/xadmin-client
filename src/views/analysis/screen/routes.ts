import { $t } from "@/plugins/i18n";

/**
 * 大屏「菜单外全屏页」声明（投屏页 / 画布设计器）。
 *
 * 由 `src/router/modules/remaining.ts` 以 glob 自动装配：模块新增同类全屏页面时
 * 只在本文件追加一条，无需改动框架路由表。
 */
const screenFullscreenRoutes: Array<RouteConfigsTable> = [
  {
    path: "/analysis/screen/display",
    name: "DataScreenDisplay",
    component: () => import("./display.vue"),
    meta: {
      title: $t("menus.dataScreen"),
      showLink: false,
      rank: 10105
    }
  },
  {
    path: "/analysis/screen/designer",
    name: "DataScreenDesigner",
    component: () => import("./designer.vue"),
    meta: {
      title: $t("menus.dataScreen"),
      showLink: false,
      rank: 10106
    }
  }
];

export default screenFullscreenRoutes;
