<script lang="ts" setup>
import { onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import { isSuccess } from "@/api/types";
import { settingsCaptchaApi } from "@/api/system/settings";
import SettingItem from "@/views/settings/components/settings-shell/SettingItem.vue";
import SettingPreview from "@/views/settings/components/settings-shell/SettingPreview.vue";
import type { settingItemProps } from "@/views/settings/components/settings-shell/types";
import { normalizeError } from "@/utils/apiError";
import { hasAuth } from "@/router/utils";

defineOptions({ name: "CaptchaImageSetting" });

const props = withDefaults(
  defineProps<{ item: settingItemProps; refreshKey?: number }>(),
  { refreshKey: 0 }
);

const { t } = useI18n();
const image = ref("");
const loading = ref(true);
const previewError = ref("");
const canPreview = hasAuth("preview:SecurityCaptchaCode");

/** 预览基于已保存配置：保存后由页面递增 refreshKey 自动刷新 */
const load = () => {
  if (!canPreview) {
    loading.value = false;
    previewError.value = "";
    image.value = "";
    return;
  }
  loading.value = true;
  previewError.value = "";
  settingsCaptchaApi
    .preview()
    .then(res => {
      if (isSuccess(res) && res.data?.image) {
        image.value = res.data.image;
      } else {
        image.value = "";
        previewError.value = String(res.detail || "");
      }
    })
    .catch(error => {
      image.value = "";
      previewError.value = normalizeError(error).detail;
    })
    .finally(() => {
      loading.value = false;
    });
};

onMounted(load);
watch(() => props.refreshKey, load);
</script>

<template>
  <div class="captcha-image-setting">
    <SettingPreview
      :title="t('settingCaptcha.imagePreviewTitle')"
      :tip="t('settingCaptcha.previewTip')"
      :loading="loading"
      :empty="!image && !loading"
      :empty-text="
        !canPreview
          ? t('settingCaptcha.previewDenied')
          : previewError || t('settingCaptcha.previewFailed')
      "
      height="180px"
    >
      <template #actions>
        <el-button
          link
          type="primary"
          :loading="loading"
          :disabled="!canPreview"
          @click="load"
        >
          {{ t("settingCaptcha.refreshPreview") }}
        </el-button>
      </template>
      <img
        v-if="image"
        :src="image"
        :alt="t('settingCaptcha.imagePreviewTitle')"
        class="captcha-image"
        data-testid="captcha-image-preview"
      />
    </SettingPreview>
    <SettingItem v-bind="props.item" />
  </div>
</template>

<style lang="scss" scoped>
.captcha-image {
  display: block;
  max-width: 100%;
  max-height: 140px;
  object-fit: contain;
  border-radius: var(--radius-sm);
}
</style>
