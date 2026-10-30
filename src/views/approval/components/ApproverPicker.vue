<script lang="ts" setup>
/**
 * 审批人选择器（仅审批域）：用户 / 角色 / 岗位三类取值共用一套交互。
 *
 * - `source="candidate"`：审批人候选目录（`useAssigneeCandidates`，按页面注入
 *   对应权限口径的端点）→ el-select；已选值自动并入选项回显，用户支持远程搜索，
 *   三类都允许直接输入 code / 用户名兜底；
 * - `source="search"`：SearchPicker 表格面板（加签 / 转交，权限点由调用方控制
 *   是否渲染本组件）。
 *
 * 载荷形状保持调用方原样：字符串（逗号分隔）进 → 字符串出，数组进 → 数组出；
 * `source="search"` 时原样透传 SearchPicker 的 `{pk,label}` 载荷。
 */
import { computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import SearchPicker from "@/components/SearchPicker";
import type { CandidateFetcher } from "@/views/approval/utils/useAssigneeCandidates";
import { joinValues, splitValues } from "@/views/approval/utils/assigneeValues";
import { useSharedAssigneeCandidates } from "./useSharedCandidates";

defineOptions({ name: "ApprovalApproverPicker", inheritAttrs: false });

type ApproverType = "user" | "role" | "post";

const props = withDefaults(
  defineProps<{
    modelValue?: string | string[] | object | object[];
    type: ApproverType;
    multiple?: boolean;
    size?: "" | "default" | "small" | "large";
    source?: "candidate" | "search";
    /** 候选目录被截断时在下方显示提示（页面级提示已存在时可不开） */
    truncatedHint?: boolean;
    /** 角色 / 岗位选项附带 code（规则页文案口径） */
    showCode?: boolean;
    /** 候选目录端点：流程设计器与规则页各用自己 list 权限同口径的端点 */
    fetcher?: CandidateFetcher;
  }>(),
  {
    modelValue: undefined,
    multiple: true,
    size: "small",
    source: "candidate",
    truncatedHint: false,
    showCode: false,
    fetcher: undefined
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: unknown];
  change: [value: unknown];
}>();

const { t } = useI18n();

/** 仅候选目录模式才请求目录（search 模式不应额外触发候选端点） */
const candidates =
  props.source === "candidate"
    ? useSharedAssigneeCandidates(props.fetcher)
    : null;

const userOptions = computed(() => candidates?.userOptions.value ?? []);
const userLoading = computed(() => candidates?.userLoading.value ?? false);
const candidateTruncated = computed(
  () => candidates?.candidateTruncated.value ?? false
);
const roleOptions = computed(() => candidates?.roleOptions.value ?? []);
const postOptions = computed(() => candidates?.postOptions.value ?? []);

const searchUsers = (query: string) => {
  void candidates?.searchUsers(query);
};
const ensureUserOption = (username: string) => {
  candidates?.ensureUserOption(username);
};

/** 已选值：兼容逗号串（流程节点）与数组（规则级次 / 抄送人）两种回显 */
const selectedValues = computed<string[]>(() =>
  Array.isArray(props.modelValue)
    ? props.modelValue.map(String)
    : splitValues(String(props.modelValue ?? ""))
);

/** 多选回写：字符串进字符串出、数组进数组出，保持各页载荷契约 */
function emitCandidateValue(value: unknown) {
  const list = (
    Array.isArray(value) ? value : value == null ? [] : [value]
  ).map(String);
  const next =
    typeof props.modelValue === "string" || props.modelValue === undefined
      ? joinValues(list)
      : list;
  emit("update:modelValue", next);
  emit("change", next);
}

const candidateModel = computed(() =>
  props.multiple ? selectedValues.value : selectedValues.value[0]
);

/** 已选用户并入候选选项（未搜索时也能看到昵称/用户名回显） */
function ensureSelectedUsers() {
  if (props.type !== "user") return;
  selectedValues.value.forEach(ensureUserOption);
}

watch(
  () => (props.type === "user" ? userOptions.value.length : 0),
  ensureSelectedUsers,
  { immediate: true }
);

/** search 模式：SearchPicker 载荷原样透传 */
const searchValue = computed({
  get: () => props.modelValue as object | object[] | string | undefined,
  set: value => {
    emit("update:modelValue", value);
    emit("change", value);
  }
});

const roleOrPostLabel = (item: { code: string; name: string }) =>
  props.showCode ? `${item.name}(${item.code})` : item.name;
</script>

<template>
  <div class="w-full">
    <SearchPicker
      v-if="source === 'search'"
      v-model="searchValue"
      :entity="type"
      :multiple="multiple"
      v-bind="$attrs"
    />
    <template v-else>
      <!-- 用户：远程搜索，允许直接输入用户名兜底 -->
      <el-select
        v-if="type === 'user'"
        :model-value="candidateModel"
        :multiple="multiple"
        :size="size"
        filterable
        remote
        allow-create
        default-first-option
        reserve-keyword
        :remote-method="searchUsers"
        :loading="userLoading"
        v-bind="$attrs"
        @focus="ensureSelectedUsers"
        @update:model-value="emitCandidateValue"
      >
        <el-option
          v-for="user in userOptions"
          :key="user.username"
          :label="user.label"
          :value="user.username"
        />
      </el-select>
      <!-- 角色 / 岗位：下拉选择，允许直接输入 code 兜底 -->
      <el-select
        v-else
        :model-value="candidateModel"
        :multiple="multiple"
        :size="size"
        filterable
        allow-create
        default-first-option
        v-bind="$attrs"
        @update:model-value="emitCandidateValue"
      >
        <el-option
          v-for="item in type === 'role' ? roleOptions : postOptions"
          :key="item.code"
          :label="roleOrPostLabel(item)"
          :value="item.code"
        />
      </el-select>
      <el-alert
        v-if="truncatedHint && candidateTruncated"
        type="warning"
        :closable="false"
        class="mt-1"
        :title="t('approval.candidateTruncated')"
      />
    </template>
  </div>
</template>
