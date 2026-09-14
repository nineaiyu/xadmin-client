<script lang="ts" setup>
// 系统设置面板：显示设置区块（灰色模式、色弱、隐藏标签页、隐藏页脚、侧边栏 Logo、标签页持久化）
import { nextTick, onBeforeMount, reactive, ref, unref } from "vue";
import { emitter } from "@/utils/mitt";
import { useGlobal } from "@pureadmin/utils";
import { useNav } from "@/layout/hooks/useNav";
import { useDataThemeChange } from "@/layout/hooks/useDataThemeChange";
import { useMultiTagsStoreHook } from "@/store/modules/multiTags";
import { useConfigureStorage } from "../hooks/useConfigureStorage";

const { t } = useNav();
const { $storage } = useGlobal<GlobalPropertiesApi>();
const { toggleClass } = useDataThemeChange();
const { storageConfigureChange } = useConfigureStorage();

const logoVal = ref($storage.configure?.showLogo ?? true);

const settings = reactive({
  greyVal: $storage.configure.grey,
  weakVal: $storage.configure.weak,
  tabsVal: $storage.configure.hideTabs,
  hideFooter: $storage.configure.hideFooter,
  multiTagsCache: $storage.configure.multiTagsCache
});

/** 灰色模式设置 */
const greyChange = (value): void => {
  const htmlEl = document.querySelector("html");
  toggleClass(settings.greyVal, "html-grey", htmlEl);
  storageConfigureChange("grey", value);
};

/** 色弱模式设置 */
const weekChange = (value): void => {
  const htmlEl = document.querySelector("html");
  toggleClass(settings.weakVal, "html-weakness", htmlEl);
  storageConfigureChange("weak", value);
};

/** 隐藏标签页设置 */
const tagsChange = () => {
  const showVal = settings.tabsVal;
  storageConfigureChange("hideTabs", showVal);
  emitter.emit("tagViewsChange", showVal as unknown as string);
};

/** 隐藏页脚设置 */
const hideFooterChange = () => {
  const hideFooter = settings.hideFooter;
  storageConfigureChange("hideFooter", hideFooter);
};

/** 标签页持久化设置 */
const multiTagsCacheChange = () => {
  const multiTagsCache = settings.multiTagsCache;
  storageConfigureChange("multiTagsCache", multiTagsCache);
  useMultiTagsStoreHook().multiTagsCacheChange(multiTagsCache);
};

/** 侧边栏Logo */
function logoChange() {
  unref(logoVal)
    ? storageConfigureChange("showLogo", true)
    : storageConfigureChange("showLogo", false);
  emitter.emit("logoChange", unref(logoVal));
}

onBeforeMount(() => {
  /* 初始化项目配置：灰色模式、色弱模式、隐藏标签页、隐藏页脚 */
  nextTick(() => {
    settings.greyVal &&
      document.querySelector("html")?.classList.add("html-grey");
    settings.weakVal &&
      document.querySelector("html")?.classList.add("html-weakness");
    settings.tabsVal && tagsChange();
    settings.hideFooter && hideFooterChange();
  });
});
</script>

<template>
  <p class="mt-5! font-medium text-sm dark:text-white">
    {{ t("layout.display") }}
  </p>
  <ul class="setting">
    <li>
      <span class="dark:text-white">{{ t("layout.greyMode") }}</span>
      <el-switch
        v-model="settings.greyVal"
        :active-text="t('labels.active')"
        :inactive-text="t('labels.inactive')"
        inline-prompt
        @change="greyChange"
      />
    </li>
    <li>
      <span class="dark:text-white">{{ t("layout.colorWeakMode") }}</span>
      <el-switch
        v-model="settings.weakVal"
        :active-text="t('labels.active')"
        :inactive-text="t('labels.inactive')"
        inline-prompt
        @change="weekChange"
      />
    </li>
    <li>
      <span class="dark:text-white">{{ t("layout.hideTabs") }}</span>
      <el-switch
        v-model="settings.tabsVal"
        :active-text="t('labels.active')"
        :inactive-text="t('labels.inactive')"
        inline-prompt
        @change="tagsChange"
      />
    </li>
    <li>
      <span class="dark:text-white">{{ t("layout.hideFooter") }}</span>
      <el-switch
        v-model="settings.hideFooter"
        :active-text="t('labels.active')"
        :inactive-text="t('labels.inactive')"
        inline-prompt
        @change="hideFooterChange"
      />
    </li>
    <li>
      <span class="dark:text-white">{{ t("layout.sidebarLogo") }}</span>
      <el-switch
        v-model="logoVal"
        :active-text="t('labels.active')"
        :active-value="true"
        :inactive-text="t('labels.inactive')"
        :inactive-value="false"
        inline-prompt
        @change="logoChange"
      />
    </li>
    <li>
      <span class="dark:text-white">{{ t("layout.labelPersistence") }}</span>
      <el-switch
        v-model="settings.multiTagsCache"
        :active-text="t('labels.active')"
        :inactive-text="t('labels.inactive')"
        inline-prompt
        @change="multiTagsCacheChange"
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
