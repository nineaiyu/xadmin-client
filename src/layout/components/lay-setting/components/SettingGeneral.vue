<script lang="ts" setup>
// 系统设置面板「通用」：界面语言、顶栏自动隐藏、内容区（紧凑模式）、
// 页面（动态标题）、快捷键（⌘/Ctrl + K）与「检查更新」；
// 切换动画见 SettingAnimation.vue
import { computed, reactive, ref } from "vue";
import { useGlobal } from "@pureadmin/utils";
import { message } from "@/utils/message";
import { checkRemoteVersion } from "@/utils/versionCheck";
import { useNav } from "@/layout/hooks/useNav";
import { useTranslationLang } from "@/layout/hooks/useTranslationLang";
import { useConfigureStorage } from "../hooks/useConfigureStorage";
import PrefBlock from "./PrefBlock.vue";
import PrefRow from "./PrefRow.vue";

import SettingLine from "~icons/ri/settings-3-line";
import KeyboardLine from "~icons/ri/keyboard-line";
import InfoLine from "~icons/ri/information-line";
import RefreshLine from "~icons/ri/refresh-line";

const { t } = useNav();
const { $storage } = useGlobal<GlobalPropertiesApi>();
const { storageConfigureChange } = useConfigureStorage();
const { locale, translationCh, translationEn } = useTranslationLang();

const {
  pkg: { version }
} = __APP_INFO__;

const settings = reactive({
  headerAutoHide: $storage.configure.headerAutoHide ?? false,
  compactMode: $storage.configure.compactMode ?? false,
  dynamicTitle: $storage.configure.dynamicTitle ?? true,
  shortcutSearch: $storage.configure.shortcutSearch ?? true
});

/** 固定顶栏：非固定头布局下没有可隐藏的固定头部，自动隐藏开关须禁用 */
const headerFixed = computed(() => $storage?.configure?.headerFixed ?? true);

/** 界面语言（复用顶栏语言切换链路：本地存储 + 站点配置自动保存） */
const language = computed<string>({
  get: () => locale.value,
  set: value => {
    if (value === "en") {
      void translationEn();
      return;
    }
    translationCh();
  }
});

const languageOptions = computed(() => [
  { label: "简体中文", value: "zh" },
  { label: "English", value: "en" }
]);

/** 顶栏自动隐藏：实时生效（useHeaderAutoHide 读同一存储项） */
const headerAutoHideChange = () => {
  storageConfigureChange("headerAutoHide", settings.headerAutoHide ?? false);
};

/** 内容区紧凑模式：实时生效（lay-content 读同一存储项） */
const compactModeChange = () => {
  storageConfigureChange("compactMode", settings.compactMode ?? false);
};

/** 动态标题：路由切换时是否改写 document.title */
const dynamicTitleChange = () => {
  storageConfigureChange("dynamicTitle", settings.dynamicTitle ?? true);
};

/** 全局搜索快捷键（⌘/Ctrl + K） */
const shortcutSearch = computed({
  get: () => $storage?.configure?.shortcutSearch ?? true,
  set: value => storageConfigureChange("shortcutSearch", value)
});

/** 锁屏快捷键（Alt + L） */
const shortcutLock = computed({
  get: () => $storage?.configure?.shortcutLock ?? true,
  set: value => storageConfigureChange("shortcutLock", value)
});

/** 折叠侧栏快捷键（Alt + S） */
const shortcutSidebar = computed({
  get: () => $storage?.configure?.shortcutSidebar ?? true,
  set: value => storageConfigureChange("shortcutSidebar", value)
});

/** 检查更新：拉取部署端 version.json 与本地版本比对（自动轮询由 version-rocket 承担） */
const checking = ref(false);
async function checkUpdate() {
  if (checking.value) return;
  checking.value = true;
  try {
    const { version: remote, outdated } = await checkRemoteVersion(version);
    if (outdated) {
      message(t("layout.checkUpdateFound", { version: remote }), {
        type: "warning",
        duration: 5000
      });
    } else {
      message(t("layout.checkUpdateLatest"), { type: "success" });
    }
  } catch {
    message(t("layout.checkUpdateFailed"), { type: "error" });
  } finally {
    checking.value = false;
  }
}
</script>

<template>
  <PrefBlock :title="t('layout.general')" :icon="SettingLine" list flush>
    <PrefRow :label="t('layout.language')" :tip="t('layout.languageTip')">
      <template #control>
        <el-select v-model="language" size="small" style="width: 132px">
          <el-option
            v-for="item in languageOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </template>
    </PrefRow>
    <PrefRow
      :label="t('layout.headerAutoHide')"
      :tip="t('layout.headerAutoHideTip')"
      :disabled="!headerFixed"
    >
      <template #control>
        <el-switch
          v-model="settings.headerAutoHide"
          :active-text="t('labels.active')"
          :inactive-text="t('labels.inactive')"
          :disabled="!headerFixed"
          inline-prompt
          @change="headerAutoHideChange"
        />
      </template>
    </PrefRow>
    <PrefRow :label="t('layout.compactMode')" :tip="t('layout.compactModeTip')">
      <template #control>
        <el-switch
          v-model="settings.compactMode"
          :active-text="t('labels.active')"
          :inactive-text="t('labels.inactive')"
          inline-prompt
          @change="compactModeChange"
        />
      </template>
    </PrefRow>
    <PrefRow
      :label="t('layout.dynamicTitle')"
      :tip="t('layout.dynamicTitleTip')"
    >
      <template #control>
        <el-switch
          v-model="settings.dynamicTitle"
          :active-text="t('labels.active')"
          :inactive-text="t('labels.inactive')"
          inline-prompt
          @change="dynamicTitleChange"
        />
      </template>
    </PrefRow>
  </PrefBlock>

  <PrefBlock :title="t('layout.shortcut')" :icon="KeyboardLine" list flush>
    <PrefRow
      :label="t('layout.shortcutSearch')"
      :tip="t('layout.shortcutSearchTip')"
    >
      <template #control>
        <el-switch
          v-model="shortcutSearch"
          :active-text="t('labels.active')"
          :inactive-text="t('labels.inactive')"
          inline-prompt
        />
      </template>
    </PrefRow>
    <PrefRow
      :label="t('layout.shortcutLock')"
      :tip="t('layout.shortcutLockTip')"
    >
      <template #control>
        <el-switch
          v-model="shortcutLock"
          :active-text="t('labels.active')"
          :inactive-text="t('labels.inactive')"
          inline-prompt
        />
      </template>
    </PrefRow>
    <PrefRow
      :label="t('layout.shortcutSidebar')"
      :tip="t('layout.shortcutSidebarTip')"
    >
      <template #control>
        <el-switch
          v-model="shortcutSidebar"
          :active-text="t('labels.active')"
          :inactive-text="t('labels.inactive')"
          inline-prompt
        />
      </template>
    </PrefRow>
  </PrefBlock>

  <PrefBlock :title="t('layout.about')" :icon="InfoLine" list flush>
    <PrefRow :label="t('layout.currentVersion')">
      <template #control>
        <span class="pref-about__version">{{ version }}</span>
      </template>
    </PrefRow>
    <PrefRow :label="t('layout.checkUpdate')" :tip="t('layout.checkUpdateTip')">
      <template #control>
        <el-button
          :loading="checking"
          size="small"
          type="primary"
          plain
          @click="checkUpdate"
        >
          <IconifyIconOffline :icon="RefreshLine" class="mr-1" />
          {{ t("layout.checkUpdate") }}
        </el-button>
      </template>
    </PrefRow>
  </PrefBlock>
</template>

<style lang="scss" scoped>
.pref-about__version {
  font-family: var(--font-family-mono);
  font-size: var(--font-size-xs);
  color: var(--el-text-color-secondary);
}
</style>
