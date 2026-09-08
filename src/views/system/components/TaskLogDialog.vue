<script lang="ts" setup>
import { nextTick, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { WS } from "@/utils/websocket";

defineOptions({ name: "TaskLogDialog" });

const props = defineProps<{ pk: string | number }>();
const emit = defineEmits<{ close: [] }>();

const { t } = useI18n();

const content = ref("");
const running = ref(true);
const ws = ref<WS | null>(null);
const contentRef = ref<HTMLElement>();

const scrollToBottom = async () => {
  await nextTick();
  contentRef.value?.scrollTo({ top: contentRef.value.scrollHeight });
};

const stopWs = () => {
  ws.value?.close();
  ws.value = null;
};

onMounted(() => {
  // 服务端固定从 0 增量推送、推完主动断开，禁止自动重连以免内容重复；
  // VITE_WSS_DOMAIN 为空串，WebSocket 构造器不接受相对路径，按页面协议拼绝对地址
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  ws.value = new WS(`${protocol}//${location.host}/ws/tasks/log/${props.pk}`, {
    autoReconnect: false,
    closeCallback: () => {
      running.value = false;
    }
  });
  ws.value.onMessage((res: unknown) => {
    const data = (
      res as {
        action?: string;
        data?: { content?: string; finished?: boolean };
      }
    )?.data;
    if (typeof data !== "object" || data === null) return;
    if (data.content) {
      content.value += data.content;
      void scrollToBottom();
    }
    if (data.finished) {
      stopWs();
      running.value = false;
    }
  });
});

onUnmounted(stopWs);
</script>
<template>
  <div>
    <div v-loading="running && !content" class="task-log">
      <pre ref="contentRef" class="task-log__pre">{{
        content || t("systemTask.noLogOutput")
      }}</pre>
    </div>
    <div class="task-log__footer">
      <el-button type="primary" plain @click="emit('close')">
        {{ t("buttons.close") }}
      </el-button>
    </div>
  </div>
</template>
<style scoped lang="scss">
.task-log {
  height: 60vh;
  overflow: auto;
  background: var(--el-fill-color-darker);

  &__pre {
    padding: 12px;
    margin: 0;
    font-size: 12px;
    line-height: 1.6;
    word-break: break-all;
    white-space: pre-wrap;
  }

  &__footer {
    margin-top: 12px;
    text-align: right;
  }
}
</style>
