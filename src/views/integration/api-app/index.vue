<script lang="ts" setup>
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import Info from "~icons/ri/information-line";
import { useApiApplication } from "./utils/hook";
import ApiUsageDrawer from "./components/ApiUsageDrawer.vue";

defineOptions({
  name: "IntegrationApiApp"
});

const { t } = useI18n();
const tableRef = ref();
const {
  api,
  auth,
  listColumnsFormat,
  operationButtonsProps,
  tableBarButtonsProps,
  credentialDialog,
  credential,
  copyText,
  usageVisible,
  usageLoading,
  usageRow,
  usage
} = useApiApplication(tableRef);
</script>

<template>
  <div>
    <!-- 一次性密钥为只读展示弹窗（C5 既定保留手写场景），
         明文只在创建/重置响应中出现一次，列表与详情不回传 -->
    <div
      class="api-app-tip mb-3 flex w-99/100 items-center gap-2 px-3 py-2.5 text-sm text-text_color_regular"
    >
      <IconifyIconOffline
        :icon="Info"
        class="shrink-0 text-base text-(--el-color-primary)"
      />
      <span>{{ t("apiApp.tip") }}</span>
    </div>
    <RePlusPage
      ref="tableRef"
      :api="api"
      :auth="auth"
      locale-name="apiApp"
      :selection="false"
      :listColumnsFormat="listColumnsFormat"
      :operationButtonsProps="operationButtonsProps"
      :tableBarButtonsProps="tableBarButtonsProps"
    />

    <el-dialog
      v-model="credentialDialog"
      :title="t('apiApp.credentialTitle')"
      width="620px"
    >
      <el-alert
        class="mb-3"
        :closable="false"
        type="warning"
        :title="t('apiApp.credentialTip')"
      />
      <div v-if="credential" class="space-y-2 text-sm">
        <div class="flex items-center gap-2">
          <span class="w-32 shrink-0">{{ t("apiApp.clientId") }}</span>
          <el-input :model-value="credential.client_id" readonly />
          <el-button
            link
            type="primary"
            @click="copyText(credential.client_id)"
          >
            {{ t("apiApp.copy") }}
          </el-button>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-32 shrink-0">{{ t("apiApp.clientSecret") }}</span>
          <el-input
            :model-value="credential.client_secret"
            readonly
            data-testid="api-app-secret"
          />
          <el-button
            link
            type="primary"
            @click="copyText(credential.client_secret)"
          >
            {{ t("apiApp.copy") }}
          </el-button>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-32 shrink-0">{{ t("apiApp.callbackSecret") }}</span>
          <el-input :model-value="credential.callback_secret" readonly />
          <el-button
            link
            type="primary"
            @click="copyText(credential.callback_secret)"
          >
            {{ t("apiApp.copy") }}
          </el-button>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="credentialDialog = false">
          {{ t("apiApp.confirm") }}
        </el-button>
      </template>
    </el-dialog>

    <ApiUsageDrawer
      v-model="usageVisible"
      :row="usageRow"
      :loading="usageLoading"
      :data="usage"
    />
  </div>
</template>

<style lang="scss" scoped>
.api-app-tip {
  background: var(--el-fill-color-light);
  border: 1px solid var(--pure-border-color);
}
</style>
