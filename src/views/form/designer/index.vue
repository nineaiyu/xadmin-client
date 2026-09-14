<script lang="ts" setup>
import { onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import {
  dynamicFormApi,
  listRows,
  type DynamicFormItem,
  type FormField,
  type FormFieldType
} from "@/api/system/dform";

defineOptions({
  name: "FormDesigner"
});

const { t } = useI18n();
const canCreate = hasAuth("create:FormDesigner");
const canEdit = hasAuth("partialUpdate:FormDesigner");
const canDestroy = hasAuth("destroy:FormDesigner");

const loading = ref(false);
const rows = ref<DynamicFormItem[]>([]);

const loadAll = async () => {
  loading.value = true;
  try {
    rows.value = listRows<DynamicFormItem>(
      await dynamicFormApi.list({ page_size: 100 })
    );
  } finally {
    loading.value = false;
  }
};

/** 字段类型选项（收敛控件集） */
const typeOptions: { value: FormFieldType; labelKey: string }[] = [
  { value: "input", labelKey: "dform.typeInput" },
  { value: "textarea", labelKey: "dform.typeTextarea" },
  { value: "number", labelKey: "dform.typeNumber" },
  { value: "select", labelKey: "dform.typeSelect" },
  { value: "radio", labelKey: "dform.typeRadio" },
  { value: "checkbox", labelKey: "dform.typeCheckbox" },
  { value: "date", labelKey: "dform.typeDate" },
  { value: "switch", labelKey: "dform.typeSwitch" }
];

const dialog = ref(false);
const editingPk = ref<string | null>(null);
const form = reactive({
  name: "",
  description: "",
  is_active: true,
  approval_required: false
});
const fields = ref<FormField[]>([]);

const openCreate = () => {
  editingPk.value = null;
  form.name = "";
  form.description = "";
  form.is_active = true;
  form.approval_required = false;
  fields.value = [];
  dialog.value = true;
};

const openEdit = (row: DynamicFormItem) => {
  editingPk.value = row.pk;
  form.name = row.name;
  form.description = row.description;
  form.is_active = row.is_active;
  form.approval_required = Boolean(row.approval_required);
  fields.value = JSON.parse(JSON.stringify(row.schema?.fields ?? []));
  dialog.value = true;
};

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

const needsOptions = (type: FormFieldType) =>
  ["select", "radio", "checkbox"].includes(type);

const submit = async () => {
  if (!form.name || fields.value.length === 0) {
    message(t("dform.required"), { type: "warning" });
    return;
  }
  const payload = {
    name: form.name,
    description: form.description,
    is_active: form.is_active,
    approval_required: form.approval_required,
    schema: { fields: fields.value }
  };
  const res = editingPk.value
    ? await dynamicFormApi.partialUpdate(editingPk.value, payload)
    : await dynamicFormApi.create(payload);
  if (res.code === 1000) {
    message(t("dform.saveOk"), { type: "success" });
    dialog.value = false;
    await loadAll();
  } else if (res.detail) {
    message(String(res.detail), { type: "warning" });
  }
};

const remove = async (row: DynamicFormItem) => {
  const res = await dynamicFormApi.destroy(row.pk);
  if (res.code === 1000) await loadAll();
};

const optionsText = (field: FormField) => (field.options ?? []).join(", ");

const onOptionsChanged = (field: FormField, value: string) => {
  field.options = value
    .split(/[,，]/)
    .map(item => item.trim())
    .filter(Boolean);
};

onMounted(loadAll);
</script>

<template>
  <div class="pr-[1%]">
    <!-- pr-[1%]：内容宽度对齐 RePlusPage 的 w-99/100（右侧留 1%），
         根元素自带 layout 注入的 main-content（24px 外边距），不能再设百分比宽度（会溢出） -->

    <el-card shadow="never">
      <div class="mb-3 flex items-center gap-2">
        <span class="font-semibold">{{ t("dform.designerTitle") }}</span>
        <div class="flex-1" />
        <el-button v-if="canCreate" type="primary" @click="openCreate">
          {{ t("dform.create") }}
        </el-button>
      </div>
      <el-table
        v-loading="loading"
        :data="rows"
        data-testid="form-designer-table"
      >
        <el-table-column prop="name" :label="t('dform.name')" min-width="140" />
        <el-table-column :label="t('dform.fieldCount')" width="100">
          <template #default="{ row }">
            {{ ((row as DynamicFormItem).schema?.fields ?? []).length }}
          </template>
        </el-table-column>
        <el-table-column :label="t('dform.isActive')" width="90">
          <template #default="{ row }">
            <el-tag
              size="small"
              :type="(row as DynamicFormItem).is_active ? 'success' : 'info'"
            >
              {{
                (row as DynamicFormItem).is_active
                  ? t("dform.active")
                  : t("dform.inactive")
              }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('dform.approvalRequired')" width="110">
          <template #default="{ row }">
            <el-tag
              size="small"
              :type="
                (row as DynamicFormItem).approval_required ? 'warning' : 'info'
              "
            >
              {{
                (row as DynamicFormItem).approval_required
                  ? t("dform.approvalOn")
                  : t("dform.approvalOff")
              }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="description"
          :label="t('dform.description')"
          min-width="160"
          show-overflow-tooltip
        />
        <el-table-column :label="t('dform.actions')" width="160" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="canEdit"
              link
              type="primary"
              @click="openEdit(row as DynamicFormItem)"
            >
              {{ t("dform.edit") }}
            </el-button>
            <el-button
              v-if="canDestroy"
              link
              type="danger"
              @click="remove(row as DynamicFormItem)"
            >
              {{ t("dform.delete") }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 设计器 -->
    <el-dialog
      v-model="dialog"
      :title="editingPk ? t('dform.edit') : t('dform.create')"
      width="760px"
      top="5vh"
    >
      <el-form label-width="90px">
        <el-form-item :label="t('dform.name')" required>
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item :label="t('dform.description')">
          <el-input v-model="form.description" />
        </el-form-item>
        <el-form-item :label="t('dform.approvalRequired')">
          <div class="flex items-center gap-2">
            <el-switch
              v-model="form.approval_required"
              data-testid="form-approval-switch"
            />
            <span class="text-xs text-gray-500">{{
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
      <el-table :data="fields" size="small" max-height="320">
        <el-table-column :label="t('dform.fieldKey')" width="150">
          <template #default="{ row }">
            <el-input v-model="(row as FormField).key" size="small" />
          </template>
        </el-table-column>
        <el-table-column :label="t('dform.fieldLabel')" width="140">
          <template #default="{ row }">
            <el-input v-model="(row as FormField).label" size="small" />
          </template>
        </el-table-column>
        <el-table-column :label="t('dform.fieldType')" width="120">
          <template #default="{ row }">
            <el-select v-model="(row as FormField).type" size="small">
              <el-option
                v-for="item in typeOptions"
                :key="item.value"
                :value="item.value"
                :label="t(item.labelKey)"
              />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column :label="t('dform.fieldOptions')" min-width="150">
          <template #default="{ row }">
            <el-input
              v-if="needsOptions((row as FormField).type)"
              :model-value="optionsText(row as FormField)"
              size="small"
              :placeholder="t('dform.optionsHint')"
              @update:model-value="
                (value: string) => onOptionsChanged(row as FormField, value)
              "
            />
          </template>
        </el-table-column>
        <el-table-column :label="t('dform.fieldRequired')" width="70">
          <template #default="{ row }">
            <el-switch v-model="(row as FormField).required" size="small" />
          </template>
        </el-table-column>
        <el-table-column :label="t('dform.actions')" width="70">
          <template #default="{ $index }">
            <el-button link type="danger" @click="removeField($index)">
              {{ t("dform.delete") }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="dialog = false">{{ t("dform.cancel") }}</el-button>
        <el-button type="primary" @click="submit">{{
          t("dform.confirm")
        }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>
