<script lang="ts" setup>
import { ref } from "vue";
import { useUserNotice } from "./utils/hook";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import Success from "@iconify-icons/ep/success-filled";
import Eye from "@iconify-icons/ri/eye-fill";
import ReBaseTable from "@/components/ReBaseTable";

defineOptions({
  name: "UserNotice"
});

const tableRef = ref();

const {
  t,
  api,
  auth,
  columns,
  unreadCount,
  selectedNum,
  searchEnd,
  showDialog,
  handleReadAll,
  handleManyRead,
  selectionChange
} = useUserNotice(tableRef);
</script>
<template>
  <ReBaseTable
    ref="tableRef"
    :api="api"
    :auth="auth"
    locale-name="userNotice"
    :table-columns="columns"
    @searchEnd="searchEnd"
    @selection-change="selectionChange"
  >
    <template #barButtons>
      <el-popconfirm
        v-if="auth.batchRead && selectedNum"
        :title="t('buttons.batchDeleteConfirm', { count: selectedNum })"
        @confirm="handleManyRead"
      >
        <template #reference>
          <el-button :icon="useRenderIcon(Success)" plain type="success">
            {{ t("userNotice.batchRead") }}
          </el-button>
        </template>
      </el-popconfirm>
      <el-button
        v-if="auth.allRead && unreadCount > 0"
        class="mr-2"
        type="primary"
        @click="handleReadAll"
      >
        {{ t("userNotice.allRead") }}
      </el-button>
      <el-text v-if="unreadCount > 0" type="primary">
        {{ t("userNotice.unreadMessage") }} {{ unreadCount }}
      </el-text>
    </template>
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
