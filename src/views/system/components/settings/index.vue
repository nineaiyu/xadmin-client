<script lang="ts" setup>
import { settingItemProps } from "./types";
import SettingItem from "./settingItem.vue";
import { useI18n } from "vue-i18n";

defineOptions({
  name: "Setting"
});

const settingData = defineModel<Array<settingItemProps>>();
const { t } = useI18n();
</script>

<template>
  <el-tabs type="border-card">
    <el-tab-pane
      v-for="(item, index) in settingData"
      :key="index"
      :label="item.label ?? t(`${item.localeName}.${item.title ?? 'title'}`)"
      :lazy="true"
    >
      <setting-item v-bind="item" />
    </el-tab-pane>
  </el-tabs>
</template>
