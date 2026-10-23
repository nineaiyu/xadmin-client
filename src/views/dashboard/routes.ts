import { $t } from "@/plugins/i18n";

/**
 * 仪表盘展板路由（无 layout 全屏页）：只读展示 + 自动刷新，隐藏全部编辑工具栏。
 * 由 remaining.ts 的 glob 自动装配。
 */
const dashboardFullscreenRoutes: Array<RouteConfigsTable> = [
  {
    path: "/analysis/dashboard/display",
    name: "DataDashboardDisplay",
    component: () => import("./index.vue"),
    meta: {
      title: $t("dashboard.title"),
      showLink: false,
      rank: 10104,
      kiosk: true
    }
  }
];

export default dashboardFullscreenRoutes;
