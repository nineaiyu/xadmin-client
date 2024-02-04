<script lang="ts" setup>
import { useMenu } from "./utils/hook";

import tree from "./tree.vue";
import edit from "./edit.vue";
import { hasAuth } from "@/router/utils";

defineOptions({
  name: "SystemMenu"
});

const {
  menuData,
  treeData,
  parentIds,
  choicesDict,
  menuChoices,
  menuUrlList,
  modelList,
  defaultData,
  openDialog,
  addNewMenu,
  handleDrag,
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
          v-if="hasAuth('list:systemMenu')"
          v-model:form-inline="menuData"
          v-model:parent-ids="parentIds"
          :default-data="defaultData"
          :tree-data="treeData"
          @addNewMenu="addNewMenu"
          @getMenuData="getMenuData"
          @handleDelete="handleDelete"
          @handleDrag="handleDrag"
          @handleManyDelete="handleManyDelete"
          @openDialog="openDialog"
        />
      </el-col>
      <el-col :lg="11" :md="11" :sm="24" :xl="11" :xs="24">
        <div :style="{ height: `calc(100vh - 130px)` }" class="overflow-y-auto">
          <edit
            v-if="hasAuth('list:systemMenu')"
            :choices-dict="choicesDict"
            :form-inline="menuData"
            :menu-choices="menuChoices"
            :menu-url-list="menuUrlList"
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
