<script lang="ts" setup>
// 水印设置页签：实时预览 + 配置表单。
// 预览复用 App.vue 同一套渲染链路（useWatermark + renderWatermarkText +
// buildWatermarkRenderOptions），占位符用当前登录用户的真实信息解析；
// 表单值变化（含回显）经 SettingItem 的 change 事件驱动，防抖后重绘预览。
import { useDebounceFn } from "@vueuse/core";
import { useWatermark } from "@pureadmin/utils";
import { computed, onBeforeUnmount, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import type { FieldValues } from "plus-pro-components";
import type { SiteWatermarkResultConfig } from "@/api/auth";
import { useUserStoreHook } from "@/store/modules/user";
import SettingItem from "@/views/settings/components/settings-shell/SettingItem.vue";
import SettingPreview from "@/views/settings/components/settings-shell/SettingPreview.vue";
import type { settingItemProps } from "@/views/settings/components/settings-shell/types";
import {
  buildWatermarkRenderOptions,
  formatWatermarkTime,
  isWatermarkPath,
  renderWatermarkText,
  toSiteWatermarkConfig
} from "@/utils/watermark";

defineOptions({
  name: "WatermarkSetting"
});

const props = defineProps<{
  /** 水印页签的表单配置（api/fields/onSaved 等由页面组装） */
  item: settingItemProps;
}>();

const { t } = useI18n();
const route = useRoute();
const userStore = useUserStoreHook();
const previewCard = ref<{ stageEl?: HTMLElement }>();
/** 水印画布挂在预览卡片的舞台上（组件暴露 stageEl） */
const previewEl = computed(() => previewCard.value?.stageEl ?? null);
/** 预览提示：关闭 / 当前页不在路径范围（两者都不应让管理员误以为配置已生效） */
const previewNote = ref<"" | "disabled" | "outOfScope">("");
const { setWatermark, clear } = useWatermark(previewEl);

function applyPreview(values: FieldValues) {
  if (!previewEl.value) return;
  // 表单字段名与 userinfo config 键一致，直接复用解析器（含非法值夹紧）
  const config = toSiteWatermarkConfig(values as SiteWatermarkResultConfig);
  if (!config.enabled) {
    previewNote.value = "disabled";
    clear();
    return;
  }
  previewNote.value = isWatermarkPath(route.path, config.paths)
    ? ""
    : "outOfScope";
  const text = renderWatermarkText(config.template, {
    username: userStore.username,
    nickname: userStore.nickname,
    phone: userStore.phone,
    email: userStore.email,
    pk: userStore.pk,
    time: formatWatermarkTime()
  });
  clear();
  setWatermark(text, buildWatermarkRenderOptions(config));
}

const debouncedPreview = useDebounceFn(applyPreview, 200);
const onFormChange = (values: FieldValues) => debouncedPreview(values);

onBeforeUnmount(() => clear());
</script>

<template>
  <SettingPreview
    ref="previewCard"
    :title="t('settingWatermark.preview')"
    :tip="t('settingWatermark.previewTip')"
    :empty="previewNote === 'disabled'"
    :empty-text="t('settingWatermark.previewDisabled')"
    empty-testid="watermark-preview-note"
    :note="
      previewNote === 'outOfScope'
        ? t('settingWatermark.previewOutOfScope')
        : ''
    "
    note-testid="watermark-preview-note"
    height="200px"
    :padded="false"
  />
  <SettingItem v-bind="props.item" @change="onFormChange" />
</template>
