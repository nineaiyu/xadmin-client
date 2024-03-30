<script lang="ts" setup>
import { ref } from "vue";
import { useRole } from "./utils/hook";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";

import Delete from "@iconify-icons/ep/delete";
import EditPen from "@iconify-icons/ep/edit-pen";
import AddFill from "@iconify-icons/ri/add-circle-line";
import { hasAuth } from "@/router/utils";
import { cloneDeep, deviceDetection } from "@pureadmin/utils";
import { plusPorChange } from "@/views/system/hooks";
import ReBaseTable from "@/components/ReBaseTable/index.vue";

defineOptions({
  name: "SystemRole"
});

const tableRef = ref();

const {
  t,
  api,
  auth,
  columns,
  editForm,
  searchForm,
  defaultValue,
  searchColumns,
  openDialog
} = useRole(tableRef);
</script>

<template>
  <ReBaseTable
    ref="tableRef"
    :api="api"
    :auth="auth"
    :edit-form="editForm"
    :search-columns="searchColumns"
    :search-form="searchForm"
    :table-columns="columns"
    :custom-add-or-edit="true"
    @open-dialog="openDialog"
  />
</template>
