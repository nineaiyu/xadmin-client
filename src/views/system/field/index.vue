<script lang="ts" setup>
import { ref } from "vue";
import { useModelField } from "./utils/hook";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";

import Refresh from "@iconify-icons/ep/refresh";
import { hasAuth } from "@/router/utils";

defineOptions({
  name: "SystemModelLabelField"
});

const formRef = ref();
const tableRef = ref();

const {
  t,
  form,
  loading,
  columns,
  dataList,
  pagination,
  sortOptions,
  onSearch,
  resetForm,
  handleSync,
  handleSizeChange,
  handleCurrentChange
} = useModelField();
</script>

<template>
  <div v-if="hasAuth('list:systemModelField')" class="main">
    <el-form
      ref="formRef"
      :inline="true"
      :model="form"
      class="search-form bg-bg_color w-[99/100] pl-8 pt-[12px] overflow-auto"
    >
      <el-form-item :label="t('modelField.name')" prop="name">
        <el-input
          v-model="form.name"
          :placeholder="t('modelField.name')"
          class="!w-[200px]"
          clearable
          @keyup.enter="onSearch(true)"
        />
      </el-form-item>
      <el-form-item :label="t('modelField.label')" prop="label">
        <el-input
          v-model="form.label"
          :placeholder="t('modelField.label')"
          class="!w-[180px]"
          clearable
          @keyup.enter="onSearch(true)"
        />
      </el-form-item>
      <el-form-item :label="t('modelField.parent')" prop="parent">
        <el-input
          v-model="form.parent"
          :placeholder="t('modelField.parent')"
          class="!w-[180px]"
          clearable
          @keyup.enter="onSearch(true)"
        />
      </el-form-item>
      <el-form-item :label="t('labels.sort')">
        <el-select
          v-model="form.ordering"
          class="!w-[180px]"
          clearable
          @change="onSearch(true)"
        >
          <el-option
            v-for="item in sortOptions"
            :key="item.key"
            :label="item.label"
            :value="item.key"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button
          :icon="useRenderIcon('ri:search-line')"
          :loading="loading"
          type="primary"
          @click="onSearch(true)"
        >
          {{ t("buttons.hssearch") }}
        </el-button>
        <el-button :icon="useRenderIcon(Refresh)" @click="resetForm(formRef)">
          {{ t("buttons.hsreload") }}
        </el-button>
      </el-form-item>
    </el-form>

    <PureTableBar
      :columns="columns"
      :title="t('menus.hsModelField')"
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
            {{ t("modelField.makeData") }}
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
