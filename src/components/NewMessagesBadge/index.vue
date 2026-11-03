<script lang="ts" setup>
import { useI18n } from "vue-i18n";

import type { NewMessagesBadgeProps } from "./types";
/**
 * 离底新消息悬浮条（聊天室 / 助手页共用）：计数大于 0 时出现，点击回到底部
 * （计数清零与滚动定位由父级的滚动域驱动）。
 */
defineOptions({
  name: "NewMessagesBadge"
});

defineProps<NewMessagesBadgeProps>();

const emit = defineEmits<{
  /** 点击悬浮条：请求回到底部 */
  jump: [];
}>();

const { t } = useI18n();
</script>

<template>
  <div
    v-if="count > 0"
    class="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 cursor-pointer transition-transform active:scale-95"
    role="button"
    tabindex="0"
    :aria-label="t('chat.newMessages', { count })"
    @click="emit('jump')"
    @keydown.enter.prevent="emit('jump')"
    @keydown.space.prevent="emit('jump')"
  >
    <el-tag type="primary" effect="dark" round>
      {{ t("chat.newMessages", { count }) }}
    </el-tag>
  </div>
</template>
