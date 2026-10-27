<script lang="ts" setup>
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import { isSuccess } from "@/api/types";
import type { CaptchaChallengeData, CaptchaType } from "@/api/auth";
import {
  settingsCaptchaInteractiveApi,
  type CaptchaInteractivePreviewData
} from "@/api/system/settings";
import { ReCaptchaPuzzle } from "@/components/ReCaptchaPuzzle";
import { ReRotateCaptcha } from "@/components/ReRotateCaptcha";
import { ReWordClickCaptcha } from "@/components/ReWordClickCaptcha";
import SettingItem from "@/views/settings/components/settings-shell/SettingItem.vue";
import SettingPreview from "@/views/settings/components/settings-shell/SettingPreview.vue";
import type { settingItemProps } from "@/views/settings/components/settings-shell/types";

defineOptions({ name: "CaptchaInteractiveSetting" });

const props = withDefaults(
  defineProps<{ item: settingItemProps; refreshKey?: number }>(),
  { refreshKey: 0 }
);

const { t } = useI18n();
const type = ref<CaptchaType>("slide");
const preview = ref<CaptchaInteractivePreviewData | null>(null);
const loading = ref(true);
const version = ref(0);

const previewTypes = computed(() => [
  { value: "slide" as const, label: t("settingCaptcha.previewSlide") },
  { value: "rotate" as const, label: t("settingCaptcha.previewRotate") },
  { value: "click" as const, label: t("settingCaptcha.previewClick") },
  { value: "wordorder" as const, label: t("settingCaptcha.previewWordorder") }
]);

/** 预览基于已保存配置：保存后由页面递增 refreshKey 自动刷新 */
const load = () => {
  loading.value = true;
  settingsCaptchaInteractiveApi
    .preview({ type: type.value })
    .then(res => {
      if (isSuccess(res) && res.data?.background) {
        preview.value = res.data;
        version.value += 1;
      } else {
        preview.value = null;
      }
    })
    .catch(() => {
      preview.value = null;
    })
    .finally(() => {
      loading.value = false;
    });
};

const challenge = computed<CaptchaChallengeData | null>(() =>
  preview.value ? { ...preview.value, challenge_id: "preview", ttl: 0 } : null
);
const previewKey = computed(() => `${type.value}-${version.value}`);

watch(type, load);
watch(() => props.refreshKey, load);
onMounted(load);
</script>

<template>
  <SettingPreview
    :title="t('settingCaptcha.interactivePreviewTitle')"
    :tip="t('settingCaptcha.previewTip')"
    :loading="loading"
    :empty="!challenge && !loading"
    :empty-text="t('settingCaptcha.previewFailed')"
    height="340px"
    testid="captcha-interactive-preview"
  >
    <template #actions>
      <el-select
        v-model="type"
        size="small"
        class="captcha-preview__select"
        :aria-label="t('settingCaptcha.previewType')"
        data-testid="captcha-preview-type"
      >
        <el-option
          v-for="option in previewTypes"
          :key="option.value"
          :label="option.label"
          :value="option.value"
        />
      </el-select>
      <el-button link type="primary" :loading="loading" @click="load">
        {{ t("settingCaptcha.refreshPreview") }}
      </el-button>
    </template>
    <div
      v-if="challenge"
      class="captcha-preview__canvas"
      :class="{
        'captcha-preview__canvas--square': challenge.type === 'rotate'
      }"
    >
      <ReCaptchaPuzzle
        v-if="challenge.type === 'slide'"
        :key="previewKey"
        :challenge="challenge"
      />
      <ReRotateCaptcha
        v-else-if="challenge.type === 'rotate'"
        :key="previewKey"
        :challenge="challenge"
      />
      <ReWordClickCaptcha v-else :key="previewKey" :challenge="challenge" />
    </div>
  </SettingPreview>
  <p class="captcha-preview__hint">
    {{ t("settingCaptcha.interactiveBehaviorHint") }}
  </p>
  <SettingItem v-bind="props.item" />
</template>

<style lang="scss" scoped>
.captcha-preview__select {
  width: 132px;
}

.captcha-preview__hint {
  margin-top: var(--space-2);
  font-size: var(--el-font-size-small);
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

/* 舞台内固定内容列：拼图 / 点选按底图 320 宽，旋转按 240 宽，
   各题型高度都落在 340px 舞台内，切换时卡片不跳动 */
.captcha-preview__canvas {
  width: 100%;
  max-width: 320px;
}

.captcha-preview__canvas--square {
  max-width: 240px;
}
</style>
