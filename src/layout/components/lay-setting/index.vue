<script lang="ts" setup>
// 系统设置面板外壳：抽屉骨架（lay-panel）+ 内容（SettingTabs）。
// 内容按需加载并随「打开」挂载：不进入首屏静态闭包，未打开时不渲染整页表单；
// 常驻副作用（跟随系统主题、灰度/色弱类）已上移到 layout 与 usePreferenceAttributes。
// 入口形态两选一：顶栏齿轮（lay-navbar）或悬浮球（本组件，位置见「偏好入口」）。
import { computed, defineAsyncComponent, unref } from "vue";
import { useGlobal } from "@pureadmin/utils";
import { emitter } from "@/utils/mitt";
import { useNav } from "@/layout/hooks/useNav";
import { isFullContent } from "@/layout/hooks/layoutModes";
import { resolvePreferencesEntry } from "@/layout/hooks/preferencesEntry";
import LayPanel from "../lay-panel/index.vue";
import { useLayout } from "@/layout/hooks/useLayout";
import { useMenuLayout } from "./hooks/useMenuLayout";
import { useFabDrag } from "./hooks/useFabDrag";

import Setting from "~icons/ri/settings-3-line";

const SettingTabs = defineAsyncComponent(
  () => import("./components/SettingTabs.vue")
);

const { t } = useNav();
const { $storage } = useGlobal<GlobalPropertiesApi>();
const { layoutTheme } = useLayout();
const { setMenuLayout } = useMenuLayout();

/**
 * 悬浮球入口：总开关 + 入口位置的判定与顶栏齿轮收敛在同一处
 * （`resolvePreferencesEntry`）。全屏内容模式顶栏整块不渲染（齿轮形态无处安放），
 * 任何位置档都回落悬浮球，保证始终有切回其它布局的入口。
 */
const preferencesEntry = computed(() =>
  resolvePreferencesEntry({
    enablePreferences: $storage?.configure?.enablePreferences,
    preferencesPosition: $storage?.configure?.preferencesPosition,
    horizontal: String($storage?.layout?.layout ?? "vertical") === "horizontal",
    fullContent: isFullContent($storage?.layout?.layout)
  })
);
const floatingVisible = computed(() => preferencesEntry.value.floating);

function openPanel() {
  emitter.emit("openPanel" as never);
}

// 悬浮球可拖拽：位置存本地偏好，拖拽与点击按位移阈值区分（见 useFabDrag）
const {
  style: fabStyle,
  dragging: fabDragging,
  onPointerDown: onFabPointerDown,
  onActivate: onFabActivate
} = useFabDrag(openPanel);

/* body添加layout属性，作用于src/style/sidebar/ 目录 */
if (unref(layoutTheme)) {
  const layout = unref(layoutTheme).layout;
  const theme = unref(layoutTheme).theme;
  document.documentElement.setAttribute("data-theme", theme ?? "");
  setMenuLayout(layout ?? "");
}
</script>

<template>
  <LayPanel v-slot="{ show, contentKey }">
    <SettingTabs v-if="show" :content-key="contentKey" />
  </LayPanel>
  <!-- 悬浮球入口：与顶栏齿轮互为替代形态，沿用 `.set-icon` 定位契约；
       顶栏动作项的浅底 hover 已用 `:not(.setting-fab)` 排除，颜色由本组件自持 -->
  <span
    v-if="floatingVisible"
    class="set-icon setting-fab"
    :class="{ 'setting-fab--dragging': fabDragging }"
    :style="fabStyle"
    :title="t('layout.preferencesFabTip')"
    role="button"
    tabindex="0"
    :aria-label="t('buttons.systemSet')"
    @pointerdown="onFabPointerDown"
    @keydown.enter.prevent="onFabActivate"
    @keydown.space.prevent="onFabActivate"
  >
    <IconifyIconOffline :icon="Setting" />
  </span>
</template>

<style lang="scss" scoped>
/* 悬浮球：默认右下角圆钮（拖动后以 left/top 还原），层级低于设置面板（面板打开时收在其下） */
.setting-fab {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: var(--z-index-layout);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  font-size: var(--font-size-xl);
  color: var(--el-color-white);

  /* 触屏上禁用滚动手势，否则按下即被判定为页面滚动、拖不动 */
  touch-action: none;
  cursor: grab;
  user-select: none;
  background: var(--el-color-primary);
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-lg);
  transition:
    background var(--duration-fast) var(--ease-standard),
    transform var(--duration-fast) var(--ease-standard),
    box-shadow var(--duration-fast) var(--ease-standard);

  /* hover 加深主色（不得换成浅色底：白图标压在浅底上会「消失」） */
  &:hover {
    background: var(--el-color-primary-dark-2);
    box-shadow: var(--shadow-float);
    transform: translateY(-2px);
  }

  &--dragging {
    cursor: grabbing;
    transform: none;
    transition: none;
  }
}
</style>
