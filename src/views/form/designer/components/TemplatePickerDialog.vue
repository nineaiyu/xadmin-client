<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useConfirm } from "@/hooks/useConfirm";
import { isSuccess } from "@/api/types";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { hasAuth } from "@/router/utils";
import {
  designerApi,
  dynamicFormApi,
  listRows,
  type DynamicFormItem
} from "@/api/dataset/dform";
import { message } from "@/utils/message";
import { normalizeError } from "@/utils/apiError";
import {
  ReReadonlyTable,
  type ReadonlyColumn
} from "@/components/ReReadonlyTable";

/**
 * 表单模板选择器：「从模板新建」的数据源。
 *
 * 模板与表单同表（is_template），列表走 `kind=templates`（权限与列表同口径）；
 * 选中后将模板 schema 交给调用方预填设计器，删除模板需要表单删除权限。
 */
defineOptions({ name: "DynamicFormTemplatePicker" });

/** 选中模板回调：由页面关闭弹窗并打开预填的设计器 */
type TemplatePickHandler = (_picked: DynamicFormItem) => void;

const props = defineProps<{
  onPick: TemplatePickHandler;
}>();

const { t } = useI18n();
const confirm = useConfirm();
const loading = ref(false);
const templates = ref<DynamicFormItem[]>([]);
const canDestroy = hasAuth("destroy:FormDesigner");

const load = async () => {
  loading.value = true;
  try {
    const res = await fetchAllRows(dynamicFormApi.list, {
      kind: "templates"
    });
    templates.value = listRows<DynamicFormItem>(res as never);
  } catch {
    templates.value = [];
  } finally {
    loading.value = false;
  }
};

/** 字段数（列表行只带字段数元数据；插槽行为 DefaultRow，脚本内统一收窄类型） */
const fieldCount = (row: unknown) =>
  (row as DynamicFormItem).schema_fields_count ?? 0;

/** 模板列表只读列（名称/字段数/描述/动作走具名插槽） */
const columns = computed<ReadonlyColumn[]>(() => [
  { label: t("dform.name"), minWidth: 150, slot: "name" },
  { label: t("dform.fieldCount"), width: 80, slot: "fieldCount" },
  { label: t("dform.description"), minWidth: 150, slot: "description" },
  { label: t("dform.actions"), width: 130, slot: "actions" }
]);

/** 模板行点击入口：先取详情补全 schema 全文，再交由调用方预填设计器 */
const pick = async (row: unknown) => {
  const item = row as DynamicFormItem;
  const res = await designerApi.retrieveForm(item.pk).catch(() => null);
  if (!res || !isSuccess(res) || !res.data) {
    message(t("results.failed"), { type: "warning" });
    return;
  }
  props.onPick(res.data);
};

const remove = async (row: DynamicFormItem) => {
  if (
    !(await confirm(t("dform.templateRemoveConfirm", { name: row.name }), {
      danger: true,
      draggable: true
    }))
  ) {
    return;
  }
  const res = await dynamicFormApi.destroy(row.pk).catch(normalizeError);
  if (isSuccess(res)) {
    message(t("dform.templateRemoved"), { type: "success" });
    await load();
    return;
  }
  if (res.detail) message(String(res.detail), { type: "warning" });
};

onMounted(load);
</script>

<template>
  <div>
    <ReReadonlyTable
      :columns="columns"
      :rows="templates"
      :loading="loading"
      size="small"
      max-height="360"
      :empty-text="t('dform.noTemplates')"
    >
      <template #name="{ row }">
        <span class="font-medium">{{ row.name }}</span>
      </template>
      <template #fieldCount="{ row }">
        {{ fieldCount(row) }}
      </template>
      <template #description="{ row }">
        <span class="text-xs text-(--el-text-color-regular)">{{
          row.description || "-"
        }}</span>
      </template>
      <template #actions="{ row }">
        <el-button
          link
          type="primary"
          size="small"
          data-testid="template-use"
          @click="pick(row)"
        >
          {{ t("dform.useTemplate") }}
        </el-button>
        <el-button
          v-if="canDestroy && row.is_owner !== false"
          link
          type="danger"
          size="small"
          @click="remove(row as DynamicFormItem)"
        >
          {{ t("dform.delete") }}
        </el-button>
      </template>
    </ReReadonlyTable>
  </div>
</template>
