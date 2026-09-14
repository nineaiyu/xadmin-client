<script lang="ts" setup>
import { SUCCESS_CODE } from "@/api/types";
import { onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { aiConfigApi } from "@/api/system/ai";
import { useAiProfiles } from "./utils/useAiProfiles";

defineOptions({
  name: "AiAssistantConfig"
});

const { t } = useI18n();
// 全局开关走 Setting 通路权限（档案未激活时仍生效）
const canEditGlobal = hasAuth("partialUpdate:AiAssistantConfig");
const canReadGlobal = hasAuth("list:AiAssistantConfig");

const globalLoading = ref(false);
const globalForm = reactive({
  AI_ASSISTANT_ENABLED: false,
  AI_NL_QUERY_ENABLED: false
});

const loadGlobal = async () => {
  if (!canReadGlobal) return;
  globalLoading.value = true;
  try {
    const res = await aiConfigApi.retrieve();
    if (res.code === SUCCESS_CODE) {
      const data = res.data as Record<string, unknown>;
      globalForm.AI_ASSISTANT_ENABLED = Boolean(data?.AI_ASSISTANT_ENABLED);
      globalForm.AI_NL_QUERY_ENABLED = Boolean(data?.AI_NL_QUERY_ENABLED);
    }
  } finally {
    globalLoading.value = false;
  }
};

const saveGlobal = async () => {
  const res = await aiConfigApi.partialUpdate({}, { ...globalForm });
  if (res.code === SUCCESS_CODE) {
    message(t("aiConfig.globalSaved"), { type: "success" });
  } else if (res.detail) {
    message(String(res.detail), { type: "warning" });
  }
};

/* ---------------- 配置档案（RePlusPage） ---------------- */
const tableRef = ref();
const {
  api,
  auth,
  listColumnsFormat,
  operationButtonsProps,
  tableBarButtonsProps
} = useAiProfiles(tableRef);

onMounted(loadGlobal);
</script>

<template>
  <div>
    <!-- 全局开关：Setting 回落通路（档案未激活时仍生效） -->
    <el-card
      v-if="canReadGlobal"
      v-loading="globalLoading"
      shadow="never"
      class="w-99/100 mb-3"
    >
      <div class="flex flex-wrap items-center gap-6">
        <span class="font-semibold">{{ t("aiConfig.globalTitle") }}</span>
        <el-switch
          v-model="globalForm.AI_ASSISTANT_ENABLED"
          :disabled="!canEditGlobal"
          :active-text="t('aiConfig.assistantEnabled')"
          data-testid="ai-assistant-enabled"
        />
        <el-switch
          v-model="globalForm.AI_NL_QUERY_ENABLED"
          :disabled="!canEditGlobal"
          :active-text="t('aiConfig.nlQueryEnabled')"
          data-testid="ai-nl-query-enabled"
        />
        <el-button v-if="canEditGlobal" type="primary" @click="saveGlobal">
          {{ t("aiConfig.globalSave") }}
        </el-button>
      </div>
    </el-card>

    <RePlusPage
      ref="tableRef"
      :api="api"
      :auth="auth"
      locale-name="aiConfig"
      :selection="false"
      :listColumnsFormat="listColumnsFormat"
      :operationButtonsProps="operationButtonsProps"
      :tableBarButtonsProps="tableBarButtonsProps"
    />
  </div>
</template>
