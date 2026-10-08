<script lang="ts" setup>
// 成员标签编辑器：现有成员以标签展示（可移除）+ 远程搜索添加。
// 部门管理员任命与岗位成员分配共用——两者仅搜索接口、文案与只读形态不同，
// 由 props 承载，提交载荷（add / remove 增量）在此统一生成。
import { computed, ref } from "vue";
import { message } from "@/utils/message";
import type { MemberTagOption } from "./memberTag";

defineOptions({ name: "MemberTagEditor" });

const props = withDefaults(
  defineProps<{
    /** 现有成员（只读展示，removing 中的条目即时隐藏） */
    members: MemberTagOption[];
    /** 说明文案（只读/可编辑形态由调用方按权限决定） */
    hint: string;
    /** 空态文案 */
    emptyText: string;
    /** 无变更时的提示文案（提交前校验） */
    noChangeText: string;
    /** 只读模式：隐藏编辑入口，标签不可移除 */
    readonly?: boolean;
    /** 加载态（岗位成员异步加载时使用） */
    loading?: boolean;
    /** 搜索框占位（只读时不渲染） */
    placeholder?: string;
    /** 搜索框 data-testid（E2E 挂点，只读时不渲染） */
    testid?: string;
    /** 远程搜索候选（≤20 条由服务端保证） */
    search: (_keyword: string) => Promise<MemberTagOption[]>;
  }>(),
  { readonly: false, loading: false }
);

/** 待新增（尚未提交，去重由服务端幂等兜底） */
const adding = ref<MemberTagOption[]>([]);
/** 待移除的成员 pk */
const removing = ref<number[]>([]);
const options = ref<MemberTagOption[]>([]);
const searching = ref(false);

const displayMembers = computed(() =>
  props.members.filter(item => !removing.value.includes(item.pk))
);

async function searchUsers(keyword: string) {
  searching.value = true;
  try {
    options.value = (await props.search(keyword ?? "")) ?? [];
  } catch {
    options.value = [];
  } finally {
    searching.value = false;
  }
}

function markRemove(pk: number) {
  removing.value = [...removing.value, pk];
}

/** 校验并生成提交载荷；无变更返回 null（调用方保持弹窗打开）；只读模式恒 null */
const getPayload = (): Record<string, unknown> | null => {
  if (props.readonly) return null;
  const existing = new Set(props.members.map(item => item.pk));
  const add = adding.value
    .map(item => item.pk)
    .filter(pk => !existing.has(pk) || removing.value.includes(pk));
  const remove = [...removing.value];
  if (!add.length && !remove.length) {
    message(props.noChangeText, { type: "warning" });
    return null;
  }
  return { add, remove };
};

defineExpose({ getPayload });
</script>

<template>
  <div v-loading="loading">
    <div class="mb-2 text-sm text-(--el-text-color-secondary)">
      {{ hint }}
    </div>
    <div class="mb-3 flex flex-wrap gap-1">
      <el-tag
        v-for="item in displayMembers"
        :key="item.pk"
        :closable="!readonly"
        size="small"
        @close="markRemove(item.pk)"
      >
        {{ item.nickname || item.username }}
      </el-tag>
      <span
        v-if="!displayMembers.length"
        class="text-xs text-(--el-text-color-secondary)"
      >
        {{ emptyText }}
      </span>
    </div>
    <el-select
      v-if="!readonly"
      v-model="adding"
      multiple
      filterable
      remote
      reserve-keyword
      :remote-method="searchUsers"
      :loading="searching"
      :placeholder="placeholder"
      style="width: 100%"
      :data-testid="testid"
    >
      <el-option
        v-for="item in options"
        :key="item.pk"
        :label="item.nickname || item.username"
        :value="item"
      />
    </el-select>
  </div>
</template>
