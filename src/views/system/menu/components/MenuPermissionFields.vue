<script lang="ts" setup>
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { MenuChoices } from "@/views/system/constants";
import FromQuestion from "@/components/FromQuestion/index.vue";
import Segmented, { type OptionsType } from "@/components/ReSegmented";
import type {
  ChoicesOptionItem,
  FormItemProps,
  MenuUrlItem,
  ModelTreeItem
} from "../utils/types";

/** 权限码（PERMISSION）类型的表单字段区（拆分自 edit.vue，就地修改父级表单对象） */
const props = defineProps<{
  newFormInline: FormItemProps;
  ifEnableOptions: Array<OptionsType>;
  menuUrlList: MenuUrlItem[];
  modelList: ModelTreeItem[];
  methodChoices: ChoicesOptionItem[];
}>();

const { t } = useI18n();

// ref 包装同一对象引用：模板经 ref 修改字段（避免 vue/no-mutating-props）
const newFormInline = ref(props.newFormInline);
</script>

<template>
  <div v-if="newFormInline.menu_type === MenuChoices.PERMISSION">
    <el-form-item :label="t('systemMenu.permissionName')" prop="title">
      <el-input
        v-model="newFormInline.title"
        :placeholder="t('systemMenu.verifyPermissionName')"
        clearable
      />
    </el-form-item>
    <el-form-item :label="t('systemMenu.permissionCode')" prop="name">
      <template #label>
        <from-question
          :description="t('systemMenu.examplePermissionCode')"
          :label="t('systemMenu.permissionCode')"
        />
      </template>
      <el-input
        v-model="newFormInline.name"
        :placeholder="t('systemMenu.verifyPermissionCode')"
        clearable
      />
    </el-form-item>
    <el-form-item :label="t('systemMenu.permissionPath')" prop="path">
      <el-select
        v-model="newFormInline.path"
        class="w-full"
        clearable
        filterable
      >
        <el-option
          v-for="item in menuUrlList"
          :key="item.name"
          :label="`${item.name}----${item.url}`"
          :value="item.url"
        />
      </el-select>
    </el-form-item>
    <el-form-item :label="t('systemMenu.associationModel')" prop="model">
      <template #label>
        <from-question
          :description="t('systemMenu.exampleAssociationModel')"
          :label="t('systemMenu.associationModel')"
        />
      </template>
      <el-cascader
        v-model="newFormInline.model"
        :options="modelList"
        :props="{
          multiple: true,
          emitPath: false,
          checkStrictly: false
        }"
        class="w-full"
        clearable
        filterable
      >
        <template #default="{ node, data }">
          <span>{{ data.label }}</span>
          <span v-show="data.parent">({{ data.name }})</span>
          <span v-show="!node.isLeaf">({{ data?.children?.length }})</span>
        </template>
      </el-cascader>
    </el-form-item>
    <el-form-item :label="t('systemMenu.requestMethod')" prop="method">
      <el-select
        v-model="newFormInline.method"
        class="w-45!"
        clearable
        value-key="value"
      >
        <el-option
          v-for="item in methodChoices"
          :key="item.value"
          :disabled="item.disabled"
          :label="item.label"
          :value="item"
        />
      </el-select>
    </el-form-item>
    <el-form-item :label="t('labels.status')" prop="is_active">
      <template #label>
        <from-question
          :description="t('systemMenu.exampleRequestStatus')"
          :label="t('labels.status')"
        />
      </template>
      <Segmented
        :modelValue="newFormInline.is_active ? 0 : 1"
        :options="ifEnableOptions"
        @change="
          ({ option: { value } }) => {
            newFormInline.is_active = value;
          }
        "
      />
    </el-form-item>
  </div>
</template>
