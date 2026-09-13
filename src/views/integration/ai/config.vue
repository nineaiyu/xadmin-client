<script lang="ts" setup>
import { aiConfigApi } from "@/api/system/ai";
import { computed } from "vue";
import { hasAuth } from "@/router/utils";
import Setting from "@/views/settings/components/settings/index.vue";
import { settingItemProps } from "@/views/settings/components/settings/types";

defineOptions({
  name: "AiAssistantConfig"
});

// AI 助手配置（ADR-023）：API Key 值级加密；测试按钮真实 ping LLM
const settingData = computed<Array<settingItemProps>>(() => [
  {
    auth: {
      partialUpdate: hasAuth("partialUpdate:AiAssistantConfig"),
      retrieve: hasAuth("list:AiAssistantConfig"),
      test: hasAuth("create:AiAssistantConfig")
    },
    api: aiConfigApi,
    localeName: "aiConfig",
    title: "title"
  }
]);
</script>

<template>
  <setting :model-value="settingData" />
</template>
