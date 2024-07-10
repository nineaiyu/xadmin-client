<script lang="ts" setup>
import RePlusCRUD from "@/components/RePlusCRUD";
import { reactive } from "vue";
import { hasAuth } from "@/router/utils";

import { BaseApi } from "@/api/base";

const bookApi = new BaseApi("/api/demo/book");
bookApi.update = bookApi.patch;

// 权限判断，用于判断是否有该权限
const auth = reactive({
  list: hasAuth("list:demoBook1"),
  create: hasAuth("create:demoBook1"),
  delete: hasAuth("delete:demoBook1"),
  update: hasAuth("update:demoBook1"),
  export: hasAuth("export:demoBook1"),
  import: hasAuth("import:demoBook1"),
  batchDelete: hasAuth("batchDelete:demoBook1")
});
</script>
<template>
  <RePlusCRUD :api="bookApi" :auth="auth" />
</template>
