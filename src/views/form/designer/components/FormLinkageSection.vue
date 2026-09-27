<script lang="ts" setup>
import { h, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElTag } from "element-plus";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import type { FormField, FormLinkage } from "@/api/dataset/dform";
import FormLinkageDialog from "./FormLinkageDialog.vue";
import {
  LINKAGE_EFFECTS,
  LINKAGE_OPS,
  VALUED_LINKAGE_OPS,
  linkageFieldLabel,
  linkageValueText
} from "../utils/linkageMeta";

/**
 * 联动规则清单（设计器内嵌区块）：新增/编辑/删除规则。
 *
 * 规则粒度 = 单目标字段；弹窗内可多选目标，保存时展开为多条同条件规则
 * （编辑既有规则时以「替换该条」语义落回清单）。
 */
defineOptions({ name: "FormLinkageSection" });

const props = defineProps<{
  fields: FormField[];
  modelValue: FormLinkage[];
}>();

const emit = defineEmits<{
  "update:modelValue": [FormLinkage[]];
}>();

const { t } = useI18n();
const dialogRef = ref<InstanceType<typeof FormLinkageDialog>>();

const opLabel = (op: string) =>
  t(
    LINKAGE_OPS.find(item => item.value === op)?.labelKey ?? "dform.linkageOpEq"
  );

const effectLabel = (effect: string) =>
  t(
    LINKAGE_EFFECTS.find(item => item.value === effect)?.labelKey ??
      "dform.linkageEffectHide"
  );

const effectTagType = (effect: string) =>
  effect === "hide"
    ? "info"
    : effect === "require"
      ? "warning"
      : effect === "optional"
        ? "success"
        : "primary";

const condText = (rule: FormLinkage) => {
  const head = `${linkageFieldLabel(props.fields, rule.field)} ${opLabel(rule.op)}`;
  return VALUED_LINKAGE_OPS.includes(rule.op)
    ? `${head} ${linkageValueText(rule)}`
    : head;
};

const openDialog = (index?: number) => {
  dialogRef.value = undefined;
  const editing = index === undefined ? null : props.modelValue[index];
  addDialog({
    title: editing ? t("dform.linkageEdit") : t("dform.linkageAdd"),
    width: dialogSize("sm"),
    draggable: true,
    destroyOnClose: true,
    closeOnClickModal: false,
    contentRenderer: () =>
      h(FormLinkageDialog, {
        ref: dialogRef,
        fields: props.fields,
        rule: editing
      }),
    beforeSure: (done, { closeLoading }) => {
      const rules = dialogRef.value?.getRules();
      if (!rules) {
        closeLoading();
        return;
      }
      const next = [...props.modelValue];
      if (index === undefined) next.push(...rules);
      else next.splice(index, 1, ...rules);
      emit("update:modelValue", next);
      done();
    }
  });
};

const remove = (index: number) => {
  const next = [...props.modelValue];
  next.splice(index, 1);
  emit("update:modelValue", next);
};
</script>

<template>
  <div>
    <div class="mb-2 flex items-center gap-2">
      <span class="text-sm font-medium">{{ t("dform.linkage") }}</span>
      <el-tag size="small" type="info" effect="plain">
        {{ modelValue.length }}
      </el-tag>
      <div class="flex-1" />
      <el-button
        size="small"
        type="primary"
        plain
        data-testid="linkage-add"
        @click="openDialog()"
      >
        {{ t("dform.linkageAdd") }}
      </el-button>
    </div>
    <el-table
      :data="modelValue"
      size="small"
      max-height="220"
      :empty-text="t('dform.linkageNone')"
    >
      <el-table-column :label="t('dform.linkageCond')" min-width="220">
        <template #default="{ row }">
          <span class="text-xs">{{ condText(row as FormLinkage) }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="t('dform.linkageTarget')" min-width="160">
        <template #default="{ row }">
          <span class="text-xs">{{
            linkageFieldLabel(fields, (row as FormLinkage).target)
          }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="t('dform.linkageEffect')" width="100">
        <template #default="{ row }">
          <el-tag
            size="small"
            effect="plain"
            :type="effectTagType((row as FormLinkage).effect)"
          >
            {{ effectLabel((row as FormLinkage).effect) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="t('dform.actions')" width="120">
        <template #default="{ $index }">
          <el-button
            link
            type="primary"
            size="small"
            data-testid="linkage-edit"
            @click="openDialog($index)"
          >
            {{ t("dform.edit") }}
          </el-button>
          <el-button link type="danger" size="small" @click="remove($index)">
            {{ t("dform.delete") }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <div class="mt-1 text-xs text-(--el-text-color-secondary)">
      {{ t("dform.linkageHint") }}
    </div>
  </div>
</template>
