<script setup lang="ts">
import { onMounted, ref, watch, nextTick } from "vue";
import { formRules } from "./utils/rule";
import { FormProps } from "./utils/types";
import { useRole } from "./utils/hook";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { isAllEmpty } from "@pureadmin/utils";
import { match } from "pinyin-pro";
import { useI18n } from "vue-i18n";
import { transformI18n } from "@/plugins/i18n";
import FromQuestion from "@/components/FromQuestion/index.vue";

const props = withDefaults(defineProps<FormProps>(), {
  formInline: () => ({
    name: "",
    code: "",
    description: "",
    menu: [],
    is_active: true,
    auto_bind: true
  })
});
const customNodeClass = data => {
  if (data.menu_type === 0) {
    return "is-penultimate";
  } else if (data.menu_type === 1) {
    return "is-permission";
  }
  return null;
};
const { locale } = useI18n();

const filterMenuNode = (value: string, data: any) => {
  if (!value) return true;
  return value
    ? transformI18n(data.meta?.title)
        .toLocaleLowerCase()
        .includes(value.toLocaleLowerCase().trim()) ||
        (locale.value === "zh" &&
          !isAllEmpty(
            match(
              transformI18n(data.meta?.title).toLocaleLowerCase(),
              value.toLocaleLowerCase().trim()
            )
          ))
    : false;
};
const ruleFormRef = ref();
const treeRoleRef = ref();
const newFormInline = ref(props.formInline);
const searchValue = ref("");
function getRef() {
  return ruleFormRef.value;
}
function getTreeRef() {
  return treeRoleRef.value;
}
const { menuTreeData, getMenuData, loading } = useRole(treeRoleRef);
const { t } = useI18n();
const ifEnableOptions = [
  { label: t("labels.enable"), value: true },
  { label: t("labels.disable"), value: false }
];
watch(searchValue, val => {
  treeRoleRef.value!.filter(val);
});
defineExpose({ getRef, getTreeRef });
onMounted(() => {
  getMenuData();
  nextTick(() => {
    treeRoleRef.value!.setCheckedKeys(newFormInline.value.menu, false);
  });
});
</script>

<template>
  <el-form
    ref="ruleFormRef"
    :model="newFormInline"
    :rules="formRules"
    label-width="140px"
  >
    <el-form-item :label="t('role.name')" prop="name">
      <el-input
        v-model="newFormInline.name"
        clearable
        :placeholder="t('role.verifyRoleName')"
      />
    </el-form-item>

    <el-form-item :label="t('role.code')" prop="code">
      <el-input
        v-model="newFormInline.code"
        clearable
        :placeholder="t('role.verifyRoleCode')"
      />
    </el-form-item>
    <el-form-item :label="t('labels.status')" prop="is_active">
      <el-radio-group v-model="newFormInline.is_active">
        <el-radio-button
          v-for="item in ifEnableOptions"
          :key="item.label"
          :label="item.value"
          >{{ item.label }}</el-radio-button
        >
      </el-radio-group>
    </el-form-item>
    <el-form-item :label="t('role.autoBind')" prop="auto_bind">
      <template #label>
        <from-question
          :label="t('role.autoBind')"
          :description="t('role.autoBindDesc')"
        />
      </template>
      <el-radio-group v-model="newFormInline.auto_bind">
        <el-radio-button
          v-for="item in ifEnableOptions"
          :key="item.label"
          :label="item.value"
          >{{ item.label }}</el-radio-button
        >
      </el-radio-group>
    </el-form-item>
    <el-form-item :label="t('labels.remark')">
      <el-input
        v-model="newFormInline.description"
        :placeholder="t('labels.verifyRemark')"
        type="textarea"
      />
    </el-form-item>
    <el-form-item :label="t('role.permissions')">
      <el-input
        v-model="searchValue"
        class="filter-item"
        clearable
        :placeholder="t('buttons.hssearch')"
      />
      <el-tree
        ref="treeRoleRef"
        v-loading="loading"
        :data="menuTreeData"
        show-checkbox
        node-key="pk"
        highlight-current
        default-expand-all
        check-strictly
        :filter-node-method="filterMenuNode"
        :expand-on-click-node="true"
        :props="{ class: customNodeClass }"
      >
        <template #default="{ data }">
          <div style="height: 30px">
            <span
              :class="[
                'pr-1',
                'rounded',
                'flex',
                'items-center',
                'select-none'
              ]"
            >
              <component :is="useRenderIcon(data.meta.icon)" class="m-1" />
              {{ `${transformI18n(data.meta.title)}` }}</span
            >
          </div>
        </template>
      </el-tree>
    </el-form-item>
  </el-form>
</template>
<style lang="scss" scoped>
:deep(.el-tree-node__content) {
  height: 30px;
  font-size: 16px;
  line-height: 30px;
}

:deep(.is-penultimate > .el-tree-node__content) {
  color: #626aef;
}

:deep(.is-permission > .el-tree-node__content) {
  color: #15a307;
}

:deep(.el-tree__empty-text) {
  position: initial;
}
</style>
