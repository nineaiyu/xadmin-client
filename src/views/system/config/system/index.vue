<script lang="ts" setup>
import { ref } from "vue";
import { useSystemConfig } from "./utils/hook";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import CircleClose from "@iconify-icons/ep/circle-close";
import ReBaseTable from "@/components/ReBaseTable/index.vue";

defineOptions({
  name: "SystemConfig"
});

const tableRef = ref();

const {
  t,
  api,
  auth,
  columns,
  editForm,
  searchField,
  defaultValue,
  searchColumns,
  handleInvalidCache
} = useSystemConfig(tableRef);
</script>

<template>
  <ReBaseTable
    ref="tableRef"
    :api="api"
    :auth="auth"
    :edit-form="editForm"
    :search-columns="searchColumns"
    :search-field="searchField"
    :table-columns="columns"
  >
    <template #extOperation="{ row, size }">
      <el-popconfirm
        v-if="auth.invalid"
        :title="t('configUser.confirmInvalid')"
        @confirm="handleInvalidCache(row)"
      >
        <template #reference>
          <el-button
            :icon="useRenderIcon(CircleClose)"
            :size="size"
            class="reset-margin"
            link
            type="primary"
          >
            {{ t("configSystem.invalidCache") }}
          </el-button>
        </template>
      </el-popconfirm>
    </template>
  </ReBaseTable>
</template>
