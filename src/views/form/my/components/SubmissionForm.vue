<script lang="ts" setup>
import { computed, reactive } from "vue";
import { useI18n } from "vue-i18n";
import type {
  DynamicFormItem,
  FormField,
  SubmissionItem
} from "@/api/system/dform";

/**
 * 动态填报表单（C5：弹窗体系收敛到 ReDialog 的 content 组件形态）。
 *
 * 组件负责「动态字段渲染 + 表单数据」，提交与列表刷新由页面在 `beforeSure` 中处理；
 * 字段校验沿用后端口径（按 schema 校验），原实现同此约定。
 */
defineOptions({ name: "FormSubmissionForm" });

const props = defineProps<{
  /** 表单定义（决定动态字段） */
  form: DynamicFormItem;
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
      v-if="!isEdit && form?.approval_required"
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
        <el-switch
          v-else-if="field.type === 'switch'"
          v-model="formData[field.key] as boolean"
        />
      </el-form-item>
    </el-form>
  </div>
</template>
