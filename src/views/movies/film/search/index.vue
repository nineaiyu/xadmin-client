<script setup lang="ts">
import { computed, ref } from "vue";
import { useColumns } from "./columns";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import Search from "@iconify-icons/ep/search";
import Refresh from "@iconify-icons/ep/refresh";
const emit = defineEmits<{ (e: "update:selectValue", v: Array<number>) }>();

const props = defineProps({
  selectValue: Array<number>
});

const selectValue = computed({
  get() {
    return props.selectValue;
  },
  set(val: boolean) {
    emit("update:selectValue", val);
  }
});

const formRef = ref();
const tableRef = ref();
const selectRef = ref();
const {
  t,
  form,
  loading,
  columns,
  pagination,
  dataList,
  sortOptions,
  usedOptions,
  uploadOptions,
  onSure,
  onClear,
  onReset,
  onSearch,
  removeTag,
  handleSizeChange,
  handleCurrentChange,
  handleSelectionChange
} = useColumns(selectValue, selectRef, formRef, tableRef);
</script>

<template>
  <el-select
    ref="selectRef"
    v-model="selectValue"
    clearable
    class="w-full"
    multiple
    collapse-tags
    :max-collapse-tags="10"
    collapse-tags-tooltip
    value-key="pk"
    @remove-tag="removeTag"
    @clear="onClear"
  >
    <template #empty>
      <div class="m-4">
        <el-form ref="formRef" :inline="true" :model="form">
          <el-form-item :label="t('MoviesFile.name')" prop="userid">
            <el-input
              v-model="form.name"
              :placeholder="t('MoviesFile.name')"
              clearable
              class="!w-[200px]"
              @keyup.enter="onSearch(true)"
            />
          </el-form-item>
          <el-form-item :label="t('MoviesFile.isUpload')">
            <el-select
              v-model="form.is_upload"
              filterable
              style="width: 180px"
              clearable
              :teleported="false"
              @change="onSearch(true)"
            >
              <el-option
                v-for="item in uploadOptions"
                :key="item.key"
                :label="item.label"
                :value="item.key"
              />
            </el-select>
          </el-form-item>
          <el-form-item :label="t('labels.status')">
            <el-select
              v-model="form.used"
              filterable
              style="width: 180px"
              clearable
              :teleported="false"
              @change="onSearch(true)"
            >
              <el-option
                v-for="item in usedOptions"
                :key="item.key"
                :label="item.label"
                :value="item.key"
              />
            </el-select>
          </el-form-item>
          <el-form-item :label="t('labels.sort')">
            <el-select
              v-model="form.ordering"
              filterable
              style="width: 180px"
              clearable
              :teleported="false"
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
              type="primary"
              :icon="useRenderIcon(Search)"
              :loading="loading"
              @click="onSearch(true)"
            >
              {{ t("buttons.hssearch") }}
            </el-button>
            <el-button :icon="useRenderIcon(Refresh)" @click="onReset">
              {{ t("buttons.hsreload") }}
            </el-button>
          </el-form-item>
        </el-form>

        <pure-table
          ref="tableRef"
          border
          height="400"
          align-whole="center"
          showOverflowTooltip
          table-layout="auto"
          :loading="loading"
          row-key="pk"
          :data="dataList"
          :columns="columns"
          :pagination="pagination"
          :header-cell-style="{
            background: 'var(--el-table-row-hover-bg-color)',
            color: 'var(--el-text-color-primary)'
          }"
          @selection-change="handleSelectionChange"
          @page-current-change="handleCurrentChange"
        />
        <el-button
          class="absolute bottom-[17px] left-5"
          type="primary"
          size="small"
          text
          bg
          @click="onSure"
        >
          {{ t("labels.sure") }}
        </el-button>
      </div>
    </template>
  </el-select>
</template>
