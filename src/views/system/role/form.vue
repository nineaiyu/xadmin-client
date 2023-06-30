<script setup lang="ts">
import { onMounted, ref, watch, nextTick } from "vue";
import { formRules } from "./utils/rule";
import { FormProps } from "./utils/types";
import { ifEnableOptions } from "@/constants/constants";
import { useRole } from "./utils/hook";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { transformI18n } from "@/plugins/i18n";
import { isAllEmpty } from "@pureadmin/utils";
import { match } from "pinyin-pro";
import { useI18n } from "vue-i18n";

const props = withDefaults(defineProps<FormProps>(), {
  formInline: () => ({
    name: "",
    code: "",
    description: "",
    menu: [],
    is_active: true
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
const { menuTreeData, getMenuData } = useRole();
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
    label-width="82px"
  >
    <el-form-item label="角色名称" prop="name">
      <el-input
        v-model="newFormInline.name"
        clearable
        placeholder="请输入角色名称"
      />
    </el-form-item>

    <el-form-item label="角色标识" prop="code">
      <el-input
        v-model="newFormInline.code"
        clearable
        placeholder="请输入角色标识"
      />
    </el-form-item>
    <el-form-item label="角色状态" prop="is_active">
      <el-radio-group v-model="newFormInline.is_active">
        <el-radio-button
          v-for="item in ifEnableOptions"
          :key="item.value"
          :label="item.value"
          >{{ item.label }}</el-radio-button
        >
      </el-radio-group>
    </el-form-item>
    <el-form-item label="备注">
      <el-input
        v-model="newFormInline.description"
        placeholder="请输入备注信息"
        type="textarea"
      />
    </el-form-item>
    <el-form-item label="权限信息">
      <el-input
        class="filter-item"
        clearable
        v-model="searchValue"
        placeholder="菜单搜索"
      />
      <el-tree
        :data="menuTreeData"
        ref="treeRoleRef"
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
