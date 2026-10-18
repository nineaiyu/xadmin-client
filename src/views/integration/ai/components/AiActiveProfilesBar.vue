<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { isSuccess } from "@/api/types";
import {
  aiConfigApi,
  aiProfileApi,
  listAiProfileRows,
  type AiProfileItem
} from "@/api/ai/ai";
import { capabilityTagItems } from "../utils/capabilities";
import { purposeLabelKey, purposeTagType } from "../utils/purpose";

/**
 * 当前生效链路头条：档案表格上方的「全局状态卡」。
 *
 * 左侧全局开关总览（助手 / NL 查数 / 动作草稿 三枚状态章），右侧按用途
 * 展示正在生效的档案（对话 / 结构化 / 向量化各一：未配置显兜底语义）。
 * 数据 = Setting 回落配置 + 档案列表激活项，与页内数据同源，无额外端点。
 */
defineOptions({
  name: "AiActiveProfilesBar"
});

const { t } = useI18n();

const loading = ref(false);
const assistantEnabled = ref(true);
const featureFlags = ref({
  nlQuery: true,
  action: true,
  nativeTools: true
});
const profiles = ref<AiProfileItem[]>([]);

const load = async () => {
  loading.value = true;
  try {
    // 全局开关与档案列表并行拉取（两者独立渲染）
    const [settingsRes, profilesRes] = await Promise.all([
      aiConfigApi.retrieve().catch(() => null),
      aiProfileApi.list({ page: 1, size: 100 }).catch(() => null)
    ]);
    if (settingsRes && isSuccess(settingsRes)) {
      const data = settingsRes.data as Record<string, unknown>;
      assistantEnabled.value = Boolean(data?.AI_ASSISTANT_ENABLED ?? true);
      featureFlags.value = {
        nlQuery: Boolean(data?.AI_NL_QUERY_ENABLED ?? true),
        action: Boolean(data?.AI_ACTION_ENABLED ?? true),
        nativeTools: Boolean(data?.AI_NATIVE_TOOLS_ENABLED ?? true)
      };
    }
    if (profilesRes && isSuccess(profilesRes)) {
      profiles.value = listAiProfileRows<AiProfileItem>(profilesRes);
    }
  } finally {
    loading.value = false;
  }
};

onMounted(load);

const featureChips = computed(() => [
  {
    key: "nlQuery",
    label: t("aiConfig.nlQueryEnabled"),
    on: featureFlags.value.nlQuery
  },
  {
    key: "action",
    label: t("aiConfig.actionEnabled"),
    on: featureFlags.value.action
  },
  {
    key: "nativeTools",
    label: t("aiConfig.nativeTools"),
    on: featureFlags.value.nativeTools
  }
]);

/** 按用途取激活档案；向量化用途缺席时提示需单独配置（不做回落） */
const activePurposes = computed(() => {
  const byPurpose = (purpose: string) =>
    profiles.value.find(
      row => row.is_active && (row.purpose ?? "chat") === purpose
    ) ?? null;
  return [
    { purpose: "chat", row: byPurpose("chat") },
    { purpose: "structured", row: byPurpose("structured") },
    { purpose: "embedding", row: byPurpose("embedding") }
  ];
});
</script>

<template>
  <div
    v-loading="loading"
    class="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2"
  >
    <!-- 全局总开关 -->
    <el-tag :type="assistantEnabled ? 'success' : 'info'" effect="light">
      {{ t("aiConfig.assistantEnabled") }}：
      {{
        assistantEnabled ? t("aiConfig.profileOn") : t("aiConfig.profileOff")
      }}
    </el-tag>
    <!-- 功能开关 -->
    <el-tag
      v-for="chip in featureChips"
      :key="chip.key"
      :type="chip.on ? 'success' : 'info'"
      effect="plain"
      size="small"
    >
      {{ chip.label }}：{{
        chip.on ? t("aiConfig.profileOn") : t("aiConfig.profileOff")
      }}
    </el-tag>
    <span class="text-(--el-text-color-secondary) text-sm">
      {{ t("aiConfig.activeProfilesTitle") }}
    </span>
    <!-- 按用途展示生效档案 -->
    <template v-for="item in activePurposes" :key="item.purpose">
      <template v-if="item.row">
        <el-tag :type="purposeTagType(item.purpose)" effect="dark" size="small">
          {{ t(purposeLabelKey(item.purpose)) }}
        </el-tag>
        <span class="text-sm font-medium">{{ item.row.name }}</span>
        <el-tag
          v-for="cap in capabilityTagItems(
            (item.row.capabilities ?? {}) as Record<
              string,
              { ok?: boolean } | undefined
            >,
            t
          )"
          :key="cap.key"
          :type="cap.type"
          size="small"
          effect="plain"
        >
          {{ cap.label }}
        </el-tag>
      </template>
      <el-tag
        v-else-if="item.purpose === 'embedding'"
        type="warning"
        size="small"
        effect="plain"
      >
        {{ t(purposeLabelKey(item.purpose)) }}：{{
          t("aiConfig.purposeEmbeddingHint")
        }}
      </el-tag>
    </template>
  </div>
</template>
