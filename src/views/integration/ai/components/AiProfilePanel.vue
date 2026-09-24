<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  ReActionPanel,
  type PanelActionGroup
} from "@/components/ReActionPanel";
import type { AiProfileItem } from "@/api/system/ai";

/**
 * AI 档案「管理」抽屉内容：档案资料 + 能力画像 + 探测/配置/删除动作。
 *
 * - 资料全部取自列表行快照（零额外请求）；采样参数未配置按「默认」语义展示；
 * - 能力画像与列表列同口径（未探测灰、支持绿、不支持红），探测后关闭抽屉重开即最新；
 * - 动作按钮由页面构建（权限已在构建期收敛），本组件只负责渲染。
 */
defineOptions({ name: "IntegrationAiProfilePanel" });

const props = defineProps<{
  row: AiProfileItem;
  groups: PanelActionGroup[];
}>();

const { t } = useI18n();

/** 采样参数未配置为 null：与表单「未设置」语义一致 */
const numText = (value: number | null | undefined): string =>
  value === null || value === undefined ? t("aiConfig.unset") : String(value);

type StatusTagType = "primary" | "success" | "warning" | "danger" | "info";

/** 能力画像：JSON / 原生工具调用 / 思考内容（+ 探测过的多模态） */
const capabilityTags = computed(() => {
  const capabilities = (props.row.capabilities ?? {}) as Record<
    string,
    { ok?: boolean } | undefined
  >;
  const items: Array<{ key: string; label: string }> = [
    { key: "json", label: t("aiConfig.capJson") },
    { key: "tool_calls", label: t("aiConfig.capToolCalls") },
    { key: "reasoning", label: t("aiConfig.capReasoning") }
  ];
  if (capabilities["vision"]) {
    items.push({ key: "vision", label: t("aiConfig.capVision") });
  }
  return items.map(item => {
    const entry = capabilities[item.key];
    const type: StatusTagType = entry
      ? entry.ok
        ? "success"
        : "danger"
      : "info";
    return { ...item, type };
  });
});

const purposeText = computed(() =>
  props.row.purpose === "structured"
    ? t("aiConfig.purposeStructured")
    : t("aiConfig.purposeChat")
);

const metaItems = computed(() => [
  {
    key: "baseUrl",
    label: t("aiConfig.baseUrl"),
    value: props.row.base_url || "—"
  },
  { key: "model", label: t("aiConfig.model"), value: props.row.model || "—" },
  {
    key: "apiKey",
    label: t("aiConfig.apiKey"),
    value: props.row.api_key_set
      ? t("aiConfig.apiKeySet")
      : t("aiConfig.apiKeyUnset")
  },
  {
    key: "temperature",
    label: t("aiConfig.temperature"),
    value: numText(props.row.temperature)
  },
  {
    key: "maxTokens",
    label: t("aiConfig.maxTokens"),
    value: numText(props.row.max_tokens)
  },
  { key: "topP", label: t("aiConfig.topP"), value: numText(props.row.top_p) },
  {
    key: "contextLimit",
    label: t("aiConfig.contextLimit"),
    value: String(props.row.context_limit ?? 0)
  },
  {
    key: "timeout",
    label: t("aiConfig.timeout"),
    value: String(props.row.timeout ?? 0)
  },
  {
    key: "maxRetries",
    label: t("aiConfig.maxRetries"),
    value: String(props.row.max_retries ?? 0)
  },
  { key: "seed", label: t("aiConfig.seed"), value: numText(props.row.seed) },
  {
    key: "probedAt",
    label: t("aiConfig.probeAt"),
    value: props.row.probed_at || "—"
  },
  {
    key: "remark",
    label: t("aiConfig.remark"),
    value: props.row.remark || "—"
  }
]);
</script>

<template>
  <ReActionPanel :groups="groups" :meta-items="metaItems">
    <template #profile>
      <div class="flex items-center gap-3">
        <span class="profile-badge">{{ (row.name || "?").slice(0, 1) }}</span>
        <div class="min-w-0 flex-1">
          <div class="profile-name">{{ row.name }}</div>
          <div class="profile-sub">{{ row.model || "—" }}</div>
        </div>
        <el-tag
          :type="row.is_active ? 'success' : 'info'"
          size="small"
          effect="plain"
        >
          {{
            row.is_active ? t("aiConfig.profileOn") : t("aiConfig.profileOff")
          }}
        </el-tag>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-1.5">
        <span class="tag-caption">{{ t("aiConfig.purpose") }}</span>
        <el-tag
          :type="row.purpose === 'structured' ? 'warning' : 'primary'"
          size="small"
          effect="plain"
        >
          {{ purposeText }}
        </el-tag>
      </div>

      <div class="mt-2 flex flex-wrap items-center gap-1.5">
        <span class="tag-caption">{{ t("aiConfig.capabilityTitle") }}</span>
        <el-tag
          v-for="item in capabilityTags"
          :key="item.key"
          :type="item.type"
          size="small"
        >
          {{ item.label }}
        </el-tag>
      </div>
    </template>
  </ReActionPanel>
</template>

<style scoped lang="scss">
.profile-badge {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-color-primary);
  user-select: none;
  background: var(--el-color-primary-light-7);
  border-radius: 10px;
}

.profile-name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 16px;
  font-weight: 600;
  line-height: 22px;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.profile-sub {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  line-height: 18px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.tag-caption {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
