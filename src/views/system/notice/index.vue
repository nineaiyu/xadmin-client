<script lang="ts" setup>
import { ref } from "vue";
import { useNotice } from "./utils/hook";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import Eye from "@iconify-icons/ri/eye-fill";
import ReBaseTable from "@/components/ReBaseTable";

defineOptions({
  name: "SystemNotice"
});

const tableRef = ref();

const { t, api, auth, columns, editForm, showDialog, searchEnd } =
  useNotice(tableRef);
</script>
<template>
  <ReBaseTable
    ref="tableRef"
    :api="api"
    :auth="auth"
    :edit-form="editForm"
    :table-columns="columns"
    locale-name="systemNotice"
    @searchEnd="searchEnd"
  >
    <template #extOperation="{ row, size }">
      <el-button
        v-if="auth.list"
        :icon="useRenderIcon(Eye)"
        :size="size"
        class="reset-margin"
        link
        type="primary"
        @click="showDialog(row)"
      >
        {{ t("buttons.detail") }}
      </el-button>
    </template>
  </ReBaseTable>
</template>
