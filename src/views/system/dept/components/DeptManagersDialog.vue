<script lang="ts" setup>
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { deptApi, type DeptManagerItem } from "@/api/identity/dept";
import { SUCCESS_CODE } from "@/api/types";
import MemberTagEditor from "@/views/system/components/MemberTagEditor.vue";

/**
 * 部门管理员任命（ReDialog 内容组件）：成员编辑交给 MemberTagEditor，
 * 本组件只做数据装配、搜索适配与载荷注册。
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
const editorRef = ref<InstanceType<typeof MemberTagEditor>>();

/** 远程搜索候选（≤20 条；无关键字时服务端返回空列表，需要输入才会出候选） */
async function searchUsers(keyword: string) {
  const res = await deptApi.userOptions(keyword ?? "");
  return res.code === SUCCESS_CODE
    ? ((res.data ?? []) as DeptManagerItem[])
    : [];
}

const getPayload = (): Record<string, unknown> | null =>
  editorRef.value?.getPayload() ?? null;

onMounted(() => props.onReady?.({ getPayload }));

defineExpose({ getPayload });
</script>

<template>
  <MemberTagEditor
    ref="editorRef"
    :members="managers"
    :hint="t('systemDept.managerHint')"
    :empty-text="t('systemDept.managerEmpty')"
    :placeholder="t('systemDept.managerPlaceholder')"
    testid="dept-manager-select"
    :no-change-text="t('systemDept.managerNoChange')"
    :search="searchUsers"
  />
</template>
