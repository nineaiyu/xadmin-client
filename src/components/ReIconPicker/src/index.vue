<script setup lang="ts">
import { IconSelect } from "@/components/ReIcon";

defineOptions({ name: "ReIconPicker" });

/**
 * 图标选择器：**薄封装**既有离线图标选择器
 * （`ReIcon` 的 `Select.vue`：搜索 + 图标集页签 + 网格分页），避免第二套实现。
 * 仅透传 `v-model`（图标名，如 `ep:search`）。
 */
const value = defineModel<string>({ default: "" });
</script>

<template>
  <IconSelect v-model="value" />
</template>
