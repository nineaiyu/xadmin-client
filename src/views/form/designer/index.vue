<script lang="ts" setup>
import { SUCCESS_CODE } from "@/api/types";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { h, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import {
  dynamicFormApi,
  listRows,
  type DynamicFormItem
} from "@/api/system/dform";
import DynamicFormForm from "./components/DynamicFormForm.vue";

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
      await fetchAllRows(dynamicFormApi.list)
    );
  } finally {
    loading.value = false;
  }
};

/** 字段类型选项（收敛控件集） */
/** 新建 / 编辑弹窗（C5：统一走 ReDialog，字段设计器在 DynamicFormForm 中） */
const formRef = ref<InstanceType<typeof DynamicFormForm>>();

const openDialog = (row: DynamicFormItem | null) => {
  formRef.value = undefined;
  addDialog({
    title: row ? t("dform.edit") : t("dform.create"),
    width: dialogSize("lg"),
    top: "5vh",
    draggable: true,
    destroyOnClose: true,
    closeOnClickModal: false,
    sureBtnLoading: true,
    contentRenderer: () => h(DynamicFormForm, { ref: formRef, row }),
    beforeSure: async (done, { closeLoading }) => {
      const payload = formRef.value?.getPayload();
      if (!payload) {
        closeLoading();
        return;
      }
      // 异常归一为可读失败结果：避免请求异常时 beforeSure 抛错、弹窗 loading 悬挂
      const res = await (
        row
          ? dynamicFormApi.partialUpdate(row.pk, payload)
          : dynamicFormApi.create(payload)
      ).catch(error => ({
        code: -1,
        detail: String((error as { detail?: string })?.detail ?? error)
      }));
      if (res.code === SUCCESS_CODE) {
        message(t("dform.saveOk"), { type: "success" });
        // 先关弹窗再刷新列表（与原手写弹窗行为一致，避免刷新耗时导致弹窗滞留）
        done();
        await loadAll();
        return;
      }
      if (res.detail) message(String(res.detail), { type: "warning" });
      closeLoading();
    }
  });
};

const openCreate = () => openDialog(null);
const openEdit = (row: DynamicFormItem) => openDialog(row);

const remove = async (row: DynamicFormItem) => {
  const res = await dynamicFormApi.destroy(row.pk);
  if (res.code === SUCCESS_CODE) await loadAll();
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
  </div>
</template>
