<script lang="ts" setup>
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import ExportPanel from "./components/ExportPanel.vue";
import ImportPanel from "./components/ImportPanel.vue";

defineOptions({
  name: "SystemExportRecord" // 必须定义，用于菜单自动匹配组件
});
const { t } = useI18n();
const activeTab = ref("export");
// 导入记录页签按权限显隐（权限码挂在下载中心菜单下）
const showImportTab = hasAuth("list:SystemImportRecord");
</script>
<template>
  <el-tabs v-model="activeTab" class="mx-3">
    <el-tab-pane :label="t('menus.exportCenter')" name="export">
      <ExportPanel />
    </el-tab-pane>
    <el-tab-pane
      v-if="showImportTab"
      :label="t('menus.importCenter')"
      name="import"
      lazy
    >
      <ImportPanel />
    </el-tab-pane>
  </el-tabs>
</template>
