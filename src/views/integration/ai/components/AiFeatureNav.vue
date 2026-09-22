<script lang="ts" setup>
import type { Component } from "vue";
import { useI18n } from "vue-i18n";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import type { AiConsoleFeature } from "@/api/system/ai";

/**
 * 左栏：功能导航（文档问答 / 数据查询 / 指令执行）。
 *
 * 与聊天室 ChatSidebar 同一套视觉口径（列表项 + 头像 + 激活高亮）；
 * 入口的可见性由页面按权限点组装（entries），点击切换右侧消息流。
 */
export type AiFeatureEntry = {
  key: AiConsoleFeature;
  title: string;
  description: string;
  icon: Component;
};

defineProps<{
  entries: AiFeatureEntry[];
  active: AiConsoleFeature;
  /** 右栏头部副标题用的入口计数（如可用动作数），可选展示 */
  footer?: string;
}>();

const emit = defineEmits<{
  select: [AiConsoleFeature];
}>();

const { t } = useI18n();
</script>

<template>
  <div
    class="flex h-full flex-col border-0 border-r border-solid border-(--pure-border-color)"
  >
    <div class="flex items-center gap-2 p-3">
      <span class="font-semibold">{{ t("ai.title") }}</span>
    </div>

    <el-scrollbar class="grow">
      <div class="pb-4">
        <div class="px-3 py-1">
          <span class="text-xs text-(--el-text-color-secondary)">
            {{ t("ai.features") }}
          </span>
        </div>
        <div
          v-for="entry in entries"
          :key="entry.key"
          class="mx-2 mb-1 cursor-pointer rounded p-2 transition-colors hover:bg-(--el-fill-color-light)"
          :class="{ 'bg-(--el-fill-color-light)': entry.key === active }"
          :data-testid="`ai-feature-${entry.key}`"
          @click="emit('select', entry.key)"
        >
          <div class="flex items-center gap-2">
            <el-avatar
              :size="34"
              class="shrink-0"
              :class="
                entry.key === active
                  ? 'bg-(--el-color-primary)'
                  : 'bg-(--el-color-info-light-3)'
              "
            >
              <el-icon>
                <component :is="useRenderIcon(entry.icon)" />
              </el-icon>
            </el-avatar>
            <div class="min-w-0 grow">
              <div class="truncate text-sm">{{ entry.title }}</div>
              <div class="truncate text-xs text-(--el-text-color-secondary)">
                {{ entry.description }}
              </div>
            </div>
          </div>
        </div>
        <el-empty
          v-if="!entries.length"
          :description="t('ai.noFeature')"
          :image-size="60"
        />
      </div>
    </el-scrollbar>

    <div
      v-if="footer"
      class="border-0 border-t border-solid border-(--pure-border-color) px-3 py-2 text-xs text-(--el-text-color-secondary)"
    >
      {{ footer }}
    </div>
  </div>
</template>
