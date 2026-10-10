<script lang="ts" setup>
import { computed } from "vue";
import { useGlobal } from "@pureadmin/utils";
import { getConfig } from "@/config";
import { SITE_LINKS } from "@/config/site";

const TITLE = getConfig("Title");
const { $storage } = useGlobal<GlobalPropertiesApi>();

/**
 * 页脚高度（px）：0 = 自动（沿用内置留白，默认档）；>0 = 固定高度并居中。
 * 固定头部总高与页脚无关（页脚在内容区滚动流内），不影响内容区让位算式。
 */
const footerHeight = computed(() => {
  const value = Number($storage?.configure?.footerHeight ?? 0);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
});

/** 固定页脚：吸附内容区底部（sticky），内容滚动时页脚常驻可见 */
const footerFixed = computed(() => $storage?.configure?.footerFixed ?? false);

const footerStyle = computed(() => {
  const fixed = footerFixed.value;
  return {
    ...(footerHeight.value > 0
      ? { height: `${footerHeight.value}px` }
      : undefined),
    ...(fixed
      ? {
          position: "sticky" as const,
          bottom: "0",
          zIndex: 1,
          background: "hsl(var(--bg-page))"
        }
      : undefined)
  };
});
</script>

<template>
  <footer
    class="layout-footer text-fg-muted"
    :class="{ 'layout-footer--fixed': footerFixed }"
    :style="footerStyle"
  >
    Copyright © 2026-present
    <a class="hover:text-primary!" :href="SITE_LINKS.author" target="_blank">
      &nbsp;{{ TITLE }}
    </a>
  </footer>
</template>

<style lang="scss" scoped>
.layout-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 0 0 8px;
  font-size: 14px;

  /* 固定页脚由内联样式接管高度与吸附（sticky），此处只去掉底部留白并加一条分隔线 */
  &--fixed {
    padding: 0;
    border-top: 1px solid var(--el-border-color-lighter);
  }
}
</style>
