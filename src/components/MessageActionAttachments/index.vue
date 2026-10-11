<script lang="ts" setup>
import { computed } from "vue";
import { pickActionDrafts } from "@/utils/messageView";
import AiActionCard from "@/components/AiActionCard";
import AiResultTable from "@/components/AiResultTable";

import type { MessageActionAttachmentsProps } from "./types";

/**
 * 消息内嵌动作渲染（聊天室 / 助手页共用）：受限动作草稿确认卡（多步串联逐项
 * 渲染）+ 只读动作执行结果表。可执行性与执行器由父级注入（聊天室走助手页
 * 执行端点的权限约束，助手页走控制台执行器）。
 */
defineOptions({
  name: "MessageActionAttachments"
});

const props = defineProps<MessageActionAttachmentsProps>();

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
