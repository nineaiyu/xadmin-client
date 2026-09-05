<script lang="ts" setup>
// 系统设置面板：页签风格（智能/卡片/谷歌）设置区块
import { computed, ref } from "vue";
import { useGlobal } from "@pureadmin/utils";
import Segmented, { type OptionsType } from "@/components/ReSegmented";
import { emitter } from "@/utils/mitt";
import { useNav } from "@/layout/hooks/useNav";
import { useConfigureStorage } from "../hooks/useConfigureStorage";
import { pClass } from "../hooks/useSectionClass";

const { t } = useNav();
const { $storage } = useGlobal<GlobalPropertiesApi>();
const { storageConfigureChange } = useConfigureStorage();

/** 页签风格默认为谷歌风格 */
const tagsStyleValue = ref($storage.configure?.tagsStyle ?? "chrome");

const markOptions = computed<Array<OptionsType>>(() => {
  return [
    {
      label: t("layout.tagsStyleSmart"),
      tip: t("layout.tagsStyleSmartTip"),
      value: "smart"
    },
    {
      label: t("layout.tagsStyleCard"),
      tip: t("layout.tagsStyleCardTip"),
      value: "card"
    },
    {
      label: t("layout.tagsStyleChrome"),
      tip: t("layout.tagsStyleChromeTip"),
      value: "chrome"
    }
  ];
});

function onChange({ option }) {
  const { value } = option;
  tagsStyleValue.value = value;
  storageConfigureChange("tagsStyle", value);
  emitter.emit("tagViewsTagsStyle", value);
}
</script>

<template>
  <p :class="['mt-4!', pClass]">{{ t("layout.labelStyle") }}</p>
  <Segmented
    :modelValue="
      tagsStyleValue === 'smart' ? 0 : tagsStyleValue === 'card' ? 1 : 2
    "
    :options="markOptions"
    class="select-none"
    @change="onChange"
  />
</template>
