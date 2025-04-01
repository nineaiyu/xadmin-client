<script lang="ts" setup>
import { useRenderIcon } from "../ReIcon/src/hooks";
import Question from "~icons/ep/question-filled";

defineProps({
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
      v-if="description"
      :content="description"
      effect="dark"
      placement="top"
      trigger="hover"
    >
      <component :is="useRenderIcon(Question)" />
    </el-tooltip>
    {{ label }}
  </div>
</template>
