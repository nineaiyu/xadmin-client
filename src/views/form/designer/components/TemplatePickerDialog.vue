<script lang="ts" setup>
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessageBox } from "element-plus";
import { SUCCESS_CODE } from "@/api/types";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { hasAuth } from "@/router/utils";
import {
  dynamicFormApi,
  listRows,
  type DynamicFormItem
} from "@/api/system/dform";
import { message } from "@/utils/message";

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

/** 字段数（插槽行为 DefaultRow，脚本内统一收窄类型） */
const fieldCount = (row: unknown) =>
  ((row as DynamicFormItem).schema?.fields ?? []).length;

/** 模板行点击入口：插槽行为 DefaultRow，统一在脚本内收窄类型 */
const pick = (row: unknown) => props.onPick(row as DynamicFormItem);

const remove = async (row: DynamicFormItem) => {
  try {
    await ElMessageBox.confirm(
      t("dform.templateRemoveConfirm", { name: row.name }),
      {
        confirmButtonText: t("buttons.sure"),
        cancelButtonText: t("buttons.cancel"),
        type: "warning",
        confirmButtonClass: "el-button--danger",
        draggable: true
      }
    );
  } catch {
    return;
  }
  const res = await dynamicFormApi.destroy(row.pk).catch(error => ({
    code: -1,
    detail: String((error as { detail?: string })?.detail ?? error)
  }));
  if (res.code === SUCCESS_CODE) {
    message(t("dform.templateRemoved"), { type: "success" });
    await load();
    return;
  }
  if (res.detail) message(String(res.detail), { type: "warning" });
};

onMounted(load);
</script>

<template>
  <div v-loading="loading">
    <el-empty
      v-if="templates.length === 0"
      :description="t('dform.noTemplates')"
      :image-size="60"
    />
    <el-table v-else :data="templates" size="small" max-height="360">
      <el-table-column :label="t('dform.name')" min-width="150">
        <template #default="{ row }">
          <span class="font-medium">{{ row.name }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="t('dform.fieldCount')" width="80">
        <template #default="{ row }">
          {{ fieldCount(row) }}
        </template>
      </el-table-column>
      <el-table-column :label="t('dform.description')" min-width="150">
        <template #default="{ row }">
          <span class="text-xs text-(--el-text-color-regular)">{{
            row.description || "-"
          }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="t('dform.actions')" width="130">
        <template #default="{ row }">
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
            v-if="canDestroy"
            link
            type="danger"
            size="small"
            @click="remove(row as DynamicFormItem)"
          >
            {{ t("dform.delete") }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>
