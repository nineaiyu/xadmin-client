<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useGlobal } from "@pureadmin/utils";
import { useNav } from "@/layout/hooks/useNav";
import LaySearch from "../lay-search/index.vue";
import LayNotice from "../lay-notice/index.vue";
import LayNavMix from "../lay-sidebar/NavMix.vue";
import LayImpersonationDropdownItem from "../lay-impersonation/ImpersonationDropdownItem.vue";
import { useTranslationLang } from "@/layout/hooks/useTranslationLang";
import { useLockScreen } from "@/layout/hooks/useLockScreen";
import { useDataThemeChange } from "@/layout/hooks/useDataThemeChange";
import { refreshCurrentRoute } from "@/utils/routeRefresh";
import LaySidebarFullScreen from "../lay-sidebar/components/SidebarFullScreen.vue";
import LaySidebarBreadCrumb from "../lay-sidebar/components/SidebarBreadCrumb.vue";
import LaySidebarTopCollapse from "../lay-sidebar/components/SidebarTopCollapse.vue";
import GlobalizationIcon from "@/assets/svg/globalization.svg?component";
import AccountSettingsIcon from "~icons/ri/user-settings-line";
import LogoutCircleRLine from "~icons/ri/logout-circle-r-line";
import Setting from "~icons/ri/settings-3-line";
import LockIcon from "~icons/ri/lock-2-line";
import RefreshIcon from "~icons/ep/refresh-right";
import MenuFoldIcon from "~icons/ri/menu-fold-fill";
import MenuUnfoldIcon from "~icons/ri/menu-unfold-fill";
import SunIcon from "~icons/ri/sun-line";
import MoonIcon from "~icons/ri/moon-line";
import Check from "~icons/ep/check";

const {
  layout,
  device,
  logout,
  onPanel,
  pureApp,
  username,
  userAvatar,
  avatarsStyle,
  toggleSideBar,
  toAccountSettings,
  getDropdownItemStyle,
  getDropdownItemClass
} = useNav();

const { t, locale, translationCh, translationEn } = useTranslationLang();
const { $storage } = useGlobal<GlobalPropertiesApi>();
const route = useRoute();
const router = useRouter();

/** 面包屑显隐（设置面板 →「布局」→「顶栏」） */
const breadcrumbVisible = computed(
  () => $storage?.configure?.breadcrumbVisible ?? true
);

/**
 * 顶栏组件显隐（设置面板 →「布局」→「顶栏」）：缺省显示；
 * 用户下拉与设置入口不参与开关（避免出现无法打开设置面板的死角）。
 */
const navbarVisible = computed(() => ({
  search: $storage?.configure?.navbarSearch ?? true,
  language: $storage?.configure?.navbarLanguage ?? true,
  fullscreen: $storage?.configure?.navbarFullscreen ?? true,
  lock: $storage?.configure?.navbarLock ?? true,
  notice: $storage?.configure?.navbarNotice ?? true,
  refresh: $storage?.configure?.navbarRefresh ?? true,
  sidebarToggle: $storage?.configure?.navbarSidebarToggle ?? false,
  themeToggle: $storage?.configure?.navbarThemeToggle ?? false
}));

/** 一键锁屏（遮罩 + 口令解锁，见 lay-lock） */
const { lock } = useLockScreen();

/** 设置入口显隐：总开关 + 位置为顶栏（悬浮球形态见 lay-setting/index.vue） */
const preferencesVisible = computed(
  () =>
    ($storage?.configure?.enablePreferences ?? true) &&
    ($storage?.configure?.preferencesPosition ?? "header") === "header"
);

/** 明暗切换（与命令面板的主题动作同口径） */
const { dataTheme, dataThemeChange } = useDataThemeChange();
function toggleTheme() {
  dataTheme.value = !dataTheme.value;
  dataThemeChange();
}

/** 刷新当前页（与页签右键菜单「刷新」同口径） */
function refreshPage() {
  refreshCurrentRoute(router, {
    fullPath: route.fullPath,
    query: { ...route.query }
  });
}
</script>

<template>
  <div class="navbar bg-white shadow-xs shadow-[rgba(0,21,41,0.08)]">
    <LaySidebarTopCollapse
      v-if="device === 'mobile'"
      class="hamburger-container"
      :is-active="pureApp.sidebar.opened"
      @toggleClick="toggleSideBar"
    />

    <LaySidebarBreadCrumb
      v-if="layout !== 'mix' && device !== 'mobile' && breadcrumbVisible"
      class="breadcrumb-container"
    />

    <LayNavMix v-if="layout === 'mix'" />

    <div v-if="layout === 'vertical'" class="vertical-header-right">
      <!-- 折叠侧栏（默认关：与侧栏底部折叠按钮重复时可按需开启） -->
      <span
        v-if="navbarVisible.sidebarToggle"
        id="header-sidebar-toggle"
        class="navbar-bg-hover hover:[&>svg]:animate-scale-bounce"
        role="button"
        tabindex="0"
        :title="t('layout.sidebarToggle')"
        :aria-label="t('layout.sidebarToggle')"
        @click="toggleSideBar"
        @keydown.enter.prevent="toggleSideBar"
        @keydown.space.prevent="toggleSideBar"
      >
        <IconifyIconOffline
          :icon="pureApp.sidebar.opened ? MenuFoldIcon : MenuUnfoldIcon"
        />
      </span>
      <!-- 刷新当前页 -->
      <span
        v-if="navbarVisible.refresh"
        id="header-refresh"
        class="navbar-bg-hover hover:[&>svg]:animate-scale-bounce"
        role="button"
        tabindex="0"
        :title="t('layout.refreshPage')"
        :aria-label="t('layout.refreshPage')"
        @click="refreshPage"
        @keydown.enter.prevent="refreshPage"
        @keydown.space.prevent="refreshPage"
      >
        <IconifyIconOffline :icon="RefreshIcon" />
      </span>
      <!-- 菜单搜索 -->
      <LaySearch v-if="navbarVisible.search" id="header-search" />
      <!-- 国际化 -->
      <el-dropdown
        v-if="navbarVisible.language"
        id="header-translation"
        trigger="click"
      >
        <div
          class="globalization-icon navbar-bg-hover hover:[&>svg]:animate-scale-bounce"
          role="button"
          tabindex="0"
          :aria-label="t('buttons.language')"
        >
          <IconifyIconOffline :icon="GlobalizationIcon" />
        </div>
        <template #dropdown>
          <el-dropdown-menu class="translation">
            <el-dropdown-item
              :style="getDropdownItemStyle(locale, 'zh')"
              :class="['dark:text-white!', getDropdownItemClass(locale, 'zh')]"
              @click="translationCh"
            >
              <IconifyIconOffline
                v-show="locale === 'zh'"
                class="check-zh"
                :icon="Check"
              />
              简体中文
            </el-dropdown-item>
            <el-dropdown-item
              :style="getDropdownItemStyle(locale, 'en')"
              :class="['dark:text-white!', getDropdownItemClass(locale, 'en')]"
              @click="translationEn"
            >
              <span v-show="locale === 'en'" class="check-en">
                <IconifyIconOffline :icon="Check" />
              </span>
              English
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <!-- 全屏 -->
      <LaySidebarFullScreen v-if="navbarVisible.fullscreen" id="full-screen" />
      <!-- 明暗切换（默认关） -->
      <span
        v-if="navbarVisible.themeToggle"
        id="header-theme-toggle"
        class="navbar-bg-hover hover:[&>svg]:animate-scale-bounce"
        role="button"
        tabindex="0"
        :title="dataTheme ? t('layout.light') : t('layout.dark')"
        :aria-label="dataTheme ? t('layout.light') : t('layout.dark')"
        @click="toggleTheme"
        @keydown.enter.prevent="toggleTheme"
        @keydown.space.prevent="toggleTheme"
      >
        <IconifyIconOffline :icon="dataTheme ? SunIcon : MoonIcon" />
      </span>
      <!-- 锁屏 -->
      <span
        v-if="navbarVisible.lock"
        id="header-lock"
        class="navbar-bg-hover hover:[&>svg]:animate-scale-bounce"
        role="button"
        tabindex="0"
        :title="t('layout.lockScreen')"
        :aria-label="t('layout.lockScreen')"
        @click="lock"
        @keydown.enter.prevent="lock"
        @keydown.space.prevent="lock"
      >
        <IconifyIconOffline :icon="LockIcon" />
      </span>
      <!-- 消息通知 -->
      <LayNotice v-if="navbarVisible.notice" id="header-notice" />
      <!-- 退出登录 -->
      <el-dropdown trigger="click">
        <span
          class="el-dropdown-link navbar-bg-hover select-none"
          role="button"
          :aria-label="t('buttons.userMenu')"
        >
          <img :src="userAvatar" :alt="username" :style="avatarsStyle" />
          <p v-if="username" class="dark:text-white">{{ username }}</p>
        </span>
        <template #dropdown>
          <el-dropdown-menu class="logout">
            <el-dropdown-item @click="toAccountSettings">
              <IconifyIconOffline
                :icon="AccountSettingsIcon"
                style="margin: 5px"
              />
              {{ t("menus.accountSettings") }}
            </el-dropdown-item>
            <!-- 模拟态专属：退出模拟（恢复原身份），与退出登录语义不同 -->
            <LayImpersonationDropdownItem />
            <el-dropdown-item @click="logout">
              <IconifyIconOffline
                :icon="LogoutCircleRLine"
                style="margin: 5px"
              />
              {{ t("buttons.loginOut") }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <span
        v-if="preferencesVisible"
        class="set-icon navbar-bg-hover hover:[&>svg]:animate-scale-bounce"
        :title="t('buttons.systemSet')"
        role="button"
        tabindex="0"
        :aria-label="t('buttons.systemSet')"
        @click="onPanel"
        @keydown.enter.prevent="onPanel"
        @keydown.space.prevent="onPanel"
      >
        <IconifyIconOffline :icon="Setting" />
      </span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.navbar {
  width: 100%;
  height: 48px;
  overflow: hidden;

  .hamburger-container {
    float: left;
    height: 100%;
    line-height: 48px;
    cursor: pointer;
  }

  .vertical-header-right {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    min-width: 280px;
    height: 48px;
    color: #000000d9;

    .el-dropdown-link {
      display: flex;
      align-items: center;
      justify-content: space-around;
      height: 48px;
      padding: 10px;
      color: #000000d9;
      cursor: pointer;

      p {
        font-size: 14px;
      }

      img {
        width: 22px;
        height: 22px;
        border-radius: 50%;
      }
    }
  }

  .breadcrumb-container {
    float: left;
    margin-left: 16px;
  }
}

.translation {
  :deep(.el-dropdown-menu__item) {
    padding: 5px 40px;
  }

  .check-zh {
    position: absolute;
    left: 20px;
  }

  .check-en {
    position: absolute;
    left: 20px;
  }
}

.logout {
  width: 120px;

  :deep(.el-dropdown-menu__item) {
    display: inline-flex;
    flex-wrap: wrap;
    min-width: 100%;
  }
}
</style>
