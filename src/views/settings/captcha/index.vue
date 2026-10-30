<script lang="ts" setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";

import Setting from "@/views/settings/components/settings-shell/index.vue";
import type {
  settingItemProps,
  settingsPane
} from "@/views/settings/components/settings-shell/types";
import {
  settingsCaptchaApi,
  settingsCaptchaGeneralApi,
  settingsCaptchaInteractiveApi,
  settingsCaptchaRiskApi
} from "@/api/system/settings";
import { settingAuth } from "@/views/settings/utils/settingAuth";
import { hasAuth } from "@/router/utils";
import CaptchaImageSetting from "./components/CaptchaImageSetting.vue";
import CaptchaInteractiveSetting from "./components/CaptchaInteractiveSetting.vue";
import CaptchaDataSetting from "./components/CaptchaDataSetting.vue";
import CaptchaRiskSetting from "./components/CaptchaRiskSetting.vue";

defineOptions({
  name: "SettingCaptcha"
});

const { t } = useI18n();

/** 保存后刷新对应预览（预览基于已保存配置） */
const imagePreviewRefresh = ref(0);
const interactivePreviewRefresh = ref(0);

const imageItem: settingItemProps = {
  auth: settingAuth("SecurityCaptchaCode"),
  api: settingsCaptchaApi,
  localeName: "settingSecurity",
  onSaved: () => {
    imagePreviewRefresh.value += 1;
  }
};

const interactiveItem: settingItemProps = {
  auth: settingAuth("SecurityCaptchaInteractive"),
  api: settingsCaptchaInteractiveApi,
  localeName: "settingSecurity",
  onSaved: () => {
    interactivePreviewRefresh.value += 1;
  }
};

const riskItem: settingItemProps = {
  auth: settingAuth("SecurityCaptchaRisk"),
  api: settingsCaptchaRiskApi,
  localeName: "settingCaptcha"
};

/**
 * 验证码设置（与短信设置同构）：
 * - 总配置：全局开关（题型池与启用项在「题型与难度」页签，不在此处）；
 * - 图片题型 / 题型与难度：各类型独立页签 + 只读预览，后续新增类型按同一模式扩展；
 * - 验证数据：观测大盘 + 日志列表（独立权限位，未授权时不渲染页签）。
 */
const canViewData = computed(
  () =>
    hasAuth("list:SecurityCaptchaStats") || hasAuth("list:SecurityCaptchaLog")
);
const canViewRisk = computed(() => hasAuth("retrieve:SecurityCaptchaRisk"));
const canViewImage = computed(
  () =>
    hasAuth("retrieve:SecurityCaptchaCode") ||
    hasAuth("preview:SecurityCaptchaCode")
);
const canViewInteractive = computed(
  () =>
    hasAuth("retrieve:SecurityCaptchaInteractive") ||
    hasAuth("preview:SecurityCaptchaInteractive")
);

const panes = computed<Array<settingsPane>>(() => [
  {
    key: "general",
    label: t("settingCaptcha.general"),
    desc: t("settingCaptcha.generalDesc"),
    item: {
      auth: settingAuth("SecurityCaptchaGeneral"),
      api: settingsCaptchaGeneralApi,
      localeName: "settingSecurity"
    }
  },
  ...(canViewImage.value
    ? [
        {
          key: "image",
          label: t("settingCaptcha.image"),
          desc: t("settingCaptcha.imageDesc")
        }
      ]
    : []),
  ...(canViewInteractive.value
    ? [
        {
          key: "interactive",
          label: t("settingCaptcha.interactive"),
          desc: t("settingCaptcha.interactiveDesc")
        }
      ]
    : []),
  ...(canViewRisk.value
    ? [
        {
          key: "risk",
          label: t("settingCaptcha.risk"),
          desc: t("settingCaptcha.riskDesc")
        }
      ]
    : []),
  ...(canViewData.value
    ? [
        {
          key: "data",
          label: t("settingCaptcha.data"),
          desc: t("settingCaptcha.dataDesc")
        }
      ]
    : [])
]);
</script>

<template>
  <setting :panes="panes">
    <template #image>
      <CaptchaImageSetting
        :item="imageItem"
        :refresh-key="imagePreviewRefresh"
      />
    </template>
    <template #interactive>
      <CaptchaInteractiveSetting
        :item="interactiveItem"
        :refresh-key="interactivePreviewRefresh"
      />
    </template>
    <template #risk>
      <CaptchaRiskSetting :item="riskItem" />
    </template>
    <template #data>
      <CaptchaDataSetting />
    </template>
  </setting>
</template>
