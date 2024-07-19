<script lang="ts" setup>
import RePlusCRUD from "@/components/RePlusCRUD";
import { reactive } from "vue";
import { hasAuth } from "@/router/utils";

import { BaseApi } from "@/api/base";

const bookApi = new BaseApi("/api/demo/book");
bookApi.update = bookApi.patch;

// 权限判断，用于判断是否有该权限
const auth = reactive({
  list: hasAuth("list:demoBook"),
  create: hasAuth("create:demoBook"),
  delete: hasAuth("delete:demoBook"),
  update: hasAuth("update:demoBook"),
  export: hasAuth("export:demoBook"),
  import: hasAuth("import:demoBook"),
  batchDelete: hasAuth("batchDelete:demoBook")
});
</script>
<template>
  <RePlusCRUD :api="bookApi" :auth="auth" />
</template>
