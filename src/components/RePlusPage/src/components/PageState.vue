<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import ReStateContainer from "@/components/ReStateContainer";

defineOptions({ name: "RePlusPageState" });

defineProps<{
  state: "denied" | "error" | "ready";
  errorDetail: string;
}>();

const emit = defineEmits<{ retry: [] }>();

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
      <div class="mt-3 text-center">
        <el-button type="primary" @click="emit('retry')">
          {{ t("plus.retry") }}
        </el-button>
      </div>
    </template>
  </ReStateContainer>
</template>
