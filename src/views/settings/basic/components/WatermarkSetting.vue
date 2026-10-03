<script lang="ts" setup>
// 水印设置页签：实时预览 + 配置表单。
// 预览复用 App.vue 同一套渲染链路（useWatermark + renderWatermarkText +
// buildWatermarkRenderOptions），占位符用当前登录用户的真实信息解析；
// 表单值变化（含回显）经 SettingItem 的 change 事件驱动，防抖后重绘预览。
import { useDebounceFn } from "@vueuse/core";
import { useWatermark } from "@pureadmin/utils";
import { onBeforeUnmount, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { FieldValues } from "plus-pro-components";
import type { SiteWatermarkResultConfig } from "@/api/auth";
import { useUserStoreHook } from "@/store/modules/user";
import SettingItem from "@/views/settings/components/settings/SettingItem.vue";
import type { settingItemProps } from "@/views/settings/components/settings/types";
import {
  buildWatermarkRenderOptions,
  formatWatermarkTime,
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
const userStore = useUserStoreHook();
const previewEl = ref<HTMLElement | null>(null);
const { setWatermark, clear } = useWatermark(previewEl);

function applyPreview(values: FieldValues) {
  if (!previewEl.value) return;
  // 表单字段名与 userinfo config 键一致，直接复用解析器（含非法值夹紧）
  const config = toSiteWatermarkConfig(values as SiteWatermarkResultConfig);
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
  <div class="m-5 mx-12">
    <p class="mb-2 font-medium text-sm dark:text-white">
      {{ t("settingWatermark.preview") }}
    </p>
    <div
      ref="previewEl"
      class="relative overflow-hidden"
      style="
        height: 144px;
        background: var(--el-bg-color);
        border: 1px solid var(--el-border-color);
        border-radius: 6px;
      "
    />
    <p class="mt-1! text-xs" style="color: var(--el-text-color-secondary)">
      {{ t("settingWatermark.previewTip") }}
    </p>
  </div>
  <SettingItem v-bind="props.item" @change="onFormChange" />
</template>
