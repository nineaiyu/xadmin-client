<script setup lang="ts">
import { useMenu } from "./utils/hook";

import tree from "./tree.vue";
import edit from "./edit.vue";
import { hasAuth } from "@/router/utils";

defineOptions({
  name: "SystemMenu"
});

const { menuData } = useMenu();
</script>

<template>
  <div class="menu-main">
    <el-row :gutter="24">
      <el-col :xs="24" :sm="24" :md="13" :lg="13" :xl="13">
        <tree :form-inline="menuData" v-if="hasAuth('list:systemMenu')" />
      </el-col>
      <el-col :xs="24" :sm="24" :md="11" :lg="11" :xl="11">
        <el-affix :offset="85">
          <edit :form-inline="menuData" v-if="hasAuth('list:systemMenu')" />
        </el-affix>
      </el-col>
    </el-row>
  </div>
</template>
