<script lang="ts" setup>
import { computed, h, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { DialogOptions } from "@/components/ReDialog";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { useConfirm } from "@/hooks/useConfirm";
import { message } from "@/utils/message";
import { formatDateTime } from "@/utils/format";
import { SUCCESS_CODE } from "@/api/types";
import {
  messageTemplateApi,
  type MessageTemplateItem
} from "@/api/system/security";
import type { RecordType } from "plus-pro-components";
import MessageTemplateForm from "./MessageTemplateForm.vue";
import TemplatePreview from "./TemplatePreview.vue";
import { normalizeError } from "@/utils/apiError";
import { TABLE_HEADER_CELL_STYLE } from "@/utils/tableHeader";

/**
 * 通知消息模板：代码内模板是默认值，此处维护可选的 DB 覆盖层。
 *
 * - 覆盖为空 = 使用代码默认（零行为变化）；
 * - 编辑走统一弹层（ReDialog + MessageTemplateForm），保存前可预览（样例数据渲染，不真实发送）；
 * - 列表「预览」动作只读渲染样例，不进入编辑；
 * - 重置即删除覆盖行。
 */
const { t } = useI18n();
const confirm = useConfirm();

const loading = ref(false);
const rows = ref<MessageTemplateItem[]>([]);
const formRef = ref<InstanceType<typeof MessageTemplateForm>>();

/** 列表工具行：名称搜索（客户端过滤，注册表规模小）与分类筛选 */
const keyword = ref("");
const categoryFilter = ref("");

const categoryOptions = computed(() => {
  const seen = new Map<string, string>();
  rows.value.forEach(row => {
    if (row.category && !seen.has(row.category)) {
      seen.set(row.category, row.category_label || row.category);
    }
  });
  return [...seen].map(([value, label]) => ({ value, label }));
});

const filteredRows = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  return rows.value.filter(row => {
    if (categoryFilter.value && row.category !== categoryFilter.value) {
      return false;
    }
    if (!kw) return true;
    return `${row.message_type_label ?? ""} ${row.message_type}`
      .toLowerCase()
      .includes(kw);
  });
});

/** 覆盖状态列：已自定义 / 代码默认；覆盖存在但停用时追加「停用」副标记 */
const overriddenLabel = (row: RecordType) =>
  row.has_override
    ? t("messageTemplate.overridden")
    : t("messageTemplate.defaultState");

const load = async () => {
  loading.value = true;
  try {
    const res = await messageTemplateApi.registry();
    if (res.code === SUCCESS_CODE) rows.value = res.data ?? [];
  } catch (error: unknown) {
    message(String((error as Error)?.message ?? error), { type: "error" });
  } finally {
    loading.value = false;
  }
};

const openEdit = (raw: RecordType) => {
  // el-table 插槽 row 为宽类型，按注册表契约收窄
  const row = raw as MessageTemplateItem;
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
      const res = await messageTemplateApi.save(payload).catch(normalizeError);
      if (res.code === SUCCESS_CODE) {
        message(t("messageTemplate.saveSuccess"), { type: "success" });
        done();
        await load();
        return;
      }
      if (res.detail) message(String(res.detail), { type: "error" });
      closeLoading();
    }
  };
  addDialog(options);
};

/** 只读预览：不进入编辑，直接用样例数据渲染当前生效模板 */
const previewRow = async (raw: RecordType) => {
  const row = raw as MessageTemplateItem;
  if (row.has_preview === false) {
    message(t("messageTemplate.previewUnsupported"), { type: "warning" });
    return;
  }
  const res = await messageTemplateApi
    .preview({ message_type: row.message_type })
    .catch(normalizeError);
  if (res.code !== SUCCESS_CODE || !res.data) {
    message(String(res.detail || t("results.failed")), { type: "error" });
    return;
  }
  const options: DialogOptions = {
    title: t("messageTemplate.previewTitle", {
      name: row.message_type_label ?? ""
    }),
    width: dialogSize("md"),
    hideFooter: true,
    destroyOnClose: true,
    contentRenderer: () =>
      h(TemplatePreview, {
        subject: res.data?.subject ?? "",
        message: res.data?.message ?? ""
      })
  };
  addDialog(options);
};

const reset = async (raw: RecordType) => {
  const row = raw as MessageTemplateItem;
  if (
    !(await confirm(
      t("messageTemplate.resetConfirm", {
        name: row.message_type_label || row.message_type
      })
    ))
  ) {
    return;
  }
  // 异常归一为可读失败结果：重置失败（权限被拒等）需给出可读原因
  const res = await messageTemplateApi
    .reset(row.message_type)
    .catch(normalizeError);
  if (res.code === SUCCESS_CODE) {
    message(t("messageTemplate.resetSuccess"), { type: "success" });
    await load();
  } else {
    message(String(res.detail), { type: "error" });
  }
};

onMounted(load);
</script>

<template>
  <div v-loading="loading">
    <!-- 心智模型说明：代码默认 → 覆盖层，随时可重置 -->
    <el-alert
      class="mb-3"
      :closable="false"
      :title="t('messageTemplate.panelHint')"
      show-icon
      type="info"
    />

    <!-- 工具行：名称搜索 + 分类筛选（注册表规模小，客户端过滤） -->
    <div class="mb-3 flex flex-wrap items-center gap-3">
      <el-input
        v-model="keyword"
        clearable
        style="width: 240px"
        :placeholder="t('messageTemplate.searchPlaceholder')"
      />
      <el-select
        v-model="categoryFilter"
        clearable
        style="width: 180px"
        :placeholder="t('messageTemplate.filterCategory')"
      >
        <el-option
          v-for="item in categoryOptions"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
    </div>

    <!-- 表头浅灰底与列表页 / 订阅表同口径，页签之间切换不再出现两种表格皮肤 -->
    <el-table
      :data="filteredRows"
      data-testid="template-table"
      :header-cell-style="TABLE_HEADER_CELL_STYLE"
    >
      <el-table-column
        prop="message_type_label"
        :label="t('messageTemplate.messageType')"
        min-width="180"
      />
      <el-table-column :label="t('messageTemplate.category')" width="100">
        <template #default="{ row }">
          <el-tag size="small" type="info" effect="plain">
            {{ row.category_label || row.category }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="t('messageTemplate.override')" width="140">
        <template #default="{ row }">
          <el-tag
            data-testid="template-override-tag"
            :type="row.has_override ? 'success' : 'info'"
            effect="light"
          >
            {{ overriddenLabel(row) }}
          </el-tag>
          <el-tag
            v-if="row.has_override && row.override?.is_active === false"
            class="ml-1"
            size="small"
            type="warning"
            effect="plain"
          >
            {{ t("messageTemplate.inactiveMark") }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="t('messageTemplate.updatedAt')" width="150">
        <template #default="{ row }">
          {{
            row.has_override && row.override?.updated_time
              ? formatDateTime(row.override.updated_time)
              : "—"
          }}
        </template>
      </el-table-column>
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
            data-testid="template-preview-row"
            :disabled="row.has_preview === false"
            link
            type="primary"
            @click="previewRow(row)"
          >
            {{ t("messageTemplate.preview") }}
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
