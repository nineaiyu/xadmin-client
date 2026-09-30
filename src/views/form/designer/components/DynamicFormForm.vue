<script lang="ts" setup>
import { h, onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { approvalFlowApi } from "@/api/approval/approvalFlow";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import type {
  DynamicFormItem,
  FormField,
  FormLinkage,
  FormSchema
} from "@/api/dataset/dform";
import { message } from "@/utils/message";
import { assertFormulaAcyclic, FormulaError } from "@/views/form/utils/formula";
import FormFieldDialog from "./FormFieldDialog.vue";
import FormFieldTable from "./FormFieldTable.vue";
import FormLinkageSection from "./FormLinkageSection.vue";
import { moveItem } from "../utils/fieldOrder";
import { linkageBroken } from "../utils/linkageMeta";

/**
 * 动态表单定义表单（弹窗体系收敛到 ReDialog 的 content 组件形态）。
 *
 * 组件负责「表单数据 + 字段设计器（字段表/属性弹窗/联动规则）+ 载荷生成」，
 * 提交与列表刷新由页面在 `beforeSure` 中处理；字段表与拖动排序在
 * FormFieldTable（排序数据路径 moveItem 与上移/下移按钮共用）。
 */
defineOptions({ name: "DynamicFormDefinitionForm" });

const props = defineProps<{
  /** 编辑时的原始行（null / 缺省 = 新建） */
  row?: DynamicFormItem | null;
  /** 新建预填（如「从模板新建」）：仅填充名称/描述/字段与联动，不携带主键 */
  prefill?: {
    name?: string;
    description?: string;
    schema?: FormSchema;
  } | null;
}>();

const { t } = useI18n();

const form = reactive({
  name: props.row?.name ?? props.prefill?.name ?? "",
  description: props.row?.description ?? props.prefill?.description ?? "",
  is_active: props.row?.is_active ?? true,
  approval_required: Boolean(props.row?.approval_required),
  approval_flow: props.row?.approval_flow?.pk ?? ""
});
const fields = ref<FormField[]>(
  JSON.parse(
    JSON.stringify(
      props.row?.schema?.fields ?? props.prefill?.schema?.fields ?? []
    )
  )
);
const linkages = ref<FormLinkage[]>(
  JSON.parse(
    JSON.stringify(
      props.row?.schema?.linkages ?? props.prefill?.schema?.linkages ?? []
    )
  )
);

/** 可绑定的审批流程（无流程管理权限时降级为空选项，不阻断表单定义） */
const flowOptions = ref<{ pk: string; name: string }[]>([]);
onMounted(() => {
  approvalFlowApi
    .list({ is_active: true, page: 1, size: 100 })
    .then(res => {
      flowOptions.value = (
        (res?.data?.results ?? []) as {
          pk: string;
          name: string;
        }[]
      ).map(item => ({ pk: item.pk, name: item.name }));
    })
    .catch(() => {
      flowOptions.value = [];
    });
});

const addField = () => {
  fields.value.push({
    key: `field_${Date.now().toString(36)}`,
    label: "",
    type: "input"
  });
};

const removeField = (index: number) => {
  fields.value.splice(index, 1);
};

/** 字段排序（拖拽与上移/下移同一路径）：字段顺序即渲染顺序，保存时按数组顺序落 schema */
const moveFieldTo = (from: number, to: number) => {
  const next = moveItem(fields.value, from, to);
  if (next !== fields.value) fields.value = next;
};

/* ---------------- 字段属性弹窗（完整校验/展示属性 + 数据字典绑定） ---------------- */
const fieldDialogRef = ref<InstanceType<typeof FormFieldDialog>>();

const openFieldDialog = (index: number) => {
  fieldDialogRef.value = undefined;
  addDialog({
    title: t("dform.fieldProps"),
    width: dialogSize("sm"),
    draggable: true,
    destroyOnClose: true,
    closeOnClickModal: false,
    contentRenderer: () =>
      h(FormFieldDialog, {
        ref: fieldDialogRef,
        field: fields.value[index],
        fields: fields.value
      }),
    beforeSure: (done, { closeLoading }) => {
      const next = fieldDialogRef.value?.getField();
      if (!next) {
        closeLoading();
        return;
      }
      // 直接替换数组元素：保持整体顺序不变，仅该字段属性变更
      fields.value[index] = next;
      done();
    }
  });
};

/** 校验并生成提交载荷；校验失败返回 null（调用方保持弹窗打开） */
const getPayload = (): Record<string, unknown> | null => {
  if (!form.name || fields.value.length === 0) {
    message(t("dform.required"), { type: "warning" });
    return null;
  }
  const tableField = fields.value.find(
    field => field.type === "table" && !(field.columns ?? []).length
  );
  if (tableField) {
    message(t("dform.tableColumnsRequired"), { type: "warning" });
    return null;
  }
  // 公式字段循环引用检测（字段级语法/引用错误在属性弹窗拦截，此处兜全图）
  try {
    assertFormulaAcyclic(fields.value);
  } catch (error) {
    const code = error instanceof FormulaError ? error.code : "invalid";
    const params = error instanceof FormulaError ? error.params : {};
    message(t(`dform.formula.errors.${code}`, params), { type: "warning" });
    return null;
  }
  // 字段被删除/改 key 后，引用失效的联动规则在保存前剔除（服务端会拒绝未知字段）
  const valid = linkages.value.filter(
    rule => !linkageBroken(rule, fields.value)
  );
  const dropped = linkages.value.length - valid.length;
  if (dropped > 0) {
    message(t("dform.linkageDropped", { count: dropped }), {
      type: "warning"
    });
    linkages.value = valid;
  }
  const schema: FormSchema = { fields: fields.value, linkages: valid };
  return {
    name: form.name,
    description: form.description,
    is_active: form.is_active,
    approval_required: form.approval_required,
    // 绑定流程后提交进入流程引擎，操作审批开关被忽略
    approval_flow: form.approval_flow || null,
    schema
  };
};

defineExpose({ getPayload });
</script>

<template>
  <div>
    <el-form label-width="90px">
      <el-form-item :label="t('dform.name')" required>
        <el-input v-model="form.name" />
      </el-form-item>
      <el-form-item :label="t('dform.description')">
        <el-input v-model="form.description" />
      </el-form-item>
      <el-form-item :label="t('dform.approvalFlow')">
        <el-select
          v-model="form.approval_flow"
          clearable
          :placeholder="t('dform.noApprovalFlow')"
          :style="{ width: '100%' }"
        >
          <el-option
            v-for="item in flowOptions"
            :key="item.pk"
            :value="item.pk"
            :label="item.name"
          />
        </el-select>
        <div class="text-xs text-(--el-text-color-regular)">
          {{ t("dform.approvalFlowTip") }}
        </div>
      </el-form-item>
      <el-form-item :label="t('dform.approvalRequired')">
        <div class="flex items-center gap-2">
          <el-switch
            v-model="form.approval_required"
            data-testid="form-approval-switch"
          />
          <span class="text-xs text-(--el-text-color-regular)">{{
            t("dform.approvalTip")
          }}</span>
        </div>
      </el-form-item>
    </el-form>
    <div class="mb-2 flex items-center gap-2">
      <span class="text-sm font-medium">{{ t("dform.fields") }}</span>
      <div class="flex-1" />
      <el-button size="small" type="primary" plain @click="addField">
        {{ t("dform.addField") }}
      </el-button>
    </div>
    <FormFieldTable
      :fields="fields"
      @move="moveFieldTo"
      @configure="openFieldDialog"
      @remove="removeField"
    />
    <div class="mt-4">
      <FormLinkageSection v-model="linkages" :fields="fields" />
    </div>
  </div>
</template>
