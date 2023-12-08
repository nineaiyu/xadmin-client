<script setup lang="ts">
import { ref } from "vue";
import { useSearchFile } from "./hook";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import Plus from "@iconify-icons/ep/plus";
import Search from "@iconify-icons/ep/search";
import Refresh from "@iconify-icons/ep/refresh";
import { hasAuth } from "@/router/utils";
import { FormProps } from "@/views/movies/drive/utils/types";

const props = withDefaults(defineProps<FormProps>(), {
  formInline: () => ({
    pk: ""
  })
});

const formRef = ref();
const tableRef = ref();
const {
  t,
  form,
  loading,
  columns,
  dataList,
  manySelectCount,
  onSelectionCancel,
  onSearch,
  resetForm,
  handleManyImportFile,
  handleSelectionChange
} = useSearchFile(tableRef, props.formInline.pk);
</script>

<template>
  <div v-if="hasAuth('list:MoviesDriveByFileId')" class="main">
    <el-form
      ref="formRef"
      :inline="true"
      :model="form"
      class="search-form bg-bg_color w-[99/100] pl-8 pt-[12px]"
    >
      <el-form-item :label="t('MoviesFile.fileId')" prop="userid">
        <el-input
          v-model="form.file_id"
          :placeholder="t('MoviesFile.fileId')"
          clearable
          class="!w-[400px]"
          @keyup.enter="onSearch()"
        />
      </el-form-item>
      <el-form-item>
        <el-button
          type="primary"
          :icon="useRenderIcon(Search)"
          :loading="loading"
          @click="onSearch()"
        >
          {{ t("buttons.hssearch") }}
        </el-button>
        <el-button :icon="useRenderIcon(Refresh)" @click="resetForm(formRef)">
          {{ t("buttons.hsreload") }}
        </el-button>
      </el-form-item>
    </el-form>

    <PureTableBar
      :title="t('MoviesFile.file')"
      :columns="columns"
      @refresh="onSearch()"
    >
      <template #buttons>
        <el-space wrap>
          <div v-if="manySelectCount > 0" class="w-[360px]">
            <span
              style="font-size: var(--el-font-size-base)"
              class="text-[rgba(42,46,54,0.5)] dark:text-[rgba(220,220,242,0.5)]"
            >
              {{ t("buttons.hsselected", { count: manySelectCount }) }}
            </span>
            <el-button type="primary" text @click="onSelectionCancel">
              {{ t("buttons.hscancel") }}
            </el-button>
            <el-popconfirm
              v-if="hasAuth('create:MoviesDriveByFileId')"
              :title="
                t('MoviesFile.batchImportConfirm', { count: manySelectCount })
              "
              @confirm="handleManyImportFile"
            >
              <template #reference>
                <el-button type="success" plain :icon="useRenderIcon(Plus)">
                  {{ t("MoviesFile.batchImport") }}
                </el-button>
              </template>
            </el-popconfirm>
          </div>
        </el-space>
      </template>
      <template v-slot="{ size, dynamicColumns }">
        <pure-table
          ref="tableRef"
          border
          align-whole="center"
          showOverflowTooltip
          table-layout="auto"
          :loading="loading"
          :size="size"
          adaptive
          row-key="pk"
          :data="dataList"
          :columns="dynamicColumns"
          :paginationSmall="size === 'small'"
          :header-cell-style="{
            background: 'var(--el-table-row-hover-bg-color)',
            color: 'var(--el-text-color-primary)'
          }"
          @selection-change="handleSelectionChange"
        />
      </template>
    </PureTableBar>
  </div>
</template>
