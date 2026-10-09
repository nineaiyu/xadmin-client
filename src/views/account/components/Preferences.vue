<script lang="ts" setup>
import { SUCCESS_CODE } from "@/api/types";
import { onMounted, ref } from "vue";
import { configApi } from "@/api/config";
import { handleOperation } from "@/components/RePlusPage";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import AccountPanel from "./AccountPanel.vue";
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
  <AccountPanel
    :title="t('account.preference')"
    :description="t('account.prefCrossHint')"
  >
    <div v-for="item in list" :key="item.name" class="account-row">
      <div class="account-row__main">
        <p class="account-row__title">{{ item.title }}</p>
        <el-text class="account-row__desc" type="info" size="small">
          {{ item.illustrate }}
        </el-text>
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
  </AccountPanel>
</template>
