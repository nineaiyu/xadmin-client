<script lang="ts" setup>
import { computed } from "vue";

/**
 * 侧栏菜单徽标（后端菜单 meta：badge / badgeType）。
 *
 * - `badgeType === "dot"`：只渲染一个红点（不显示文本）；
 * - 其余形态：渲染文本徽标，纯数字大于 99 截断为 `99+`；
 * - 折叠态由样式层（`.el-menu--collapse`）叠加为图标右上角角标，组件本身不含定位。
 */
const props = defineProps<{
  badge?: string | null;
  type?: string | null;
}>();

const isDot = computed(() => props.type === "dot");

const display = computed(() => {
  const raw = String(props.badge ?? "").trim();
  if (!raw) return "";
  return /^\d+$/.test(raw) && Number(raw) > 99 ? "99+" : raw;
});
</script>

<template>
  <i
    v-if="display"
    class="sidebar-menu-badge"
    :class="{ 'is-dot': isDot }"
    aria-hidden="true"
  >
    <!--
      根元素用 i 而非 span：菜单标题的文本节点本身以 span 形态渲染，
      折叠态「标题不渲染」的既有判定按 `.el-sub-menu__title > span` 计数，
      badge 用 span 会被该断言误计（角标不属于标题文本）。
    -->
    {{ isDot ? "" : display }}
  </i>
</template>
