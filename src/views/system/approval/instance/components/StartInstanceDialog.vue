<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import { approvalInstanceApi } from "@/api/system/approvalFlow";

/**
 * 发起申请弹窗：选择启用中的流程 → 按 form_schema 渲染动态表单 → 提交。
 *
 * 流程选项走 `available-flows` 轻量接口（申请人无需流程定义管理权限）；
 * 动态字段统一按字符串收集（number 类型在提交前转数值，与后端条件运算口径一致）。
 */

defineOptions({ name: "ApprovalInstanceStart" });

type FormField = {
  key: string;
  label?: string;
  type?: string;
  required?: boolean;
  options?: string[];
};
type FlowOption = {
  pk: string;
  name: string;
  code: string;
  form_schema?: FormField[];
};

const emit = defineEmits<{ submitted: [] }>();
const { t } = useI18n();

const loading = ref(false);
const submitting = ref(false);
const flows = ref<FlowOption[]>([]);
const formRef = ref<FormInstance>();

const form = reactive<{
  flow: string;
  title: string;
  values: Record<string, string>;
}>({
  flow: "",
  title: "",
  values: {}
});

const currentFlow = computed(() =>
  flows.value.find(item => item.pk === form.flow)
);
const fields = computed(() => currentFlow.value?.form_schema ?? []);

const rules = computed<FormRules>(() => {
  const base: FormRules = {
    flow: [
      {
        required: true,
        message: t("systemApprovalInstance.flowRequired"),
        trigger: "change"
      }
    ],
    title: [
      {
        required: true,
        message: t("systemApprovalInstance.titleRequired"),
        trigger: "blur"
      }
    ]
  };
  fields.value.forEach(field => {
    if (field.required) {
      base[`values.${field.key}`] = [
        {
          required: true,
          message: t("systemApprovalInstance.fieldRequired", {
            label: field.label ?? field.key
          }),
          trigger: "blur"
        }
      ];
    }
  });
  return base;
});

/** 切换流程：重建动态字段值（清空旧流程残留，避免误提交） */
function onFlowChange() {
  const next: Record<string, string> = {};
  fields.value.forEach(field => {
    next[field.key] = "";
  });
  form.values = next;
  formRef.value?.clearValidate();
}

async function loadFlows() {
  loading.value = true;
  try {
    const res = await approvalInstanceApi.availableFlows();
    // DataListResult 的行类型为通用 RecordType：按本接口契约收窄为 FlowOption
    flows.value = Array.isArray(res.data)
      ? (res.data as unknown as FlowOption[])
      : [];
  } finally {
    loading.value = false;
  }
}

async function submit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  submitting.value = true;
  try {
    const formData: Record<string, string | number> = {};
    fields.value.forEach(field => {
      const raw = form.values[field.key] ?? "";
      formData[field.key] =
        field.type === "number" && raw !== "" ? Number(raw) : raw;
    });
    const res = await approvalInstanceApi.create({
      flow: form.flow,
      title: form.title,
      form_data: formData
    });
    if (res.code === 1000) {
      ElMessage.success(t("systemApprovalInstance.submitSuccess"));
      emit("submitted");
    }
  } catch {
    // 失败提示由 http 拦截器统一处理
  } finally {
    submitting.value = false;
  }
}

onMounted(loadFlows);
</script>
<template>
  <el-form
    ref="formRef"
    v-loading="loading"
    :model="form"
    :rules="rules"
    label-width="90px"
  >
    <el-form-item :label="t('systemApprovalInstance.formFlow')" prop="flow">
      <el-select
        v-model="form.flow"
        class="w-full"
        filterable
        :placeholder="t('systemApprovalInstance.flowPlaceholder')"
        @change="onFlowChange"
      >
        <el-option
          v-for="item in flows"
          :key="item.pk"
          :label="item.name"
          :value="item.pk"
        />
      </el-select>
    </el-form-item>
    <el-form-item :label="t('systemApprovalInstance.formTitle')" prop="title">
      <el-input
        v-model="form.title"
        maxlength="128"
        :placeholder="t('systemApprovalInstance.titlePlaceholder')"
      />
    </el-form-item>
    <el-form-item
      v-for="field in fields"
      :key="field.key"
      :label="field.label ?? field.key"
      :prop="`values.${field.key}`"
      :required="field.required"
    >
      <el-select
        v-if="field.type === 'select'"
        v-model="form.values[field.key]"
        class="w-full"
        :placeholder="t('systemApprovalInstance.fieldPlaceholder')"
      >
        <el-option
          v-for="option in field.options ?? []"
          :key="String(option)"
          :label="String(option)"
          :value="String(option)"
        />
      </el-select>
      <el-date-picker
        v-else-if="field.type === 'date'"
        v-model="form.values[field.key]"
        type="date"
        value-format="YYYY-MM-DD"
        class="w-full"
      />
      <el-input
        v-else
        v-model="form.values[field.key]"
        :type="field.type === 'textarea' ? 'textarea' : 'text'"
        :rows="3"
        :placeholder="t('systemApprovalInstance.fieldPlaceholder')"
      />
    </el-form-item>
  </el-form>
  <div class="flex justify-end mt-2">
    <el-button type="primary" :loading="submitting" @click="submit">
      {{ t("systemApprovalInstance.submit") }}
    </el-button>
  </div>
</template>
