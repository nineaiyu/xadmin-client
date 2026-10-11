<script setup lang="ts">
import { emitter } from "@/utils/mitt";
import { useTags } from "../../hooks/useTag";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { onClickOutside } from "@vueuse/core";
import TagChrome from "./components/TagChrome.vue";
import {
  computed,
  ref,
  watch,
  unref,
  toRaw,
  onMounted,
  onBeforeUnmount,
  type Ref
} from "vue";
import { delay, useGlobal, useResizeObserver } from "@pureadmin/utils";

import { useTagScroll } from "./hooks/useTagScroll";
import { useTagActions } from "./hooks/useTagActions";
import { useTagDrag } from "./hooks/useTagDrag";

import ArrowDown from "~icons/ri/arrow-down-s-line";
import ArrowRightSLine from "~icons/ri/arrow-right-s-line";
import ArrowLeftSLine from "~icons/ri/arrow-left-s-line";
import RefreshRight from "~icons/ep/refresh-right";

const {
  Close,
  route,
  router,
  visible,
  showTags,
  instance,
  tagsStyle,
  multiTags,
  tagsViews,
  buttonTop,
  buttonLeft,
  translateX,
  isFixedTag,
  pureSetting,
  activeIndex,
  getTabStyle,
  isScrolling,
  iconIsActive,
  linkIsActive,
  currentSelect,
  scheduleIsActive,
  getContextMenuStyle,
  closeMenu,
  onContentFullScreen,
  onMouseenter,
  onMouseleave,
  transformI18n
} = useTags();

const containerDom = ref();
const contextmenuRef = ref();
const { $storage } = useGlobal<GlobalPropertiesApi>();

/** 中键关闭页签（默认开） */
const middleClickClose = computed(
  () => $storage?.configure?.tagsMiddleClickClose ?? true
);

/** 滚轮横向滚动页签条（默认开） */
const tagsWheelSwitch = computed(
  () => $storage?.configure?.tagsWheelSwitch ?? true
);

/** 页签条细分开关（默认全开）：页签图标 / 刷新按钮 / 更多按钮 */
const tagsShowIcon = computed(() => $storage?.configure?.tagsShowIcon ?? true);
const tagsShowRefresh = computed(
  () => $storage?.configure?.tagsShowRefresh ?? true
);
const tagsShowMore = computed(() => $storage?.configure?.tagsShowMore ?? true);

/**
 * 页签 v-for 的稳定 key（path + query，与 store 的去重口径一致）。
 *
 * 不能用下标做 key：拖拽排序由 sortable 直接搬动 DOM，Vue 的下标补丁会把
 * 「搬动过」的节点按老位置写文本，等于把排序结果抵消（实测：store 已更新为新序，
 * 界面仍是旧序）。
 */
function tagKey(item: { path?: string; query?: unknown }) {
  return `${item?.path ?? ""}-${JSON.stringify(item?.query ?? {})}`;
}

/** 滚动与可视区域定位 */
const {
  tabDom,
  scrollbarDom,
  isShowArrow,
  dynamicTagView,
  handleScroll,
  handleWheel
} = useTagScroll({ route, multiTags, instance, translateX, isScrolling });

/** 标签增删、右键/下拉菜单 */
const {
  dynamicRouteTag,
  deleteMenu,
  handleCommand,
  selectTag,
  showMenuModel,
  openMenu,
  tagOnClick,
  refreshRoute
} = useTagActions({
  route,
  router,
  visible,
  multiTags,
  tagsViews,
  buttonTop,
  buttonLeft,
  currentSelect,
  pureSetting,
  closeMenu,
  onContentFullScreen,
  dynamicTagView,
  containerDom
});

/** 拖拽排序：固定页签不参与拖拽，排序结果写回 multiTags */
useTagDrag({ tabDom, refresh: dynamicTagView });

onClickOutside(contextmenuRef, closeMenu, {
  detectIframe: true
});

watch(route, () => {
  activeIndex.value = -1;
  dynamicTagView();
});

onMounted(() => {
  if (!instance) return;

  // 根据当前路由初始化操作标签页的禁用状态
  showMenuModel(route.fullPath);

  // 触发隐藏标签页
  emitter.on("tagViewsChange", key => {
    // 载荷为布尔开关（与 mitt 事件类型一致），showTags 运行时为布尔 ref
    if (unref(showTags as Ref<boolean>) === key) return;
    (showTags as Ref<boolean>).value = key;
  });

  // 改变标签风格
  emitter.on("tagViewsTagsStyle", key => {
    tagsStyle.value = key;
  });

  //  接收侧边栏切换传递过来的参数
  emitter.on("changLayoutRoute", indexPath => {
    dynamicRouteTag(indexPath);
    setTimeout(() => {
      showMenuModel(indexPath);
    });
  });

  useResizeObserver(scrollbarDom, dynamicTagView);
  delay().then(() => dynamicTagView());
});

onBeforeUnmount(() => {
  // 解绑`tagViewsChange`、`tagViewsTagsStyle`、`changLayoutRoute`公共事件，防止多次触发
  emitter.off("tagViewsChange");
  emitter.off("tagViewsTagsStyle");
  emitter.off("changLayoutRoute");
});
</script>

<template>
  <div v-if="!showTags" ref="containerDom" class="tags-view">
    <span v-show="isShowArrow" class="arrow-left">
      <IconifyIconOffline :icon="ArrowLeftSLine" @click="handleScroll(200)" />
    </span>
    <div
      ref="scrollbarDom"
      class="scroll-container"
      :class="[
        tagsStyle === 'chrome' && 'chrome-scroll-container',
        tagsStyle === 'plain' && 'plain-scroll-container'
      ]"
      @wheel.prevent="tagsWheelSwitch && handleWheel($event)"
    >
      <div ref="tabDom" class="tab select-none" :style="getTabStyle">
        <div
          v-for="(item, index) in multiTags"
          :ref="'dynamic' + index"
          :key="tagKey(item)"
          :class="[
            'scroll-item is-closable',
            linkIsActive(item),
            tagsStyle === 'chrome' && 'chrome-item',
            isFixedTag(item) && 'fixed-tag'
          ]"
          @contextmenu.prevent="openMenu(item, $event)"
          @mousedown.middle.prevent="
            middleClickClose && !isFixedTag(item) && deleteMenu(item)
          "
          @mouseenter.prevent="onMouseenter(index)"
          @mouseleave.prevent="onMouseleave(index)"
          @click="tagOnClick(item)"
        >
          <template v-if="tagsStyle !== 'chrome'">
            <span
              v-if="tagsShowIcon && item.meta?.icon"
              class="tag-icon"
              aria-hidden="true"
            >
              <component :is="useRenderIcon(toRaw(item.meta.icon))" />
            </span>
            <span class="tag-title dark:text-fg! dark:hover:text-primary!">
              {{ transformI18n(item.meta?.title ?? "") }}
            </span>
            <span
              v-if="
                isFixedTag(item)
                  ? false
                  : iconIsActive(item, index) ||
                    (index === activeIndex && index !== 0)
              "
              class="el-icon-close"
              @click.stop="deleteMenu(item)"
            >
              <IconifyIconOffline :icon="Close" />
            </span>
            <span
              v-if="tagsStyle !== 'card' && tagsStyle !== 'plain'"
              :ref="'schedule' + index"
              :class="[scheduleIsActive(item)]"
            />
          </template>
          <div v-else class="chrome-tab">
            <span
              v-if="index !== 0 && index !== activeIndex"
              class="chrome-tab-divider bg-border-light dark:bg-fill"
            />
            <div class="chrome-tab__bg">
              <TagChrome />
            </div>
            <span
              v-if="tagsShowIcon && item.meta?.icon"
              class="tag-icon"
              aria-hidden="true"
            >
              <component :is="useRenderIcon(toRaw(item.meta.icon))" />
            </span>
            <span class="tag-title">
              {{ transformI18n(item.meta?.title ?? "") }}
            </span>
            <span
              v-if="isFixedTag(item) ? false : index !== 0"
              class="chrome-close-btn"
              @click.stop="deleteMenu(item)"
            >
              <IconifyIconOffline :icon="Close" />
            </span>
          </div>
        </div>
      </div>
    </div>
    <span v-show="isShowArrow" class="arrow-right">
      <IconifyIconOffline :icon="ArrowRightSLine" @click="handleScroll(-200)" />
    </span>
    <!-- 刷新当前页按钮（与右键菜单「刷新」同口径） -->
    <span
      v-if="tagsShowRefresh"
      class="tags-refresh"
      role="button"
      tabindex="0"
      :title="transformI18n('buttons.reload')"
      :aria-label="transformI18n('buttons.reload')"
      @click="refreshRoute"
      @keydown.enter.prevent="refreshRoute"
      @keydown.space.prevent="refreshRoute"
    >
      <IconifyIconOffline :icon="RefreshRight" class="dark:text-white" />
    </span>
    <!-- 右键菜单按钮 -->
    <transition name="el-zoom-in-top">
      <ul
        v-show="visible"
        ref="contextmenuRef"
        :key="Math.random()"
        :style="getContextMenuStyle"
        class="contextmenu"
      >
        <div
          v-for="(item, key) in tagsViews"
          :key="key"
          style="display: flex; align-items: center"
        >
          <li v-if="item.show" @click="selectTag(key, item)">
            <IconifyIconOffline :icon="item.icon" />
            {{ transformI18n(item.text) }}
          </li>
        </div>
      </ul>
    </transition>
    <!-- 右侧功能按钮（更多：页签批量操作） -->
    <el-dropdown
      v-if="tagsShowMore"
      trigger="click"
      placement="bottom-end"
      @command="handleCommand"
    >
      <span class="arrow-down" :aria-label="transformI18n('layout.more')">
        <IconifyIconOffline :icon="ArrowDown" class="dark:text-white" />
      </span>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item
            v-for="(item, key) in tagsViews"
            :key="key"
            :command="{ key, item }"
            :divided="item.divided"
            :disabled="item.disabled"
          >
            <IconifyIconOffline :icon="item.icon" />
            {{ transformI18n(item.text) }}
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<style lang="scss" scoped>
@import url("./index.scss");
</style>
