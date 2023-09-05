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
    <tree
      :form-inline="menuData"
      class="w-[48%] float-left"
      v-if="hasAuth('list:systemMenu')"
    />
    <el-affix :offset="90">
      <edit
        :form-inline="menuData"
        class="w-[51%] float-right"
        v-if="hasAuth('list:systemMenu')"
      />
    </el-affix>
  </div>
</template>
