import { $t } from "@/plugins/i18n";

const Layout = () => import("@/layout/index.vue");

/**
 * 组件 Playground（提案 B-1）：二开用户的可交互组件文档——活样例 + props 速查。
 *
 * 静态路由不进业务菜单（showLink: false，二开者从组件手册 docs 链接进入），
 * 不需要权限点；示例一律纯前端自包含组件，不调用业务 API。
 */
export default {
  path: "/playground",
  name: "Playground",
  component: Layout,
  redirect: "/playground/index",
  meta: {
    icon: "ep/magic-stick",
    title: $t("menus.playground"),
    showLink: false,
    rank: 98
  },
  children: [
    {
      path: "/playground/index",
      name: "PlaygroundIndex",
      component: () => import("@/views/playground/index.vue"),
      meta: { title: $t("menus.playground"), showLink: false }
    },
    {
      path: "/playground/display",
      name: "PlaygroundDisplay",
      component: () => import("@/views/playground/display.vue"),
      meta: { title: $t("playground.demoDisplay"), showLink: false }
    },
    {
      path: "/playground/layout",
      name: "PlaygroundLayout",
      component: () => import("@/views/playground/layout.vue"),
      meta: { title: $t("playground.demoLayout"), showLink: false }
    },
    {
      path: "/playground/input",
      name: "PlaygroundInput",
      component: () => import("@/views/playground/input.vue"),
      meta: { title: $t("playground.demoInput"), showLink: false }
    }
  ]
} satisfies RouteConfigsTable;
