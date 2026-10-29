<script lang="ts" setup>
import { computed, reactive, watch } from "vue";
import { useI18n } from "vue-i18n";
import { choiceValue } from "@/utils/dict";
import { message } from "@/utils/message";
import type {
  DatasetFilter,
  DatasetItem,
  DatasetMeta
} from "@/api/dataset/datasets";

/**
 * 数据集表单（弹窗体系收敛到 ReDialog 的 content 组件形态）。
 *
 * 组件负责「表单数据 + 模型字段联动 + 载荷生成」，提交与列表刷新由页面在
 * `beforeSure` 中处理；校验失败返回 null，调用方保持弹窗打开。
 */
defineOptions({ name: "DataDatasetForm" });

const props = defineProps<{
  /** 编辑时的原始行（null / 缺省 = 新建） */
  row?: DatasetItem | null;
  /** 模型与字段元数据（可选模型 + 按模型的字段候选） */
  meta: DatasetMeta;
}>();

const { t } = useI18n();
const isEdit = !!props.row;

const opOptions = [
  "exact",
  "in",
  "gte",
  "gt",
  "lte",
  "lt",
  "contains",
  "startswith",
  "isnull"
];

// 编辑回显：`in` 过滤的 value 保持数组（tag 输入），含逗号的值不再被拆散
// `_id` 为行稳定标识（动态增删时作 v-for key，避免 index key 导致的控件内部状态错位；
// 仅本地使用，getPayload 按字段显式重建，不会提交给后端）
const initialFilters = (
  props.row ? JSON.parse(JSON.stringify(props.row.filters ?? [])) : []
) as DatasetFilter[];
let filterRowSeq = 0;
initialFilters.forEach(item => {
  item._id = ++filterRowSeq;
  if (item.op === "in") {
    item.value = Array.isArray(item.value) ? item.value.map(String) : [];
  }
});

const form = reactive({
  name: props.row?.name ?? "",
  description: props.row?.description ?? "",
  bound_model: props.row?.bound_model ?? "",
  columns: [...(props.row?.columns ?? [])],
  filters: initialFilters,
  ordering: props.row?.ordering ?? "",
  row_limit: props.row?.row_limit ?? 1000,
  // visibility 序列化为 {value,label} 对象，radio 只接受标量（归一化取 value）
  visibility: (props.row ? choiceValue(props.row.visibility) : "personal") as
    "personal" | "shared",
  field_permission_mode: (props.row
    ? choiceValue(props.row.field_permission_mode) || "inherit"
    : "inherit") as "inherit" | "strict",
  date_field: props.row?.config?.date_field ?? ""
});

// 新建时从个人切到共享：默认 strict（服务端同样默认；这里避免表单显式提交 inherit
// 覆盖服务端默认）。用户随后仍可手动改回 inherit。
watch(
  () => form.visibility,
  value => {
    if (!props.row && value === "shared") form.field_permission_mode = "strict";
  }
);

const fieldOptions = computed(() => props.meta.fields[form.bound_model] ?? []);

/**
 * JSON 路径列的可用根字段（如 `system.dynamicformsubmission` → `data`）：
 * 非空时列/筛选输入框允许手工输入 `字段.键`（可加 `|number` 标注数值列）。
 */
const jsonRoots = computed(
  () => props.meta.json_fields?.[form.bound_model] ?? []
);

/** 可选模型：过滤伪模型 "*"（「全部表」根节点，选择后保存必被后端拒绝） */
const modelOptions = computed(() =>
  props.meta.models.filter(model => model !== "*")
);

/** 绑定模型切换：下游字段候选全变，清空已选列/过滤/排序/时间字段 */
const onModelChanged = () => {
  form.columns = [];
  form.filters = [];
  form.ordering = "";
  form.date_field = "";
};

const addFilter = () => {
  form.filters.push({
    _id: ++filterRowSeq,
    field: fieldOptions.value[0] ?? "",
    op: "exact",
    value: ""
  });
};

const removeFilter = (index: number) => {
  form.filters.splice(index, 1);
};

/** 校验并生成提交载荷；校验失败返回 null（调用方保持弹窗打开） */
const getPayload = (): Record<string, unknown> | null => {
  if (!form.name || !form.bound_model || form.columns.length === 0) {
    message(t("dataDataset.required"), { type: "warning" });
    return null;
  }
  return {
    name: form.name,
    description: form.description,
    bound_model: form.bound_model,
    columns: form.columns,
    filters: form.filters.map(item => {
      let value: unknown = item.value;
      if (item.op === "isnull") {
        value = Boolean(item.value);
      } else if (item.op === "in") {
        // tag 输入直接提交数组：值本身可含逗号，不做字符串拆分
        value = (Array.isArray(item.value) ? item.value : [])
          .map(part => String(part).trim())
          .filter(part => part !== "");
      }
      return { field: item.field, op: item.op, value };
    }),
    ordering: form.ordering,
    row_limit: Number(form.row_limit) || 1000,
    visibility: form.visibility,
    field_permission_mode: form.field_permission_mode,
    config: form.date_field ? { date_field: form.date_field } : {}
  };
};

defineExpose({ getPayload });
</script>

<template>
  <el-form label-width="110px">
    <!-- 112px：「时间字段（趋势）」8 个全角字符不折行 -->
    <el-form-item :label="t('dataDataset.name')" required>
      <el-input v-model="form.name" />
    </el-form-item>
    <el-form-item :label="t('dataDataset.model')" required>
      <el-select
        v-model="form.bound_model"
        class="w-full"
        filterable
        :disabled="isEdit"
        @change="onModelChanged"
      >
        <el-option v-for="m in modelOptions" :key="m" :value="m" :label="m" />
      </el-select>
    </el-form-item>
    <el-form-item :label="t('dataDataset.columns')" required>
      <el-select
        v-model="form.columns"
        class="w-full"
        multiple
        filterable
        allow-create
        default-first-option
      >
        <el-option v-for="f in fieldOptions" :key="f" :value="f" :label="f" />
      </el-select>
      <div
        v-if="jsonRoots.length"
        class="text-xs text-(--el-text-color-regular)"
      >
        {{ t("dataDataset.jsonColumnTip", { roots: jsonRoots.join(" / ") }) }}
      </div>
    </el-form-item>
    <el-form-item :label="t('dataDataset.filters')">
      <div class="w-full">
        <div
          v-for="(item, index) in form.filters"
          :key="item._id"
          class="mb-2 flex gap-2"
        >
          <!-- EP .el-select 根元素默认 width:var(--el-select-width)=100%，
               flex 行内会与 value 输入框争宽，工具类 w-* 同级被覆盖，须行内样式定宽 -->
          <el-select
            v-model="item.field"
            :style="{ width: '190px' }"
            filterable
            allow-create
            default-first-option
          >
            <el-option
              v-for="f in fieldOptions"
              :key="f"
              :value="f"
              :label="f"
            />
          </el-select>
          <!-- op 为短枚举值，收窄让位给右侧 value 输入框 -->
          <el-select v-model="item.op" :style="{ width: '110px' }">
            <el-option
              v-for="op in opOptions"
              :key="op"
              :value="op"
              :label="op"
            />
          </el-select>
          <el-select
            v-if="item.op === 'in'"
            :model-value="item.value as string[]"
            multiple
            filterable
            allow-create
            default-first-option
            class="flex-1"
            :placeholder="t('dataDataset.inValuesPlaceholder')"
            @update:model-value="value => (item.value = value)"
          />
          <!-- isnull 无自由值：以开关表达真/假（提交为布尔），空串会被归一为假 -->
          <el-switch
            v-else-if="item.op === 'isnull'"
            v-model="item.value as boolean"
            class="flex-1"
            :active-text="t('dataDataset.isNullTrue')"
            :inactive-text="t('dataDataset.isNullFalse')"
          />
          <el-input
            v-else
            v-model="item.value as string"
            class="flex-1"
            :placeholder="t('dataDataset.value')"
          />
          <el-button
            link
            type="danger"
            class="shrink-0"
            @click="removeFilter(index)"
          >
            {{ t("dataDataset.delete") }}
          </el-button>
        </div>
        <el-button @click="addFilter">{{
          t("dataDataset.addFilter")
        }}</el-button>
      </div>
    </el-form-item>
    <el-form-item :label="t('dataDataset.ordering')">
      <el-select v-model="form.ordering" class="w-full" clearable filterable>
        <el-option v-for="f in form.columns" :key="f" :value="f" :label="f" />
        <el-option
          v-for="f in form.columns"
          :key="`-${f}`"
          :value="`-${f}`"
          :label="`-${f}`"
        />
      </el-select>
    </el-form-item>
    <el-form-item :label="t('dataDataset.rowLimit')">
      <el-input-number v-model="form.row_limit" :min="1" :max="5000" />
    </el-form-item>
    <el-form-item :label="t('dataDataset.dateField')">
      <el-select
        v-model="form.date_field"
        class="w-full"
        clearable
        filterable
        allow-create
        default-first-option
      >
        <el-option v-for="f in fieldOptions" :key="f" :value="f" :label="f" />
      </el-select>
      <div class="text-xs text-(--el-text-color-regular)">
        {{ t("dataDataset.dateFieldTip") }}
      </div>
    </el-form-item>
    <el-form-item :label="t('dataDataset.visibilityLabel')">
      <el-radio-group v-model="form.visibility">
        <el-radio value="personal">{{ t("dataDataset.personal") }}</el-radio>
        <el-radio value="shared">{{ t("dataDataset.shared") }}</el-radio>
      </el-radio-group>
    </el-form-item>
    <el-form-item :label="t('dataDataset.fieldPermissionMode')">
      <el-radio-group v-model="form.field_permission_mode">
        <el-radio value="inherit">
          {{ t("dataDataset.fieldPermissionInherit") }}
        </el-radio>
        <el-radio value="strict">
          {{ t("dataDataset.fieldPermissionStrict") }}
        </el-radio>
      </el-radio-group>
      <div class="text-xs text-(--el-text-color-regular)">
        {{ t("dataDataset.fieldPermissionTip") }}
      </div>
    </el-form-item>
    <el-form-item :label="t('dataDataset.description')">
      <el-input v-model="form.description" />
    </el-form-item>
  </el-form>
</template>
