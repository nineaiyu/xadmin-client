<script lang="ts" setup>
import { toRaw, type FunctionalComponent, type PropType } from "vue";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";

defineProps({
  extraIcon: {
    // 路由 meta 的附加图标：字符串图标名或组件（useRenderIcon 两者皆支持）
    type: [String, Object] as PropType<string | FunctionalComponent>,
    default: ""
  }
});
</script>

<template>
  <div v-if="extraIcon" class="flex-c">
    <component :is="useRenderIcon(toRaw(extraIcon))" class="size-7.5" />
  </div>
</template>
