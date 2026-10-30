<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import SendIcon from "~icons/ep/promotion";
import type { AiActionDraft, AiConsoleMessage } from "@/api/ai/ai";
import MessageThreadPanel from "@/components/MessageThreadPanel";
import MessageTimeDivider from "@/components/MessageTimeDivider";
import AiStreamingBubble from "@/components/AiStreamingBubble";
import { useListAppendAnimation } from "@/hooks/useListAppendAnimation";
import AiMessageRow from "./AiMessageRow.vue";

/**
 * 右栏：会话头部 + 消息区（时间分组 / 向上加载 / 新消息悬浮条 / 流式气泡）
 * + 输入区。面板骨架收敛于 MessageThreadPanel（与聊天室 ChatWindow 同一套壳），
 * 本组件只组装助手页的行渲染（NL / 动作内嵌卡片）与输入区。布局与交互对齐
 * 聊天室（Enter 发送、Shift+Enter 换行），但消息流按助手页入口独立持久化，
 * 且支持 NL / 动作内嵌卡片。
 */
type ExecuteResult = { ok: boolean; pending?: boolean; detail?: string };
type MessageGroup =
  | { type: "divider"; key: string; label: string }
  | { type: "message"; key: string; item: AiConsoleMessage };

const props = defineProps<{
  title: string;
  subtitle: string;
  placeholder: string;
  emptyText: string;
  /** AI 未启用/未配置或入口无权限时禁用输入 */
  disabled: boolean;
  loadingHistory: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  groups: MessageGroup[];
  activeStreaming: { content: string; reasoning: string } | null;
  /** 是否有流式生成进行中（当前入口） */
  streaming: boolean;
  pendingCount: number;
  nlRunning: boolean;
  /** NL 结果卡片的运行权限（run:AiAssistant） */
  nlRunnable: boolean;
  actionExecutor: (_draft: AiActionDraft) => Promise<ExecuteResult>;
  isNarrow: boolean;
  /** 初始输入内容（命令面板「问 AI」经路由 query 预填）；seq 变化即覆盖 */
  initialDraft?: { seq: number; text: string } | null;
  /** 发送失败回填的草稿（输入框为空时恢复，避免覆盖用户新输入） */
  failedDraft?: { seq: number; text: string } | null;
}>();

const emit = defineEmits<{
  send: [string];
  stop: [];
  loadMore: [];
  scroll: [];
  scrollToBottom: [];
  scroller: [HTMLElement | null];
  toggleNav: [];
  runNl: [dsl: object];
  retry: [text: string];
}>();

const { t } = useI18n();
const draft = ref(props.initialDraft?.text ?? "");
// 命令面板「问 AI」再次进入（keep-alive 复用本组件）时刷新预填；
// 仅在携带非空文案时覆盖，不清空用户已输入的内容
watch(
  () => props.initialDraft,
  payload => {
    if (payload?.text) draft.value = payload.text;
  }
);
// 发送失败：乐观气泡被移除时把原草稿回填；用户已输入新内容则不覆盖
watch(
  () => props.failedDraft,
  payload => {
    if (payload?.text && !draft.value.trim()) draft.value = payload.text;
  },
  { immediate: true }
);
const scrollEl = ref<HTMLElement | null>(null);

/** 列表壳滚动元素就绪：登记并向上冒泡，供父级滚动到底/离底检测持有 */
function onListReady(element: HTMLElement | null) {
  scrollEl.value = element;
  emit("scroller", element);
}

/** 「最新一条 assistant 消息」才可操作（NL 运行 / 动作确认）：执行后新消息
 * 追加在后，卡片自然变为只读回看，与刷新后的历史渲染口径一致 */
const lastAssistantId = computed(() => {
  for (let i = props.groups.length - 1; i >= 0; i--) {
    const row = props.groups[i];
    if (row.type === "message" && row.item.role === "assistant") {
      return row.item.id;
    }
  }
  return null;
});

function submit() {
  const content = draft.value.trim();
  if (!content) return;
  draft.value = "";
  emit("send", content);
}

/** Enter 发送：输入法组词确认（isComposing / 229）不发送，避免只发出未上屏拼音 */
function onEnterKeydown(event: Event | KeyboardEvent) {
  if (!(event instanceof KeyboardEvent)) return;
  if (event.isComposing || event.keyCode === 229) return;
  event.preventDefault();
  submit();
}

/** 重试中断/失败回答：向上找最近一条用户提问原样重发（历史消息无本地请求上下文） */
function retryMessage(item: AiConsoleMessage) {
  if (props.streaming) return;
  const flat = props.groups
    .filter(row => row.type === "message")
    .map(row => row.item);
  const index = flat.findIndex(message => message.id === item.id);
  for (let i = index - 1; i >= 0; i--) {
    if (flat[i].role === "user") {
      emit("retry", flat[i].content);
      return;
    }
  }
}

/** 新增消息的进入动画标记：仅「尾部追加」播一次（整批替换 / 加载更早不播） */
const { isFresh } = useListAppendAnimation(() =>
  props.groups.map(row => row.key)
);

defineExpose({ scrollEl });
</script>

<template>
  <MessageThreadPanel
    :title="title"
    title-testid="ai-panel-title"
    :subtitle="subtitle"
    :toggle-label="t('ai.features')"
    :is-narrow="isNarrow"
    list-testid="ai-messages"
    skeleton-testid="ai-history-skeleton"
    :skeleton-visible="loadingHistory && !groups.length"
    :history-bar-visible="groups.length > 0"
    :has-more="hasMore"
    :loading-more="loadingMore"
    :empty-visible="!groups.length && !loadingHistory && !activeStreaming"
    :empty-text="emptyText"
    :pending-count="pendingCount"
    @toggle="emit('toggleNav')"
    @scroll="emit('scroll')"
    @load-more="emit('loadMore')"
    @ready="onListReady"
    @jump-to-latest="emit('scrollToBottom')"
  >
    <template #actions>
      <slot name="actions" />
    </template>

    <template v-for="row in groups" :key="row.key">
      <MessageTimeDivider v-if="row.type === 'divider'" :label="row.label" />
      <AiMessageRow
        v-else
        :item="row.item"
        :runnable="row.item.id === lastAssistantId && !streaming"
        :nl-runnable="nlRunnable"
        :nl-running="nlRunning"
        :action-executor="actionExecutor"
        :fresh="isFresh(row.key)"
        :retry-disabled="streaming"
        @run-nl="dsl => emit('runNl', dsl)"
        @retry="retryMessage(row.item)"
      />
    </template>

    <!-- 流式气泡：思考面板 + 增量正文 + 停止生成 -->
    <AiStreamingBubble
      v-if="activeStreaming"
      :reasoning="activeStreaming.reasoning"
      :content="activeStreaming.content"
      testid="ai-streaming"
      stop-testid="ai-stream-stop"
      :stop-label="t('ai.stopGenerating')"
      @stop="emit('stop')"
    />

    <template #composer>
      <!-- data-testid 挂 el-input：Element Plus 会把属性透传到内部 textarea
           （E2E 直接 fill 该 testid；挂外层 div 会被判为不可编辑元素） -->
      <el-input
        v-model="draft"
        type="textarea"
        :autosize="{ minRows: 2, maxRows: 4 }"
        :placeholder="placeholder"
        :disabled="disabled"
        data-testid="ai-ask-input"
        @keydown.enter.exact="onEnterKeydown"
      />
      <div class="mt-2 flex-bc">
        <div class="text-xs text-(--el-text-color-secondary)">
          {{ t("chat.enterHint") }}
        </div>
        <el-button
          v-if="streaming"
          type="danger"
          plain
          data-testid="ai-stop"
          @click="emit('stop')"
        >
          {{ t("ai.stopGenerating") }}
        </el-button>
        <el-button
          v-else
          type="primary"
          :icon="useRenderIcon(SendIcon)"
          :disabled="disabled || !draft.trim()"
          data-testid="ai-send"
          @click="submit"
        >
          {{ t("chat.send") }}
        </el-button>
      </div>
    </template>
  </MessageThreadPanel>
</template>
