<script lang="ts" setup>
import { computed } from "vue";
import type { AiActionDraft } from "@/api/ai/ai";
import { pickActionDrafts, type ActionDraftCarrier } from "@/utils/messageView";
import AiActionCard from "@/components/AiActionCard/index.vue";
import AiResultTable from "@/components/AiResultTable/index.vue";

/**
 * 消息内嵌动作渲染（聊天室 / 助手页共用）：受限动作草稿确认卡（多步串联逐项
 * 渲染）+ 只读动作执行结果表。可执行性与执行器由父级注入（聊天室走助手页
 * 执行端点的权限约束，助手页走控制台执行器）。
 */
defineOptions({
  name: "MessageActionAttachments"
});

type ExecuteResult = { ok: boolean; pending?: boolean; detail?: string };

const props = defineProps<{
  /** 消息 extra（动作草稿与执行结果的公共载体） */
  extra?: ActionDraftCarrier | null;
  /** 草稿卡可执行（false 时只读展示，可附 disabledHint） */
  runnable: boolean;
  executor: (_draft: AiActionDraft) => Promise<ExecuteResult>;
  /** 卡片 testid 前缀（助手页缺省 ai；聊天室传 chat，E2E 选择器不变） */
  testidPrefix?: string;
  /** 不可执行时的提示文案；空则不提示 */
  disabledHint?: string;
}>();

const drafts = computed(() => pickActionDrafts(props.extra));
const actionResult = computed(() => props.extra?.action_result ?? null);
</script>

<template>
  <AiActionCard
    v-for="(draft, index) in drafts"
    :key="`${draft.action}-${index}`"
    :draft="draft"
    :runnable="runnable"
    :executor="executor"
    :testid-prefix="testidPrefix"
    :disabled-hint="disabledHint"
  />
  <!-- 只读动作结果表（查询类动作执行后展示数据，两条消息线同口径） -->
  <AiResultTable
    v-if="actionResult && Object.keys(actionResult).length"
    :data="actionResult"
  />
</template>
