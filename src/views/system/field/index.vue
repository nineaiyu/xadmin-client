<script lang="ts" setup>
import { ref } from "vue";
import { useModelField } from "./utils/hook";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { hasAuth } from "@/router/utils";
import { cloneDeep, deviceDetection } from "@pureadmin/utils";
import { plusPorChange } from "@/views/system/hooks";

defineOptions({
  name: "SystemModelLabelField"
});

const tableRef = ref();

const {
  t,
  form,
  loading,
  columns,
  dataList,
  pagination,
  searchColumns,
  onSearch,
  handleSync,
  handleSizeChange,
  handleCurrentChange
} = useModelField();

const defaultValue = cloneDeep(form.value);
</script>

<template>
  <div v-if="hasAuth('list:systemModelField')" class="main">
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
      :title="t('menus.modelFieldManagement')"
      @refresh="onSearch(true)"
    >
      <template #buttons>
        <el-space wrap>
          <el-button
            v-if="hasAuth('sync:systemModelField')"
            :icon="useRenderIcon('ep:money')"
            type="primary"
            @click="handleSync"
          >
            {{ t("modelFieldManagement.makeData") }}
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
          @page-size-change="handleSizeChange"
          @page-current-change="handleCurrentChange"
        />
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
