<script lang="ts" setup>
import { onMounted, ref } from "vue";
import { deviceDetection } from "@pureadmin/utils";
import { configApi } from "@/api/config";
import { handleOperation } from "@/components/RePlusPage";
import { useI18n } from "vue-i18n";

defineOptions({
  name: "Preferences"
});
const loading = ref(true);
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

function onChange(val, item) {
  loading.value = true;

  handleOperation({
    t,
    apiReq: configApi.setConfig(item.name, val, "put"),
    requestEnd() {
      loading.value = false;
    }
  });
}

onMounted(() => {
  loading.value = true;
  list.value.forEach(config => {
    configApi.getConfig(config.name).then(res => {
      if (res.code === 1000) {
        config.checked = res.config.value;
      }
    });
  });
  loading.value = false;
});
</script>

<template>
  <div
    :class="[
      'min-w-[180px]',
      deviceDetection() ? 'max-w-[100%]' : 'max-w-[70%]'
    ]"
  >
    <h3 class="my-8">{{ t("account.preference") }}</h3>
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
