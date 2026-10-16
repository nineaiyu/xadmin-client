import { $t } from "@/plugins/i18n";

/**
 * 菜单外页面（`showLink: false`）路由表，由两部分组成：
 *
 * - **框架级**：登录 / 重定向 / 空白页 / 账号设置 / 邀请激活 / OAuth 回调与同意页
 *   —— 不随业务模块走，直接登记在下方 `frameworkRoutes`；
 * - **模块级**：业务模块自带的全屏页（大屏投屏页与设计器、报表设计器等）在模块
 *   目录的 `routes.ts` 内自声明，本文件用 glob 自动收集——新增同类页面无需改
 *   框架文件（示例见 `views/analysis/screen/routes.ts`）。
 */

const Layout = () => import("@/layout/index.vue");

/** 模块自带全屏页声明（glob 模式见下方代码，默认导出单条或数组，按路径排序装配） */
const fullscreenPageModules = import.meta.glob<{
  default: RouteConfigsTable | RouteConfigsTable[];
}>("/src/views/**/routes.ts", { eager: true });

const declaredFullscreenRoutes: Array<RouteConfigsTable> = Object.keys(
  fullscreenPageModules
)
  .sort()
  .flatMap(key => {
    const declared = fullscreenPageModules[key].default;
    return Array.isArray(declared) ? declared : [declared];
  });

/** 框架级菜单外页面 */
const frameworkRoutes: Array<RouteConfigsTable> = [
  {
    path: "/login",
    name: "Login",
    component: () => import("@/views/login/index.vue"),
    meta: {
      title: $t("menus.login"),
      showLink: false,
      rank: 10101
    }
  },
  {
    path: "/redirect",
    component: Layout,
    meta: {
      title: $t("status.hsLoad"),
      showLink: false,
      rank: 10102
    },
    children: [
      {
        path: "/redirect/:path(.*)",
        name: "Redirect",
        component: () => import("@/layout/redirect.vue")
      }
    ]
  },
  // 下面是一个无layout菜单的例子（一个全屏空白页面），因为这种情况极少发生，所以只需要在前端配置即可（配置路径：src/router/modules/remaining.ts）
  {
    path: "/empty",
    name: "Empty",
    component: () => import("@/views/empty/index.vue"),
    meta: {
      title: $t("menus.empty"),
      showLink: false,
      rank: 10103
    }
  },
  // 邀请激活：令牌即凭据，未登录访问，独立无侧栏页面
  {
    path: "/invite/accept",
    name: "InviteAccept",
    component: () => import("@/views/invite/accept.vue"),
    meta: {
      title: $t("invite.title"),
      showLink: false,
      rank: 10107
    }
  },
  {
    path: "/oauth/callback",
    name: "OAuthCallback",
    component: () => import("@/views/oauth/callback.vue"),
    meta: {
      title: $t("oauth.title"),
      showLink: false,
      rank: 10104
    }
  },
  // 开放平台 OAuth 授权码同意页：第三方发起，独立无侧栏
  {
    path: "/oauth/authorize",
    name: "OAuthAuthorize",
    component: () => import("@/views/oauth/authorize.vue"),
    meta: {
      title: $t("oauthAuthorize.title"),
      showLink: false,
      rank: 10106
    }
  },
  {
    path: "/account-settings",
    name: "AccountSettings",
    component: () => import("@/views/account/index.vue"),
    meta: {
      title: $t("menus.accountSettings"),
      showLink: false,
      rank: 104
    }
  }
];

const remainingRoutes: Array<RouteConfigsTable> = [
  ...frameworkRoutes,
  ...declaredFullscreenRoutes
];

export default remainingRoutes;
