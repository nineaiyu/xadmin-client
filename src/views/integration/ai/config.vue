<script lang="ts" setup>
import { SUCCESS_CODE } from "@/api/types";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { h, onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessageBox } from "element-plus";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import {
  aiConfigApi,
  aiProfileApi,
  listAiProfileRows,
  type AiProfileItem
} from "@/api/system/ai";
import AiProfileForm from "./components/AiProfileForm.vue";

defineOptions({
  name: "AiAssistantConfig"
});

const { t } = useI18n();
// 档案权限
const canCreate = hasAuth("create:AiProfile");
const canEdit = hasAuth("partialUpdate:AiProfile");
const canDestroy = hasAuth("destroy:AiProfile");
const canActivate = hasAuth("activate:AiProfile");
const canDeactivate = hasAuth("deactivate:AiProfile");
const canTest = hasAuth("test:AiProfile");
// 全局开关走 Setting 通路权限
const canEditGlobal = hasAuth("partialUpdate:AiAssistantConfig");
const canReadGlobal = hasAuth("list:AiAssistantConfig");

const loading = ref(false);
const rows = ref<AiProfileItem[]>([]);

const loadRows = async () => {
  loading.value = true;
  try {
    const res = await fetchAllRows(aiProfileApi.list);
    rows.value = listAiProfileRows<AiProfileItem>(res);
  } finally {
    loading.value = false;
  }
};

/* ---------------- 全局开关（Setting 回落通路） ---------------- */
const globalLoading = ref(false);
const globalForm = reactive({
  AI_ASSISTANT_ENABLED: false,
  AI_NL_QUERY_ENABLED: false
});

const loadGlobal = async () => {
  if (!canReadGlobal) return;
  globalLoading.value = true;
  try {
    const res = await aiConfigApi.retrieve();
    if (res.code === SUCCESS_CODE) {
      const data = res.data as Record<string, unknown>;
      globalForm.AI_ASSISTANT_ENABLED = Boolean(data?.AI_ASSISTANT_ENABLED);
      globalForm.AI_NL_QUERY_ENABLED = Boolean(data?.AI_NL_QUERY_ENABLED);
    }
  } finally {
    globalLoading.value = false;
  }
};

const saveGlobal = async () => {
  const res = await aiConfigApi.partialUpdate({}, { ...globalForm });
  if (res.code === SUCCESS_CODE) {
    message(t("aiConfig.globalSaved"), { type: "success" });
  } else if (res.detail) {
    message(String(res.detail), { type: "warning" });
  }
};

/* ---------------- 配置档案 CRUD ---------------- */
const formRef = ref<InstanceType<typeof AiProfileForm>>();

/** 新建 / 编辑弹窗（C5：统一走 ReDialog，表单在 AiProfileForm 中） */
const openDialog = (row: AiProfileItem | null) => {
  formRef.value = undefined;
  addDialog({
    title: row ? t("aiConfig.edit") : t("aiConfig.create"),
    width: dialogSize("md"),
    draggable: true,
    destroyOnClose: true,
    closeOnClickModal: false,
    sureBtnLoading: true,
    contentRenderer: () => h(AiProfileForm, { ref: formRef, row }),
    beforeSure: async (done, { closeLoading }) => {
      const payload = formRef.value?.getPayload();
      if (!payload) {
        closeLoading();
        return;
      }
      const res = row
        ? await aiProfileApi.partialUpdate(row.pk, payload)
        : await aiProfileApi.create(payload);
      if (res.code === SUCCESS_CODE) {
        message(t("aiConfig.saveOk"), { type: "success" });
        await loadRows();
        done();
        return;
      }
      if (res.detail) message(String(res.detail), { type: "warning" });
      closeLoading();
    }
  });
};

const openCreate = () => openDialog(null);
const openEdit = (row: AiProfileItem) => openDialog(row);

const remove = async (row: AiProfileItem) => {
  await ElMessageBox.confirm(
    t("aiConfig.deleteConfirm"),
    t("aiConfig.profileTitle"),
    {
      type: "warning",
      confirmButtonText: t("buttons.sure"),
      cancelButtonText: t("buttons.cancel")
    }
  ).catch(() => null);
  const res = await aiProfileApi.destroy(row.pk);
  if (res.code === SUCCESS_CODE) {
    message(t("aiConfig.deleteDone"), { type: "success" });
    await loadRows();
  } else if (res.detail) {
    message(String(res.detail), { type: "warning" });
  }
};

const activate = async (row: AiProfileItem) => {
  await ElMessageBox.confirm(
    t("aiConfig.activateConfirm"),
    t("aiConfig.profileTitle"),
    {
      type: "warning",
      confirmButtonText: t("buttons.sure"),
      cancelButtonText: t("buttons.cancel")
    }
  ).catch(() => null);
  const res = await aiProfileApi.activate(row.pk);
  if (res.code === SUCCESS_CODE) {
    message(t("aiConfig.activateDone"), { type: "success" });
    await loadRows();
  } else if (res.detail) {
    message(String(res.detail), { type: "warning" });
  }
};

const deactivate = async (row: AiProfileItem) => {
  await ElMessageBox.confirm(
    t("aiConfig.deactivateConfirm"),
    t("aiConfig.profileTitle"),
    {
      type: "warning",
      confirmButtonText: t("buttons.sure"),
      cancelButtonText: t("buttons.cancel")
    }
  ).catch(() => null);
  const res = await aiProfileApi.deactivate(row.pk);
  if (res.code === SUCCESS_CODE) {
    message(t("aiConfig.deactivateDone"), { type: "success" });
    await loadRows();
  } else if (res.detail) {
    message(String(res.detail), { type: "warning" });
  }
};

const testProfile = async (row: AiProfileItem) => {
  const res = await aiProfileApi.test(row.pk);
  if (res.code === SUCCESS_CODE) {
    message(String(res.detail ?? t("aiConfig.testOk")), { type: "success" });
  } else if (res.detail) {
    message(String(res.detail), { type: "warning" });
  }
};

onMounted(() => {
  loadRows();
  loadGlobal();
});
</script>

<template>
  <div class="pr-[1%]">
    <!-- 全局开关：Setting 回落通路（档案未激活时仍生效） -->
    <el-card v-if="canReadGlobal" shadow="never" class="mb-3">
      <div class="flex flex-wrap items-center gap-6">
        <span class="font-semibold">{{ t("aiConfig.globalTitle") }}</span>
        <el-switch
          v-model="globalForm.AI_ASSISTANT_ENABLED"
          :disabled="!canEditGlobal"
          :active-text="t('aiConfig.assistantEnabled')"
          data-testid="ai-assistant-enabled"
        />
        <el-switch
          v-model="globalForm.AI_NL_QUERY_ENABLED"
          :disabled="!canEditGlobal"
          :active-text="t('aiConfig.nlQueryEnabled')"
          data-testid="ai-nl-query-enabled"
        />
        <el-button v-if="canEditGlobal" type="primary" @click="saveGlobal">
          {{ t("aiConfig.globalSave") }}
        </el-button>
      </div>
    </el-card>

    <!-- 配置档案 -->
    <el-card shadow="never">
      <div class="mb-3 flex items-center gap-2">
        <span class="font-semibold">{{ t("aiConfig.profileTitle") }}</span>
        <span class="text-xs text-gray-400">{{
          t("aiConfig.profileHint")
        }}</span>
        <div class="flex-1" />
        <el-button v-if="canCreate" type="primary" @click="openCreate">
          {{ t("aiConfig.create") }}
        </el-button>
      </div>
      <el-table v-loading="loading" :data="rows" data-testid="ai-profile-table">
        <el-table-column
          prop="name"
          :label="t('aiConfig.name')"
          min-width="120"
        />
        <el-table-column
          prop="model"
          :label="t('aiConfig.model')"
          min-width="120"
        />
        <el-table-column
          prop="base_url"
          :label="t('aiConfig.baseUrl')"
          min-width="200"
          show-overflow-tooltip
        />
        <el-table-column :label="t('aiConfig.temperature')" width="90">
          <template #default="{ row }">
            {{ (row as AiProfileItem).temperature ?? t("aiConfig.unset") }}
          </template>
        </el-table-column>
        <el-table-column :label="t('aiConfig.maxTokens')" width="110">
          <template #default="{ row }">
            {{ (row as AiProfileItem).max_tokens ?? t("aiConfig.unset") }}
          </template>
        </el-table-column>
        <el-table-column :label="t('aiConfig.isActive')" width="100">
          <template #default="{ row }">
            <el-tag
              size="small"
              :type="(row as AiProfileItem).is_active ? 'success' : 'info'"
            >
              {{
                (row as AiProfileItem).is_active
                  ? t("aiConfig.profileOn")
                  : t("aiConfig.profileOff")
              }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="remark"
          :label="t('aiConfig.remark')"
          min-width="120"
          show-overflow-tooltip
        />
        <el-table-column
          :label="t('aiConfig.actions')"
          width="240"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button
              v-if="canTest"
              link
              type="success"
              @click="testProfile(row as AiProfileItem)"
            >
              {{ t("aiConfig.test") }}
            </el-button>
            <el-button
              v-if="canEdit"
              link
              type="primary"
              @click="openEdit(row as AiProfileItem)"
            >
              {{ t("aiConfig.edit") }}
            </el-button>
            <el-button
              v-if="canActivate && !(row as AiProfileItem).is_active"
              link
              type="warning"
              @click="activate(row as AiProfileItem)"
            >
              {{ t("aiConfig.activate") }}
            </el-button>
            <el-button
              v-if="canDeactivate && (row as AiProfileItem).is_active"
              link
              type="info"
              @click="deactivate(row as AiProfileItem)"
            >
              {{ t("aiConfig.deactivate") }}
            </el-button>
            <el-button
              v-if="canDestroy"
              link
              type="danger"
              @click="remove(row as AiProfileItem)"
            >
              {{ t("aiConfig.delete") }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>
