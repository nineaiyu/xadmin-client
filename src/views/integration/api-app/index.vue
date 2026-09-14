<script lang="ts" setup>
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { useApiApplication } from "./utils/hook";

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
  copyText
} = useApiApplication(tableRef);
</script>

<template>
  <div>
    <!-- 一次性密钥为只读展示弹窗（C5 既定保留手写场景），
         明文只在创建/重置响应中出现一次，列表与详情不回传 -->
    <el-alert
      class="w-99/100 mb-3"
      :closable="false"
      type="info"
      :title="t('apiApp.tip')"
    />
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
  </div>
</template>
