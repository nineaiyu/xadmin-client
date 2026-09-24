<script lang="ts" setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import Plus from "~icons/ep/plus";
import Search from "~icons/ep/search";
import Star from "~icons/ep/star";
import StarFilled from "~icons/ep/star-filled";
import Refresh from "~icons/ep/refresh";
import EditPen from "~icons/ep/edit-pen";
import CopyDocument from "~icons/ep/copy-document";
import Delete from "~icons/ep/delete";
import type { PageColumn } from "../utils/types";
import { isViewOwner, type SavedViewRow } from "../utils/savedView";
import {
  summarizeConditions,
  summarizeConditionsText,
  type SummaryTranslator
} from "../utils/savedViewSummary";

/**
 * 「我的视图」下拉面板（纯展示 + 事件上抛，数据与请求编排在 SavedViews.vue）。
 *
 * 面板内**不使用嵌套浮层**（popover 内再开 dropdown 会因外部点击判定互相关闭），
 * 行操作直接平铺为文字按钮；星标即默认视图开关。
 */
const props = defineProps<{
  views: SavedViewRow[];
  currentPk?: string | number;
  columns?: PageColumn[];
  username?: string;
}>();
const emit = defineEmits<{
  apply: [row: SavedViewRow];
  save: [];
  update: [row: SavedViewRow];
  rename: [row: SavedViewRow];
  duplicate: [row: SavedViewRow];
  toggleDefault: [row: SavedViewRow];
  remove: [row: SavedViewRow];
}>();

const { t } = useI18n();
const translate = t as unknown as SummaryTranslator;
const keyword = ref("");

const isOwner = (row: SavedViewRow) => isViewOwner(row, props.username ?? "");
const isActive = (row: SavedViewRow) =>
  String(row.pk) === String(props.currentPk ?? "");

const summaries = computed(() => {
  const map = new Map<string, string>();
  props.views.forEach(row => {
    const items = summarizeConditions(
      row.conditions,
      props.columns ?? [],
      translate
    );
    map.set(String(row.pk), summarizeConditionsText(items));
  });
  return map;
});

const filtered = computed(() => {
  const text = keyword.value.trim().toLowerCase();
  if (!text) return props.views;
  return props.views.filter(row =>
    `${row.name ?? ""} ${row.remark ?? ""} ${summaries.value.get(String(row.pk)) ?? ""}`
      .toLowerCase()
      .includes(text)
  );
});
</script>

<template>
  <div data-testid="sv-panel">
    <div class="flex-bc px-1 pb-2">
      <span class="text-sm font-medium">{{ t("savedView.title") }}</span>
      <el-button
        link
        type="primary"
        :icon="Plus"
        data-testid="sv-save"
        @click="emit('save')"
      >
        {{ t("savedView.saveCurrent") }}
      </el-button>
    </div>
    <el-input
      v-if="views.length > 6"
      v-model="keyword"
      size="small"
      clearable
      :prefix-icon="Search"
      :placeholder="t('savedView.searchPlaceholder')"
      class="mb-2"
    />
    <el-scrollbar max-height="320px">
      <div v-if="!filtered.length" class="px-2 py-6 text-center">
        <p class="mb-0 text-sm text-text_color_secondary">
          {{ views.length ? t("savedView.noMatch") : t("savedView.emptyHint") }}
        </p>
        <el-button
          v-if="!views.length"
          class="mt-3"
          size="small"
          type="primary"
          plain
          @click="emit('save')"
        >
          {{ t("savedView.saveCurrent") }}
        </el-button>
      </div>
      <div
        v-for="row in filtered"
        :key="row.pk"
        class="mb-1 cursor-pointer rounded-lg p-2 transition-colors hover:bg-(--el-fill-color-lighter)"
        :class="isActive(row) ? 'bg-(--el-color-primary-light-9)' : ''"
        data-testid="sv-item"
        @click="emit('apply', row)"
      >
        <div class="flex items-start gap-1.5">
          <el-button
            link
            class="mt-0.5 shrink-0"
            :icon="row.is_default ? StarFilled : Star"
            :class="
              row.is_default
                ? 'text-(--el-color-warning)'
                : 'text-text_color_secondary'
            "
            :disabled="!isOwner(row)"
            :title="
              row.is_default
                ? t('savedView.cancelDefault')
                : t('savedView.setDefault')
            "
            @click.stop="emit('toggleDefault', row)"
          />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <span class="truncate text-sm font-medium">{{ row.name }}</span>
              <el-tag
                v-if="row.is_shared"
                size="small"
                type="info"
                effect="plain"
              >
                {{ t("savedView.sharedShort") }}
              </el-tag>
              <span
                v-if="isActive(row)"
                class="shrink-0 text-xs text-(--el-color-primary)"
              >
                {{ t("savedView.current") }}
              </span>
            </div>
            <div class="mt-0.5 truncate text-xs text-text_color_secondary">
              {{ summaries.get(String(row.pk)) || t("savedView.noConditions") }}
            </div>
            <div class="mt-1 flex flex-wrap items-center">
              <el-button
                link
                size="small"
                :icon="Refresh"
                :disabled="!isOwner(row)"
                data-testid="sv-update"
                @click.stop="emit('update', row)"
              >
                {{ t("savedView.updateCurrent") }}
              </el-button>
              <el-button
                link
                size="small"
                :icon="EditPen"
                :disabled="!isOwner(row)"
                @click.stop="emit('rename', row)"
              >
                {{ t("savedView.rename") }}
              </el-button>
              <el-button
                link
                size="small"
                :icon="CopyDocument"
                @click.stop="emit('duplicate', row)"
              >
                {{ t("savedView.duplicate") }}
              </el-button>
              <el-button
                link
                size="small"
                type="danger"
                :icon="Delete"
                :disabled="!isOwner(row)"
                :aria-label="t('buttons.delete')"
                :title="t('buttons.delete')"
                @click.stop="emit('remove', row)"
              />
            </div>
          </div>
        </div>
      </div>
    </el-scrollbar>
    <p class="mb-0 mt-1 px-1 text-xs text-text_color_secondary">
      {{ t("savedView.footerHint") }}
    </p>
  </div>
</template>
