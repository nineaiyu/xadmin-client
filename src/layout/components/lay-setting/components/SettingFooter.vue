<script lang="ts" setup>
// 系统设置面板「布局」：页脚显示
import { computed, reactive } from "vue";
import { useGlobal } from "@pureadmin/utils";
import { useNav } from "@/layout/hooks/useNav";
import { useConfigureStorage } from "../hooks/useConfigureStorage";
import PrefBlock from "./PrefBlock.vue";
import PrefRow from "./PrefRow.vue";

/** 页脚高度范围（px）：0 = 自动（沿用内置留白） */
const FOOTER_HEIGHT_RANGE = { min: 0, max: 80, step: 2 } as const;

const { t } = useNav();
const { $storage } = useGlobal<GlobalPropertiesApi>();
const { storageConfigureChange } = useConfigureStorage();

const settings = reactive({
  hideFooter: $storage.configure.hideFooter ?? false
});

/** 隐藏页脚：实时生效（lay-content / layout 按同一存储项渲染） */
const hideFooterChange = () => {
  storageConfigureChange("hideFooter", settings.hideFooter);
};

/** 固定页脚：吸附在内容区底部（滚动时保持可见） */
const footerFixed = computed({
  get: () => $storage?.configure?.footerFixed ?? false,
  set: value => storageConfigureChange("footerFixed", value)
});

/** 页脚高度（px，0 = 自动） */
const footerHeight = computed<number>({
  get: () => Number($storage?.configure?.footerHeight ?? 0),
  set: value => {
    const height = Number(value);
    storageConfigureChange(
      "footerHeight",
      Number.isFinite(height) && height > 0 ? Math.round(height) : 0
    );
  }
});
</script>

<template>
  <PrefBlock :title="t('layout.footer')" list>
    <PrefRow :label="t('layout.hideFooter')">
      <template #control>
        <el-switch
          v-model="settings.hideFooter"
          :active-text="t('labels.active')"
          :inactive-text="t('labels.inactive')"
          inline-prompt
          @change="hideFooterChange"
        />
      </template>
    </PrefRow>
    <PrefRow :label="t('layout.footerFixed')" :tip="t('layout.footerFixedTip')">
      <template #control>
        <el-switch
          v-model="footerFixed"
          :active-text="t('labels.active')"
          :inactive-text="t('labels.inactive')"
          inline-prompt
        />
      </template>
    </PrefRow>
    <PrefRow
      :label="t('layout.footerHeight')"
      :tip="t('layout.footerHeightTip')"
    >
      <template #control>
        <el-input-number
          v-model="footerHeight"
          :min="FOOTER_HEIGHT_RANGE.min"
          :max="FOOTER_HEIGHT_RANGE.max"
          :step="FOOTER_HEIGHT_RANGE.step"
          size="small"
          controls-position="right"
          style="width: 108px"
        />
      </template>
    </PrefRow>
  </PrefBlock>
</template>
