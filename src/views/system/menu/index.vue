<script lang="ts" setup>
import { deviceDetection } from "@pureadmin/utils";
import { useMenu } from "./utils/hook";

import tree from "./components/MenuTree.vue";
import edit from "./components/MenuEdit.vue";
import { ReSplitPane } from "@/components/ReSplitPane";
import { useSplitPaneConfig } from "@/hooks/useSplitPaneConfig";

defineOptions({
  name: "SystemMenu"
});

const {
  auth,
  treeData,
  menuData,
  viewList,
  modelList,
  parentIds,
  choicesDict,
  menuUrlList,
  defaultData,
  exportData,
  importData,
  addNewMenu,
  handleDrag,
  openDialog,
  getMenuData,
  handleDelete,
  handleConfirm,
  handleManyDelete,
  handleAddPermissions
} = useMenu();

// 左栏宽度持久化（默认 54%，对应原 13/11 栅格比例；双击分隔条或点悬浮按钮重置）
const { percent, handleDragEnd } = useSplitPaneConfig("system/menu", {
  defaultPercent: 54,
  minPercent: 25
});
</script>

<template>
  <div class="menu-main">
    <!-- 桌面：可拖拽分栏（宽度比例持久化到 WEB_SITE_CONFIG.SplitPanes） -->
    <ReSplitPane
      v-if="!deviceDetection()"
      v-model:percent="percent"
      :split-set="{ minPercent: 25, defaultPercent: 54, split: 'vertical' }"
      @drag-end="handleDragEnd"
    >
      <template #paneL>
        <tree
          v-if="auth.list"
          v-model:form-inline="menuData"
          v-model:parent-ids="parentIds"
          :auth="auth"
          :default-data="defaultData"
          :tree-data="treeData"
          @addNewMenu="addNewMenu"
          @exportData="exportData"
          @getMenuData="getMenuData"
          @handleDelete="handleDelete"
          @handleDrag="handleDrag"
          @handleManyDelete="handleManyDelete"
          @handleAddPermissions="handleAddPermissions"
          @importData="importData"
          @openDialog="openDialog"
        />
      </template>
      <template #paneR>
        <div :style="{ height: `calc(100vh - 145px)` }" class="overflow-y-auto">
          <edit
            v-if="auth.list"
            :auth="auth"
            :form-inline="menuData"
            :menu-choices="choicesDict['menu_type']"
            :menu-url-list="menuUrlList"
            :method-choices="choicesDict['method']"
            :model-list="modelList"
            :view-list="viewList"
            :tree-data="treeData"
            class="pt-10 pb-20"
            @handleConfirm="handleConfirm"
          />
        </div>
      </template>
    </ReSplitPane>
    <!-- 移动端：保留栅格上下堆叠 -->
    <el-row v-else :gutter="24">
      <el-col :sm="24" :xs="24">
        <tree
          v-if="auth.list"
          v-model:form-inline="menuData"
          v-model:parent-ids="parentIds"
          :auth="auth"
          :default-data="defaultData"
          :tree-data="treeData"
          @addNewMenu="addNewMenu"
          @exportData="exportData"
          @getMenuData="getMenuData"
          @handleDelete="handleDelete"
          @handleDrag="handleDrag"
          @handleManyDelete="handleManyDelete"
          @handleAddPermissions="handleAddPermissions"
          @importData="importData"
          @openDialog="openDialog"
        />
      </el-col>
      <el-col :sm="24" :xs="24">
        <div :style="{ height: `calc(100vh - 145px)` }" class="overflow-y-auto">
          <edit
            v-if="auth.list"
            :auth="auth"
            :form-inline="menuData"
            :menu-choices="choicesDict['menu_type']"
            :menu-url-list="menuUrlList"
            :method-choices="choicesDict['method']"
            :model-list="modelList"
            :view-list="viewList"
            :tree-data="treeData"
            class="pt-10 pb-20"
            @handleConfirm="handleConfirm"
          />
        </div>
      </el-col>
    </el-row>
  </div>
</template>
<style lang="scss" scoped>
.main-content {
  --main-content-margin: 24px 24px 0;
}
</style>
