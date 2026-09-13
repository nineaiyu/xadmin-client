<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import {
  dynamicFormApi,
  listRows,
  submissionApi,
  type DynamicFormItem,
  type FormField,
  type SubmissionItem
} from "@/api/system/dform";

defineOptions({
  name: "FormMySubmission"
});

const { t } = useI18n();
const canEdit = hasAuth("partialUpdate:FormMySubmission");
const canDestroy = hasAuth("destroy:FormMySubmission");

const loading = ref(false);
const forms = ref<DynamicFormItem[]>([]);
const submissions = ref<SubmissionItem[]>([]);

const loadAll = async () => {
  loading.value = true;
  try {
    const [formRes, subRes] = await Promise.all([
      dynamicFormApi.list({ page_size: 100 }),
      submissionApi.list({ page_size: 50 })
    ]);
    forms.value = listRows<DynamicFormItem>(formRes).filter(
      item => item.is_active
    );
    submissions.value = listRows<SubmissionItem>(subRes);
  } finally {
    loading.value = false;
  }
};

/** 当前编辑的表单与数据（动态表单渲染核心） */
const dialog = ref(false);
const editingPk = ref<string | null>(null);
const currentForm = ref<DynamicFormItem | null>(null);
const formData = reactive<Record<string, unknown>>({});

const schemaFields = computed<FormField[]>(
  () => currentForm.value?.schema?.fields ?? []
);

const openFill = (form: DynamicFormItem) => {
  currentForm.value = form;
  editingPk.value = null;
  Object.keys(formData).forEach(key => delete formData[key]);
  dialog.value = true;
};

const openEditSubmission = (submission: SubmissionItem) => {
  const form = forms.value.find(item => item.pk === submission.form);
  if (!form) return;
  currentForm.value = form;
  editingPk.value = submission.pk;
  Object.keys(formData).forEach(key => delete formData[key]);
  Object.assign(formData, JSON.parse(JSON.stringify(submission.data)));
  dialog.value = true;
};

const submit = async () => {
  if (!currentForm.value) return;
  const payload = { form: currentForm.value.pk, data: { ...formData } };
  const res = editingPk.value
    ? await submissionApi.partialUpdate(editingPk.value, payload)
    : await submissionApi.create(payload);
  if (res.code === 1000) {
    message(t("dform.saveOk"), { type: "success" });
    dialog.value = false;
    await loadAll();
  } else if (res.detail) {
    message(String(res.detail), { type: "warning" });
  }
};

const remove = async (row: SubmissionItem) => {
  const res = await submissionApi.destroy(row.pk);
  if (res.code === 1000) await loadAll();
};

const formName = (pk: string) =>
  forms.value.find(item => item.pk === pk)?.name ?? pk;

onMounted(loadAll);
</script>

<template>
  <div class="p-4">
    <!-- 可填表单卡片 -->
    <el-card shadow="never" class="mb-3">
      <template #header>
        <span class="font-semibold">{{ t("dform.fillTitle") }}</span>
      </template>
      <el-empty
        v-if="forms.length === 0"
        :description="t('dform.noForms')"
        :image-size="60"
      />
      <div v-else class="flex flex-wrap gap-3">
        <el-card
          v-for="form in forms"
          :key="form.pk"
          shadow="hover"
          class="w-72 cursor-pointer"
          data-testid="fill-form-card"
          @click="openFill(form)"
        >
          <div class="flex items-center gap-2">
            <span class="font-medium">{{ form.name }}</span>
            <el-tag
              v-if="form.approval_required"
              size="small"
              type="warning"
              data-testid="fill-form-approval-tag"
            >
              {{ t("dform.approvalOn") }}
            </el-tag>
          </div>
          <div class="mt-1 text-xs text-gray-500">
            {{ form.description || t("dform.noDescription") }}
          </div>
        </el-card>
      </div>
    </el-card>

    <!-- 我的提交 -->
    <el-card shadow="never">
      <template #header>
        <span class="font-semibold">{{ t("dform.mySubmissions") }}</span>
      </template>
      <el-table
        v-loading="loading"
        :data="submissions"
        data-testid="my-submission-table"
      >
        <el-table-column :label="t('dform.name')" min-width="140">
          <template #default="{ row }">{{
            formName((row as SubmissionItem).form)
          }}</template>
        </el-table-column>
        <el-table-column :label="t('dform.submissionData')" min-width="260">
          <template #default="{ row }">
            <span class="text-xs">
              {{
                Object.entries((row as SubmissionItem).data ?? {})
                  .map(([key, value]) => `${key}: ${value ?? "-"}`)
                  .join(" | ") || "-"
              }}
            </span>
          </template>
        </el-table-column>
        <el-table-column
          prop="created_time"
          :label="t('dform.submittedAt')"
          width="170"
        />
        <el-table-column :label="t('dform.actions')" width="140" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="canEdit"
              link
              type="primary"
              @click="openEditSubmission(row as SubmissionItem)"
            >
              {{ t("dform.edit") }}
            </el-button>
            <el-button
              v-if="canDestroy"
              link
              type="danger"
              @click="remove(row as SubmissionItem)"
            >
              {{ t("dform.delete") }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 动态填报表单 -->
    <el-dialog
      v-model="dialog"
      :title="editingPk ? t('dform.editSubmission') : (currentForm?.name ?? '')"
      width="560px"
    >
      <el-alert
        v-if="!editingPk && currentForm?.approval_required"
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
      <template #footer>
        <el-button @click="dialog = false">{{ t("dform.cancel") }}</el-button>
        <el-button type="primary" @click="submit">{{
          t("dform.confirm")
        }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>
