<script lang="ts" setup>
import { ref } from "vue";
import { useLoginLog } from "./utils/hook";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import Delete from "@iconify-icons/ep/delete";
import { hasAuth } from "@/router/utils";
import { cloneDeep, deviceDetection } from "@pureadmin/utils";
import { plusPorChange } from "@/views/system/hooks";

defineOptions({
  name: "SystemUserLoginLog"
});

const tableRef = ref();

const {
  t,
  form,
  loading,
  columns,
  dataList,
  pagination,
  choicesDict,
  selectedNum,
  searchColumns,
  onSearch,
  handleDelete,
  handleManyDelete,
  handleSizeChange,
  onSelectionCancel,
  handleCurrentChange,
  handleSelectionChange
} = useLoginLog(tableRef);

const defaultValue = cloneDeep(form.value);
</script>

<template>
  <div v-if="hasAuth('list:systemLoginLog')" class="main">
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
    <PureTableBar :columns="columns" @refresh="onSearch(true)">
      <template #title>
        <el-space>
          <p class="font-bold truncate">{{ t("menus.loginLogManagement") }}</p>
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
              v-if="hasAuth('manyDelete:systemLoginLog')"
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
            <el-popconfirm
              v-if="hasAuth('delete:systemLoginLog')"
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
.main-content {
  margin: 24px 24px 0 !important;
}

.search-form {
  :deep(.el-form-item) {
    margin-bottom: 12px;
  }
}
</style>
