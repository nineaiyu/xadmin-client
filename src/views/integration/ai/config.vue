<script lang="ts" setup>
import { onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessageBox } from "element-plus";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import {
  aiConfigApi,
  aiProfileApi,
  listAiProfileRows,
  type AiProfileItem
} from "@/api/system/ai";

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
    const res = await aiProfileApi.list({ page_size: 100 });
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
    if (res.code === 1000) {
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
  if (res.code === 1000) {
    message(t("aiConfig.globalSaved"), { type: "success" });
  } else if (res.detail) {
    message(String(res.detail), { type: "warning" });
  }
};

/* ---------------- 配置档案 CRUD ---------------- */
const dialog = ref(false);
const saving = ref(false);
const editingPk = ref<string | null>(null);

const numberOrNull = (value: unknown): number | null =>
  value === "" || value === undefined || value === null ? null : Number(value);

const emptyForm = () => ({
  name: "",
  base_url: "",
  api_key: "",
  model: "",
  temperature: 0.2 as number | null,
  max_tokens: null as number | null,
  top_p: null as number | null,
  frequency_penalty: null as number | null,
  presence_penalty: null as number | null,
  stop: "",
  seed: null as number | null,
  timeout: 60,
  max_retries: 0,
  context_limit: 20,
  persona: "",
  is_active: false,
  remark: ""
});

const form = reactive(emptyForm());

const openCreate = () => {
  editingPk.value = null;
  Object.assign(form, emptyForm());
  dialog.value = true;
};

const openEdit = (row: AiProfileItem) => {
  editingPk.value = row.pk;
  Object.assign(form, emptyForm(), {
    ...JSON.parse(JSON.stringify(row)),
    api_key: ""
  });
  dialog.value = true;
};

const submit = async () => {
  if (!form.name.trim() || !form.base_url.trim() || !form.model.trim()) {
    message(t("aiConfig.required"), { type: "warning" });
    return;
  }
  saving.value = true;
  try {
    const payload: Record<string, unknown> = {
      name: form.name,
      base_url: form.base_url,
      model: form.model,
      temperature: numberOrNull(form.temperature),
      max_tokens: numberOrNull(form.max_tokens),
      top_p: numberOrNull(form.top_p),
      frequency_penalty: numberOrNull(form.frequency_penalty),
      presence_penalty: numberOrNull(form.presence_penalty),
      stop: form.stop,
      seed: numberOrNull(form.seed),
      timeout: form.timeout,
      max_retries: form.max_retries,
      context_limit: form.context_limit,
      persona: form.persona,
      is_active: form.is_active,
      remark: form.remark
    };
    // 编辑时留空 api_key = 沿用原密钥
    if (form.api_key || !editingPk.value) {
      payload.api_key = form.api_key;
    }
    const res = editingPk.value
      ? await aiProfileApi.partialUpdate(editingPk.value, payload)
      : await aiProfileApi.create(payload);
    if (res.code === 1000) {
      message(t("aiConfig.saveOk"), { type: "success" });
      dialog.value = false;
      await loadRows();
    } else if (res.detail) {
      message(String(res.detail), { type: "warning" });
    }
  } finally {
    saving.value = false;
  }
};

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
  if (res.code === 1000) {
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
  if (res.code === 1000) {
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
  if (res.code === 1000) {
    message(t("aiConfig.deactivateDone"), { type: "success" });
    await loadRows();
  } else if (res.detail) {
    message(String(res.detail), { type: "warning" });
  }
};

const testProfile = async (row: AiProfileItem) => {
  const res = await aiProfileApi.test(row.pk);
  if (res.code === 1000) {
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

    <el-dialog
      v-model="dialog"
      :title="editingPk ? t('aiConfig.edit') : t('aiConfig.create')"
      width="640px"
    >
      <el-form label-width="120px">
        <el-divider content-position="left">{{
          t("aiConfig.sectionBasic")
        }}</el-divider>
        <el-form-item :label="t('aiConfig.name')" required>
          <el-input
            v-model="form.name"
            maxlength="64"
            data-testid="ai-profile-name"
          />
        </el-form-item>
        <el-form-item :label="t('aiConfig.baseUrl')" required>
          <el-input
            v-model="form.base_url"
            placeholder="https://api.deepseek.com/v1"
          />
        </el-form-item>
        <el-form-item :label="t('aiConfig.apiKey')" :required="!editingPk">
          <el-input
            v-model="form.api_key"
            type="password"
            show-password
            :placeholder="
              editingPk ? t('aiConfig.apiKeyKeep') : t('aiConfig.apiKeyHint')
            "
          />
        </el-form-item>
        <el-form-item :label="t('aiConfig.model')" required>
          <el-input v-model="form.model" placeholder="deepseek-chat" />
        </el-form-item>
        <el-form-item :label="t('aiConfig.remark')">
          <el-input v-model="form.remark" maxlength="255" />
        </el-form-item>
        <el-form-item :label="t('aiConfig.isActive')">
          <el-switch v-model="form.is_active" />
        </el-form-item>

        <el-divider content-position="left">{{
          t("aiConfig.sectionSampling")
        }}</el-divider>
        <el-form-item :label="t('aiConfig.temperature')">
          <el-input-number
            v-model="form.temperature"
            :min="0"
            :max="2"
            :step="0.1"
            :precision="2"
          />
        </el-form-item>
        <el-form-item :label="t('aiConfig.maxTokens')">
          <el-input-number v-model="form.max_tokens" :min="1" :step="256" />
        </el-form-item>
        <el-form-item :label="t('aiConfig.topP')">
          <el-input-number
            v-model="form.top_p"
            :min="0"
            :max="1"
            :step="0.05"
            :precision="2"
          />
        </el-form-item>
        <el-form-item :label="t('aiConfig.frequencyPenalty')">
          <el-input-number
            v-model="form.frequency_penalty"
            :min="-2"
            :max="2"
            :step="0.1"
            :precision="1"
          />
        </el-form-item>
        <el-form-item :label="t('aiConfig.presencePenalty')">
          <el-input-number
            v-model="form.presence_penalty"
            :min="-2"
            :max="2"
            :step="0.1"
            :precision="1"
          />
        </el-form-item>
        <el-form-item :label="t('aiConfig.stop')">
          <el-input
            v-model="form.stop"
            :placeholder="t('aiConfig.stopHint')"
            maxlength="255"
          />
        </el-form-item>
        <el-form-item :label="t('aiConfig.seed')">
          <el-input-number v-model="form.seed" :step="1" />
        </el-form-item>

        <el-divider content-position="left">{{
          t("aiConfig.sectionBehavior")
        }}</el-divider>
        <el-form-item :label="t('aiConfig.timeout')">
          <el-input-number
            v-model="form.timeout"
            :min="5"
            :max="300"
            :step="5"
          />
        </el-form-item>
        <el-form-item :label="t('aiConfig.maxRetries')">
          <el-input-number
            v-model="form.max_retries"
            :min="0"
            :max="3"
            :step="1"
          />
        </el-form-item>
        <el-form-item :label="t('aiConfig.contextLimit')">
          <el-input-number
            v-model="form.context_limit"
            :min="2"
            :max="50"
            :step="1"
          />
        </el-form-item>
        <el-form-item :label="t('aiConfig.persona')">
          <el-input
            v-model="form.persona"
            type="textarea"
            :rows="3"
            maxlength="2000"
            :placeholder="t('aiConfig.personaHint')"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">{{ t("buttons.cancel") }}</el-button>
        <el-button type="primary" :loading="saving" @click="submit">
          {{ t("buttons.sure") }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>
