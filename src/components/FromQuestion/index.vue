<script setup lang="ts">
import { useRenderIcon } from "../ReIcon/src/hooks";

const props = defineProps({
  label: {
    required: true,
    type: String
  },
  description: {
    required: false,
    type: String
  }
});
defineOptions({ name: "FromQuestion" });
</script>

<template>
  <div class="flex justify-center items-center">
    <el-tooltip
      v-if="props.description"
      trigger="hover"
      :content="props.description"
      placement="top"
      effect="dark"
    >
      <component :is="useRenderIcon('ep:question-filled')" />
    </el-tooltip>
    {{ props.label }}
  </div>
</template>
