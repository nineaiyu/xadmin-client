<script setup lang="ts">
import { emitter } from "@/utils/mitt";
import { useTags } from "../../hooks/useTag";
import { onClickOutside } from "@vueuse/core";
import TagChrome from "./components/TagChrome.vue";
import { ref, watch, unref, onMounted, onBeforeUnmount, type Ref } from "vue";
import { delay, useResizeObserver } from "@pureadmin/utils";

import { useTagScroll } from "./hooks/useTagScroll";
import { useTagActions } from "./hooks/useTagActions";

import ArrowDown from "~icons/ri/arrow-down-s-line";
import ArrowRightSLine from "~icons/ri/arrow-right-s-line";
import ArrowLeftSLine from "~icons/ri/arrow-left-s-line";

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
  tagOnClick
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
  emitter.on("tagViewsChange", (key: string | boolean) => {
    // 载荷实际为布尔开关（emit 侧经 string 通道传出），showTags 运行时为布尔 ref
    if (unref(showTags as Ref<boolean>) === key) return;
    (showTags as Ref<boolean>).value = key as boolean;
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
      :class="tagsStyle === 'chrome' && 'chrome-scroll-container'"
      @wheel.prevent="handleWheel"
    >
      <div ref="tabDom" class="tab select-none" :style="getTabStyle">
        <div
          v-for="(item, index) in multiTags"
          :ref="'dynamic' + index"
          :key="index"
          :class="[
            'scroll-item is-closable',
            linkIsActive(item),
            tagsStyle === 'chrome' && 'chrome-item',
            isFixedTag(item) && 'fixed-tag'
          ]"
          @contextmenu.prevent="openMenu(item, $event)"
          @mouseenter.prevent="onMouseenter(index)"
          @mouseleave.prevent="onMouseleave(index)"
          @click="tagOnClick(item)"
        >
          <template v-if="tagsStyle !== 'chrome'">
            <span
              class="tag-title dark:text-text_color_primary! dark:hover:text-primary!"
            >
              {{ transformI18n(item.meta.title) }}
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
              v-if="tagsStyle !== 'card'"
              :ref="'schedule' + index"
              :class="[scheduleIsActive(item)]"
            />
          </template>
          <div v-else class="chrome-tab">
            <span
              v-if="index !== 0 && index !== activeIndex"
              class="chrome-tab-divider bg-[#e2e2e2] dark:bg-[#2d2d2d]"
            />
            <div class="chrome-tab__bg">
              <TagChrome />
            </div>
            <span class="tag-title">
              {{ transformI18n(item.meta.title) }}
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
          v-for="(item, key) in tagsViews.slice(0, 6)"
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
    <!-- 右侧功能按钮 -->
    <el-dropdown
      trigger="click"
      placement="bottom-end"
      @command="handleCommand"
    >
      <span class="arrow-down">
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
