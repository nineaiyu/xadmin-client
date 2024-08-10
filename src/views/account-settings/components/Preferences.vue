<script lang="ts" setup>
import { onMounted, ref } from "vue";
import { message } from "@/utils/message";
import { deviceDetection } from "@pureadmin/utils";
import { configApi } from "@/api/config";

defineOptions({
  name: "Preferences"
});
const loading = ref(true);
const list = ref([
  {
    name: "PUSH_MESSAGE_NOTICE",
    title: "消息公告推送",
    illustrate: "消息公告将在右上角实时推送通知",
    checked: false
  },
  {
    name: "PUSH_CHAT_MESSAGE",
    title: "聊天室@ 推送",
    illustrate: "聊天@ 消息将在右上角实时推送通知",
    checked: false
  }
]);

function onChange(val, item) {
  loading.value = true;
  configApi.setConfig(item.name, val).finally(() => {
    loading.value = false;
  });
  message(`${item.title}设置成功`, { type: "success" });
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
    <h3 class="my-8">偏好设置</h3>
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
          active-text="是"
          inactive-text="否"
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
