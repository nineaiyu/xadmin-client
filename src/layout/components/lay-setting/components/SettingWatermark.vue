<script lang="ts" setup>
// 系统设置面板：全屏水印设置区块（水印开关与水印文字）
import { reactive } from "vue";
import { useGlobal } from "@pureadmin/utils";
import { useNav } from "@/layout/hooks/useNav";
import { useConfigureStorage } from "../hooks/useConfigureStorage";

const { t } = useNav();
const { $storage } = useGlobal<GlobalPropertiesApi>();
const { storageConfigureChange } = useConfigureStorage();

const watermarkConfigs = reactive({
  enable: $storage.configure.watermark,
  text: $storage.configure.watermarkText
});

function onWatermarkSwitchChange(value) {
  storageConfigureChange("watermark", value);
}

function onWatermarkInputChange(text) {
  storageConfigureChange("watermarkText", text);
}
</script>

<template>
  <p class="mt-5! font-medium text-sm dark:text-white">
    {{ t("panel.fullScreenWatermark") }}
  </p>
  <ul class="setting">
    <li>
      <span class="dark:text-white">
        {{ t("panel.enableWatermark") }}
      </span>
      <el-switch
        v-model="watermarkConfigs.enable"
        :active-text="t('labels.active')"
        :inactive-text="t('labels.inactive')"
        inline-prompt
        @change="onWatermarkSwitchChange"
      />
    </li>
    <li v-if="watermarkConfigs.enable" v-motion-fade>
      <span class="dark:text-white">
        {{ t("panel.watermarkText") }}
      </span>
      <el-input
        v-model="watermarkConfigs.text"
        class="w-32!"
        clearable
        :placeholder="t('panel.watermarkTextPlaceholder')"
        @input="onWatermarkInputChange"
      />
    </li>
  </ul>
</template>

<style lang="scss" scoped>
:deep(.el-switch__core) {
  --el-switch-off-color: var(--pure-switch-off-color);

  min-width: 36px;
  height: 18px;
}

:deep(.el-switch__core .el-switch__action) {
  height: 14px;
}

.setting {
  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 3px 0;
    font-size: 14px;
  }
}
</style>
