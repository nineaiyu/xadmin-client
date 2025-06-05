<script lang="ts" setup>
import { useRouter } from "vue-router";
import { computed, onBeforeMount, ref } from "vue";
import { ReText } from "@/components/ReText";
import Profile from "./components/Profile.vue";
import Preferences from "./components/Preferences.vue";
import SecurityLog from "./components/SecurityLog.vue";
import Notifications from "./components/Notifications.vue";
import { deviceDetection, useGlobal } from "@pureadmin/utils";
import AccountManagement from "./components/AccountManagement.vue";
import TopCollapse from "@/layout/components/lay-sidebar/components/SidebarTopCollapse.vue";
import { useDataThemeChange } from "@/layout/hooks/useDataThemeChange";
import avatar from "@/assets/avatar.png";
import leftLine from "~icons/ri/arrow-left-s-line";
import ProfileIcon from "~icons/ri/user-3-line";
import PreferencesIcon from "~icons/ri/settings-3-line";
import SecurityLogIcon from "~icons/ri/window-line";
import MessageIcon from "~icons/ep/message";
import AccountManagementIcon from "~icons/ri/profile-line";
import { useUserStoreHook } from "@/store/modules/user";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";

defineOptions({
  name: "Account"
});

const router = useRouter();
const isOpen = ref(!deviceDetection());
const userinfoStore = useUserStoreHook();
const { $storage } = useGlobal<GlobalPropertiesApi>();
onBeforeMount(() => {
  useDataThemeChange().dataThemeChange($storage.layout?.overallStyle);
});
const { t } = useI18n();

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
const witchPane = ref("profile");
</script>

<template>
  <el-container class="h-full">
    <el-aside
      v-if="isOpen"
      :width="deviceDetection() ? '180px' : '210px'"
      class="pure-account-settings overflow-hidden px-2 dark:bg-(--el-bg-color)! border-r-[1px] border-[var(--pure-border-color)]"
    >
      <el-menu :default-active="witchPane" class="pure-account-settings-menu">
        <el-menu-item
          class="hover:transition-all! hover:duration-200! hover:text-base! h-[50px]!"
          @click="router.go(-1)"
        >
          <div class="flex items-center">
            <IconifyIconOffline :icon="leftLine" />
            <span class="ml-2">{{ t("account.back") }}</span>
          </div>
        </el-menu-item>
        <div class="flex items-center ml-8 mt-4 mb-4">
          <el-avatar :size="48" :src="userinfoStore.avatar ?? avatar" />
          <div class="ml-4 flex flex-col max-w-[100px]">
            <ReText class="font-bold self-baseline!">
              {{ userinfoStore.nickname }}
            </ReText>
            <ReText class="self-baseline!" type="info">
              {{ userinfoStore.username }}
            </ReText>
          </div>
        </div>
        <el-menu-item
          v-for="item in panes.filter(item => item.auth)"
          :key="item.key"
          :index="item.key"
          @click="
            () => {
              witchPane = item.key;
              if (deviceDetection()) {
                isOpen = !isOpen;
              }
            }
          "
        >
          <div class="flex items-center z-10">
            <el-icon>
              <IconifyIconOffline :icon="item.icon" />
            </el-icon>
            <span>{{ item.label }}</span>
          </div>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-main>
      <TopCollapse
        v-if="deviceDetection()"
        :is-active="isOpen"
        class="px-0"
        @toggleClick="isOpen = !isOpen"
      />
      <component
        :is="panes.find(item => item.key === witchPane).component"
        :class="[!deviceDetection() && 'ml-[120px]']"
      />
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
