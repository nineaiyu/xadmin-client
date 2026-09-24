<script lang="ts" setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { PageColumn } from "../utils/types";
import {
  summarizeConditions,
  summarizeConditionsText,
  type SummaryTranslator
} from "../utils/savedViewSummary";
import type { SavedViewRow } from "../utils/savedView";

/**
 * 视图保存 / 编辑表单（弹窗内容组件，ReDialog 托管）。
 *
 * 条件只读预览：把即将保存的筛选条件翻译成可读文本，避免「存了不知道存了什么」；
 * 名称 / 说明 / 共享 / 默认四项可编辑，`getPayload()` 校验失败返回 null（弹窗不关闭）。
 */
const props = defineProps<{
  /** 编辑既有视图时的行数据（名称 / 说明 / 共享 / 默认回显） */
  row?: SavedViewRow;
  /** 待保存的条件快照（新建为当前筛选；副本 / 重命名为目标视图条件） */
  conditions: Record<string, unknown>;
  columns?: PageColumn[];
  /** 名称预填（副本场景） */
  defaultName?: string;
}>();
const { t } = useI18n();
const translate = t as unknown as SummaryTranslator;

const name = ref(String(props.row?.name ?? props.defaultName ?? ""));
const remark = ref(String(props.row?.remark ?? ""));
const isShared = ref(Boolean(props.row?.is_shared));
const isDefault = ref(Boolean(props.row?.is_default));
const nameError = ref("");

const chips = computed(() =>
  summarizeConditions(props.conditions, props.columns ?? [], translate).map(
    item => summarizeConditionsText([item])
  )
);

const getPayload = () => {
  const value = name.value.trim();
  if (!value) {
    nameError.value = t("savedView.nameRequired");
    return null;
  }
  nameError.value = "";
  return {
    name: value,
    remark: remark.value.trim(),
    is_shared: isShared.value,
    is_default: isDefault.value
  };
};

defineExpose({ getPayload });
</script>

<template>
  <el-form label-position="top" class="pt-1">
    <el-form-item :label="t('savedView.nameLabel')" required :error="nameError">
      <!-- 包裹层承载 testid：el-input 把 $attrs 透传到内部 input（inheritAttrs: false），
           直接挂在组件上会让 [data-testid="sv-name"] input 这类后代选择器失配 -->
      <div class="w-full" data-testid="sv-name">
        <el-input
          v-model="name"
          maxlength="64"
          show-word-limit
          clearable
          :placeholder="t('savedView.namePlaceholder')"
        />
      </div>
    </el-form-item>
    <el-form-item :label="t('savedView.remarkLabel')">
      <el-input
        v-model="remark"
        type="textarea"
        :rows="2"
        maxlength="255"
        :placeholder="t('savedView.remarkPlaceholder')"
      />
    </el-form-item>
    <el-form-item :label="t('savedView.conditionsLabel')">
      <div
        class="flex flex-wrap items-center gap-2"
        data-testid="sv-conditions"
      >
        <el-tag
          v-for="chip in chips"
          :key="chip"
          type="info"
          effect="plain"
          round
        >
          {{ chip }}
        </el-tag>
        <span v-if="!chips.length" class="text-sm text-text_color_secondary">
          {{ t("savedView.noConditions") }}
        </span>
      </div>
    </el-form-item>
    <div class="flex flex-col gap-3">
      <div class="flex-bc rounded-lg bg-(--el-fill-color-lighter) px-3 py-2">
        <div>
          <div class="text-sm">{{ t("savedView.defaultLabel") }}</div>
          <div class="text-xs text-text_color_secondary">
            {{ t("savedView.defaultHint") }}
          </div>
        </div>
        <el-switch v-model="isDefault" />
      </div>
      <div class="flex-bc rounded-lg bg-(--el-fill-color-lighter) px-3 py-2">
        <div>
          <div class="text-sm">{{ t("savedView.sharedLabel") }}</div>
          <div class="text-xs text-text_color_secondary">
            {{ t("savedView.sharedHint") }}
          </div>
        </div>
        <el-switch v-model="isShared" />
      </div>
    </div>
  </el-form>
</template>
