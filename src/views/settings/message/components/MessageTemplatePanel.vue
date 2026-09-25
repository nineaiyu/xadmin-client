<script lang="ts" setup>
import { h, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessage, ElMessageBox } from "element-plus";
import type { DialogOptions } from "@/components/ReDialog";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { message } from "@/utils/message";
import {
  messageTemplateApi,
  type MessageTemplateItem
} from "@/api/system/security";
import type { RecordType } from "plus-pro-components";
import MessageTemplateForm from "./MessageTemplateForm.vue";

/**
 * 通知消息模板：代码内模板是默认值，此处维护可选的 DB 覆盖层。
 *
 * - 覆盖为空 = 使用代码默认（零行为变化）；
 * - 编辑走统一弹层（ReDialog + MessageTemplateForm），保存前可预览（样例数据渲染，不真实发送）；
 * - 重置即删除覆盖行。
 */
const { t } = useI18n();

const loading = ref(false);
const rows = ref<MessageTemplateItem[]>([]);
const formRef = ref<InstanceType<typeof MessageTemplateForm>>();

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
  formRef.value = undefined;
  const options: DialogOptions = {
    title: t("messageTemplate.editTitle", {
      name: row.message_type_label ?? ""
    }),
    width: dialogSize("lg"),
    draggable: true,
    destroyOnClose: true,
    closeOnClickModal: false,
    sureBtnLoading: true,
    contentRenderer: () => h(MessageTemplateForm, { ref: formRef, row }),
    beforeSure: async (done, { closeLoading }) => {
      const payload = formRef.value?.getPayload();
      if (!payload) {
        closeLoading();
        return;
      }
      // 异常归一为可读失败结果：避免请求异常时 beforeSure 抛错、弹窗 loading 悬挂
      const res = await messageTemplateApi.save(payload).catch(error => ({
        code: -1,
        detail: String((error as { detail?: string })?.detail ?? error)
      }));
      if (res.code === 1000) {
        message(t("messageTemplate.saveSuccess"), { type: "success" });
        done();
        await load();
        return;
      }
      if (res.detail) ElMessage.error(String(res.detail));
      closeLoading();
    }
  };
  addDialog(options);
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
    message(t("messageTemplate.resetSuccess"), { type: "success" });
    await load();
  } else {
    ElMessage.error(String(res.detail));
  }
};

onMounted(load);
</script>

<template>
  <div v-loading="loading">
    <el-table :data="rows" border data-testid="template-table">
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
          <el-tag
            data-testid="template-override-tag"
            :type="row.has_override ? 'success' : 'info'"
            effect="light"
          >
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
          <el-button
            data-testid="template-edit"
            link
            type="primary"
            @click="openEdit(row)"
          >
            {{ t("messageTemplate.edit") }}
          </el-button>
          <el-button
            v-if="row.has_override"
            data-testid="template-reset"
            link
            type="warning"
            @click="reset(row)"
          >
            {{ t("messageTemplate.reset") }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>
