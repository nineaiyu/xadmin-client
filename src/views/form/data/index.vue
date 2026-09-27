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
  selectedFormPk,
  selectedForm,
  listColumnsFormat,
  searchColumnsFormat,
  operationButtonsProps
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
        v-if="forms.length === 0"
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
