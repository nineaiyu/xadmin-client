<script lang="ts" setup>
import ReEmpty from "@/components/ReEmpty";
import { useI18n } from "vue-i18n";
import { useFormData } from "./utils/hook";

defineOptions({
  name: "FormData"
});

const { t } = useI18n();

const {
  api,
  auth,
  tableRef,
  forms,
  formsLoadFailed,
  loadForms,
  selectedFormPk,
  selectedForm,
  listColumnsFormat,
  searchColumnsFormat,
  operationButtonsProps,
  filterableFields,
  filterValues,
  applyFilters,
  clearFilters,
  isOptionedField,
  isNumberField,
  isUserField,
  isCascaderField,
  filterOptionsOf,
  filterUserOptionsOf,
  filterUserLabel,
  searchFilterUsers,
  cascaderOptionsOf
} = useFormData();
</script>

<template>
  <div class="pr-[1%]">
    <!-- pr-[1%]：内容宽度对齐 RePlusPage 的 w-99/100（右侧留 1%），
         根元素自带 layout 注入的 main-content（24px 外边距），不能再设百分比宽度（会溢出） -->

    <!-- 选择表单卡片：本页入口（行可见性由后端数据权限编译器收敛） -->
    <el-card shadow="never" class="mb-3">
      <template #header>
        <span class="font-semibold">{{ t("formData.selectTitle") }}</span>
      </template>
      <ReEmpty
        v-if="formsLoadFailed"
        :description="t('formData.formsLoadFailed')"
        :image-size="60"
      >
        <el-button size="small" type="primary" @click="loadForms">
          {{ t("formData.retry") }}
        </el-button>
      </ReEmpty>
      <ReEmpty
        v-else-if="forms.length === 0"
        :description="t('formData.noForms')"
        :image-size="60"
      />
      <div v-else class="flex flex-wrap items-center gap-3">
        <el-select
          v-model="selectedFormPk"
          class="w-80"
          :placeholder="t('formData.selectPlaceholder')"
          data-testid="form-data-form-select"
        >
          <el-option
            v-for="form in forms"
            :key="form.pk"
            :label="form.name"
            :value="form.pk"
          >
            <span class="flex items-center gap-2">
              <span>{{ form.name }}</span>
              <el-tag v-if="!form.is_active" size="small" type="info">
                {{ t("formData.inactive") }}
              </el-tag>
            </span>
          </el-option>
        </el-select>
        <span
          v-if="selectedForm"
          class="text-xs text-(--el-text-color-regular)"
          data-testid="form-data-form-desc"
        >
          {{ selectedForm.description || t("dform.noDescription") }}
        </span>
      </div>
      <!-- 字段筛选（物化筛选列）：只渲染设计器勾选「可筛选」的等值型字段；
           条件随列表/导出请求下发（后端按所选表单的可筛选面 fail-closed 校验） -->
      <template v-if="selectedForm && filterableFields.length">
        <el-divider class="my-3!" />
        <div
          class="flex flex-wrap items-end gap-3"
          data-testid="form-data-filters"
        >
          <div
            v-for="field in filterableFields"
            :key="field.key"
            class="flex flex-col gap-1"
          >
            <span class="text-xs text-(--el-text-color-regular)">
              {{ field.label || field.key }}
            </span>
            <el-date-picker
              v-if="field.type === 'date'"
              v-model="filterValues[field.key] as string"
              type="date"
              value-format="YYYY-MM-DD"
              class="w-40!"
              :placeholder="field.label"
              clearable
              :data-testid="`form-data-filter-${field.key}`"
              @change="applyFilters"
            />
            <el-select
              v-else-if="field.type === 'switch'"
              v-model="filterValues[field.key] as boolean"
              class="w-40!"
              clearable
              :placeholder="field.label"
              :data-testid="`form-data-filter-${field.key}`"
              @change="applyFilters"
            >
              <el-option :label="t('dform.yes')" :value="true" />
              <el-option :label="t('dform.no')" :value="false" />
            </el-select>
            <el-select
              v-else-if="isOptionedField(field)"
              v-model="filterValues[field.key] as string | string[]"
              class="w-40!"
              clearable
              :multiple="field.type === 'checkbox'"
              collapse-tags
              :placeholder="field.label"
              :data-testid="`form-data-filter-${field.key}`"
              @change="applyFilters"
            >
              <el-option
                v-for="option in filterOptionsOf(field)"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
            <el-input-number
              v-else-if="isNumberField(field)"
              v-model="filterValues[field.key] as number"
              controls-position="right"
              class="w-40!"
              :placeholder="field.label"
              :data-testid="`form-data-filter-${field.key}`"
              @change="applyFilters"
            />
            <el-select
              v-else-if="isUserField(field)"
              v-model="filterValues[field.key] as number | number[]"
              class="w-40!"
              :multiple="field.multiple === true"
              filterable
              remote
              reserve-keyword
              clearable
              :remote-method="
                (keyword: string) => searchFilterUsers(field, keyword)
              "
              :placeholder="t('dform.userSearchPlaceholder')"
              :data-testid="`form-data-filter-${field.key}`"
              @change="applyFilters"
            >
              <el-option
                v-for="user in filterUserOptionsOf(field)"
                :key="user.pk"
                :value="user.pk"
                :label="filterUserLabel(user)"
              />
            </el-select>
            <el-cascader
              v-else-if="isCascaderField(field)"
              v-model="filterValues[field.key] as (string | number)[]"
              class="w-40!"
              :options="cascaderOptionsOf(field)"
              clearable
              :placeholder="field.label"
              :data-testid="`form-data-filter-${field.key}`"
              @change="applyFilters"
            />
            <el-input
              v-else
              v-model="filterValues[field.key] as string"
              class="w-40!"
              clearable
              :placeholder="field.label"
              :data-testid="`form-data-filter-${field.key}`"
              @change="applyFilters"
            />
          </div>
          <el-button link type="primary" @click="clearFilters">
            {{ t("formData.filterClear") }}
          </el-button>
        </div>
      </template>
    </el-card>

    <!-- 表格区：切换表单按 pk 重建（动态列随所选表单 schema 重新生成）；
         搜索区由框架接管，表单筛选走顶部选择器（已注入列表与导出请求） -->
    <div
      v-if="selectedForm"
      :key="selectedFormPk"
      data-testid="form-data-table"
    >
      <RePlusPage
        ref="tableRef"
        :api="api"
        :auth="auth"
        locale-name="formData"
        :selection="false"
        :listColumnsFormat="listColumnsFormat"
        :searchColumnsFormat="searchColumnsFormat"
        :operationButtonsProps="operationButtonsProps"
      />
    </div>
    <ReEmpty v-else :description="t('formData.selectHint')" :image-size="80" />
  </div>
</template>
