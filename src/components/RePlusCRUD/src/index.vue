<script lang="ts" setup>
import { ref } from "vue";
import PureTable from "@pureadmin/table";
import { usePlusCRUDPage } from "./utils/hook";
import { RePlusPageProps } from "./utils/types";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { cloneDeep, deviceDetection, getKeyList } from "@pureadmin/utils";
import Delete from "@iconify-icons/ep/delete";
import { PlusSearch } from "plus-pro-components";
import ButtonOperation, {
  ButtonsCallBackParams
} from "./components/ButtonOperation";

const props = withDefaults(defineProps<RePlusPageProps>(), {
  api: undefined,
  title: "",
  isTree: false,
  tableBar: true,
  localeName: "",
  selection: true,
  immediate: true,
  operation: true,
  searchResultFormat: undefined,
  listColumnsFormat: undefined,
  detailColumnsFormat: undefined,
  baseColumnsFormat: undefined,
  searchColumnsFormat: undefined,
  beforeSearchSubmit: undefined,
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
  addOrEditOptions: () => ({}),
  pagination: () => ({}),
  pureTableProps: () => ({}),
  plusSearchProps: () => ({}),
  plusDescriptionsProps: () => ({}),
  operationButtonsProps: () => ({}),
  tableBarButtonsProps: () => ({})
});
defineOptions({ name: "RePlusCRUD" });
const emit = defineEmits<{
  (e: "searchComplete", ...args: any[]): void;
  (e: "selectionChange", ...args: any[]): void;
  (e: "tableBarClickAction", data: ButtonsCallBackParams): void;
  (e: "operationClickAction", data: ButtonsCallBackParams): void;
}>();

const tableRef = ref();

const {
  t,
  dataList,
  pageTitle,
  treeProps,
  listColumns,
  selectedNum,
  defaultValue,
  tableBarData,
  searchFields,
  searchColumns,
  loadingStatus,
  tablePagination,
  tableBarButtons,
  operationButtons,
  handleReset,
  handleSearch,
  getSelectPks,
  getPageColumn,
  handleGetData,
  handleAddOrEdit,
  handleManyDelete,
  handleSizeChange,
  handleFullscreen,
  onSelectionCancel,
  handleCurrentChange,
  handleTableBarChange,
  handleSelectionChange
} = usePlusCRUDPage(emit, tableRef, props);

function getTableRef() {
  return tableRef.value;
}

defineExpose({
  dataList,
  searchFields,
  getTableRef,
  getSelectPks,
  getPageColumn,
  handleGetData,
  handleAddOrEdit
});
</script>

<template>
  <div v-if="auth?.list" class="main">
    <div
      v-if="api?.fields"
      class="bg-bg_color w-[99/100] pl-8 pr-8 pt-[12px] search-form"
    >
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
        :search-loading="loadingStatus"
        :show-number="deviceDetection() ? 1 : 3"
        :needValidate="true"
        label-width="auto"
        v-bind="plusSearchProps"
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
    <div :class="tableBarData.renderClass">
      <PureTableBar
        v-if="tableBar"
        :columns="listColumns"
        @refresh="handleGetData"
        @change="handleTableBarChange"
        @fullscreen="handleFullscreen"
      >
        <template #title>
          <el-space>
            <p class="font-bold truncate">
              {{ title ?? pageTitle }}
            </p>
            <div
              v-if="selectedNum > 0"
              v-motion-fade
              class="bg-[var(--el-fill-color-light)] w-[160px] h-[46px] m-2 pl-4 flex items-center rounded-md"
            >
              <span
                class="text-[rgba(42,46,54,0.5)] dark:text-[rgba(220,220,242,0.5)]"
                style="font-size: 14px"
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
            <button-operation
              :show-number="99"
              v-bind="tableBarButtonsProps"
              :buttons="tableBarButtons"
              @clickAction="
                data => {
                  emit('tableBarClickAction', data);
                }
              "
            />
            <slot name="barButtons" />
          </el-space>
        </template>
      </PureTableBar>
      <pure-table
        ref="tableRef"
        :adaptiveConfig="{ offsetBottom: 110 }"
        :columns="tableBarData.dynamicColumns"
        :data="dataList"
        :header-cell-style="{
          background: 'var(--el-table-row-hover-bg-color)',
          color: 'var(--el-text-color-primary)'
        }"
        :loading="loadingStatus"
        :pagination="tablePagination"
        :size="tableBarData.size as any"
        :tree-props="treeProps as any"
        adaptive
        align-whole="center"
        default-expand-all
        row-key="pk"
        showOverflowTooltip
        table-layout="auto"
        v-bind="pureTableProps"
        @selection-change="handleSelectionChange"
        @page-size-change="handleSizeChange"
        @page-current-change="handleCurrentChange"
      >
        <template #operation="{ row }">
          <button-operation
            :row="row"
            :size="tableBarData.size as any"
            v-bind="operationButtonsProps"
            :buttons="operationButtons"
            @clickAction="
              data => {
                emit('operationClickAction', data);
              }
            "
          />
          <slot name="extOperation" v-bind="{ row, size: tableBarData.size }" />
        </template>
        <template
          v-for="item in getKeyList(listColumns, 'slot').filter(x => {
            return x !== 'operation';
          })"
          :key="item"
          #[item]="{ row, size }"
        >
          <slot :key="item" :name="item" v-bind="{ row, size }" />
        </template>
      </pure-table>
    </div>
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
