<script setup lang="ts">
import { computed, shallowRef, watch } from "vue";
import { useGlobal } from "@pureadmin/utils";
import { useNav } from "@/layout/hooks/useNav";
import LayNavMix from "../lay-sidebar/NavMix.vue";
import LayImpersonationDropdownItem from "../lay-impersonation/ImpersonationDropdownItem.vue";
import LaySidebarBreadCrumb from "../lay-sidebar/components/SidebarBreadCrumb.vue";
import LaySidebarTopCollapse from "../lay-sidebar/components/SidebarTopCollapse.vue";
import { resolveNavbarLayout } from "./widgets/catalog";
import AccountSettingsIcon from "~icons/ri/user-settings-line";
import LogoutCircleRLine from "~icons/ri/logout-circle-r-line";
import Setting from "~icons/ri/settings-3-line";
import MoreIcon from "~icons/ri/more-line";

const {
  t,
  layout,
  device,
  logout,
  onPanel,
  pureApp,
  username,
  userAvatar,
  avatarsStyle,
  toggleSideBar,
  toAccountSettings
} = useNav();

const { $storage } = useGlobal<GlobalPropertiesApi>();

/** 面包屑显隐（设置面板 →「布局」→「顶栏」） */
const breadcrumbVisible = computed(
  () => $storage?.configure?.breadcrumbVisible ?? true
);

/** 设置入口显隐：总开关 + 位置为顶栏（悬浮球形态见 lay-setting/index.vue） */
const preferencesVisible = computed(
  () =>
    ($storage?.configure?.enablePreferences ?? true) &&
    ($storage?.configure?.preferencesPosition ?? "header") === "header"
);

/**
 * 顶栏组件编排（设置面板 →「布局」→「顶栏组件」）：顺序 / 位置 / 显隐见 catalog 的 resolveNavbarLayout。
 *
 * 用「深度监听整包 configure → 写入本地快照」而非 computed：编排同时依赖数组型偏好
 * （navbarOrder / navbarMoreWidgets）与各组件开关，逐字段依赖在响应式存储的实现下
 * 会出现漏更新（实测：面板改落位后存储已更新、本组件仍渲染旧分组）。
 */
const widgetLayout = shallowRef(
  resolveNavbarLayout(
    $storage?.configure as Record<string, unknown> | undefined
  )
);
watch(
  () => $storage?.configure,
  configure => {
    widgetLayout.value = resolveNavbarLayout(
      configure as Record<string, unknown> | undefined
    );
  },
  { deep: true }
);
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
      <component
        :is="entry.item.component"
        v-for="entry in widgetLayout.header"
        :key="entry.item.key"
        :style="{ order: entry.order }"
      />
      <!-- 更多：收进下拉的动作类组件（弹层类组件固定顶栏，见 catalog.more） -->
      <!-- id 落在 el-dropdown 上：EP 会把 id 透传到触发器，直接写在 span 上会被其内部 id 覆盖 -->
      <el-dropdown
        v-if="widgetLayout.more.length"
        id="header-more"
        trigger="click"
      >
        <span
          class="navbar-bg-hover hover:[&>svg]:animate-scale-bounce"
          role="button"
          tabindex="0"
          :title="t('layout.moreWidgets')"
          :aria-label="t('layout.moreWidgets')"
        >
          <IconifyIconOffline :icon="MoreIcon" />
        </span>
        <template #dropdown>
          <el-dropdown-menu class="more-widgets">
            <el-dropdown-item
              v-for="entry in widgetLayout.more"
              :key="entry.item.key"
            >
              <component :is="entry.item.component" />
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
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

.logout {
  width: 120px;

  :deep(.el-dropdown-menu__item) {
    display: inline-flex;
    flex-wrap: wrap;
    min-width: 100%;
  }
}
</style>
