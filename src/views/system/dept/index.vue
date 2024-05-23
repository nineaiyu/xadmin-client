<script lang="ts" setup>
import { ref } from "vue";
import { useDept } from "./utils/hook";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";

import More from "@iconify-icons/ep/more-filled";
import Role from "@iconify-icons/ri/admin-line";
import { getIndexType } from "@/utils";
import ReBaseTable from "@/components/ReBaseTable";

defineOptions({
  name: "SystemDept"
});

const tableRef = ref();

const {
  t,
  api,
  auth,
  columns,
  editForm,
  pagination,
  buttonClass,
  handleRole,
  formatResult
} = useDept(tableRef);
</script>

<template>
  <ReBaseTable
    ref="tableRef"
    :api="api"
    :auth="auth"
    :edit-form="editForm"
    :result-format="formatResult"
    :table-columns="columns"
    :pagination="pagination"
    locale-name="systemDept"
  >
    <template #extOperation="{ row, size }">
      <el-dropdown>
        <el-button
          :icon="useRenderIcon(More)"
          :size="size"
          class="ml-3 mt-[2px]"
          link
          type="primary"
        />
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item v-if="auth.empower">
              <el-button
                :class="buttonClass"
                :icon="useRenderIcon(Role)"
                :size="size"
                link
                type="primary"
                @click="handleRole(row)"
              >
                {{ t("systemDept.assignRoles") }}
              </el-button>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </template>
    <template #roles="{ row }">
      <el-space>
        <el-text
          v-for="(role, index) in row.roles_info"
          :key="role.pk"
          :type="getIndexType(index + 1)"
        >
          {{ role.name }}
        </el-text>
      </el-space>
    </template>
    <template #rules="{ row }">
      <el-space>
        <el-text
          v-for="(role, index) in row.rules_info"
          :key="role.pk"
          :type="getIndexType(index + 1)"
        >
          {{ role.name }}
        </el-text>
      </el-space>
    </template>
  </ReBaseTable>
</template>
