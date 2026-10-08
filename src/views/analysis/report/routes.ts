import { $t } from "@/plugins/i18n";

/**
 * 报表「菜单外全屏页」声明（报表设计器）。
 *
 * 装配口径同 `views/analysis/screen/routes.ts`：模块自带声明，框架路由表自动收集。
 */
const reportFullscreenRoutes: Array<RouteConfigsTable> = [
  {
    path: "/analysis/report/designer",
    name: "DataReportDesigner",
    component: () => import("./designer.vue"),
    meta: {
      title: $t("menus.dataReport"),
      showLink: false,
      rank: 10107
    }
  }
];

export default reportFullscreenRoutes;
