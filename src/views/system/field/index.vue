<script lang="ts" setup>
import { useModelField } from "./utils/hook";
import ReBaseTable from "@/components/ReBaseTable/index.vue";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { ref } from "vue";

defineOptions({
  name: "SystemModelLabelField"
});
const tableRef = ref();

const {
  t,
  api,
  auth,
  columns,
  searchField,
  defaultValue,
  searchColumns,
  handleSync
} = useModelField(tableRef);
</script>

<template>
  <ReBaseTable
    ref="tableRef"
    :api="api"
    :auth="auth"
    :search-columns="searchColumns"
    :search-field="searchField"
    :table-columns="columns"
  >
    <template #barButtons>
      <el-button
        v-if="auth.sync"
        :icon="useRenderIcon('ep:money')"
        type="primary"
        @click="handleSync"
      >
        {{ t("modelFieldManagement.makeData") }}
      </el-button>
    </template>
  </ReBaseTable>
</template>
