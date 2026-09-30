<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import { SUCCESS_CODE } from "@/api/types";
import { deptApi, type DeptManagerItem } from "@/api/system/dept";

/**
 * 部门管理员任命（ReDialog 内容组件）：现有管理员以标签展示（可移除）+ 远程搜索添加。
 *
 * 提交走增量载荷 `{add, remove}`（服务端幂等，并同步装配预置角色与数据权限规则）；
 * 初始清单直接取行数据快照（列表已带 managers 列），不额外请求。
 * 组件就绪时经 `onReady` 向调用方注册载荷读取口（contentRenderer 渲染链路下
 * 模板 ref 不落位——保存回调拿不到组件实例，载荷被静默短路）。
 */
defineOptions({ name: "DeptManagersDialog" });

const props = defineProps<{
  row: {
    pk: number | string;
    name?: string;
    managers?: DeptManagerItem[];
  };
  onReady?: (_api: {
    getPayload: () => Record<string, unknown> | null;
  }) => void;
}>();

const { t } = useI18n();

const managers = ref<DeptManagerItem[]>([...(props.row.managers ?? [])]);
/** 待新增（尚未提交，去重由服务端幂等兜底） */
const adding = ref<DeptManagerItem[]>([]);
/** 待移除的管理员 pk */
const removing = ref<number[]>([]);
const options = ref<DeptManagerItem[]>([]);
const searching = ref(false);

const displayMembers = computed(() =>
  managers.value.filter(item => !removing.value.includes(item.pk))
);

/** 远程搜索候选（≤20 条；服务端在无关键字时返回空列表，需要输入才会出候选） */
async function searchUsers(keyword: string) {
  searching.value = true;
  try {
    const res = await deptApi.userOptions(keyword ?? "");
    if (res.code === SUCCESS_CODE) {
      options.value = (res.data ?? []) as DeptManagerItem[];
    }
  } catch {
    options.value = [];
  } finally {
    searching.value = false;
  }
}

function markRemove(pk: number) {
  removing.value = [...removing.value, pk];
}

/** 校验并生成提交载荷；无变更返回 null（调用方保持弹窗打开） */
const getPayload = (): Record<string, unknown> | null => {
  const existing = new Set(managers.value.map(item => item.pk));
  const add = adding.value
    .map(item => item.pk)
    .filter(pk => !existing.has(pk) || removing.value.includes(pk));
  const remove = [...removing.value];
  if (!add.length && !remove.length) {
    message(t("systemDept.managerNoChange"), { type: "warning" });
    return null;
  }
  return { add, remove };
};

onMounted(() => props.onReady?.({ getPayload }));

defineExpose({ getPayload });
</script>

<template>
  <div>
    <div class="mb-2 text-sm text-(--el-text-color-secondary)">
      {{ t("systemDept.managerHint") }}
    </div>
    <div class="mb-3 flex flex-wrap gap-1">
      <el-tag
        v-for="item in displayMembers"
        :key="item.pk"
        closable
        size="small"
        @close="markRemove(item.pk)"
      >
        {{ item.nickname || item.username }}
      </el-tag>
      <span
        v-if="!displayMembers.length"
        class="text-xs text-(--el-text-color-secondary)"
      >
        {{ t("systemDept.managerEmpty") }}
      </span>
    </div>
    <el-select
      v-model="adding"
      multiple
      filterable
      remote
      reserve-keyword
      :remote-method="searchUsers"
      :loading="searching"
      :placeholder="t('systemDept.managerPlaceholder')"
      style="width: 100%"
      data-testid="dept-manager-select"
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
