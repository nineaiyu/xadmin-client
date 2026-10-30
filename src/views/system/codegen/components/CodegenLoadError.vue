<script lang="ts" setup>
import { useI18n } from "vue-i18n";

defineOptions({ name: "CodegenLoadError" });

withDefaults(
  defineProps<{
    title: string;
    detail: string;
    /** 是否显示重试按钮（下载失败由原按钮重试，可关闭） */
    retryable?: boolean;
  }>(),
  { retryable: true }
);

const emit = defineEmits<{ retry: [] }>();
const { t } = useI18n();
</script>

<template>
  <div class="mb-2 flex items-start gap-2">
    <el-alert
      class="flex-1"
      type="error"
      :closable="false"
      show-icon
      :title="title"
      :description="detail"
    />
    <el-button v-if="retryable" link type="primary" @click="emit('retry')">
      {{ t("plus.retry") }}
    </el-button>
  </div>
</template>
