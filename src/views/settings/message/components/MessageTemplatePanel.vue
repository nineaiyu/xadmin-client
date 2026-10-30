<script lang="ts" setup>
import { computed, h, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { DialogOptions } from "@/components/ReDialog";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { useConfirm } from "@/hooks/useConfirm";
import { useDialogForm } from "@/hooks/useDialogForm";
import { message } from "@/utils/message";
import { formatDateTime } from "@/utils/format";
import { isSuccess } from "@/api/types";
import { hasAuth } from "@/router/utils";
import {
  messageTemplateApi,
  type MessageTemplateItem
} from "@/api/system/security";
import type { RecordType } from "plus-pro-components";
import MessageTemplateForm from "./MessageTemplateForm.vue";
import TemplatePreview from "./TemplatePreview.vue";
import { normalizeError } from "@/utils/apiError";
import {
  ReReadonlyTable,
  type ReadonlyColumn
} from "@/components/ReReadonlyTable";

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
// 模板动作各有独立权限点（save / preview / reset，挂在 SettingMessage 名下）：
// 只读角色不应看到编辑/预览/重置入口（点开必 403）
const canSave = hasAuth("save:SettingMessage");
const canPreview = hasAuth("preview:SettingMessage");
const canReset = hasAuth("reset:SettingMessage");

/** 保存载荷（与 MessageTemplateForm.getPayload 契约一致：message_type 为行主键） */
type MessageTemplatePayload = {
  message_type: string;
  subject_template: string;
  body_template: string;
  is_active: boolean;
};

const loading = ref(false);
const loadFailed = ref(false);
const resetting = ref("");
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

/** 模板注册表只读列（注册表规模小，过滤在客户端完成） */
const columns = computed<ReadonlyColumn[]>(() => [
  {
    prop: "message_type_label",
    label: t("messageTemplate.messageType"),
    minWidth: 180
  },
  { label: t("messageTemplate.category"), width: 100, slot: "category" },
  { label: t("messageTemplate.override"), width: 140, slot: "override" },
  { label: t("messageTemplate.updatedAt"), width: 150, slot: "updatedAt" },
  {
    label: t("commonLabels.operation"),
    width: 170,
    fixed: "right",
    slot: "actions"
  }
]);

const load = async () => {
  loading.value = true;
  loadFailed.value = false;
  try {
    const res = await messageTemplateApi.registry();
    if (isSuccess(res)) {
      rows.value = res.data ?? [];
    } else {
      loadFailed.value = true;
      if (res.detail) {
        message(String(res.detail), { type: "error" });
      }
    }
  } catch (error: unknown) {
    loadFailed.value = true;
    message(normalizeError(error).detail, { type: "error" });
  } finally {
    loading.value = false;
  }
};

const openEdit = (raw: RecordType) => {
  // el-table 插槽 row 为宽类型，按注册表契约收窄
  const row = raw as MessageTemplateItem;
  formRef.value = undefined;
  // 显式指定载荷泛型：ref 包装的实例类型无法从 getPayload 返回类型反推（TS 退化 unknown）
  const { beforeSure } = useDialogForm<MessageTemplatePayload>({
    formRef,
    submit: payload => messageTemplateApi.save(payload),
    successText: t("messageTemplate.saveSuccess"),
    failType: "error",
    // 先关弹窗再刷新（与手写弹窗行为一致）
    onSuccess: () => load()
  });
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
    beforeSure
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
  if (!isSuccess(res) || !res.data) {
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
  resetting.value = row.message_type;
  // 异常归一为可读失败结果：重置失败（权限被拒等）需给出可读原因
  const res = await messageTemplateApi
    .reset(row.message_type)
    .catch(normalizeError);
  resetting.value = "";
  if (isSuccess(res)) {
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

    <!-- 注册表加载失败：空表 + 可重试失败态，避免权限被回收时误读成“没有模板” -->
    <el-alert
      v-if="loadFailed"
      class="mb-3"
      type="error"
      :closable="false"
      show-icon
      :title="t('messageTemplate.loadFailed')"
    >
      <el-button link type="primary" size="small" @click="load">
        {{ t("buttons.reload") }}
      </el-button>
    </el-alert>

    <!-- 表头浅灰底与列表页 / 订阅表同口径，页签之间切换不再出现两种表格皮肤 -->
    <ReReadonlyTable
      :columns="columns"
      :rows="filteredRows"
      data-testid="template-table"
    >
      <template #category="{ row }">
        <el-tag size="small" type="info" effect="plain">
          {{ row.category_label || row.category }}
        </el-tag>
      </template>
      <template #override="{ row }">
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
      <template #updatedAt="{ row }">
        {{
          row.has_override && row.override?.updated_time
            ? formatDateTime(row.override.updated_time)
            : "—"
        }}
      </template>
      <template #actions="{ row }">
        <el-button
          v-if="canSave"
          data-testid="template-edit"
          link
          type="primary"
          @click="openEdit(row)"
        >
          {{ t("messageTemplate.edit") }}
        </el-button>
        <el-button
          v-if="canPreview"
          data-testid="template-preview-row"
          :disabled="row.has_preview === false"
          link
          type="primary"
          @click="previewRow(row)"
        >
          {{ t("messageTemplate.preview") }}
        </el-button>
        <el-button
          v-if="canReset && row.has_override"
          data-testid="template-reset"
          link
          type="warning"
          :loading="resetting === row.message_type"
          :disabled="Boolean(resetting)"
          @click="reset(row)"
        >
          {{ t("messageTemplate.reset") }}
        </el-button>
      </template>
    </ReReadonlyTable>
  </div>
</template>
