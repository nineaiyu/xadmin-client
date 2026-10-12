<script setup lang="ts">
import { useRoute } from "vue-router";
import { emitter } from "@/utils/mitt";
import { useNav } from "@/layout/hooks/useNav";
import { responsiveStorageNameSpace } from "@/config";
import { ref, nextTick, computed, onMounted, onBeforeUnmount } from "vue";
import {
  storageLocal,
  isAllEmpty,
  useDark,
  useGlobal,
  useResizeObserver
} from "@pureadmin/utils";
import { usePermissionStoreHook } from "@/store/modules/permission";
import { groupMenuChildren } from "@/utils/menuGroups";
import {
  resolveLogoImageStyle,
  resolveLogoMode,
  resolveLogoSrc,
  resolveLogoTextVisible
} from "@/layout/hooks/logoPreferences";
import LaySidebarItem from "../lay-sidebar/components/SidebarItem.vue";
import NavbarActions from "../lay-navbar/NavbarActions.vue";

/**
 * 水平布局（vben `header-nav`）：通栏顶栏 = Logo + 一级菜单 + 右侧动作区。
 * 动作区与纵向顶栏共用 NavbarActions（同一套落位编排与设置入口形态）。
 */
const menuRef = ref();
const headerRef = ref();
const showLogo = ref(
  storageLocal().getItem<StorageConfigs>(
    `${responsiveStorageNameSpace()}configure`
  )?.showLogo ?? true
);

const route = useRoute();
const { title, getLogo, backTopMenu } = useNav();
const { $storage } = useGlobal<GlobalPropertiesApi>();
const { isDark } = useDark();

const configure = computed(() => $storage?.configure);
/** Logo 自定义三件套 + 形态派生（实现见 layout/hooks/logoPreferences） */
const logoSrc = computed(() =>
  resolveLogoSrc(configure.value, getLogo(), Boolean(isDark.value))
);
const logoMode = computed(() => resolveLogoMode(configure.value));
const showLogoText = computed(() => resolveLogoTextVisible(configure.value));
const logoStyle = computed(() => resolveLogoImageStyle(configure.value));

const defaultActive = computed(() =>
  !isAllEmpty(route.meta?.activePath) ? route.meta.activePath : route.path
);

/** 顶栏渲染序列：支持一级菜单按 groupName/groupRank 分组（仅影响展示层） */
const topMenuData = computed(() =>
  groupMenuChildren(usePermissionStoreHook().wholeMenus)
);

/** 菜单项数量/宽度变化后重算 EP 的溢出收纳（否则多出的一级项会盖到右侧动作区） */
function relayoutMenu() {
  nextTick(() => menuRef.value?.handleResize());
}

nextTick(() => {
  menuRef.value?.handleResize();
});

useResizeObserver(headerRef, relayoutMenu);

onMounted(() => {
  relayoutMenu();
  emitter.on("logoChange", key => {
    showLogo.value = key;
  });
});

onBeforeUnmount(() => {
  emitter.off("logoChange");
});
</script>

<template>
  <div
    ref="headerRef"
    v-loading="usePermissionStoreHook().wholeMenus.length === 0"
    class="horizontal-header"
  >
    <div
      v-if="showLogo"
      class="horizontal-header-left"
      :class="[`logo-mode-${logoMode}`]"
      @click="backTopMenu"
    >
      <img :src="logoSrc" :style="logoStyle" alt="logo" />
      <span v-if="showLogoText">{{ title }}</span>
    </div>
    <el-menu
      ref="menuRef"
      mode="horizontal"
      popper-class="pure-scrollbar"
      class="horizontal-header-menu"
      :default-active="defaultActive"
      :show-timeout="300"
      :hide-timeout="300"
    >
      <LaySidebarItem
        v-for="route in topMenuData"
        :key="route.path"
        :item="route as never"
        :base-path="route.path"
      />
    </el-menu>
    <NavbarActions class="horizontal-header-right" />
  </div>
</template>

<style lang="scss" scoped>
:deep(.el-loading-mask) {
  opacity: 0.45;
}
</style>
