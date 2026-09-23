<script lang="ts" setup>
import { SUCCESS_CODE } from "@/api/types";
import { computed, onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import { approvalInstanceApi } from "@/api/system/approvalFlow";
import { searchUserApi } from "@/api/system/search";

/**
 * 发起申请弹窗：选择启用中的流程 → 按 form_schema 渲染动态表单 → 提交。
 *
 * 流程选项走 `available-flows` 轻量接口（申请人无需流程定义管理权限）；
 * 动态字段统一按字符串收集（number 类型在提交前转数值，与后端条件运算口径一致）。
 */

defineOptions({ name: "ApprovalInstanceStart" });

type FormField = {
  key: string;
  label?: string;
  type?: string;
  required?: boolean;
  options?: string[];
};
type FlowOption = {
  pk: string;
  name: string;
  code: string;
  form_schema?: FormField[];
};

const props = defineProps<{
  /** 预填（「重新提交」场景）：预选流程 + 回填标题与表单内容 */
  initial?: {
    flow?: string;
    title?: string;
    formData?: Record<string, unknown>;
  } | null;
}>();

const emit = defineEmits<{ submitted: [] }>();
const { t } = useI18n();

const loading = ref(false);
const submitting = ref(false);
const flows = ref<FlowOption[]>([]);
const formRef = ref<FormInstance>();

const form = reactive<{
  flow: string;
  title: string;
  values: Record<string, string>;
  /** F-5 发起时追加抄送人（用户名；与节点级抄送合并去重） */
  ccUsers: string[];
}>({
  flow: "",
  title: "",
  values: {},
  ccUsers: []
});

/* ---------------- F-5 抄送人选择（用户名远程搜索，与流程设计器同口径） ---------------- */
const userOptions = ref<Array<{ username: string; label: string }>>([]);
const userLoading = ref(false);

/** 已选用户并入选项：未搜索时也能看到已选人员（后端只存用户名，无法反查昵称） */
function ensureUserOption(username: string) {
  if (!username) return;
  if (!userOptions.value.some(item => item.username === username)) {
    userOptions.value.push({ username, label: username });
  }
}

async function searchUsers(query: string) {
  if (!query) return;
  userLoading.value = true;
  try {
    const res = await searchUserApi.list({
      page: 1,
      size: 20,
      username: query
    });
    if (res.code === SUCCESS_CODE && res.data) {
      const rows =
        (
          res.data as {
            results?: Array<{ username: string; nickname?: string }>;
          }
        ).results ?? [];
      const fetched = rows.map(user => ({
        username: user.username,
        label: user.nickname
          ? `${user.nickname}(${user.username})`
          : user.username
      }));
      const fetchedNames = new Set(fetched.map(item => item.username));
      userOptions.value = [
        ...fetched,
        ...userOptions.value.filter(item => !fetchedNames.has(item.username))
      ];
    }
  } finally {
    userLoading.value = false;
  }
}

const currentFlow = computed(() =>
  flows.value.find(item => item.pk === form.flow)
);
const fields = computed(() => currentFlow.value?.form_schema ?? []);

const rules = computed<FormRules>(() => {
  const base: FormRules = {
    flow: [
      {
        required: true,
        message: t("systemApprovalInstance.flowRequired"),
        trigger: "change"
      }
    ],
    title: [
      {
        required: true,
        message: t("systemApprovalInstance.titleRequired"),
        trigger: "blur"
      }
    ]
  };
  fields.value.forEach(field => {
    if (field.required) {
      base[`values.${field.key}`] = [
        {
          required: true,
          message: t("systemApprovalInstance.fieldRequired", {
            label: field.label ?? field.key
          }),
          trigger: "blur"
        }
      ];
    }
  });
  return base;
});

/** 切换流程：重建动态字段值（清空旧流程残留，避免误提交） */
function onFlowChange() {
  const next: Record<string, string> = {};
  fields.value.forEach(field => {
    next[field.key] = "";
  });
  form.values = next;
  formRef.value?.clearValidate();
}

/** 预填（重新提交）：流程须仍可发起（available-flows 内），表单值按字段原样回填为字符串 */
function applyInitial() {
  const initial = props.initial;
  if (!initial?.flow) return;
  const flow = flows.value.find(item => item.pk === initial.flow);
  if (!flow) {
    ElMessage.warning(t("systemApprovalInstance.flowUnavailable"));
    return;
  }
  form.flow = initial.flow;
  form.title = initial.title ?? "";
  const next: Record<string, string> = {};
  for (const field of flow.form_schema ?? []) {
    const raw = initial.formData?.[field.key];
    next[field.key] =
      raw === null || raw === undefined ? "" : String(raw as string | number);
  }
  form.values = next;
}

async function loadFlows() {
  loading.value = true;
  try {
    const res = await approvalInstanceApi.availableFlows();
    // DataListResult 的行类型为通用 RecordType：按本接口契约收窄为 FlowOption
    flows.value = Array.isArray(res.data)
      ? (res.data as unknown as FlowOption[])
      : [];
    applyInitial();
  } finally {
    loading.value = false;
  }
}

async function submit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  submitting.value = true;
  try {
    const formData: Record<string, string | number> = {};
    fields.value.forEach(field => {
      const raw = form.values[field.key] ?? "";
      formData[field.key] =
        field.type === "number" && raw !== "" ? Number(raw) : raw;
    });
    const res = await approvalInstanceApi.create({
      flow: form.flow,
      title: form.title,
      form_data: formData,
      // F-5 抄送人：与流程节点级默认抄送合并（后端去重、不含申请人）
      cc_users: form.ccUsers
    });
    if (res.code === SUCCESS_CODE) {
      ElMessage.success(t("systemApprovalInstance.submitSuccess"));
      emit("submitted");
      return;
    }
    // 200 + 业务码非 1000（未配置流程 / 校验拒绝等）：全局拦截器只处理 HTTP 层错误，
    // 业务失败必须显式提示
    ElMessage.error(String(res.detail || t("results.failed")));
  } catch {
    // HTTP 层错误提示由拦截器统一处理
  } finally {
    submitting.value = false;
  }
}

onMounted(loadFlows);
</script>
<template>
  <!-- 单根包裹：ReDialog 会透传 change/close 监听器，fragment 根无法继承会告警 -->
  <div>
    <el-form
      ref="formRef"
      v-loading="loading"
      :model="form"
      :rules="rules"
      label-width="90px"
    >
      <el-form-item :label="t('systemApprovalInstance.formFlow')" prop="flow">
        <el-select
          v-model="form.flow"
          class="w-full"
          filterable
          :placeholder="t('systemApprovalInstance.flowPlaceholder')"
          @change="onFlowChange"
        >
          <el-option
            v-for="item in flows"
            :key="item.pk"
            :label="item.name"
            :value="item.pk"
          />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('systemApprovalInstance.formTitle')" prop="title">
        <el-input
          v-model="form.title"
          class="w-full"
          maxlength="128"
          :placeholder="t('systemApprovalInstance.titlePlaceholder')"
        />
      </el-form-item>
      <!-- F-5 抄送人：可选，留空则仅按流程节点配置的默认抄送 -->
      <el-form-item :label="t('approvalDiscussion.cc')">
        <el-select
          v-model="form.ccUsers"
          class="w-full"
          multiple
          filterable
          remote
          allow-create
          default-first-option
          reserve-keyword
          clearable
          :remote-method="searchUsers"
          :loading="userLoading"
          :placeholder="t('approvalDiscussion.ccPlaceholder')"
          @focus="form.ccUsers.forEach(ensureUserOption)"
        >
          <el-option
            v-for="user in userOptions"
            :key="user.username"
            :label="user.label"
            :value="user.username"
          />
        </el-select>
      </el-form-item>
      <el-form-item
        v-for="field in fields"
        :key="field.key"
        :label="field.label ?? field.key"
        :prop="`values.${field.key}`"
        :required="field.required"
      >
        <el-select
          v-if="field.type === 'select'"
          v-model="form.values[field.key]"
          class="w-full"
          :placeholder="t('systemApprovalInstance.fieldPlaceholder')"
        >
          <el-option
            v-for="option in field.options ?? []"
            :key="String(option)"
            :label="String(option)"
            :value="String(option)"
          />
        </el-select>
        <el-date-picker
          v-else-if="field.type === 'date'"
          v-model="form.values[field.key]"
          type="date"
          value-format="YYYY-MM-DD"
          class="w-full"
        />
        <el-input
          v-else
          v-model="form.values[field.key]"
          class="w-full"
          :type="field.type === 'textarea' ? 'textarea' : 'text'"
          :rows="3"
          :placeholder="t('systemApprovalInstance.fieldPlaceholder')"
        />
      </el-form-item>
    </el-form>
    <div class="flex justify-end mt-2">
      <el-button type="primary" :loading="submitting" @click="submit">
        {{ t("systemApprovalInstance.submit") }}
      </el-button>
    </div>
  </div>
</template>
