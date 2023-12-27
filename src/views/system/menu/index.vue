<script setup lang="ts">
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
      <el-col :xs="24" :sm="24" :md="13" :lg="13" :xl="13">
        <tree
          v-if="hasAuth('list:systemMenu')"
          v-model:form-inline="menuData"
          v-model:parent-ids="parentIds"
          :tree-data="treeData"
          :default-data="defaultData"
          @getMenuData="getMenuData"
          @openDialog="openDialog"
          @handleDelete="handleDelete"
          @addNewMenu="addNewMenu"
          @handleDrag="handleDrag"
          @handleManyDelete="handleManyDelete"
        />
      </el-col>
      <el-col :xs="24" :sm="24" :md="11" :lg="11" :xl="11">
        <div class="overflow-y-auto" :style="{ height: `calc(100vh - 130px)` }">
          <edit
            v-if="hasAuth('list:systemMenu')"
            class="pt-10 pb-20"
            :form-inline="menuData"
            :choices-dict="choicesDict"
            :menu-choices="menuChoices"
            :tree-data="treeData"
            :menu-url-list="menuUrlList"
            @handleConfirm="handleConfirm"
          />
        </div>
      </el-col>
    </el-row>
  </div>
</template>
