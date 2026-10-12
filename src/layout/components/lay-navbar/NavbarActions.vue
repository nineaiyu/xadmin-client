<script setup lang="ts">
import { computed, shallowRef, watch } from "vue";
import { useGlobal } from "@pureadmin/utils";
import { useNav } from "@/layout/hooks/useNav";
import LayImpersonationDropdownItem from "../lay-impersonation/ImpersonationDropdownItem.vue";
import { resolveNavbarLayout } from "./widgets/catalog";
import AccountSettingsIcon from "~icons/ri/user-settings-line";
import LogoutCircleRLine from "~icons/ri/logout-circle-r-line";
import Setting from "~icons/ri/settings-3-line";
import MoreIcon from "~icons/ri/more-line";

/**
 * 顶栏右侧动作区（三种顶栏形态共用：纵向 / 混合系 / 水平）。
 *
 * 编排完全由 `resolveNavbarLayout` 决定（顺序 `navbarOrder` + 落位 `widgetPositions`）：
 * 顶栏组直挂、动作类可收进「更多」下拉、任意组件可移入头像下拉；设置入口位置由
 * `preferencesPosition` 控制（顶栏齿轮 / 头像下拉 / 悬浮球见 lay-setting）。
 */
const {
  t,
  logout,
  onPanel,
  username,
  userAvatar,
  avatarsStyle,
  toAccountSettings
} = useNav();

const { $storage } = useGlobal<GlobalPropertiesApi>();

const configure = computed(
  () => $storage?.configure as Record<string, unknown> | undefined
);

/**
 * 用「深度监听整包 configure → 写入本地快照」而非 computed：编排同时依赖对象型偏好
 * （widgetPositions）与各组件开关，逐字段依赖在响应式存储的实现下会漏更新。
 */
const widgetLayout = shallowRef(resolveNavbarLayout(configure.value));
watch(
  () => $storage?.configure,
  value => {
    widgetLayout.value = resolveNavbarLayout(
      value as Record<string, unknown> | undefined
    );
  },
  { deep: true }
);

/** 设置入口位置（五态）：none 不显示；user-dropdown 移入头像菜单；
 *  auto 档在水平布局走悬浮球（见 lay-setting），其余顶栏显示齿轮 */
const preferencesPosition = computed(() => {
  const position = $storage?.configure?.preferencesPosition ?? "header";
  if (
    position === "auto" &&
    String($storage?.layout?.layout ?? "vertical") === "horizontal"
  ) {
    return "fixed";
  }
  return position;
});
const preferencesInHeader = computed(
  () =>
    ($storage?.configure?.enablePreferences ?? true) &&
    preferencesPosition.value !== "none" &&
    preferencesPosition.value !== "user-dropdown" &&
    preferencesPosition.value !== "fixed"
);
const preferencesInDropdown = computed(
  () =>
    ($storage?.configure?.enablePreferences ?? true) &&
    preferencesPosition.value === "user-dropdown"
);
</script>

<template>
  <div class="navbar-actions">
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
    <!-- 设置入口（顶栏齿轮形态） -->
    <span
      v-if="preferencesInHeader"
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
    <!-- 用户下拉（可内嵌落位为 user-dropdown 的组件） -->
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
          <el-dropdown-item
            v-for="entry in widgetLayout.userDropdown"
            :key="entry.item.key"
          >
            <component :is="entry.item.component" />
          </el-dropdown-item>
          <el-dropdown-item v-if="preferencesInDropdown" @click="onPanel">
            <IconifyIconOffline :icon="Setting" style="margin: 5px" />
            {{ t("buttons.systemSet") }}
          </el-dropdown-item>
          <el-dropdown-item @click="logout">
            <IconifyIconOffline :icon="LogoutCircleRLine" style="margin: 5px" />
            {{ t("buttons.loginOut") }}
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<style lang="scss" scoped>
.navbar-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  height: 48px;
  color: hsl(var(--fg));
}

.el-dropdown-link {
  display: flex;
  align-items: center;
  justify-content: space-around;
  height: 48px;
  padding: 10px;
  color: hsl(var(--fg));
  cursor: pointer;

  p {
    font-size: var(--font-size-base);
  }

  img {
    width: 22px;
    height: 22px;
    border-radius: 50%;
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
