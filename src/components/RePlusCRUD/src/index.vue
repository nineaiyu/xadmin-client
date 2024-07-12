<script lang="ts" setup>
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { PureTableBar } from "@/components/RePureTableBar";
import { PlusPageProps } from "./utils/types";
import { ref, shallowRef } from "vue";
import { cloneDeep, deviceDetection, getKeyList } from "@pureadmin/utils";
import { useBaseTable } from "./utils/hook";
import Delete from "@iconify-icons/ep/delete";
import AddFill from "@iconify-icons/ri/add-circle-line";
import Download from "@iconify-icons/ep/download";
import Upload from "@iconify-icons/ep/upload";
import PureTable from "@pureadmin/table";
import { PlusSearch } from "plus-pro-components";
import TableOperation, {
  OperationButtonsRow
} from "@/components/RePlusCRUD/src/components/tableOperation.vue";

const props = withDefaults(defineProps<PlusPageProps>(), {
  auth: () => ({
    list: false,
    batchDelete: false,
    create: false,
    delete: false,
    update: false,
    patch: false,
    export: false,
    import: false
  }),
  api: undefined,
  resultFormat: undefined,
  beforeSearchSubmit: undefined,
  addOrEditOptions: () => ({}),
  pagination: () => {
    return {
      total: 0,
      pageSize: 10,
      currentPage: 1,
      pageSizes: [5, 10, 20, 50, 100],
      background: true
    };
  },
  localeName: ""
});
defineOptions({ name: "RePlusCRUD" });
const emit = defineEmits<{
  (e: "searchComplete", ...args: any[]): void;
  (e: "selectionChange", ...args: any[]): void;
}>();

const tableRef = ref();

const {
  t,
  loading,
  dataList,
  pageTitle,
  pagination,
  listColumns,
  selectedNum,
  defaultValue,
  searchFields,
  searchColumns,
  operationButtons,
  exportData,
  importData,
  handleReset,
  handleSearch,
  getSelectPks,
  handleGetData,
  handleAddOrEdit,
  handleManyDelete,
  handleSizeChange,
  onSelectionCancel,
  handleCurrentChange,
  handleSelectionChange
} = useBaseTable(
  emit,
  tableRef,
  props.api,
  props.pagination,
  props.localeName,
  props.resultFormat,
  props.addOrEditOptions,
  props.beforeSearchSubmit
);

function getTableRef() {
  return tableRef.value;
}

defineExpose({
  handleGetData,
  getTableRef,
  getSelectPks,
  dataList,
  searchFields
});
</script>

<template>
  <div v-if="auth?.list" class="main">
    <div class="search-form bg-bg_color w-[99/100] pl-8 pr-8 pt-[12px]">
      <PlusSearch
        v-model="searchFields"
        :col-props="{
          xs: 24,
          sm: 12,
          md: 6,
          lg: 6,
          xl: 6
        }"
        :columns="searchColumns"
        :default-values="cloneDeep(defaultValue)"
        :row-props="{
          gutter: 24
        }"
        :search-loading="loading"
        :show-number="deviceDetection() ? 1 : 3"
        label-width="auto"
        @change="
          (_, column) => {
            const canChangeType = [
              'select',
              'date-picker',
              'time-picker',
              'time-select'
            ];
            canChangeType.indexOf(column.valueType) > -1 && handleSearch();
          }
        "
        @reset="handleReset"
        @search="handleSearch"
        @keyup.enter="handleSearch"
      />
    </div>
    <PureTableBar :columns="listColumns" @refresh="handleGetData">
      <template #title>
        <el-space>
          <p class="font-bold truncate">
            {{ pageTitle }}
          </p>
          <div
            v-if="selectedNum > 0"
            v-motion-fade
            class="bg-[var(--el-fill-color-light)] w-[160px] h-[46px] m-2 pl-4 flex items-center rounded-md"
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
        <el-space>
          <div v-if="selectedNum > 0" v-motion-fade>
            <el-popconfirm
              v-if="auth.batchDelete"
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
            v-if="auth.create"
            :icon="useRenderIcon(AddFill)"
            type="primary"
            @click="handleAddOrEdit(true, {})"
          >
            {{ t("buttons.add") }}
          </el-button>
          <el-tooltip
            v-if="auth.export"
            :content="t('exportImport.export')"
            effect="dark"
            placement="top-start"
          >
            <el-button
              :icon="useRenderIcon(Download)"
              plain
              type="primary"
              @click="exportData"
            />
          </el-tooltip>
          <el-tooltip
            v-if="auth.import"
            :content="t('exportImport.import')"
            effect="dark"
            placement="top-start"
          >
            <el-button
              :icon="useRenderIcon(Upload)"
              plain
              type="primary"
              @click="importData"
            />
          </el-tooltip>
          <slot name="barButtons" />
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
          default-expand-all
          row-key="pk"
          showOverflowTooltip
          table-layout="auto"
          @selection-change="handleSelectionChange"
          @page-size-change="handleSizeChange"
          @page-current-change="handleCurrentChange"
        >
          <template #operation="{ row }">
            <tableOperation
              :buttons="operationButtons"
              :row="row"
              :size="size"
            />
            <slot name="extOperation" v-bind="{ row, size }" />
          </template>
          <template
            v-for="item in getKeyList(listColumns, 'slot').filter(x => {
              return x !== 'operation';
            })"
            :key="item"
            #[item]="{ row }"
          >
            <slot :key="item" :name="item" v-bind="{ row }" />
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
