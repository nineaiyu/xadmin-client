<script lang="ts" setup>
import { computed, defineAsyncComponent, ref } from "vue";
import { useI18n } from "vue-i18n";

import type { JsonViewerAction, JsonViewerProps } from "./types";

defineOptions({ name: "ReJsonViewer", inheritAttrs: false });

/**
 * vue-json-pretty 异步组件（含样式）：静态引入会把 JS + CSS 双双拖入引用方闭包
 * （约 9.6 KB gzip），改为首次渲染时加载；Vite 会为动态 import 的 CSS 产出独立
 * chunk 并在加载时注入。与 RePlusPage 详情渲染器的既有做法同源。
 */
const VueJsonPretty = defineAsyncComponent(async () => {
  await import("vue-json-pretty/lib/styles.css");
  return (await import("vue-json-pretty")).default;
});

const props = withDefaults(defineProps<JsonViewerProps>(), {
  expandDepth: 1,
  copyable: false,
  boxed: false,
  theme: "light",
  expanded: false,
  previewMode: false,
  showDoubleQuotes: false
});

const emit = defineEmits<{ copied: [event: JsonViewerAction] }>();

const { t } = useI18n();

const copiedPath = ref<null | string>(null);

/** vue-json-pretty 复制动作传入的节点 */
interface JsonNode {
  path: string;
  content: unknown;
  el?: HTMLElement;
}

function handleCopy(node: JsonNode, defaultCopy: () => void) {
  defaultCopy();
  copiedPath.value = node.path;
  emit("copied", {
    action: "copy",
    text: JSON.stringify(node.content),
    trigger: node.el ?? document.body
  });
  setTimeout(() => {
    if (copiedPath.value === node.path) copiedPath.value = null;
  }, 2000);
}

// 字符串入参按 JSON 解析；对象直接透传（解析失败降级为空对象，不抛错打断页面）
const jsonData = computed(() => {
  if (typeof props.value !== "string") {
    return props.value ?? {};
  }
  try {
    return JSON.parse(props.value);
  } catch {
    return {};
  }
});

/** `dark*` 归一为 vue-json-pretty 的 dark 主题 */
const prettyTheme = computed<"light" | "dark">(() =>
  props.theme === "dark" || props.theme === "dark-json-theme" ? "dark" : "light"
);
</script>

<template>
  <div
    class="re-json-viewer"
    :class="[`re-json-viewer--${prettyTheme}`, { 'is-boxed': boxed }]"
  >
    <VueJsonPretty
      v-bind="$attrs"
      :data="jsonData"
      :deep="expanded ? Infinity : expandDepth"
      :show-double-quotes="showDoubleQuotes"
      :show-line="boxed"
      show-length
      show-icon
      :theme="prettyTheme"
      :collapsed-node-length="previewMode ? 0 : Infinity"
      :render-node-actions="copyable"
    >
      <template #renderNodeActions="{ node, defaultActions }">
        <slot name="copy" :node="node" :default-actions="defaultActions">
          <span
            v-if="copyable"
            class="re-json-viewer__copy"
            :class="{ 'is-copied': copiedPath === node.path }"
            @click.stop="handleCopy(node, defaultActions.copy)"
          >
            {{
              copiedPath === node.path
                ? t("jsonViewer.copied")
                : t("jsonViewer.copy")
            }}
          </span>
        </slot>
      </template>
    </VueJsonPretty>
  </div>
</template>

<style lang="scss" scoped>
.re-json-viewer {
  font-family: Consolas, Menlo, Courier, monospace;
  font-size: var(--el-font-size-base);
  color: var(--el-text-color-primary);
  background: var(--el-bg-color);

  &.is-boxed {
    padding: var(--space-3);
    border: 1px solid var(--el-border-color);
    border-radius: var(--el-border-radius-base);
  }

  :deep(.vjs-value-null),
  :deep(.vjs-value-undefined) {
    color: var(--el-text-color-secondary);
  }

  :deep(.vjs-value-boolean) {
    color: var(--el-color-danger);
  }

  :deep(.vjs-value-number) {
    color: var(--el-color-primary);
  }

  :deep(.vjs-value-string) {
    color: var(--el-color-success);
    overflow-wrap: break-word;
    white-space: normal;
  }

  :deep(.vjs-tree-brackets) {
    color: var(--el-text-color-regular);
  }

  :deep(.vjs-tree-node.is-highlight) {
    background-color: var(--el-fill-color-light);
  }

  :deep(.vjs-carets:hover) {
    color: var(--el-color-primary);
  }

  :deep(.vjs-indent-unit.has-line) {
    border-left: 1px solid var(--el-border-color-lighter);
  }

  &__copy {
    display: inline-block;
    padding: 0 var(--space-2);
    margin-left: var(--space-2);
    font-size: var(--el-font-size-extra-small);
    line-height: 20px;
    color: var(--el-color-primary);
    cursor: pointer;
    user-select: none;
    background-color: var(--el-fill-color-light);
    border-radius: var(--radius-sm);
    opacity: 0;
    transition: opacity 0.2s;

    &:hover {
      background-color: var(--el-fill-color);
    }

    &.is-copied {
      color: var(--el-color-success);
      opacity: 1;
    }
  }

  :deep(.vjs-tree-node:hover .re-json-viewer__copy) {
    opacity: 1;
  }
}
</style>
