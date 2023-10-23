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
          class="pb-20"
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
          v-if="hasAuth('list:systemMenu')"
        />
      </el-col>
      <el-col :xs="24" :sm="24" :md="11" :lg="11" :xl="11">
        <el-affix :offset="85">
          <edit
            class="pb-20"
            :form-inline="menuData"
            :choices-dict="choicesDict"
            :tree-data="treeData"
            :menu-url-list="menuUrlList"
            @handleConfirm="handleConfirm"
            v-if="hasAuth('list:systemMenu')"
          />
        </el-affix>
      </el-col>
    </el-row>
  </div>
</template>
