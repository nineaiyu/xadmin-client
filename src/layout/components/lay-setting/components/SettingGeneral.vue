<script lang="ts" setup>
// 系统设置面板：通用区块（顶栏滚动自动隐藏、内容区紧凑模式）
import { reactive } from "vue";
import { useGlobal } from "@pureadmin/utils";
import { useNav } from "@/layout/hooks/useNav";
import { useConfigureStorage } from "../hooks/useConfigureStorage";
import { pClass } from "../hooks/useSectionClass";

const { t } = useNav();
const { $storage } = useGlobal<GlobalPropertiesApi>();
const { storageConfigureChange } = useConfigureStorage();

const settings = reactive({
  headerAutoHide: $storage.configure.headerAutoHide ?? false,
  compactMode: $storage.configure.compactMode ?? false
});

/** 顶栏自动隐藏：实时生效（useHeaderAutoHide 读同一存储项） */
const headerAutoHideChange = () => {
  storageConfigureChange("headerAutoHide", settings.headerAutoHide ?? false);
};

/** 内容区紧凑模式：实时生效（lay-content 读同一存储项） */
const compactModeChange = () => {
  storageConfigureChange("compactMode", settings.compactMode ?? false);
};
</script>

<template>
  <p :class="['mt-5!', pClass]">{{ t("layout.general") }}</p>
  <ul class="setting">
    <li>
      <span class="dark:text-white">{{ t("layout.headerAutoHide") }}</span>
      <el-switch
        v-model="settings.headerAutoHide"
        :active-text="t('labels.active')"
        :inactive-text="t('labels.inactive')"
        inline-prompt
        @change="headerAutoHideChange"
      />
    </li>
    <li>
      <span class="dark:text-white">{{ t("layout.compactMode") }}</span>
      <el-switch
        v-model="settings.compactMode"
        :active-text="t('labels.active')"
        :inactive-text="t('labels.inactive')"
        inline-prompt
        @change="compactModeChange"
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
