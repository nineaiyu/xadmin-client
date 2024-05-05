<script lang="ts" setup>
import { ref } from "vue";
import { useNoticeRead } from "./hook";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import Eye from "@iconify-icons/ri/eye-fill";
import ReBaseTable from "@/components/ReBaseTable";

defineOptions({
  name: "SystemNoticeRead"
});

const tableRef = ref();

const { t, api, auth, columns, showDialog } = useNoticeRead(tableRef);
</script>

<template>
  <ReBaseTable
    ref="tableRef"
    :api="api"
    :auth="auth"
    :table-columns="columns"
    locale-name="noticeRead"
  >
    <template #extOperation="{ row, size }">
      <el-button
        v-if="auth.list"
        :icon="useRenderIcon(Eye)"
        :size="size"
        class="reset-margin"
        link
        type="primary"
        @click="showDialog(row.notice_info)"
      >
        {{ t("buttons.detail") }}
      </el-button>
    </template>
  </ReBaseTable>
</template>
