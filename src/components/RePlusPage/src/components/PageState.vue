<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import ReStateContainer from "@/components/ReStateContainer";

defineOptions({ name: "RePlusPageState" });

defineProps<{
  state: "denied" | "error" | "ready";
  errorDetail: string;
  /** 错误可能由筛选参数引起：提供「重置筛选并重试」自救入口 */
  canReset?: boolean;
}>();

const emit = defineEmits<{ retry: []; reset: [] }>();

const { t } = useI18n();
</script>

<template>
  <ReStateContainer
    :state="state"
    :denied-text="t('plus.noListPermission')"
    :error-text="t('reState.error')"
    :error-detail="errorDetail"
    :min-height="240"
    data-testid="plus-page-state"
  >
    <template #error>
      <el-alert
        type="error"
        :closable="false"
        show-icon
        :title="t('reState.error')"
        :description="errorDetail"
      />
      <div class="mt-3 flex-c gap-2">
        <el-button type="primary" @click="emit('retry')">
          {{ t("plus.retry") }}
        </el-button>
        <el-button v-if="canReset" @click="emit('reset')">
          {{ t("plus.resetAndRetry") }}
        </el-button>
      </div>
    </template>
  </ReStateContainer>
</template>
