<script lang="ts" setup>
// 系统设置面板：页宽（固定/自定义内容区宽度）设置区块
import { computed, reactive } from "vue";
import { isNumber, useGlobal } from "@pureadmin/utils";
import Segmented, { type OptionsType } from "@/components/ReSegmented";
import { useNav } from "@/layout/hooks/useNav";
import { useAppStoreHook } from "@/store/modules/app";
import { useConfigureStorage } from "../hooks/useConfigureStorage";
import { pClass } from "../hooks/useSectionClass";

import LeftArrow from "~icons/ri/arrow-left-s-line?width=20&height=20";
import RightArrow from "~icons/ri/arrow-right-s-line?width=20&height=20";

const { t } = useNav();
const { $storage } = useGlobal<GlobalPropertiesApi>();
const { storageConfigureChange } = useConfigureStorage();

const settings = reactive({
  stretch: $storage.configure.stretch
});

/** 页宽 */
const stretchTypeOptions = computed<Array<OptionsType>>(() => {
  return [
    {
      label: t("layout.fixed"),
      tip: t("layout.fixedTip"),
      value: "fixed"
    },
    {
      label: t("layout.customization"),
      tip: t("layout.customTip"),
      value: "custom"
    }
  ];
});

const setStretch = value => {
  settings.stretch = value;
  storageConfigureChange("stretch", value);
};

const stretchTypeChange = ({ option }) => {
  const { value } = option;
  value === "custom" ? setStretch(1440) : setStretch(false);
};
</script>

<template>
  <span v-if="useAppStoreHook().getViewportWidth > 1280">
    <p :class="['mt-5!', pClass]">{{ t("layout.pageWidth") }}</p>
    <Segmented
      :modelValue="isNumber(settings.stretch) ? 1 : 0"
      :options="stretchTypeOptions"
      class="mb-2 select-none"
      @change="stretchTypeChange"
    />
    <el-input-number
      v-if="isNumber(settings.stretch)"
      v-model="settings.stretch as number"
      :max="1600"
      :min="1280"
      controls-position="right"
      @change="value => setStretch(value)"
    />
    <button
      v-else
      v-ripple="{ class: 'text-gray-300' }"
      class="bg-transparent flex-c w-full h-20 rounded-md border border-(--pure-border-color)"
      @click="setStretch(!settings.stretch)"
    >
      <div
        :class="[settings.stretch ? 'w-[24%]' : 'w-[50%]']"
        class="flex-bc transition-all duration-300"
        style="color: var(--el-color-primary)"
      >
        <IconifyIconOffline :icon="settings.stretch ? RightArrow : LeftArrow" />
        <div
          class="grow border-0 border-b border-dashed"
          style="border-color: var(--el-color-primary)"
        />
        <IconifyIconOffline :icon="settings.stretch ? LeftArrow : RightArrow" />
      </div>
    </button>
  </span>
</template>
