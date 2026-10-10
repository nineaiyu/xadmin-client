<script lang="ts" setup>
// 系统设置面板「布局」：页脚显示
import { reactive } from "vue";
import { useGlobal } from "@pureadmin/utils";
import { useNav } from "@/layout/hooks/useNav";
import { useConfigureStorage } from "../hooks/useConfigureStorage";
import PrefBlock from "./PrefBlock.vue";
import PrefRow from "./PrefRow.vue";

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
  </PrefBlock>
</template>
