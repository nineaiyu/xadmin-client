<script setup lang="ts">
import { isAllEmpty, useGlobal, useResizeObserver } from "@pureadmin/utils";
import { useRoute } from "vue-router";
import { useNav } from "@/layout/hooks/useNav";
import { isMixedNav } from "@/layout/hooks/layoutModes";
import { transformI18n } from "@/plugins/i18n";
import { ref, toRaw, computed, watch, onMounted, nextTick } from "vue";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { getParentPaths, findRouteByPath } from "@/router/utils";
import { usePermissionStoreHook } from "@/store/modules/permission";
import { groupMenuChildren } from "@/utils/menuGroups";
import LaySidebarExtraIcon from "../lay-sidebar/components/SidebarExtraIcon.vue";
import LaySidebarItem from "./components/SidebarItem.vue";
import NavbarActions from "../lay-navbar/NavbarActions.vue";

/**
 * 顶栏一级菜单条（混合系布局：mix / header-mixed-nav）：
 * 菜单取全量一级路由，右侧动作区与纵向顶栏共用 NavbarActions（同一套落位编排）。
 *
 * 「导航切割」（`navigationSplit`，仅混合布局 mix 生效）：开 = 顶栏只显示一级菜单、
 * 侧栏显示所属一级的子菜单；关 = 顶栏显示完整菜单树（可下拉）、侧栏显示完整菜单。
 * 混合双列（header-mixed-nav）的顶栏恒为一级菜单（一级导航在顶栏，侧栏承担子级）。
 */
const menuRef = ref();
const headerRef = ref();
const defaultActive = ref<string | undefined>(undefined);

const route = useRoute();
const { $storage } = useGlobal<GlobalPropertiesApi>();
const { layout, resolvePath } = useNav();

/** 导航切割开关（默认开，保持历史行为） */
const navigationSplitConfig = computed(
  () => $storage?.configure?.navigationSplit ?? true
);
/** 切割生效：混合布局由开关控制；混合双列恒切割 */
const navigationSplit = computed(() =>
  isMixedNav(layout.value) ? navigationSplitConfig.value : true
);

/** 完整菜单树渲染序列：支持一级菜单按 groupName/groupRank 分组（仅影响展示层） */
const topMenuData = computed(() =>
  groupMenuChildren(usePermissionStoreHook().wholeMenus)
);

/** 高亮项：一级菜单取「当前路由所属一级路由的第一个子菜单」 */
function getDefaultActive(routePath: string) {
  const wholeMenus = usePermissionStoreHook().wholeMenus;
  const parentRoutes = getParentPaths(routePath, wholeMenus as never)[0];
  defaultActive.value = !isAllEmpty(route.meta?.activePath)
    ? route.meta.activePath
    : findRouteByPath(parentRoutes, wholeMenus as never)?.children?.[0]?.path;
}

/** 菜单项数量/宽度变化后重算 EP 的溢出收纳（否则多出的一级项会盖到右侧动作区） */
function relayoutMenu() {
  nextTick(() => menuRef.value?.handleResize());
}

onMounted(() => {
  getDefaultActive(route.path);
  relayoutMenu();
});

useResizeObserver(headerRef, relayoutMenu);

nextTick(() => {
  menuRef.value?.handleResize();
});

watch(
  () => [
    route.path,
    usePermissionStoreHook().wholeMenus,
    navigationSplit.value
  ],
  () => {
    getDefaultActive(route.path);
    relayoutMenu();
  }
);
</script>

<template>
  <div
    ref="headerRef"
    v-loading="usePermissionStoreHook().wholeMenus.length === 0"
    class="horizontal-header"
  >
    <el-menu
      ref="menuRef"
      router
      mode="horizontal"
      popper-class="pure-scrollbar"
      class="horizontal-header-menu"
      :default-active="defaultActive"
      :show-timeout="300"
      :hide-timeout="300"
    >
      <!-- 未切割：完整菜单树（一级项下拉二级），与侧栏整树一致 -->
      <template v-if="!navigationSplit">
        <LaySidebarItem
          v-for="route in topMenuData"
          :key="route.path"
          :item="route as never"
          :base-path="route.path"
        />
      </template>
      <!-- 切割：仅一级菜单，点击进入该一级下的首个子页 -->
      <template v-else>
        <el-menu-item
          v-for="route in usePermissionStoreHook().wholeMenus"
          :key="route.path"
          :index="resolvePath(route) || route.redirect || ''"
        >
          <template #title>
            <div
              v-if="toRaw(route.meta?.icon)"
              :class="['sub-menu-icon', route.meta?.icon]"
            >
              <component
                :is="
                  useRenderIcon(
                    route.meta ? (toRaw(route.meta.icon) ?? '') : ''
                  )
                "
              />
            </div>
            <div style="display: flex; align-items: center; width: 100%">
              <span class="select-none">
                {{ transformI18n(route.meta?.title ?? "") }}
              </span>
              <LaySidebarExtraIcon :extraIcon="route.meta?.extraIcon" />
            </div>
          </template>
        </el-menu-item>
      </template>
    </el-menu>
    <NavbarActions class="horizontal-header-right" />
  </div>
</template>

<style lang="scss" scoped>
:deep(.el-loading-mask) {
  opacity: 0.45;
}
</style>
