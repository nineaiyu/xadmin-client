<script lang="ts" setup>
import { computed, reactive } from "vue";
import { useI18n } from "vue-i18n";
import UploadFiles from "@/components/RePlusPage/src/components/UploadFiles.vue";
import type {
  FillableFormItem,
  FormField,
  SubmissionItem
} from "@/api/system/dform";

/**
 * 动态填报表单（弹窗体系收敛到 ReDialog 的 content 组件形态）。
 *
 * 组件负责「动态字段渲染 + 表单数据」，提交与列表刷新由页面在 `beforeSure` 中处理；
 * 字段校验沿用后端口径（按 schema 校验），原实现同此约定。
 */
defineOptions({ name: "FormSubmissionForm" });

const props = defineProps<{
  /** 表单定义（决定动态字段） */
  form: FillableFormItem;
  /** 编辑既有提交（null / 缺省 = 新建填报） */
  submission?: SubmissionItem | null;
}>();

const { t } = useI18n();
const isEdit = !!props.submission;

const schemaFields = computed<FormField[]>(
  () => props.form?.schema?.fields ?? []
);

const formData = reactive<Record<string, unknown>>(
  props.submission
    ? JSON.parse(JSON.stringify(props.submission.data ?? {}))
    : {}
);

/** 明细子表：新增一行（按列定义初始化空值） */
const rowsOf = (field: FormField): Record<string, unknown>[] => {
  if (!Array.isArray(formData[field.key])) {
    formData[field.key] = [];
  }
  return formData[field.key] as Record<string, unknown>[];
};

const addRow = (field: FormField) => {
  const row: Record<string, unknown> = {};
  for (const column of field.columns ?? []) row[column.key] = "";
  rowsOf(field).push(row);
};

const removeRow = (field: FormField, index: number) => {
  rowsOf(field).splice(index, 1);
};

/** 生成提交载荷（字段校验由后端按 schema 执行） */
const getPayload = () => ({
  form: props.form.pk,
  data: { ...formData }
});

defineExpose({ getPayload });
</script>

<template>
  <div>
    <el-alert
      v-if="!isEdit && form?.approval_flow"
      type="info"
      :closable="false"
      class="mb-3"
      :title="t('dform.approvalFlowHint')"
    />
    <el-alert
      v-else-if="!isEdit && form?.approval_required"
      type="warning"
      :closable="false"
      class="mb-3"
      :title="t('dform.approvalHint')"
    />
    <el-form label-width="110px">
      <el-form-item
        v-for="field in schemaFields"
        :key="field.key"
        :label="field.label"
        :required="field.required"
      >
        <el-input
          v-if="field.type === 'input'"
          v-model="formData[field.key] as string"
          :maxlength="field.max_length"
          :placeholder="field.placeholder"
        />
        <el-input
          v-else-if="field.type === 'textarea'"
          v-model="formData[field.key] as string"
          type="textarea"
          :rows="3"
          :maxlength="field.max_length"
        />
        <el-input-number
          v-else-if="field.type === 'number'"
          v-model="formData[field.key] as number"
          :min="field.min"
          :max="field.max"
        />
        <el-select
          v-else-if="field.type === 'select'"
          v-model="formData[field.key] as string"
          class="w-full"
          clearable
        >
          <el-option
            v-for="option in field.options"
            :key="option"
            :value="option"
            :label="option"
          />
        </el-select>
        <el-radio-group
          v-else-if="field.type === 'radio'"
          v-model="formData[field.key] as string"
        >
          <el-radio
            v-for="option in field.options"
            :key="option"
            :value="option"
            >{{ option }}</el-radio
          >
        </el-radio-group>
        <el-checkbox-group
          v-else-if="field.type === 'checkbox'"
          v-model="formData[field.key] as string[]"
        >
          <el-checkbox
            v-for="option in field.options"
            :key="option"
            :value="option"
            >{{ option }}</el-checkbox
          >
        </el-checkbox-group>
        <el-date-picker
          v-else-if="field.type === 'date'"
          v-model="formData[field.key] as string"
          type="date"
          value-format="YYYY-MM-DD"
        />
        <el-date-picker
          v-else-if="field.type === 'daterange'"
          v-model="formData[field.key] as string[]"
          type="daterange"
          value-format="YYYY-MM-DD"
          :start-placeholder="t('dform.rangeStart')"
          :end-placeholder="t('dform.rangeEnd')"
        />
        <UploadFiles
          v-else-if="field.type === 'upload'"
          v-model="formData[field.key] as Record<string, unknown>[]"
          multiple
        />
        <div v-else-if="field.type === 'table'" class="w-full">
          <el-table :data="rowsOf(field)" size="small" border>
            <el-table-column
              v-for="column in field.columns ?? []"
              :key="column.key"
              :label="column.label"
              min-width="120"
            >
              <template #default="{ row }">
                <el-input-number
                  v-if="column.type === 'number'"
                  v-model="
                    (row as Record<string, unknown>)[column.key] as number
                  "
                  size="small"
                  controls-position="right"
                />
                <el-select
                  v-else-if="column.type === 'select'"
                  v-model="
                    (row as Record<string, unknown>)[column.key] as string
                  "
                  size="small"
                  clearable
                >
                  <el-option
                    v-for="option in column.options ?? []"
                    :key="option"
                    :value="option"
                    :label="option"
                  />
                </el-select>
                <el-date-picker
                  v-else-if="column.type === 'date'"
                  v-model="
                    (row as Record<string, unknown>)[column.key] as string
                  "
                  type="date"
                  value-format="YYYY-MM-DD"
                  size="small"
                />
                <el-input
                  v-else
                  v-model="
                    (row as Record<string, unknown>)[column.key] as string
                  "
                  size="small"
                />
              </template>
            </el-table-column>
            <el-table-column :label="t('dform.actions')" width="70">
              <template #default="{ $index }">
                <el-button
                  link
                  type="danger"
                  size="small"
                  @click="removeRow(field, $index)"
                >
                  {{ t("dform.delete") }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-button
            class="mt-1"
            size="small"
            type="primary"
            plain
            data-testid="dform-add-row"
            @click="addRow(field)"
          >
            {{ t("dform.addRow") }}
          </el-button>
        </div>
        <el-switch
          v-else-if="field.type === 'switch'"
          v-model="formData[field.key] as boolean"
        />
      </el-form-item>
    </el-form>
  </div>
</template>
