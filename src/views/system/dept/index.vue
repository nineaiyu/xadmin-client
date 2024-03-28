<script lang="ts" setup>
import { ref } from "vue";
import { useDept } from "./utils/hook";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";

import More from "@iconify-icons/ep/more-filled";
import Delete from "@iconify-icons/ep/delete";
import Role from "@iconify-icons/ri/admin-line";
import EditPen from "@iconify-icons/ep/edit-pen";
import AddFill from "@iconify-icons/ri/add-circle-line";
import { hasAuth } from "@/router/utils";
import { getIndexType } from "@/utils";
import { cloneDeep, deviceDetection } from "@pureadmin/utils";
import { plusPorChange } from "@/views/system/hooks";

defineOptions({
  name: "SystemDept"
});

const tableRef = ref();

const {
  t,
  form,
  loading,
  columns,
  dataList,
  buttonClass,
  choicesDict,
  selectedNum,
  searchColumns,
  onSearch,
  openDialog,
  handleRole,
  handleDelete,
  handleManyDelete,
  onSelectionCancel,
  handleSelectionChange
} = useDept(tableRef);

const defaultValue = cloneDeep(form.value);
</script>

<template>
  <div v-if="hasAuth('list:systemDept')" class="main">
    <div class="search-form bg-bg_color w-[99/100] pl-8 pr-8 pt-[12px]">
      <PlusSearch
        v-model="form"
        :col-props="{
          xs: 24,
          sm: 12,
          md: 6,
          lg: 6,
          xl: 6
        }"
        :columns="searchColumns"
        :default-values="defaultValue"
        :row-props="{
          gutter: 24
        }"
        :search-loading="loading"
        :show-number="deviceDetection() ? 1 : 3"
        label-width="auto"
        @change="
          (values: any, column) => {
            plusPorChange(column, onSearch, true);
          }
        "
        @reset="onSearch"
        @search="onSearch"
        @keyup.enter="onSearch"
      />
    </div>
    <PureTableBar :columns="columns" @refresh="onSearch">
      <template #title>
        <el-space>
          <p class="font-bold truncate">{{ t("menus.deptManagement") }}</p>
          <div
            v-if="selectedNum > 0"
            v-motion-fade
            class="bg-[var(--el-fill-color-light)] w-full h-[46px] m-2 pl-4 flex items-center rounded-md"
          >
            <span
              class="text-[rgba(42,46,54,0.5)] dark:text-[rgba(220,220,242,0.5)]"
              style="font-size: var(--el-font-size-base)"
            >
              {{ t("buttons.selected", { count: selectedNum }) }}
            </span>
            <el-button text type="primary" @click="onSelectionCancel">
              {{ t("buttons.cancel") }}
            </el-button>
          </div>
        </el-space>
      </template>
      <template #buttons>
        <el-space wrap>
          <div v-if="selectedNum > 0" v-motion-fade>
            <el-popconfirm
              v-if="hasAuth('manyDelete:systemDept')"
              :title="t('buttons.batchDeleteConfirm', { count: selectedNum })"
              @confirm="handleManyDelete"
            >
              <template #reference>
                <el-button :icon="useRenderIcon(Delete)" plain type="danger">
                  {{ t("buttons.batchDelete") }}
                </el-button>
              </template>
            </el-popconfirm>
          </div>
          <el-button
            v-if="hasAuth('create:systemDept')"
            :icon="useRenderIcon(AddFill)"
            type="primary"
            @click="openDialog()"
          >
            {{ t("buttons.add") }}
          </el-button>
        </el-space>
      </template>
      <template v-slot="{ size, dynamicColumns }">
        <pure-table
          ref="tableRef"
          :adaptiveConfig="{ offsetBottom: 45 }"
          :columns="dynamicColumns"
          :data="dataList"
          :header-cell-style="{
            background: 'var(--el-table-row-hover-bg-color)',
            color: 'var(--el-text-color-primary)'
          }"
          :loading="loading"
          :size="size"
          adaptive
          align-whole="center"
          default-expand-all
          row-key="pk"
          showOverflowTooltip
          table-layout="auto"
          @selection-change="handleSelectionChange"
        >
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
          <template #operation="{ row }">
            <el-button
              v-if="hasAuth('update:systemDept')"
              :icon="useRenderIcon(EditPen)"
              :size="size"
              class="reset-margin"
              link
              type="primary"
              @click="openDialog(false, row)"
            >
              {{ t("buttons.edit") }}
            </el-button>
            <el-popconfirm
              v-if="hasAuth('delete:systemDept')"
              :title="t('buttons.confirmDelete')"
              @confirm="handleDelete(row)"
            >
              <template #reference>
                <el-button
                  :icon="useRenderIcon(Delete)"
                  :size="size"
                  class="reset-margin"
                  link
                  type="danger"
                >
                  {{ t("buttons.delete") }}
                </el-button>
              </template>
            </el-popconfirm>

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
                  <el-dropdown-item v-if="hasAuth('empower:systemDeptRole')">
                    <el-button
                      :class="buttonClass"
                      :icon="useRenderIcon(Role)"
                      :size="size"
                      link
                      type="primary"
                      @click="handleRole(row)"
                    >
                      {{ t("dept.assignRoles") }}
                    </el-button>
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </pure-table>
      </template>
    </PureTableBar>
  </div>
</template>
<style lang="scss" scoped>
:deep(.el-table__inner-wrapper::before) {
  height: 0;
}

.main-content {
  margin: 24px 24px 0 !important;
}

.search-form {
  :deep(.el-form-item) {
    margin-bottom: 12px;
  }
}
</style>
