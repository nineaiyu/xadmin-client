<script lang="ts" setup>
import { onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import { isSuccess } from "@/api/types";
import { settingsCaptchaApi } from "@/api/system/settings";
import SettingItem from "@/views/settings/components/settings-shell/SettingItem.vue";
import SettingPreview from "@/views/settings/components/settings-shell/SettingPreview.vue";
import type { settingItemProps } from "@/views/settings/components/settings-shell/types";

defineOptions({ name: "CaptchaImageSetting" });

const props = withDefaults(
  defineProps<{ item: settingItemProps; refreshKey?: number }>(),
  { refreshKey: 0 }
);

const { t } = useI18n();
const image = ref("");
const loading = ref(true);

/** 预览基于已保存配置：保存后由页面递增 refreshKey 自动刷新 */
const load = () => {
  loading.value = true;
  settingsCaptchaApi
    .preview()
    .then(res => {
      image.value = isSuccess(res) && res.data?.image ? res.data.image : "";
    })
    .catch(() => {
      image.value = "";
    })
    .finally(() => {
      loading.value = false;
    });
};

onMounted(load);
watch(() => props.refreshKey, load);
</script>

<template>
  <SettingPreview
    :title="t('settingCaptcha.imagePreviewTitle')"
    :tip="t('settingCaptcha.previewTip')"
    :loading="loading"
    :empty="!image && !loading"
    :empty-text="t('settingCaptcha.previewFailed')"
    height="180px"
  >
    <template #actions>
      <el-button link type="primary" :loading="loading" @click="load">
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
