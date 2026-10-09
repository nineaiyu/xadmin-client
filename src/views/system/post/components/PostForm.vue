<script lang="ts" setup>
import { onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { deptApi } from "@/api/identity/dept";
import { hasAuth } from "@/router/utils";
import { SUCCESS_CODE } from "@/api/types";
import type { PostItem } from "@/api/identity/post";

/**
 * 岗位表单（C5：弹窗体系收敛到 ReDialog 的 content 组件形态）。
 *
 * 组件负责「表单数据 + 载荷生成」，提交与列表刷新由页面在 `beforeSure` 中处理。
 * 部门下拉依赖部门列表权限：无权限时保持为空并可留空（组织通用岗），不阻塞提交。
 */
defineOptions({ name: "PostForm" });

const props = defineProps<{
  /** 编辑时的原始行（null / 缺省 = 新建） */
  row?: PostItem | null;
}>();

const { t } = useI18n();
const isEdit = !!props.row;

/** 部门选项（部门列表权限缺失时为空，岗位可留空 = 组织通用岗） */
const deptOptions = ref<Array<{ pk: number; name: string }>>([]);

onMounted(() => {
  if (!hasAuth("list:SystemDept")) return;
  fetchAllRows(deptApi.list)
    .then(res => {
      if (res.code === SUCCESS_CODE && res.data) {
        deptOptions.value = (res.data.results ?? []) as Array<{
          pk: number;
          name: string;
        }>;
      }
    })
    .catch(() => undefined);
});

const form = reactive({
  name: props.row?.name ?? "",
  code: props.row?.code ?? "",
  dept: props.row?.dept ?? null,
  rank: props.row?.rank ?? 99,
  is_active: props.row?.is_active ?? true,
  description: props.row?.description ?? ""
});

/** 校验并生成提交载荷；校验失败返回 null（调用方保持弹窗打开） */
const getPayload = (): Record<string, unknown> | null => {
  if (!form.name.trim()) {
    message(t("post.nameRequired"), { type: "warning" });
    return null;
  }
  if (!form.code.trim()) {
    message(t("post.codeRequired"), { type: "warning" });
    return null;
  }
  return {
    name: form.name.trim(),
    code: form.code.trim(),
    dept: form.dept ?? null,
    rank: Number(form.rank) || 99,
    is_active: form.is_active,
    description: form.description ?? ""
  };
};

defineExpose({ getPayload });
</script>

<template>
  <el-form label-width="90px">
    <el-form-item :label="t('post.name')" required>
      <el-input
        v-model="form.name"
        maxlength="64"
        data-testid="post-name"
        @keyup.enter="getPayload"
      />
    </el-form-item>
    <el-form-item :label="t('post.code')" required>
      <el-input
        v-model="form.code"
        maxlength="64"
        data-testid="post-code"
        @keyup.enter="getPayload"
      />
    </el-form-item>
    <el-form-item :label="t('post.dept')">
      <el-select
        v-model="form.dept"
        clearable
        :placeholder="t('post.deptPlaceholder')"
        style="width: 100%"
      >
        <el-option
          v-for="item in deptOptions"
          :key="item.pk"
          :label="item.name"
          :value="item.pk"
        />
      </el-select>
    </el-form-item>
    <el-form-item :label="t('post.rank')">
      <el-input-number v-model="form.rank" :min="1" :max="9999" />
    </el-form-item>
    <el-form-item :label="t('post.isActive')">
      <el-switch v-model="form.is_active" />
    </el-form-item>
    <el-form-item :label="t('post.description')">
      <el-input v-model="form.description" maxlength="255" />
    </el-form-item>
    <el-form-item v-if="isEdit" :label="t('post.memberCount')">
      <el-tag type="info" size="small">{{ props.row?.user_count ?? 0 }}</el-tag>
    </el-form-item>
  </el-form>
</template>
