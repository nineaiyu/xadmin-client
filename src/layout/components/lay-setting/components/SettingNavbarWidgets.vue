<script lang="ts" setup>
// 布局 - 顶栏组件：拖拽调序 + 逐个组件选择落位（顶栏 / 更多下拉 / 不显示）。
// 顺序写 `navbarOrder`，落位写各组件既有显隐开关（navbarXxx）与 `navbarMoreWidgets`；
// 组件目录见 lay-navbar/widgets/catalog.ts（弹层类组件固定顶栏，见 catalog.more）。
import { computed, ref } from "vue";
import { useGlobal } from "@pureadmin/utils";
import { useNav } from "@/layout/hooks/useNav";
import { useSortable } from "@/hooks/useSortable";
import {
  DEFAULT_NAVBAR_ORDER,
  findNavbarWidget
} from "@/layout/components/lay-navbar/widgets/catalog";
import { useConfigureStorage } from "../hooks/useConfigureStorage";
import PrefBlock from "./PrefBlock.vue";

import DragMoveLine from "~icons/ri/drag-move-2-line";
import DraggableIcon from "~icons/ri/drag-move-2-line";

const { t } = useNav();
const { $storage } = useGlobal<GlobalPropertiesApi>();
const { storageConfigureChange } = useConfigureStorage();

const listDom = ref<HTMLElement>();

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

/** 落位取值：hidden = 既有显隐开关关闭；more = 收进「更多」下拉；header = 顶栏 */
function positionOf(key: string): string {
  const item = findNavbarWidget(key);
  if (!item) return "header";
  const visible =
    ($storage?.configure?.[item.visibleKey] as boolean | undefined) ??
    item.defaultVisible;
  if (!visible) return "hidden";
  return moreWidgets.value.includes(key) ? "more" : "header";
}

const positionOptions = computed(() =>
  [
    { value: "header", label: t("layout.navbarPositionHeader") },
    { value: "more", label: t("layout.navbarPositionMore") },
    { value: "hidden", label: t("layout.navbarPositionHidden") }
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
  const others = moreWidgets.value.filter(value => value !== key);
  if (position === "more") {
    storageConfigureChange(item.visibleKey, true);
    storageConfigureChange("navbarMoreWidgets", [...others, key]);
    return;
  }
  storageConfigureChange("navbarMoreWidgets", others);
  storageConfigureChange(item.visibleKey, position === "header");
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

  &__ghost {
    opacity: 0.6;
  }
}
</style>
