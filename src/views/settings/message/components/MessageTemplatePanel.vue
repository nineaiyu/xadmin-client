<script lang="ts" setup>
import { onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  messageTemplateApi,
  type MessageTemplateItem
} from "@/api/system/security";
import type { RecordType } from "plus-pro-components";

/**
 * 通知消息模板：代码内模板是默认值，此处维护可选的 DB 覆盖层。
 *
 * - 覆盖为空 = 使用代码默认（零行为变化）；
 * - 保存前可预览（样例数据渲染，不真实发送）；重置即删除覆盖行。
 */
const { t } = useI18n();

const loading = ref(false);
const rows = ref<MessageTemplateItem[]>([]);
const saving = ref(false);
const dialogVisible = ref(false);
const current = ref<MessageTemplateItem | null>(null);
const previewResult = ref<{ subject: string; message: string } | null>(null);
const form = reactive({
  subject_template: "",
  body_template: "",
  is_active: true
});

const load = async () => {
  loading.value = true;
  try {
    const res = await messageTemplateApi.registry();
    if (res.code === 1000) rows.value = res.data ?? [];
  } catch (error: unknown) {
    ElMessage.error(String((error as Error)?.message ?? error));
  } finally {
    loading.value = false;
  }
};

const openEdit = (raw: RecordType) => {
  // el-table 插槽 row 为宽类型，按注册表契约收窄
  const row = raw as unknown as MessageTemplateItem;
  current.value = row;
  form.subject_template = row.override?.subject_template ?? "";
  form.body_template = row.override?.body_template ?? "";
  form.is_active = row.override?.is_active !== false;
  previewResult.value = null;
  dialogVisible.value = true;
};

const preview = async () => {
  if (!current.value) return;
  const res = await messageTemplateApi.preview({
    message_type: current.value.message_type,
    subject_template: form.subject_template,
    body_template: form.body_template
  });
  if (res.code === 1000) {
    previewResult.value = {
      subject: res.data.subject,
      message: res.data.message
    };
  } else {
    ElMessage.error(String(res.detail));
  }
};

const save = async () => {
  if (!current.value) return;
  saving.value = true;
  try {
    const res = await messageTemplateApi.save({
      message_type: current.value.message_type,
      subject_template: form.subject_template,
      body_template: form.body_template,
      is_active: form.is_active
    });
    if (res.code === 1000) {
      ElMessage.success(t("messageTemplate.saveSuccess"));
      dialogVisible.value = false;
      await load();
    } else {
      ElMessage.error(String(res.detail));
    }
  } finally {
    saving.value = false;
  }
};

const reset = async (raw: RecordType) => {
  const row = raw as unknown as MessageTemplateItem;
  try {
    await ElMessageBox.confirm(
      t("messageTemplate.resetConfirm", {
        name: row.message_type_label || row.message_type
      }),
      t("buttons.tips"),
      {
        type: "warning",
        confirmButtonText: t("buttons.sure"),
        cancelButtonText: t("buttons.cancel")
      }
    );
  } catch {
    return;
  }
  const res = await messageTemplateApi.reset(row.message_type);
  if (res.code === 1000) {
    ElMessage.success(t("messageTemplate.resetSuccess"));
    await load();
  } else {
    ElMessage.error(String(res.detail));
  }
};

onMounted(load);
</script>

<template>
  <div v-loading="loading">
    <el-table :data="rows" border>
      <el-table-column
        prop="message_type_label"
        :label="t('messageTemplate.messageType')"
        min-width="160"
      />
      <el-table-column
        prop="category_label"
        :label="t('messageTemplate.category')"
        width="120"
      />
      <el-table-column :label="t('messageTemplate.override')" width="120">
        <template #default="{ row }">
          <el-tag :type="row.has_override ? 'success' : 'info'" effect="light">
            {{
              row.has_override
                ? t("messageTemplate.overridden")
                : t("messageTemplate.defaultState")
            }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        prop="default_subject"
        :label="t('messageTemplate.defaultSubject')"
        min-width="180"
        show-overflow-tooltip
      />
      <el-table-column
        :label="t('commonLabels.operation')"
        width="170"
        fixed="right"
      >
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">
            {{ t("messageTemplate.edit") }}
          </el-button>
          <el-button
            v-if="row.has_override"
            link
            type="warning"
            @click="reset(row)"
          >
            {{ t("messageTemplate.reset") }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog
      v-model="dialogVisible"
      :title="
        t('messageTemplate.editTitle', {
          name: current?.message_type_label ?? ''
        })
      "
      width="720px"
      draggable
      destroy-on-close
      :close-on-click-modal="false"
    >
      <el-alert
        type="info"
        :closable="false"
        show-icon
        class="mb-3"
        :title="`${t('messageTemplate.variables')}: ${(current?.variables ?? []).join(' / ')}`"
      />
      <el-form label-width="90px">
        <el-form-item :label="t('messageTemplate.subject')">
          <el-input
            v-model="form.subject_template"
            :placeholder="t('messageTemplate.subjectPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('messageTemplate.body')">
          <el-input
            v-model="form.body_template"
            type="textarea"
            :rows="8"
            :placeholder="t('messageTemplate.bodyPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('loginPolicy.isActive')">
          <el-switch v-model="form.is_active" />
        </el-form-item>
      </el-form>
      <div v-if="previewResult" class="rounded bg-gray-50 p-3 dark:bg-gray-800">
        <div class="mb-1 text-sm font-medium">{{ previewResult.subject }}</div>
        <div
          class="text-xs whitespace-pre-wrap"
          v-html="previewResult.message"
        />
      </div>
      <template #footer>
        <el-button @click="dialogVisible = false">
          {{ t("buttons.cancel") }}
        </el-button>
        <el-button @click="preview">{{
          t("messageTemplate.preview")
        }}</el-button>
        <el-button type="primary" :loading="saving" @click="save">
          {{ t("buttons.sure") }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>
