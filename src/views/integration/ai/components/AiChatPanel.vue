<script lang="ts" setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import ReEmpty from "@/components/ReEmpty";
import AiIcon from "~icons/ep/cpu";
import MenuIcon from "~icons/ep/menu";
import SendIcon from "~icons/ep/promotion";
import type { AiActionDraft, AiConsoleMessage } from "@/api/system/ai";
import AiMessageBlock from "@/components/AiMessageBlock/index.vue";
import AiMessageRow from "./AiMessageRow.vue";

/**
 * 右栏：会话头部 + 消息区（时间分组 / 向上加载 / 新消息悬浮条 / 流式气泡）
 * + 输入区。布局与交互对齐聊天室 ChatWindow（Enter 发送、Shift+Enter 换行），
 * 但消息流按助手页入口独立持久化，且支持 NL / 动作内嵌卡片。
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
}>();

const { t } = useI18n();
const draft = ref("");
const scrollEl = ref<HTMLElement | null>(null);

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

defineExpose({ scrollEl });
</script>

<template>
  <div class="relative flex h-full min-w-0 grow flex-col">
    <div
      class="flex items-center gap-2 border-0 border-b border-solid border-(--pure-border-color) px-3 py-2"
    >
      <el-button
        v-if="isNarrow"
        link
        :icon="useRenderIcon(MenuIcon)"
        :aria-label="t('ai.features')"
        @click="emit('toggleNav')"
      />
      <div class="min-w-0 grow">
        <span class="truncate font-medium" data-testid="ai-panel-title">
          {{ title }}
        </span>
        <div class="truncate text-xs text-(--el-text-color-secondary)">
          {{ subtitle }}
        </div>
      </div>
      <slot name="actions" />
    </div>

    <div
      ref="scrollEl"
      v-loading="loadingHistory"
      class="grow overflow-y-auto px-2 py-3"
      data-testid="ai-messages"
      @scroll.passive="emit('scroll')"
    >
      <div
        v-if="groups.length"
        class="mb-2 text-center text-xs text-(--el-text-color-secondary)"
      >
        <el-button
          v-if="hasMore"
          link
          size="small"
          :loading="loadingMore"
          @click="emit('loadMore')"
        >
          {{ t("chat.loadMore") }}
        </el-button>
        <span v-else>{{ t("chat.noMoreHistory") }}</span>
      </div>

      <template v-for="row in groups" :key="row.key">
        <div v-if="row.type === 'divider'" class="my-3 text-center">
          <span
            class="rounded bg-(--el-fill-color-light) px-2 py-0.5 text-xs text-(--el-text-color-secondary)"
          >
            {{ row.label }}
          </span>
        </div>
        <AiMessageRow
          v-else
          :item="row.item"
          :runnable="row.item.id === lastAssistantId && !streaming"
          :nl-runnable="nlRunnable"
          :nl-running="nlRunning"
          :action-executor="actionExecutor"
          @run-nl="dsl => emit('runNl', dsl)"
        />
      </template>

      <!-- 流式气泡：思考面板 + 增量正文 + 停止生成 -->
      <div
        v-if="activeStreaming"
        class="flex gap-2 px-2 py-1.5"
        data-testid="ai-streaming"
      >
        <el-avatar :size="36" class="shrink-0 bg-(--el-color-primary)">
          <el-icon><component :is="useRenderIcon(AiIcon)" /></el-icon>
        </el-avatar>
        <div class="flex min-w-0 max-w-[72%] flex-col">
          <AiMessageBlock
            :reasoning="activeStreaming.reasoning"
            :content="activeStreaming.content"
            streaming
          />
          <div class="mt-1">
            <el-button
              link
              type="info"
              size="small"
              data-testid="ai-stream-stop"
              @click="emit('stop')"
            >
              {{ t("ai.stopGenerating") }}
            </el-button>
          </div>
        </div>
      </div>

      <ReEmpty
        v-if="!groups.length && !loadingHistory && !activeStreaming"
        :description="emptyText"
      />
    </div>

    <div
      v-if="pendingCount > 0"
      class="absolute bottom-40 left-1/2 -translate-x-1/2 cursor-pointer"
      @click="emit('scrollToBottom')"
    >
      <el-tag type="primary" effect="dark" round>
        {{ t("chat.newMessages", { count: pendingCount }) }}
      </el-tag>
    </div>

    <div
      class="border-0 border-t border-solid border-(--pure-border-color) p-3"
    >
      <!-- data-testid 挂 el-input：Element Plus 会把属性透传到内部 textarea
           （E2E 直接 fill 该 testid；挂外层 div 会被判为不可编辑元素） -->
      <el-input
        v-model="draft"
        type="textarea"
        :autosize="{ minRows: 2, maxRows: 4 }"
        :placeholder="placeholder"
        :disabled="disabled"
        data-testid="ai-ask-input"
        @keydown.enter.exact.prevent="submit"
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
    </div>
  </div>
</template>
