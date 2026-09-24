<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessage } from "element-plus";
import { SUCCESS_CODE } from "@/api/types";
import { tagApi, type TagItem } from "@/api/system/tag";

/**
 * 通用打标面板：单对象打标 / 批量打标（追加·移除·替换）+ 弹窗内新建标签。
 *
 * - 单对象（pk）：回显对象当前标签，提交为全量替换语义；
 * - 批量（pks）：不回显（多对象标签可能各不相同），默认「追加」模式；
 * - 新建标签复用标签管理接口（需 create:Tag 权限），创建成功后自动选中，
 *   免去"打标要先去标签管理页建标签"的往返。
 */
defineOptions({ name: "TagAssignPanel" });

const props = withDefaults(
  defineProps<{
    /** 可打标资源标识（后端 TAGGABLE_MODELS 白名单，如 system.userinfo） */
    resource: string;
    /** 单对象 pk（与 pks 二选一） */
    pk?: string;
    /** 批量对象 pk 集合（与 pk 二选一） */
    pks?: string[];
    /** 批量场景：展示「追加/移除/替换」应用方式 */
    showMode?: boolean;
    /** 是否允许新建标签（由页面按 create:Tag 权限传入） */
    canCreate?: boolean;
  }>(),
  { pk: "", pks: () => [], showMode: false, canCreate: false }
);

const { t } = useI18n();
const loading = ref(false);
const tags = ref<TagItem[]>([]);
const selected = ref<string[]>([]);
const mode = ref<"add" | "remove" | "replace">("add");
const newName = ref("");
const creating = ref(false);

/** 批量模式（无单对象 pk、但有多个目标） */
const isBatch = computed(() => !props.pk && (props.pks?.length ?? 0) > 0);

const load = async () => {
  loading.value = true;
  try {
    const list = await tagApi.list({ page: 1, size: 1000 });
    if (list.code === SUCCESS_CODE) {
      tags.value = (list.data as { results?: TagItem[] })?.results ?? [];
    }
    if (props.pk) {
      const current = await tagApi.getObjectTags(props.resource, props.pk);
      if (current.code === SUCCESS_CODE) {
        selected.value = (current.data?.tags ?? []).map(item => item.pk);
      }
    }
  } finally {
    loading.value = false;
  }
};

onMounted(load);

/** 新建标签并自动选中；重名等失败原因由后端返回 */
const createTag = async () => {
  const name = newName.value.trim();
  if (!name || creating.value) return;
  creating.value = true;
  try {
    // 归一异常：API 抛错时给出可读提示（否则外层 catch 会把消息吞成通用失败）
    const res = (await tagApi.create({ name }).catch(error => ({
      code: -1,
      detail: String((error as { detail?: string })?.detail ?? error),
      data: undefined
    }))) as { code: number; detail?: string; data?: TagItem };
    if (res.code !== SUCCESS_CODE) {
      ElMessage.warning(String(res.detail || t("results.failed")));
      return;
    }
    const created = res.data ?? ({} as TagItem);
    if (created.pk && !tags.value.some(item => item.pk === created.pk)) {
      tags.value = [created, ...tags.value];
      selected.value = [...selected.value, created.pk];
    }
    newName.value = "";
    ElMessage.success(t("tag.createDone"));
  } finally {
    creating.value = false;
  }
};

/** 提交载荷：单对象走 replace 语义，批量按所选应用方式 */
const getPayload = () => ({
  resource: props.resource,
  pk: props.pk ?? "",
  pks: props.pks ?? [],
  tags: selected.value,
  mode: (props.showMode ? mode.value : "replace") as
    "add" | "remove" | "replace"
});

defineExpose({ getPayload });
</script>

<template>
  <div v-loading="loading">
    <el-select
      v-model="selected"
      multiple
      filterable
      collapse-tags
      collapse-tags-tooltip
      class="w-full"
      :placeholder="t('tag.assignPlaceholder')"
      data-testid="tag-assign-select"
    >
      <el-option
        v-for="tag in tags"
        :key="tag.pk"
        :label="tag.name"
        :value="tag.pk"
      />
    </el-select>

    <!-- 就地新建标签：省去「先去标签管理页建标签再回来打标」的往返 -->
    <div v-if="canCreate" class="mt-2 flex gap-2">
      <el-input
        v-model="newName"
        :placeholder="t('tag.newPlaceholder')"
        maxlength="50"
        clearable
        data-testid="tag-assign-new-name"
        @keyup.enter="createTag"
      />
      <el-button
        :loading="creating"
        :disabled="!newName.trim()"
        data-testid="tag-assign-create"
        @click="createTag"
      >
        {{ t("tag.create") }}
      </el-button>
    </div>

    <!-- 批量应用方式：批量场景默认「追加」，避免误覆盖各对象既有标签 -->
    <div v-if="showMode" class="mt-3">
      <div class="mb-1 text-xs opacity-70">{{ t("tag.modeLabel") }}</div>
      <el-radio-group v-model="mode" data-testid="tag-assign-mode">
        <el-radio value="add">{{ t("tag.modeAdd") }}</el-radio>
        <el-radio value="remove">{{ t("tag.modeRemove") }}</el-radio>
        <el-radio value="replace">{{ t("tag.modeReplace") }}</el-radio>
      </el-radio-group>
    </div>

    <div class="mt-2 text-xs opacity-60">
      {{ isBatch ? t("tag.batchHint") : t("tag.assignHint") }}
    </div>
  </div>
</template>
