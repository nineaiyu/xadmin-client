<script lang="ts">
/** 供父组件 ref 调用的实例契约 */
export type TaskLogDialogInstance = {
  open: (_row: { pk: string | number; name: string }) => Promise<void>;
};
</script>
<script lang="ts" setup>
import { nextTick, onUnmounted, reactive, ref } from "vue";
import { WS } from "@/utils/websocket";

defineOptions({ name: "TaskLogDialog" });

const visible = ref(false);
const content = ref("");
const running = ref(false);
const state = reactive({ taskName: "", ws: null as WS | null });
const contentRef = ref<HTMLElement>();

const scrollToBottom = async () => {
  await nextTick();
  contentRef.value?.scrollTo({ top: contentRef.value.scrollHeight });
};

const stopWs = () => {
  state.ws?.close();
  state.ws = null;
};

const open = async (row: { pk: string | number; name: string }) => {
  content.value = "";
  state.taskName = row.name;
  visible.value = true;
  running.value = true;
  stopWs();
  // 服务端固定从 0 增量推送、推完主动断开，禁止自动重连以免内容重复；
  // VITE_WSS_DOMAIN 为空串，WebSocket 构造器不接受相对路径，按页面协议拼绝对地址
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  state.ws = new WS(`${protocol}//${location.host}/ws/tasks/log/${row.pk}`, {
    autoReconnect: false,
    closeCallback: () => {
      running.value = false;
    }
  });
  state.ws.onMessage((res: unknown) => {
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
};

onUnmounted(stopWs);

defineExpose({ open });
</script>
<template>
  <el-dialog
    v-model="visible"
    :title="`${state.taskName} 日志`"
    width="860px"
    destroy-on-close
    @closed="stopWs"
  >
    <div v-loading="running && !content" class="task-log">
      <pre ref="contentRef" class="task-log__pre">{{
        content || "暂无日志输出"
      }}</pre>
    </div>
    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
    </template>
  </el-dialog>
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
}
</style>
