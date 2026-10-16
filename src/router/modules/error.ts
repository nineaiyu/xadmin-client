import { $t } from "@/plugins/i18n";

export default {
  path: "/error",
  redirect: "/error/403",
  meta: {
    icon: "informationLine",
    title: $t("menus.abnormal"),
    showLink: false,
    rank: 9
  },
  children: [
    {
      path: "/error/403",
      name: "403",
      component: () => import("@/views/error/403.vue"),
      meta: {
        title: $t("menus.fourZeroThree")
      }
    },
    {
      path: "/error/404",
      name: "404",
      component: () => import("@/views/error/404.vue"),
      meta: {
        title: $t("menus.fourZeroFour")
      }
    },
    {
      path: "/error/500",
      name: "500",
      component: () => import("@/views/error/500.vue"),
      meta: {
        title: $t("menus.FiveZeroZero")
      }
    },
    {
      // 功能模块已停用：命中模块裁剪网关（404 + code=1001）的整页提示
      path: "/error/module-disabled",
      name: "ModuleDisabled",
      component: () => import("@/views/error/module-disabled.vue"),
      meta: {
        title: $t("error.moduleDisabled")
      }
    }
  ]
} satisfies RouteConfigsTable;
