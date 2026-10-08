<script lang="ts" setup>
import { SUCCESS_CODE } from "@/api/types";
import { onMounted, ref } from "vue";
import { deviceDetection } from "@pureadmin/utils";
import { configApi } from "@/api/config";
import { handleOperation } from "@/components/RePlusPage";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import type { RecordType } from "plus-pro-components";

defineOptions({
  name: "Preferences"
});
const loading = ref(true);
// 初态未知（配置读取失败）时禁用开关：防止把默认值反向写回服务端
const loadFailed = ref(false);
const { t } = useI18n();

const list = ref([
  {
    name: "PUSH_MESSAGE_NOTICE",
    title: t("account.messagePush"),
    illustrate: t("account.messagePushTips"),
    checked: false
  },
  {
    name: "PUSH_CHAT_MESSAGE",
    title: t("account.chatPush"),
    illustrate: t("account.chatPushTips"),
    checked: false
  }
]);

function onChange(val: unknown, item: RecordType) {
  loading.value = true;

  handleOperation({
    t,
    apiReq: configApi.setConfig(item.name, val as object, "patch"),
    requestEnd() {
      loading.value = false;
    }
  });
}

onMounted(async () => {
  loading.value = true;
  try {
    const results = await Promise.all(
      list.value.map(config => configApi.getConfig(config.name))
    );
    // 全部读取成功才回填初态：部分失败时开关状态未知，保持禁用防反向写入
    if (results.every(res => res.code === SUCCESS_CODE)) {
      results.forEach((res, index) => {
        list.value[index].checked = res.config.value as boolean;
      });
    } else {
      loadFailed.value = true;
      message(t("account.preferenceLoadFailed"), { type: "warning" });
    }
  } catch {
    // 网络层异常（http 层已提示错误详情）：这里只拦住反向写入并给出可读结论
    loadFailed.value = true;
    message(t("account.preferenceLoadFailed"), { type: "warning" });
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div :class="['min-w-45', deviceDetection() ? 'max-w-full' : 'max-w-[70%]']">
    <h3 class="my-8!">{{ t("account.preference") }}</h3>
    <el-text class="mb-4 block" type="info" size="small">
      {{ t("account.prefCrossHint") }}
    </el-text>
    <div v-for="(item, index) in list" :key="index">
      <div class="flex items-center">
        <div class="flex-1">
          <p>{{ item.title }}</p>
          <p class="wp-4">
            <el-text class="mx-1" type="info">
              {{ item.illustrate }}
            </el-text>
          </p>
        </div>
        <el-switch
          v-model="item.checked"
          :loading="loading"
          :disabled="loadFailed"
          :active-text="t('labels.enable')"
          :inactive-text="t('labels.disable')"
          inline-prompt
          @change="val => onChange(val, item)"
        />
      </div>
      <el-divider />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.el-divider--horizontal {
  border-top: 0.1px var(--el-border-color) var(--el-border-style);
}
</style>
