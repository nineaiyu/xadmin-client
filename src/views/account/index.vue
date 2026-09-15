<script lang="ts" setup>
import { useRoute } from "vue-router";
import { computed, onBeforeMount, ref } from "vue";
import { deviceDetection, useGlobal } from "@pureadmin/utils";
import Profile from "./components/Profile.vue";
import Preferences from "./components/Preferences.vue";
import SecurityLog from "./components/SecurityLog.vue";
import Notifications from "./components/Notifications.vue";
import AccountSidebar from "./components/AccountSidebar.vue";
import AccountManagement from "./components/AccountManagement.vue";
import TopCollapse from "@/layout/components/lay-sidebar/components/SidebarTopCollapse.vue";
import { useDataThemeChange } from "@/layout/hooks/useDataThemeChange";
import MessageIcon from "~icons/ep/message";
import ProfileIcon from "~icons/ri/user-3-line";
import PreferencesIcon from "~icons/ri/settings-3-line";
import SecurityLogIcon from "~icons/ri/window-line";
import AccountManagementIcon from "~icons/ri/profile-line";
import ShieldKeyholeIcon from "~icons/ri/shield-keyhole-line";
import LinksIcon from "~icons/ri/links-line";
import KeyIcon from "~icons/ri/key-2-line";
import MfaSecurity from "./components/MfaSecurity.vue";
import OAuthBindings from "./components/OAuthBindings.vue";
import AccessToken from "./components/AccessToken.vue";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { ReSplitPane } from "@/components/ReSplitPane";
import { useSplitPaneConfig } from "@/hooks/useSplitPaneConfig";

defineOptions({
  name: "Account"
});

const route = useRoute();
const isOpen = ref(!deviceDetection());
const { $storage } = useGlobal<GlobalPropertiesApi>();
onBeforeMount(() => {
  useDataThemeChange().dataThemeChange($storage.layout?.themeMode);
});
const { t } = useI18n();

// 侧栏宽度持久化（默认 15%，约等于原 210px 固定宽；双击分隔条或点悬浮按钮重置）
const { percent, handleDragEnd } = useSplitPaneConfig("account", {
  defaultPercent: 15,
  minPercent: 10
});

const panes = computed(() => [
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
]);
/**
 * 页签定位：支持 `?tab=xxx` 直达（OAuth 绑定回调落地后回到「第三方账号」），
 * 非法/无权限的 key 一律回落「个人信息」，避免落到空白面板。
 */
const initialPane = () => {
  const key = String(route.query.tab ?? "");
  return panes.value.some(item => item.key === key && item.auth)
    ? key
    : "profile";
};
const witchPane = ref(initialPane());

/**
 * 切换页签只改本地状态，**不**同步 URL query。
 *
 * 面板首屏请求会按「当前路由 fullPath」登记（见 utils/http/routeCancel）；
 * 若在此处 `router.replace({query})`，afterEach 的
 * `cancelRoutePending(from.fullPath)` 会取消刚挂载面板的在途请求
 * （列表/元数据被中止 → 表格空白、provider 列表为空），且取消与挂载是竞态，
 * 表现为偶发。深度定位一次性由 `?tab=` 读入即可，URL 保持落地时的值。
 */
const switchPane = (key: string) => {
  witchPane.value = key;
  if (deviceDetection()) {
    isOpen.value = !isOpen.value;
  }
};
</script>

<template>
  <!-- 桌面：侧栏宽度可拖拽（比例持久化到 WEB_SITE_CONFIG.SplitPanes） -->
  <el-container v-if="!deviceDetection()" class="h-full">
    <ReSplitPane
      v-model:percent="percent"
      :split-set="{ minPercent: 10, defaultPercent: 15, split: 'vertical' }"
      class="w-full"
      @drag-end="handleDragEnd"
    >
      <template #paneL>
        <div
          class="pure-account-settings h-full overflow-hidden px-2 dark:bg-(--el-bg-color)! border-r border-(--pure-border-color)"
        >
          <AccountSidebar
            :witch-pane="witchPane"
            :panes="panes"
            @switch-pane="switchPane"
          />
        </div>
      </template>
      <template #paneR>
        <el-main>
          <component
            :is="panes.find(item => item.key === witchPane).component"
          />
        </el-main>
      </template>
    </ReSplitPane>
  </el-container>
  <!-- 移动端：侧栏抽屉式显隐 -->
  <el-container v-else class="h-full">
    <el-aside
      v-if="isOpen"
      width="180px"
      class="pure-account-settings overflow-hidden px-2 dark:bg-(--el-bg-color)! border-r border-(--pure-border-color)"
    >
      <AccountSidebar
        :witch-pane="witchPane"
        :panes="panes"
        @switch-pane="switchPane"
      />
    </el-aside>
    <el-main>
      <TopCollapse
        :is-active="isOpen"
        class="px-0"
        @toggleClick="isOpen = !isOpen"
      />
      <component :is="panes.find(item => item.key === witchPane).component" />
    </el-main>
  </el-container>
</template>

<style lang="scss">
.pure-account-settings {
  background: var(--pure-theme-menu-bg) !important;
}

.pure-account-settings-menu {
  background-color: transparent;
  border: none;

  .el-menu-item {
    height: 48px !important;
    color: var(--pure-theme-menu-text);
    background-color: transparent !important;
    transition: color 0.2s;

    &:hover {
      color: var(--pure-theme-menu-title-hover) !important;
    }

    &.is-active {
      color: #fff !important;

      &:hover {
        color: #fff !important;
      }

      &::before {
        position: absolute;
        inset: 0;
        clear: both;
        margin: 4px 0;
        content: "";
        background: var(--el-color-primary);
        border-radius: 3px;
      }
    }
  }
}
</style>

<style lang="scss" scoped>
body[layout] {
  .el-menu--vertical .is-active {
    color: #fff !important;
    transition: color 0.2s;

    &:hover {
      color: #fff !important;
    }
  }
}
</style>
