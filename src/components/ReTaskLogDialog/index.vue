<script lang="ts" setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { isSuccess } from "@/api/types";
import { taskExecutionApi, type TaskLogChunk } from "@/api/task/task";
import { createTaskLogFeed, type TaskLogStatus } from "./taskLogFeed";

defineOptions({ name: "TaskLogDialog" });

const props = defineProps<{ pk: string | number }>();
const emit = defineEmits<{ close: [] }>();

const { t } = useI18n();

const content = ref("");
const status = ref<TaskLogStatus>("connecting");
const failureDetail = ref("");
const contentRef = ref<HTMLElement>();

const scrollToBottom = async () => {
  await nextTick();
  // 可选调用：部分内嵌浏览器/测试环境没有 Element.scrollTo
  contentRef.value?.scrollTo?.({ top: contentRef.value.scrollHeight });
};

const loadChunk = async (offset: number): Promise<TaskLogChunk> => {
  const res = await taskExecutionApi.log(props.pk, offset);
  if (!isSuccess(res) || !res.data) {
    // 业务失败（无权/记录不存在等）：抛出可读 detail，由数据源置失败态
    throw { detail: res?.detail ?? "" };
  }
  return res.data;
};

/**
 * 日志数据源：WS 优先，断开/假活/代理不支持升级时降级 HTTP 轮询；
 * 4401/4403 与「暂无输出」必须区分（此前一律显示为空，无从判断失败原因）。
 */
const feed = createTaskLogFeed({
  url: `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws/tasks/log/${props.pk}`,
  fetchChunk: loadChunk,
  onChunk: chunk => {
    if (!chunk.content) return;
    content.value += chunk.content;
    void scrollToBottom();
  },
  onStatus: (next, detail) => {
    status.value = next;
    failureDetail.value = detail ?? "";
  }
});

const blocked = computed(
  () =>
    status.value === "unauthorized" ||
    status.value === "forbidden" ||
    status.value === "failed"
);
const loading = computed(
  () => !blocked.value && status.value !== "finished" && !content.value
);

onMounted(() => feed.start());
onUnmounted(() => feed.stop());

const retry = () => feed.retry();
</script>
<template>
  <div>
    <el-alert
      v-if="status === 'unauthorized'"
      data-testid="task-log-unauthorized"
      type="warning"
      :closable="false"
      show-icon
      :title="t('systemTask.logAuthExpired')"
    />
    <el-alert
      v-else-if="status === 'forbidden'"
      data-testid="task-log-forbidden"
      type="error"
      :closable="false"
      show-icon
      :title="t('systemTask.logForbidden')"
    />
    <div v-else-if="status === 'failed'" class="mb-2">
      <el-alert
        data-testid="task-log-failed"
        type="error"
        :closable="false"
        show-icon
        :title="t('systemTask.logLoadFailed')"
        :description="failureDetail"
      />
      <el-button
        class="mt-2"
        size="small"
        data-testid="task-log-retry"
        @click="retry"
      >
        {{ t("systemTask.logRetry") }}
      </el-button>
    </div>
    <div v-if="!blocked || content" v-loading="loading" class="task-log">
      <div v-if="status === 'polling'" class="task-log__mode">
        <el-tag size="small" type="warning" data-testid="task-log-polling">
          {{ t("systemTask.logPolling") }}
        </el-tag>
      </div>
      <pre ref="contentRef" class="task-log__pre">{{
        content || (status === "finished" ? t("systemTask.noLogOutput") : "")
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

  &__mode {
    padding: 6px 12px 0;
  }

  &__pre {
    padding: 12px;
    margin: 0;
    font-size: var(--el-font-size-extra-small);
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
