/**
 * 账户设置页签定义（自 index.vue 模块内数组抽取，便于单测与复用）。
 *
 * `auth` 是页签的权限门：个人可自管的页签恒 true；需要菜单权限点的页签
 * （账户管理 / 通知订阅 / 安全日志）按 `hasAuth` 判定——无权限时页签不渲染，
 * 也不参与 `?tab=` 直达解析（非法 / 无权限 key 回落个人信息）。
 */

import type { Component } from "vue";
import MessageIcon from "~icons/ep/message";
import ProfileIcon from "~icons/ri/user-3-line";
import PreferencesIcon from "~icons/ri/settings-3-line";
import SecurityLogIcon from "~icons/ri/window-line";
import AccountManagementIcon from "~icons/ri/profile-line";
import ShieldKeyholeIcon from "~icons/ri/shield-keyhole-line";
import FingerprintIcon from "~icons/ri/fingerprint-line";
import LinksIcon from "~icons/ri/links-line";
import KeyIcon from "~icons/ri/key-2-line";
import Profile from "../components/Profile.vue";
import Preferences from "../components/Preferences.vue";
import SecurityLog from "../components/SecurityLog.vue";
import Notifications from "../components/Notifications.vue";
import AccountManagement from "../components/AccountManagement.vue";
import MfaSecurity from "../components/MfaSecurity.vue";
import PasskeySecurity from "../components/PasskeySecurity.vue";
import OAuthBindings from "../components/OAuthBindings.vue";
import AccessToken from "../components/AccessToken.vue";

export interface AccountPane {
  key: string;
  label: string;
  icon: Component;
  component: Component;
  auth: boolean;
}

export function createAccountPanes(
  t: (key: string) => string,
  hasAuth: (code: string) => boolean
): AccountPane[] {
  return [
    {
      key: "profile",
      label: t("account.profile"),
      icon: ProfileIcon,
      component: Profile,
      auth: true
    },
    {
      key: "accountManagement",
      label: t("account.accountManagement"),
      icon: AccountManagementIcon,
      component: AccountManagement,
      auth: hasAuth("resetPassword:UserInfo") || hasAuth("bind:UserInfo")
    },
    {
      key: "mfa",
      label: t("mfa.tabTitle"),
      icon: ShieldKeyholeIcon,
      component: MfaSecurity,
      auth: true
    },
    {
      // Passkey 是登录凭据（个人凭据个人管，白名单路由），与 MFA / 访问令牌并列
      key: "passkey",
      label: t("passkey.title"),
      icon: FingerprintIcon,
      component: PasskeySecurity,
      auth: true
    },
    {
      key: "oauthBindings",
      label: t("oauth.tabTitle"),
      icon: LinksIcon,
      component: OAuthBindings,
      // 未配置 provider 时接口返回空列表，页签仍可见（便于查看已有绑定）
      auth: true
    },
    {
      key: "accessToken",
      label: t("accessToken.title"),
      icon: KeyIcon,
      component: AccessToken,
      auth: true
    },
    {
      key: "preferences",
      label: t("account.preference"),
      icon: PreferencesIcon,
      component: Preferences,
      auth: true
    },
    {
      key: "Notifications",
      label: t("account.notifications"),
      icon: MessageIcon,
      component: Notifications,
      auth: hasAuth("list:UserMsgSubscription")
    },
    {
      key: "securityLog",
      label: t("account.securityLog"),
      icon: SecurityLogIcon,
      component: SecurityLog,
      auth: hasAuth("list:UserLoginLog")
    }
  ];
}
