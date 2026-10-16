<script setup lang="ts">
import { computed, shallowRef, watch } from "vue";
import { useGlobal } from "@pureadmin/utils";
import { useNav } from "@/layout/hooks/useNav";
import LayImpersonationDropdownItem from "../lay-impersonation/ImpersonationDropdownItem.vue";
import { NAVBAR_FIXED_ORDER, resolveNavbarLayout } from "./widgets/catalog";
import { isFullContent } from "@/layout/hooks/layoutModes";
import { resolvePreferencesEntry } from "@/layout/hooks/preferencesEntry";
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

/**
 * 设置入口形态：位置五态 + 总开关的判定收敛在 `resolvePreferencesEntry`
 * （与右下角悬浮球同一份判定）。头像菜单项是兜底通道——「不显示」档与总开关
 * 关闭时仍保留，保证任何时候都能重新打开面板。
 */
const preferencesEntry = computed(() =>
  resolvePreferencesEntry({
    enablePreferences: $storage?.configure?.enablePreferences,
    preferencesPosition: $storage?.configure?.preferencesPosition,
    horizontal: String($storage?.layout?.layout ?? "vertical") === "horizontal",
    fullContent: isFullContent($storage?.layout?.layout)
  })
);
const preferencesInHeader = computed(() => preferencesEntry.value.header);
const preferencesInDropdown = computed(() => preferencesEntry.value.dropdown);
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
      :style="{ order: NAVBAR_FIXED_ORDER.more }"
    >
      <span
        class="navbar-action navbar-bg-hover hover:[&>svg]:animate-scale-bounce"
        role="button"
        tabindex="0"
        :title="t('layout.moreWidgets')"
        :aria-label="t('layout.moreWidgets')"
      >
        <IconifyIconOffline :icon="MoreIcon" />
      </span>
      <template #dropdown>
        <el-dropdown-menu class="more-widgets">
          <!-- 落位到「更多」的组件复用顶栏组件本体：样式在 sidebar/_common.scss
               收敛为菜单项内联形态（图标 + 名称），此处补名称标签 -->
          <el-dropdown-item
            v-for="entry in widgetLayout.more"
            :key="entry.item.key"
          >
            <component :is="entry.item.component" />
            <span class="widget-menu__label">{{ t(entry.item.labelKey) }}</span>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
    <!-- 设置入口（顶栏齿轮形态） -->
    <span
      v-if="preferencesInHeader"
      class="navbar-action set-icon navbar-bg-hover hover:[&>svg]:animate-scale-bounce"
      :style="{ order: NAVBAR_FIXED_ORDER.preferences }"
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
    <el-dropdown
      trigger="click"
      :style="{ order: NAVBAR_FIXED_ORDER.userDropdown }"
    >
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
            <span class="widget-menu__label">{{ t(entry.item.labelKey) }}</span>
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
  gap: var(--navbar-action-gap);
  align-items: center;
  justify-content: flex-end;
  height: 100%;

  /* 右侧留白：动作区不贴浏览器边缘（与内容区的 16px 节奏呼应） */
  padding-right: var(--navbar-action-pad-right);
  color: hsl(var(--fg));
}

.el-dropdown-link {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
  height: var(--navbar-action-size);
  padding: 0 10px;
  color: hsl(var(--fg));
  cursor: pointer;
  border-radius: var(--navbar-action-radius);
  transition: background var(--duration-fast) var(--ease-standard);

  &:hover {
    background: hsl(var(--fill-muted));
  }

  p {
    font-size: var(--font-size-base);
  }

  img {
    width: 24px;
    height: 24px;
    border-radius: 50%;
  }
}

/* 菜单宽度按最长项自适应（固定宽度会把「打开项目配置」挤成图标一行、文字一行） */
.logout {
  min-width: 120px;

  :deep(.el-dropdown-menu__item) {
    display: flex;
    align-items: center;
    white-space: nowrap;
  }
}
</style>
