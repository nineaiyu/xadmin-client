<script lang="ts" setup>
import { hasAuth } from "@/router/utils";
import type { PageColumn } from "@/components/RePlusPage";
import SettingItem from "@/views/settings/components/settings-shell/SettingItem.vue";
import type { settingItemProps } from "@/views/settings/components/settings-shell/types";
import { aiConfigApi } from "@/api/ai/ai";

/**
 * AI 全局开关（Setting 回落通路）：档案未激活时仍生效。
 *
 * 表单改走框架 SettingItem（与「系统设置 → 基本设置」同形态）：列元数据来自
 * 后端 search-columns（PlusForm + label 置右 + 字段 help_text 问号），保存 /
 * 重置按钮与权限位由框架统一装配——此前手写 el-form 时这些都要各写一遍。
 * fields 白名单只保留本面板的开关 / 配额字段（AI_BASE_URL、API Key 等回落
 * 凭据字段由档案体系承载，不在本面板出现）。
 */
defineOptions({ name: "AiGlobalSettingsCard" });

const canEdit = hasAuth("partialUpdate:AiAssistantConfig");
const canRead = hasAuth("list:AiAssistantConfig");
// create 端点是「按当前表单值真实 ping 一次 LLM」：无激活档案时最需要验证回落凭据
const canTest = hasAuth("create:AiAssistantConfig");

/** 本面板字段白名单（后端 AiAssistantSettingSerializer 字段名） */
const panelFields = [
  "AI_ASSISTANT_ENABLED",
  "AI_NL_QUERY_ENABLED",
  "AI_ACTION_ENABLED",
  "AI_DAILY_REPORT_ENABLED",
  "AI_CODEGEN_DRAFT_ENABLED",
  "AI_NATIVE_TOOLS_ENABLED",
  "AI_STRUCTURED_MAX_TOKENS",
  "AI_QUOTA_USER_DAILY_CALLS",
  "AI_QUOTA_USER_DAILY_TOKENS",
  "AI_QUOTA_MAX_CONCURRENT_STREAMS"
];

/** E2E 锚点（框架列经 fieldProps 透传，EP 控件根元素携带） */
const FIELD_TEST_IDS: Record<string, string> = {
  AI_ASSISTANT_ENABLED: "ai-assistant-enabled",
  AI_NL_QUERY_ENABLED: "ai-nl-query-enabled",
  AI_ACTION_ENABLED: "ai-action-enabled",
  AI_DAILY_REPORT_ENABLED: "ai-daily-report-enabled",
  AI_CODEGEN_DRAFT_ENABLED: "ai-codegen-draft-enabled",
  AI_NATIVE_TOOLS_ENABLED: "ai-native-tools-enabled",
  AI_STRUCTURED_MAX_TOKENS: "ai-structured-max-tokens",
  AI_QUOTA_USER_DAILY_CALLS: "ai-quota-calls",
  AI_QUOTA_USER_DAILY_TOKENS: "ai-quota-tokens",
  AI_QUOTA_MAX_CONCURRENT_STREAMS: "ai-quota-streams"
};

const decorateColumn = (column: PageColumn) => {
  const testId = FIELD_TEST_IDS[column.prop as string];
  if (testId) {
    (column.fieldProps as Record<string, unknown>)["data-testid"] = testId;
  }
};

const item: settingItemProps = {
  canRead,
  auth: {
    partialUpdate: canEdit,
    retrieve: canRead,
    test: canTest
  },
  api: aiConfigApi,
  localeName: "aiConfig",
  fields: panelFields,
  columnDecorator: decorateColumn
};
</script>

<template>
  <SettingItem v-if="canRead" v-bind="item" />
</template>
