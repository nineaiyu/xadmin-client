<script lang="ts" setup>
// 系统设置面板「布局」：页签风格（灵动/卡片/谷歌，预览卡）+ 页签行为
// （隐藏、持久化、中键关闭、滚轮滚动、最大数量）
import { computed, reactive } from "vue";
import { useGlobal } from "@pureadmin/utils";
import { emitter } from "@/utils/mitt";
import { useNav } from "@/layout/hooks/useNav";
import { useMultiTagsStoreHook } from "@/store/modules/multiTags";
import { useConfigureStorage } from "../hooks/useConfigureStorage";
import PrefBlock from "./PrefBlock.vue";
import PrefRow from "./PrefRow.vue";
import PrefChoice from "./PrefChoice.vue";
import type { PrefChoiceOption } from "./prefTypes";

import TabLine from "~icons/ri/window-line";

const { t } = useNav();
const { $storage } = useGlobal<GlobalPropertiesApi>();
const { storageConfigureChange } = useConfigureStorage();

/** 页签风格默认为谷歌风格 */
const tagsStyleValue = computed<string>({
  get: () => $storage?.configure?.tagsStyle ?? "chrome",
  set: value => {
    storageConfigureChange("tagsStyle", value);
    emitter.emit("tagViewsTagsStyle", value);
  }
});

const settings = reactive({
  hideTabs: $storage.configure.hideTabs ?? false,
  multiTagsCache: $storage.configure.multiTagsCache ?? false,
  tagsMiddleClickClose: $storage.configure.tagsMiddleClickClose ?? true,
  tagsWheelSwitch: $storage.configure.tagsWheelSwitch ?? true
});

const styleOptions = computed<PrefChoiceOption[]>(() => [
  {
    value: "smart",
    label: t("layout.tagsStyleSmart"),
    tip: t("layout.tagsStyleSmartTip")
  },
  {
    value: "plain",
    label: t("layout.tagsStylePlain"),
    tip: t("layout.tagsStylePlainTip")
  },
  {
    value: "card",
    label: t("layout.tagsStyleCard"),
    tip: t("layout.tagsStyleCardTip")
  },
  {
    value: "chrome",
    label: t("layout.tagsStyleChrome"),
    tip: t("layout.tagsStyleChromeTip")
  }
]);

/** 隐藏标签页 */
const hideTabsChange = () => {
  storageConfigureChange("hideTabs", settings.hideTabs);
  emitter.emit("tagViewsChange", settings.hideTabs ?? false);
};

/** 标签页持久化 */
const multiTagsCacheChange = () => {
  storageConfigureChange("multiTagsCache", settings.multiTagsCache ?? false);
  useMultiTagsStoreHook().multiTagsCacheChange(
    settings.multiTagsCache ?? false
  );
};

/** 中键关闭页签 */
const tagsMiddleClickCloseChange = () => {
  storageConfigureChange(
    "tagsMiddleClickClose",
    settings.tagsMiddleClickClose ?? true
  );
};

/** 滚轮横向滚动页签条 */
const tagsWheelSwitchChange = () => {
  storageConfigureChange("tagsWheelSwitch", settings.tagsWheelSwitch ?? true);
};

/** 页签最大数量（0 = 不限制）：multiTags 每次 push 时读取，超出后自动关闭最旧页签 */
const maxTagsCount = computed<number>({
  get: () => Number($storage?.configure?.maxTagsCount ?? 0),
  set: value =>
    storageConfigureChange("maxTagsCount", Math.max(0, Number(value) || 0))
});

/** 页签条细分开关：页签图标 / 刷新按钮 / 更多按钮 */
const tagsShowIcon = computed({
  get: () => $storage?.configure?.tagsShowIcon ?? true,
  set: value => storageConfigureChange("tagsShowIcon", value)
});
const tagsShowRefresh = computed({
  get: () => $storage?.configure?.tagsShowRefresh ?? true,
  set: value => storageConfigureChange("tagsShowRefresh", value)
});
const tagsShowMore = computed({
  get: () => $storage?.configure?.tagsShowMore ?? true,
  set: value => storageConfigureChange("tagsShowMore", value)
});
</script>

<template>
  <PrefBlock :title="t('layout.labelStyle')" :icon="TabLine" list flush>
    <PrefRow :label="t('layout.labelStyle')" stack>
      <template #control>
        <PrefChoice
          :options="styleOptions"
          :model-value="tagsStyleValue"
          :preview-height="30"
          @change="value => (tagsStyleValue = value)"
        >
          <template #preview="{ value }">
            <span class="tab-preview" :class="`tab-preview--${value}`">
              <i class="tab-preview__item" />
              <i class="tab-preview__item" />
              <i class="tab-preview__body" />
            </span>
          </template>
        </PrefChoice>
      </template>
    </PrefRow>
  </PrefBlock>

  <PrefBlock :title="t('layout.tabbar')" list flush>
    <PrefRow :label="t('layout.hideTabs')">
      <template #control>
        <el-switch
          v-model="settings.hideTabs"
          :active-text="t('labels.active')"
          :inactive-text="t('labels.inactive')"
          inline-prompt
          @change="hideTabsChange"
        />
      </template>
    </PrefRow>
    <PrefRow
      :label="t('layout.labelPersistence')"
      :tip="t('layout.persistenceTip')"
    >
      <template #control>
        <el-switch
          v-model="settings.multiTagsCache"
          :active-text="t('labels.active')"
          :inactive-text="t('labels.inactive')"
          inline-prompt
          @change="multiTagsCacheChange"
        />
      </template>
    </PrefRow>
    <PrefRow
      :label="t('layout.tagsMiddleClickClose')"
      :tip="t('layout.tagsMiddleClickCloseTip')"
    >
      <template #control>
        <el-switch
          v-model="settings.tagsMiddleClickClose"
          :active-text="t('labels.active')"
          :inactive-text="t('labels.inactive')"
          inline-prompt
          @change="tagsMiddleClickCloseChange"
        />
      </template>
    </PrefRow>
    <PrefRow
      :label="t('layout.tagsWheelSwitch')"
      :tip="t('layout.tagsWheelSwitchTip')"
    >
      <template #control>
        <el-switch
          v-model="settings.tagsWheelSwitch"
          :active-text="t('labels.active')"
          :inactive-text="t('labels.inactive')"
          inline-prompt
          @change="tagsWheelSwitchChange"
        />
      </template>
    </PrefRow>
    <PrefRow
      :label="t('layout.tagsShowIcon')"
      :tip="t('layout.tagsShowIconTip')"
    >
      <template #control>
        <el-switch
          v-model="tagsShowIcon"
          :active-text="t('labels.active')"
          :inactive-text="t('labels.inactive')"
          inline-prompt
        />
      </template>
    </PrefRow>
    <PrefRow
      :label="t('layout.tagsShowRefresh')"
      :tip="t('layout.tagsShowRefreshTip')"
    >
      <template #control>
        <el-switch
          v-model="tagsShowRefresh"
          :active-text="t('labels.active')"
          :inactive-text="t('labels.inactive')"
          inline-prompt
        />
      </template>
    </PrefRow>
    <PrefRow
      :label="t('layout.tagsShowMore')"
      :tip="t('layout.tagsShowMoreTip')"
    >
      <template #control>
        <el-switch
          v-model="tagsShowMore"
          :active-text="t('labels.active')"
          :inactive-text="t('labels.inactive')"
          inline-prompt
        />
      </template>
    </PrefRow>
    <PrefRow
      :label="t('layout.maxTagsCount')"
      :tip="t('layout.maxTagsCountTip')"
    >
      <template #control>
        <el-input-number
          v-model="maxTagsCount"
          :min="0"
          :max="30"
          :step="5"
          size="small"
          controls-position="right"
          style="width: 108px"
        />
      </template>
    </PrefRow>
  </PrefBlock>
</template>

<style lang="scss" scoped>
.tab-preview {
  position: relative;
  display: flex;
  gap: 3px;
  align-items: flex-end;
  width: 46px;
  height: 30px;
  padding: 5px 5px 0;
  overflow: hidden;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--radius-sm);

  &__item {
    flex: 1;
    height: 7px;
    background: var(--el-fill-color);
    border: 1px solid var(--el-border-color-lighter);

    &:first-child {
      background: var(--el-color-primary-light-5);
      border-color: var(--el-color-primary-light-5);
    }
  }

  &__body {
    position: absolute;
    right: 5px;
    bottom: 5px;
    left: 5px;
    height: 12px;
    background: var(--el-fill-color-light);
    border: 1px solid var(--el-border-color-lighter);
  }

  /* 灵动：胶囊标签 */
  &--smart {
    align-items: center;
    padding: 5px;

    .tab-preview__item {
      height: 6px;
      border-radius: var(--radius-full);
    }
  }

  /* 卡片：独立圆角卡片 */
  &--card {
    align-items: center;
    padding: 5px;

    .tab-preview__item {
      height: 9px;
      border-radius: var(--radius-xs);
    }
  }

  /* 谷歌：与内容区相连的梯形页签 */
  &--chrome {
    .tab-preview__item {
      height: 9px;
      border-bottom: 0;
      border-radius: var(--radius-xs) var(--radius-xs) 0 0;
    }

    .tab-preview__body {
      border-radius: 0 0 var(--radius-xs) var(--radius-xs);
    }
  }
}
</style>
