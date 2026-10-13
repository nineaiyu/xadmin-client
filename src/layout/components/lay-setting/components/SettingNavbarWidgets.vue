<script lang="ts" setup>
// 布局 - 顶栏组件：拖拽调序 + 逐个组件选择落位（顶栏 / 更多下拉 / 头像菜单 / 不显示）。
// 顺序写 `navbarOrder`；落位写 `widgetPositions`（权威），并镜像到各组件既有显隐开关
// （navbarXxx）与 `navbarMoreWidgets`，保证历史键读取端与既有用例语义不变。
// 组件目录见 lay-navbar/widgets/catalog.ts（弹层类组件固定顶栏，见 catalog.more）。
import { computed, ref } from "vue";
import { useGlobal } from "@pureadmin/utils";
import { useNav } from "@/layout/hooks/useNav";
import { useSortable } from "@/hooks/useSortable";
import {
  DEFAULT_NAVBAR_ORDER,
  findNavbarWidget,
  resolveWidgetPosition,
  type WidgetPosition
} from "@/layout/components/lay-navbar/widgets/catalog";
import { useConfigureStorage } from "../hooks/useConfigureStorage";
import { formatShortcut, resolveShortcutKeys } from "@/utils/shortcutKeys";
import PrefBlock from "./PrefBlock.vue";

import DragMoveLine from "~icons/ri/drag-move-2-line";
import DraggableIcon from "~icons/ri/drag-move-2-line";

const { t } = useNav();
const { $storage } = useGlobal<GlobalPropertiesApi>();
const { storageConfigureChange } = useConfigureStorage();

const listDom = ref<HTMLElement>();

/**
 * 组件 ↔ 全局快捷键动作映射（对齐 vben 小部件开关行的 kbd 提示）：
 * 有快捷键的组件在行内展示当前键位，提升快捷键可发现性。
 */
type WidgetShortcut = {
  keysKey: "shortcutSearchKeys" | "shortcutLockKeys" | "shortcutSidebarKeys";
  legacyKey: "shortcutSearch" | "shortcutLock" | "shortcutSidebar";
  fallback: string;
};

const WIDGET_SHORTCUTS: Record<string, WidgetShortcut> = {
  search: {
    keysKey: "shortcutSearchKeys",
    legacyKey: "shortcutSearch",
    fallback: "mod+k"
  },
  lock: {
    keysKey: "shortcutLockKeys",
    legacyKey: "shortcutLock",
    fallback: "alt+l"
  },
  sidebarToggle: {
    keysKey: "shortcutSidebarKeys",
    legacyKey: "shortcutSidebar",
    fallback: "alt+s"
  }
};

/** 行内快捷键提示文本（总开关关闭 / 该组件无快捷键 / 动作未启用时为空） */
function shortcutHint(key: string): string {
  if ($storage?.configure?.shortcutEnable === false) return "";
  const item = WIDGET_SHORTCUTS[key];
  if (!item) return "";
  const configure = $storage?.configure;
  const keys = resolveShortcutKeys(
    configure?.[item.keysKey],
    configure?.[item.legacyKey],
    item.fallback
  );
  return formatShortcut(keys);
}

/** 当前顺序：偏好优先，缺省内置顺序；目录新增但未入队列的组件按内置顺序补在末尾 */
const orderedKeys = computed<string[]>(() => {
  const configured = $storage?.configure?.navbarOrder;
  const list = Array.isArray(configured) ? configured : [];
  return [
    ...list.filter(key => Boolean(findNavbarWidget(key))),
    ...DEFAULT_NAVBAR_ORDER.filter(key => !list.includes(key))
  ];
});

const widgets = computed(() =>
  orderedKeys.value
    .map(key => findNavbarWidget(key))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
);

const moreWidgets = computed<string[]>(() => {
  const list = $storage?.configure?.navbarMoreWidgets;
  return Array.isArray(list) ? list : [];
});

/** 落位取值（权威 = widgetPositions，缺省回落历史显隐 / 更多键，实现见 catalog） */
function positionOf(key: string): WidgetPosition {
  return resolveWidgetPosition(
    key,
    $storage?.configure as Record<string, unknown> | undefined
  );
}

const positionOptions = computed(() =>
  [
    { value: "header", label: t("layout.navbarPositionHeader") },
    { value: "more", label: t("layout.navbarPositionMore") },
    { value: "user-dropdown", label: t("layout.navbarPositionUserDropdown") },
    { value: "none", label: t("layout.navbarPositionHidden") }
  ].filter(
    option => option.value !== "more" || widgets.value.some(item => item.more)
  )
);

function optionsFor(key: string) {
  const item = findNavbarWidget(key);
  return positionOptions.value.filter(
    option => option.value !== "more" || Boolean(item?.more)
  );
}

function changePosition(key: string, position: string) {
  const item = findNavbarWidget(key);
  if (!item) return;
  const target = position as WidgetPosition;
  const others = moreWidgets.value.filter(value => value !== key);
  // 权威：整包写 `widgetPositions`（引用替换，否则深层监听不触发自动保存）
  const positions = {
    ...(($storage?.configure?.widgetPositions as
      Record<string, WidgetPosition> | undefined) ?? {}),
    [key]: target
  };
  storageConfigureChange("widgetPositions", positions);
  // 兼容镜像：既有显隐开关 + 「更多」下拉键
  storageConfigureChange(item.visibleKey, target !== "none");
  storageConfigureChange(
    "navbarMoreWidgets",
    target === "more" ? [...others, key] : others
  );
}

function writeOrder(keys: string[]) {
  storageConfigureChange("navbarOrder", keys);
}

/** 拖拽调序：松手后按 DOM 顺序写回偏好 */
useSortable(listDom, {
  animation: 200,
  draggable: "[data-widget-key]",
  handle: ".navbar-widgets__handle",
  ghostClass: "navbar-widgets__ghost",
  forceFallback: true,
  onEnd: () => {
    const keys = Array.from(
      listDom.value?.querySelectorAll<HTMLElement>("[data-widget-key]") ?? []
    ).map(node => node.dataset.widgetKey ?? "");
    writeOrder(keys.filter(Boolean));
  }
});
</script>

<template>
  <PrefBlock
    :title="t('layout.navbarWidgets')"
    :desc="t('layout.navbarWidgetsDesc')"
    :tip="t('layout.navbarWidgetsTip')"
    :icon="DragMoveLine"
  >
    <ul ref="listDom" class="navbar-widgets">
      <li
        v-for="item in widgets"
        :key="item.key"
        :data-widget-key="item.key"
        :data-position="positionOf(item.key)"
        class="navbar-widgets__item"
      >
        <span
          class="navbar-widgets__handle"
          role="button"
          tabindex="0"
          :title="t('layout.navbarWidgetsDesc')"
          :aria-label="t('layout.navbarWidgetsDesc')"
        >
          <IconifyIconOffline :icon="DraggableIcon" />
        </span>
        <span class="navbar-widgets__label">{{ t(item.labelKey) }}</span>
        <kbd v-if="shortcutHint(item.key)" class="navbar-widgets__kbd">
          {{ shortcutHint(item.key) }}
        </kbd>
        <el-select
          :model-value="positionOf(item.key)"
          size="small"
          style="width: 118px"
          @change="value => changePosition(item.key, value as string)"
        >
          <el-option
            v-for="option in optionsFor(item.key)"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
      </li>
    </ul>
  </PrefBlock>
</template>

<style lang="scss" scoped>
.navbar-widgets {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 6px;

  &__item {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 4px 8px;
    background: var(--el-fill-color-light);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: var(--radius-md);
  }

  &__handle {
    display: flex;
    align-items: center;
    color: var(--el-text-color-secondary);
    cursor: grab;

    &:active {
      cursor: grabbing;
    }
  }

  &__label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: var(--font-size-sm);
    color: var(--el-text-color-regular);
    white-space: nowrap;
  }

  &__kbd {
    flex: none;
    padding: 1px 5px;
    font-family: var(--font-family-mono);
    font-size: var(--font-size-2xs);
    color: var(--el-text-color-secondary);
    background: var(--el-fill-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: var(--radius-xs);
  }

  &__ghost {
    opacity: 0.6;
  }
}
</style>
