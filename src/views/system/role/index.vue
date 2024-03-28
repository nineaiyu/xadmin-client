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

defineOptions({
  name: "SystemRole"
});

const tableRef = ref();

const {
  t,
  form,
  loading,
  columns,
  dataList,
  pagination,
  selectedNum,
  searchColumns,
  onSearch,
  openDialog,
  handleDelete,
  handleManyDelete,
  handleSizeChange,
  onSelectionCancel,
  handleCurrentChange,
  handleSelectionChange
} = useRole(tableRef);

const defaultValue = cloneDeep(form.value);
</script>

<template>
  <div v-if="hasAuth('list:systemRole')" class="main">
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

    <PureTableBar
      :columns="columns"
      style="transition: width 220ms cubic-bezier(0.4, 0, 0.2, 1)"
      @refresh="onSearch(true)"
    >
      <template #title>
        <el-space>
          <p class="font-bold truncate">{{ t("menus.roleManagement") }}</p>
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
              v-if="hasAuth('manyDelete:systemRole')"
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
            v-if="hasAuth('create:systemRole')"
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
          :adaptiveConfig="{ offsetBottom: 108 }"
          :columns="dynamicColumns"
          :data="dataList"
          :header-cell-style="{
            background: 'var(--el-table-row-hover-bg-color)',
            color: 'var(--el-text-color-primary)'
          }"
          :loading="loading"
          :pagination="pagination"
          :paginationSmall="size === 'small'"
          :size="size"
          adaptive
          align-whole="center"
          row-key="pk"
          showOverflowTooltip
          table-layout="auto"
          @selection-change="handleSelectionChange"
          @page-size-change="handleSizeChange"
          @page-current-change="handleCurrentChange"
        >
          <template #operation="{ row }">
            <el-button
              v-if="hasAuth('update:systemRole')"
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
              v-if="hasAuth('delete:systemRole')"
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
          </template>
        </pure-table>
      </template>
    </PureTableBar>
  </div>
</template>

<style lang="scss" scoped>
:deep(.el-dropdown-menu__item i) {
  margin: 0;
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
