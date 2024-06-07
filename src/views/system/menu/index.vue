<script lang="ts" setup>
import { useMenu } from "./utils/hook";

import tree from "./tree.vue";
import edit from "./edit.vue";

defineOptions({
  name: "SystemMenu"
});

const {
  auth,
  treeData,
  menuData,
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
  handleManyDelete
} = useMenu();
</script>

<template>
  <div class="menu-main">
    <el-row :gutter="24">
      <el-col :lg="13" :md="13" :sm="24" :xl="13" :xs="24">
        <tree
          v-if="auth.list"
          v-model:form-inline="menuData"
          v-model:parent-ids="parentIds"
          :auth="auth"
          :default-data="defaultData"
          :tree-data="treeData"
          @addNewMenu="addNewMenu"
          @getMenuData="getMenuData"
          @handleDelete="handleDelete"
          @handleDrag="handleDrag"
          @exportData="exportData"
          @importData="importData"
          @handleManyDelete="handleManyDelete"
          @openDialog="openDialog"
        />
      </el-col>
      <el-col :lg="11" :md="11" :sm="24" :xl="11" :xs="24">
        <div :style="{ height: `calc(100vh - 145px)` }" class="overflow-y-auto">
          <edit
            v-if="auth.list"
            :auth="auth"
            :form-inline="menuData"
            :menu-choices="choicesDict['menu_type']"
            :menu-url-list="menuUrlList"
            :method-choices="choicesDict['method']"
            :model-list="modelList"
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
  margin: 24px 24px 0 !important;
}
</style>
