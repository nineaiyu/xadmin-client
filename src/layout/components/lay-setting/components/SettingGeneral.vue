<script lang="ts" setup>
// 系统设置面板「通用」：界面语言、顶栏自动隐藏、内容区（紧凑模式）、
// 页面（动态标题）、偏好入口与「检查更新」；快捷键见 SettingShortcut.vue，
// 切换动画见 SettingAnimation.vue
import { computed, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { useGlobal } from "@pureadmin/utils";
import { message } from "@/utils/message";
import { checkRemoteVersion } from "@/utils/versionCheck";
import {
  checkUpdatesEnabled,
  setCheckUpdatesEnabled
} from "@/utils/autoUpdate";
import { emitter } from "@/utils/mitt";
import { useConfirm } from "@/hooks/useConfirm";
import { useNav } from "@/layout/hooks/useNav";
import { resolveHeaderMode } from "@/layout/hooks/layoutModes";
import { resolveTimezoneOptions } from "@/layout/hooks/timezoneOptions";
import { useTranslationLang } from "@/layout/hooks/useTranslationLang";
import { useConfigureStorage } from "../hooks/useConfigureStorage";
import PrefBlock from "./PrefBlock.vue";
import PrefRow from "./PrefRow.vue";
import PrefChoice from "./PrefChoice.vue";
import type { PrefChoiceOption } from "./prefTypes";

import SettingLine from "~icons/ri/settings-3-line";
import InfoLine from "~icons/ri/information-line";
import RefreshLine from "~icons/ri/refresh-line";

const { t, changeTitle } = useNav();
const router = useRouter();
const { $storage } = useGlobal<GlobalPropertiesApi>();
const { storageConfigureChange } = useConfigureStorage();
const confirm = useConfirm();
const { locale, translationCh, translationEn } = useTranslationLang();

const {
  pkg: { version }
} = __APP_INFO__;

const settings = reactive({
  title: $storage.configure.title ?? "",
  headerAutoHide: $storage.configure.headerAutoHide ?? false,
  compactMode: $storage.configure.compactMode ?? false,
  dynamicTitle: $storage.configure.dynamicTitle ?? true
});

/** 站点标题：品牌区随响应式 title 自动更新；标签页标题只在路由切换时重算，
 *  这里主动刷新一次。留空提交时回落 platform-config 的 Title（见 utils/preferences）。 */
const titleChange = () => {
  storageConfigureChange("title", settings.title.trim());
  changeTitle(router.currentRoute.value.meta);
};

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

/** 时区（顶栏时区组件与时钟展示消费同一存储项；空串 = 跟随浏览器） */
const timezone = computed<string>({
  get: () => String($storage?.configure?.timezone ?? ""),
  set: value => storageConfigureChange("timezone", value)
});
const timezoneOptions = computed(() => resolveTimezoneOptions());

/** 顶栏自动隐藏：实时生效（useHeaderAutoHide 读同一存储项）；
 *  与「布局」页签的顶栏模式四态同源——同时镜像 `headerMode`，两个入口不互相覆盖 */
const headerAutoHideChange = () => {
  const enabled = settings.headerAutoHide ?? false;
  storageConfigureChange("headerAutoHide", enabled);
  storageConfigureChange(
    "headerMode",
    enabled
      ? "auto"
      : resolveHeaderMode(
            $storage?.configure?.headerMode,
            $storage?.configure?.headerFixed ?? true,
            false
          ) === "static"
        ? "static"
        : "fixed"
  );
};

/** 内容区紧凑模式：实时生效（lay-content 读同一存储项） */
const compactModeChange = () => {
  storageConfigureChange("compactMode", settings.compactMode ?? false);
};

/** 动态标题：路由切换时是否改写 document.title */
const dynamicTitleChange = () => {
  storageConfigureChange("dynamicTitle", settings.dynamicTitle ?? true);
};

/** 认证页（登录）外壳形态：插画左 / 居中（不显示插画）/ 插画右 */
const authPageLayout = computed<string>({
  get: () => $storage?.configure?.authPageLayout ?? "panel-left",
  set: value => storageConfigureChange("authPageLayout", value)
});
const authPageLayoutOptions = computed<PrefChoiceOption[]>(() => [
  { value: "panel-left", label: t("layout.authPanelLeft") },
  { value: "panel-center", label: t("layout.authPanelCenter") },
  { value: "panel-right", label: t("layout.authPanelRight") }
]);

/** 设置入口总开关（关闭前二次确认并给出恢复路径） */
const prefsEnabled = computed(
  () => $storage?.configure?.enablePreferences ?? true
);

async function onPrefsEnabledChange(value: string | number | boolean) {
  if (Boolean(value)) {
    storageConfigureChange("enablePreferences", true);
    return;
  }
  const ok = await confirm(t("layout.enablePreferencesOffConfirm"));
  if (!ok) return;
  storageConfigureChange("enablePreferences", false);
}

/** 入口位置（对齐 vben `preferencesButtonPosition` 五态）：
 *  auto = 水平布局走悬浮球、其余走顶栏齿轮；none = 不显示；user-dropdown = 收进头像菜单 */
const preferencesPosition = computed<string>({
  get: () => $storage?.configure?.preferencesPosition ?? "header",
  set: value => storageConfigureChange("preferencesPosition", value)
});
const preferencesPositionOptions = computed<PrefChoiceOption[]>(() => [
  { value: "auto", label: t("layout.preferencesPositionAuto") },
  { value: "header", label: t("layout.preferencesPositionHeader") },
  { value: "fixed", label: t("layout.preferencesPositionFixed") },
  {
    value: "user-dropdown",
    label: t("layout.preferencesPositionUserDropdown")
  },
  { value: "none", label: t("layout.preferencesPositionNone") }
]);

/** 面板「复制偏好」按钮显隐（对齐 vben `enableCopyPreferences`） */
const copyPreferencesEnabled = computed(
  () => $storage?.configure?.enableCopyPreferences ?? true
);
function onCopyPreferencesChange(value: string | number | boolean) {
  storageConfigureChange("enableCopyPreferences", Boolean(value));
}

/** 自动检查更新（本地偏好）：后台轮询部署端版本；切换后经全局事件实时启停（App.vue） */
const autoCheckUpdates = ref(checkUpdatesEnabled());
function onAutoCheckUpdatesChange(value: string | number | boolean) {
  const enabled = Boolean(value);
  autoCheckUpdates.value = enabled;
  setCheckUpdatesEnabled(enabled);
  emitter.emit("checkUpdatesChange", enabled);
}

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
    <PrefRow :label="t('layout.siteTitle')" :tip="t('layout.siteTitleTip')">
      <template #control>
        <el-input
          v-model="settings.title"
          size="small"
          class="w-36"
          maxlength="24"
          :placeholder="t('layout.siteTitlePlaceholder')"
          @change="titleChange"
        />
      </template>
    </PrefRow>
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
    <PrefRow :label="t('layout.timezone')" :tip="t('layout.timezoneTip')">
      <template #control>
        <el-select
          v-model="timezone"
          size="small"
          style="width: 180px"
          filterable
          :placeholder="t('layout.timezoneFollowBrowser')"
        >
          <el-option :label="t('layout.timezoneFollowBrowser')" value="" />
          <el-option
            v-for="item in timezoneOptions"
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

  <PrefBlock :title="t('layout.authPage')" :icon="SettingLine" list flush>
    <PrefRow
      :label="t('layout.authPageLayout')"
      :tip="t('layout.authPageLayoutTip')"
      stack
    >
      <template #control>
        <PrefChoice
          :options="authPageLayoutOptions"
          :model-value="authPageLayout"
          @change="value => (authPageLayout = value)"
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
    <PrefRow
      :label="t('layout.enableCopyPreferences')"
      :tip="t('layout.enableCopyPreferencesTip')"
    >
      <template #control>
        <el-switch
          :model-value="copyPreferencesEnabled"
          :active-text="t('labels.active')"
          :inactive-text="t('labels.inactive')"
          inline-prompt
          @change="onCopyPreferencesChange"
        />
      </template>
    </PrefRow>
    <PrefRow
      :label="t('layout.autoCheckUpdates')"
      :tip="t('layout.autoCheckUpdatesTip')"
    >
      <template #control>
        <el-switch
          :model-value="autoCheckUpdates"
          :active-text="t('labels.active')"
          :inactive-text="t('labels.inactive')"
          inline-prompt
          @change="onAutoCheckUpdatesChange"
        />
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

  <PrefBlock
    :title="t('layout.preferencesEntry')"
    :icon="SettingLine"
    list
    flush
  >
    <PrefRow
      :label="t('layout.enablePreferences')"
      :tip="t('layout.enablePreferencesTip')"
    >
      <template #control>
        <el-switch
          :model-value="prefsEnabled"
          :active-text="t('labels.active')"
          :inactive-text="t('labels.inactive')"
          inline-prompt
          @change="onPrefsEnabledChange"
        />
      </template>
    </PrefRow>
    <PrefRow
      :label="t('layout.preferencesPosition')"
      :tip="t('layout.preferencesPositionTip')"
      stack
    >
      <template #control>
        <PrefChoice
          :options="preferencesPositionOptions"
          :model-value="preferencesPosition"
          @change="value => (preferencesPosition = value)"
        />
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
