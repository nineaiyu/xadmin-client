<script lang="ts" setup>
import { getConfig } from "@/config";
import { posix } from "path-browserify";
import { menuType } from "@/layout/types";
import { useRouter } from "vue-router";
import { ReText } from "@/components/ReText";
import { useNav } from "@/layout/hooks/useNav";
import { transformI18n } from "@/plugins/i18n";
import { firstLeafPath } from "@/utils/menuActivate";
import SidebarLinkItem from "./SidebarLinkItem.vue";
import SidebarExtraIcon from "./SidebarExtraIcon.vue";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import {
  computed,
  type CSSProperties,
  type PropType,
  ref,
  toRaw,
  useAttrs
} from "vue";

import ArrowUp from "~icons/ep/arrow-up-bold";
import EpArrowDown from "~icons/ep/arrow-down-bold";
import ArrowLeft from "~icons/ep/arrow-left-bold";
import ArrowRight from "~icons/ep/arrow-right-bold";

const attrs = useAttrs();
const router = useRouter();
const { layout, tooltipEffect, getDivStyle, $storage } = useNav();

/** 侧边栏菜单节点：路由数据在运行时必然携带 meta，类型层窄化便于模板直接访问 */
type SidebarMenuNode = menuType & { meta: NonNullable<menuType["meta"]> };

const props = defineProps({
  item: {
    type: Object as PropType<SidebarMenuNode>,
    required: true
  },
  isNest: {
    type: Boolean,
    default: false
  },
  basePath: {
    type: String,
    default: ""
  },
  /**
   * 侧栏视觉折叠态（NavVertical 传入）：折叠态下「只留图标」的形态判断一律用它，
   * 而非 useNav 的 isCollapse —— 后者在「折叠态悬停临时展开」期间仍为 true，
   * 会让标题在临时展开的完整侧栏里消失。
   * 子孙项由 isNest 区分，无需继续下传。
   */
  collapse: {
    type: Boolean,
    default: false
  }
});

const getNoDropdownStyle = computed((): CSSProperties => {
  return {
    width: "100%",
    display: "flex",
    alignItems: "center"
  };
});

const getSubMenuIconStyle = computed((): CSSProperties => {
  return {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    margin:
      layout.value === "horizontal"
        ? "0 5px 0 0"
        : props.collapse
          ? "0 auto"
          : "0 5px 0 0"
  };
});

const textClass = computed(() => {
  const item = props.item;
  const baseClass = "w-full! text-inherit!";
  // 折叠态无图标的一级项：由文字顶替图标（居中单行），isNest 项不在折叠判定内
  if (
    layout.value !== "horizontal" &&
    props.collapse &&
    !toRaw(item.meta.icon) &&
    !props.isNest
  ) {
    return `${baseClass} min-w-13.5! text-center! px-3!`;
  }
  return baseClass;
});

const expandCloseIcon = computed(() => {
  if (!getConfig()?.MenuArrowIconNoTransition) return "";
  return {
    "expand-close-icon": useRenderIcon(EpArrowDown),
    "expand-open-icon": useRenderIcon(ArrowUp),
    "collapse-close-icon": useRenderIcon(ArrowRight),
    "collapse-open-icon": useRenderIcon(ArrowLeft)
  };
});

const onlyOneChild = ref<SidebarMenuNode>({ meta: {}, value: undefined });

function hasOneShowingChild(children: menuType[] = [], parent: menuType) {
  const showingChildren = children.filter(item => {
    onlyOneChild.value = item as SidebarMenuNode;
    return true;
  });

  if (showingChildren[0]?.meta?.showParent) {
    return false;
  }

  if (showingChildren.length === 1) {
    return true;
  }

  if (showingChildren.length === 0) {
    onlyOneChild.value = {
      ...parent,
      path: "",
      noShowingChildren: true
    } as SidebarMenuNode;
    return true;
  }
  return false;
}

/** 子菜单节点窄化（运行时由路由数据保证 meta 存在） */
function asMenuNode(node: menuType): SidebarMenuNode {
  return node as SidebarMenuNode;
}

function resolvePath(routePath: string) {
  const httpReg = /^http(s?):\/\//;
  if (httpReg.test(routePath) || httpReg.test(props.basePath)) {
    return routePath || props.basePath;
  } else {
    return posix.resolve(props.basePath, routePath);
  }
}

/** 折叠态显示菜单标题（设置面板 →「折叠态显示标题」，仅垂直布局） */
const collapsedShowTitle = computed(
  () =>
    layout.value === "vertical" &&
    ($storage?.configure?.sidebarCollapsedShowTitle ?? false)
);

/** 一级有图标项：折叠态给根节点加类，样式层切换「图标在上、标题在下」形态 */
const showCollapseTitleItem = computed(
  () =>
    collapsedShowTitle.value &&
    props.collapse &&
    !props.isNest &&
    !!toRaw(props.item.meta.icon)
);

/** 叶子项折叠标题（有图标）：渲染在默认插槽内，仅折叠态显示 */
const showCollapsedLeafTitle = computed(
  () =>
    collapsedShowTitle.value &&
    props.collapse &&
    !!(toRaw(onlyOneChild.value.meta.icon) ?? toRaw(props.item.meta.icon))
);

/** 叶子项文本：无图标折叠态（既有形态）或有图标折叠显示标题时渲染 */
const showLeafText = computed(
  () =>
    showCollapsedLeafTitle.value ||
    (!props.item.meta.icon &&
      props.collapse &&
      layout.value === "vertical" &&
      !props.isNest) ||
    (!onlyOneChild.value.meta.icon &&
      props.collapse &&
      layout.value === "mix" &&
      !props.isNest)
);

/** 叶子项文本样式：折叠标题（有图标）与既有单行文字形态分别取类 */
const leafTextClass = computed(() =>
  showCollapsedLeafTitle.value
    ? "collapse-show-title-text w-full! text-center! text-inherit!"
    : "w-full! px-3! min-w-13.5! text-center! text-inherit!"
);

/** 自动激活子菜单：点击顶层父级展开时跳转其第一个子菜单（仅展开态生效） */
const autoActivateChild = computed(
  () =>
    layout.value === "vertical" &&
    !props.collapse &&
    ($storage?.configure?.sidebarAutoActivateChild ?? false)
);

/** 本次点击前父级是否已展开（mousedown 时 EP 尚未切换展开状态，click 时已刷新） */
const openedBeforeClick = ref(false);

function handleSubMenuMouseDown(event: MouseEvent) {
  const rootEl = event.currentTarget as HTMLElement | null;
  openedBeforeClick.value = !!rootEl && rootEl.classList.contains("is-opened");
}

function handleSubMenuClick(event: MouseEvent) {
  if (props.isNest || !autoActivateChild.value) return;
  const rootEl = event.currentTarget as HTMLElement | null;
  const title = (event.target as HTMLElement | null)?.closest?.(
    ".el-sub-menu__title"
  );
  if (!rootEl || !title || title.closest(".el-sub-menu") !== rootEl) return;
  // 点击前已展开：本次为收起动作，不触发跳转
  if (openedBeforeClick.value) return;
  const path = firstLeafPath(props.item, props.basePath);
  if (path) router.push(path);
}
</script>

<template>
  <SidebarLinkItem
    v-if="
      hasOneShowingChild(item.children, item) &&
      (!onlyOneChild.children || onlyOneChild.noShowingChildren)
    "
    :to="item"
  >
    <el-menu-item
      :index="resolvePath(onlyOneChild.path ?? '')"
      :class="{ 'submenu-title-noDropdown': !isNest }"
      :style="getNoDropdownStyle"
      v-bind="attrs"
    >
      <div
        v-if="toRaw(item.meta.icon)"
        class="sub-menu-icon"
        :style="getSubMenuIconStyle"
      >
        <component
          :is="
            useRenderIcon(
              toRaw(onlyOneChild.meta.icon) ?? toRaw(item.meta.icon) ?? ''
            )
          "
        />
      </div>
      <el-text v-if="showLeafText" truncated :class="leafTextClass">
        {{ transformI18n(onlyOneChild.meta.title) }}
      </el-text>

      <template #title>
        <div :style="getDivStyle">
          <ReText
            :tippyProps="{
              offset: [0, -10],
              theme: tooltipEffect
            }"
            class="w-full! text-inherit!"
          >
            {{ transformI18n(onlyOneChild.meta.title) }}
          </ReText>
          <SidebarExtraIcon :extraIcon="onlyOneChild.meta.extraIcon" />
        </div>
      </template>
    </el-menu-item>
  </SidebarLinkItem>
  <el-sub-menu
    v-else
    ref="subMenu"
    :index="resolvePath(item.path ?? '')"
    teleported
    v-bind="expandCloseIcon"
    :class="{ 'collapse-show-title': showCollapseTitleItem }"
    @mousedown="handleSubMenuMouseDown"
    @click="handleSubMenuClick"
  >
    <template #title>
      <div
        v-if="toRaw(item.meta.icon)"
        :style="getSubMenuIconStyle"
        class="sub-menu-icon"
      >
        <component :is="useRenderIcon(toRaw(item.meta.icon) ?? '')" />
      </div>
      <ReText
        v-if="
          layout === 'mix' && toRaw(item.meta.icon)
            ? !collapse || isNest
            : !(
                layout === 'vertical' &&
                collapse &&
                toRaw(item.meta.icon) &&
                !isNest &&
                !collapsedShowTitle
              )
        "
        :tippyProps="{
          offset: [0, -10],
          theme: tooltipEffect
        }"
        :class="textClass"
      >
        {{ transformI18n(item.meta.title) }}
      </ReText>
      <SidebarExtraIcon v-if="!collapse" :extraIcon="item.meta.extraIcon" />
    </template>

    <sidebar-item
      v-for="child in item.children"
      :key="child.path"
      :is-nest="true"
      :item="asMenuNode(child)"
      :base-path="resolvePath(child.path ?? '')"
      class="nest-menu"
    />
  </el-sub-menu>
</template>
