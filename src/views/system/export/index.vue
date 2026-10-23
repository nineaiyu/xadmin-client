<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { hasAuth } from "@/router/utils";
import { resolveInitialPane, syncTabQuery } from "@/utils/tabQuery";
import ExportPanel from "./components/ExportPanel.vue";
import ImportPanel from "./components/ImportPanel.vue";

defineOptions({
  name: "SystemExportRecord" // 必须定义，用于菜单自动匹配组件
});
const { t } = useI18n();
const route = useRoute();
// 导入记录页签按权限显隐（权限码挂在下载中心菜单下）
const showImportTab = hasAuth("list:SystemImportRecord");
const tabs = computed(() => [
  { key: "export", auth: true },
  { key: "import", auth: showImportTab }
]);
// 页签写入 URL（history.replaceState，不触发路由取消在途请求）
const activeTab = ref(
  resolveInitialPane(tabs.value, route.query.tab, "export")
);
watch(activeTab, key => syncTabQuery(key));
</script>
<template>
  <el-tabs v-model="activeTab">
    <el-tab-pane :label="t('menus.exportRecord')" name="export">
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
