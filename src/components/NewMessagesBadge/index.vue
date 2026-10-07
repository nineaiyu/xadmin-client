<script lang="ts" setup>
import { useI18n } from "vue-i18n";

/**
 * 离底新消息悬浮条（聊天室 / 助手页共用）：计数大于 0 时出现，点击回到底部
 * （计数清零与滚动定位由父级的滚动域驱动）。
 */
defineOptions({
  name: "NewMessagesBadge"
});

defineProps<{
  /** 离底期间到达的新消息条数 */
  count: number;
}>();

const emit = defineEmits<{
  /** 点击悬浮条：请求回到底部 */
  jump: [];
}>();

const { t } = useI18n();
</script>

<template>
  <div
    v-if="count > 0"
    class="absolute bottom-40 left-1/2 -translate-x-1/2 cursor-pointer"
    @click="emit('jump')"
  >
    <el-tag type="primary" effect="dark" round>
      {{ t("chat.newMessages", { count }) }}
    </el-tag>
  </div>
</template>
