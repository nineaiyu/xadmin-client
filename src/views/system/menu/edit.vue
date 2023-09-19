<script setup lang="ts">
import { ref, watch } from "vue";
import { FormProps } from "./utils/types";
import FromQuestion from "@/components/FromQuestion/index.vue";
import { IconSelect } from "@/components/IconSelect";

import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { transformI18n } from "@/plugins/i18n";
import {
  ifEnableOptions,
  ifOptions,
  MenuTypeOptions
} from "@/constants/constants";
import { dirFormRules, menuFormRules, permissionFormRules } from "./utils/rule";
import { hasAuth } from "@/router/utils";
import { cloneDeep } from "@pureadmin/utils";

const emit = defineEmits(["handleConfirm"]);
const props = withDefaults(defineProps<FormProps>(), {
  treeData: () => [],
  choicesDict: () => [],
  menuUrlList: () => [],
  formInline: () => ({
    menu_type: 0,
    is_add: false,
    parent: "",
    parent_ids: [],
    name: "",
    path: "",
    rank: 0,
    component: "",
    is_active: true,
    meta: {
      title: "",
      icon: "",
      r_svg_name: "",
      is_show_menu: true,
      is_show_parent: false,
      is_keepalive: false,
      frame_url: "",
      frame_loading: false,
      transition_enter: "",
      transition_leave: "",
      is_hidden_tag: false,
      dynamic_level: 0
    }
  })
});

const ruleFormRef = ref();
const treeSelectRef = ref();
const newFormInline = ref(props.formInline);

function getRef() {
  return ruleFormRef.value;
}

const formRules = ref(cloneDeep(dirFormRules));
watch(
  () => newFormInline.value.menu_type,
  () => {
    handleChangeMenuType(newFormInline.value.menu_type);
  }
);

const handleChangeMenuType = (val: number) => {
  setTimeout(function () {
    ruleFormRef.value!.clearValidate([
      "menu_type",
      "title",
      "rank",
      "path",
      "perms"
    ]);
  }, 30);

  if (val === 0) {
    formRules.value = dirFormRules;
  } else if (val === 1) {
    formRules.value = menuFormRules;
  } else {
    formRules.value = permissionFormRules;
  }
};

defineExpose({ getRef });

const getMinHeight = () => {
  if (!newFormInline.value.is_add) {
    return `calc(100vh - 133px)`;
  }
  return "";
};
</script>

<template>
  <div
    class="h-full bg-bg_color overflow-auto"
    :style="{ minHeight: getMinHeight() }"
  >
    <el-form
      ref="ruleFormRef"
      :model="newFormInline"
      :rules="formRules"
      label-width="100px"
      :disabled="!hasAuth('update:systemMenu')"
      class="search-form bg-bg_color w-[90%] pl-8 pt-[12px]"
    >
      <el-form-item label="节点类型" prop="menu_type">
        <el-radio-group
          v-model="newFormInline.menu_type"
          @change="handleChangeMenuType"
        >
          <el-radio-button
            v-for="(item, index) in MenuTypeOptions"
            :label="item.value"
            :key="index"
            :disabled="
              !newFormInline.is_add &&
              ((newFormInline.menu_type === 2 && index !== 2) ||
                (newFormInline.menu_type !== 2 && index === 2))
            "
            >{{ item.label }}</el-radio-button
          >
        </el-radio-group>
      </el-form-item>
      <el-form-item label="上级节点" prop="parentId">
        <el-tree-select
          ref="treeSelectRef"
          v-model="newFormInline.parent"
          :data="props.treeData"
          :props="{
            children: 'children',
            label: data => transformI18n(data.meta.title)
          }"
          node-key="pk"
          accordion
          auto-expand-parent
          show-checkbox
          :default-expanded-keys="newFormInline.parent_ids"
          filterable
          check-strictly
          clearable
          style="width: 100%"
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
        </el-tree-select>
      </el-form-item>
      <div v-if="newFormInline.menu_type !== 2">
        <el-form-item label="菜单名称" prop="title">
          <el-input
            v-model="newFormInline.title"
            clearable
            placeholder="请输入菜单名称"
          />
        </el-form-item>
        <el-form-item label="菜单图标" prop="icon">
          <icon-select v-model="newFormInline.meta.icon" style="width: 100%" />
        </el-form-item>

        <el-form-item label="组件名称" prop="name">
          <template #label>
            <from-question
              label="组件名称"
              description="如：`user`，如外网地址需内链访问则以`http(s)://`开头"
            />
          </template>
          <el-input
            v-model="newFormInline.name"
            clearable
            placeholder="组件名称"
          />
        </el-form-item>
        <el-form-item label="路由地址" prop="path">
          <template #label>
            <from-question
              label="路由地址"
              description="访问的路由地址，如：`/user`, `/system/about`"
            />
          </template>
          <el-input
            v-model="newFormInline.path"
            clearable
            placeholder="请输入路由地址"
          />
        </el-form-item>
      </div>
      <div v-if="newFormInline.menu_type === 1">
        <el-form-item label="组件路径" prop="component">
          <template #label>
            <from-question
              label="组件路径"
              description="访问的组件路径，如：`system/user/index`，默认在`views`目录下"
            />
          </template>
          <el-input
            v-model="newFormInline.component"
            clearable
            placeholder="请输入组件路径"
          />
        </el-form-item>

        <el-divider />
        <el-form-item label="是否缓存" prop="keepAlive">
          <template #label>
            <from-question
              label="是否缓存"
              description="选择是则会被`keep-alive`缓存，需要匹配组件的`name`和地址保持一致"
            />
          </template>
          <el-radio-group v-model="newFormInline.meta.is_keepalive">
            <el-radio-button
              v-for="(item, index) in ifOptions"
              :label="item.value"
              :key="index"
              >{{ item.label }}</el-radio-button
            >
          </el-radio-group>
        </el-form-item>
        <el-form-item label="显示父级菜单" prop="showParent">
          <el-radio-group v-model="newFormInline.meta.is_show_parent">
            <el-radio-button
              v-for="(item, index) in ifOptions"
              :label="item.value"
              :key="index"
              >{{ item.label }}</el-radio-button
            >
          </el-radio-group>
        </el-form-item>
      </div>
      <div v-if="newFormInline.menu_type !== 2">
        <el-divider />
        <el-form-item label="菜单可见" prop="showLink">
          <template #label>
            <from-question
              label="菜单可见"
              description="选择隐藏则路由将不会出现在侧边栏，但仍然可以访问"
            />
          </template>
          <el-radio-group v-model="newFormInline.meta.is_show_menu">
            <el-radio-button
              v-for="(item, index) in ifOptions"
              :label="item.value"
              :key="index"
              >{{ item.label }}</el-radio-button
            >
          </el-radio-group>
        </el-form-item>

        <el-form-item label="菜单状态" prop="is_active">
          <template #label>
            <from-question
              label="菜单状态"
              description="选择停用则路由将不会出现在侧边栏，也不能被访问"
            />
          </template>
          <el-radio-group v-model="newFormInline.is_active">
            <el-radio-button
              v-for="(item, index) in ifEnableOptions"
              :label="item.value"
              :key="index"
              >{{ item.label }}</el-radio-button
            >
          </el-radio-group>
        </el-form-item>

        <el-divider />
        <el-form-item label="内嵌外链地址" prop="isFrame">
          <template #label>
            <from-question
              label="内嵌外链"
              description="选择是外链则路由地址需要以`http(s)://`开头"
            />
          </template>
          <el-input
            v-model="newFormInline.meta.frame_url"
            clearable
            placeholder="默认为空，除非有外链"
          />
        </el-form-item>
        <el-form-item label="内嵌动画" prop="frameLoading">
          <template #label>
            <from-question
              label="内嵌动画"
              description="内嵌的iframe页面是否开启首次加载动画"
            />
          </template>
          <el-radio-group v-model="newFormInline.meta.frame_loading">
            <el-radio-button
              v-for="(item, index) in ifOptions"
              :label="item.value"
              :key="index"
              >{{ item.label }}</el-radio-button
            >
          </el-radio-group>
        </el-form-item>
      </div>
      <div v-if="newFormInline.menu_type === 2">
        <el-form-item label="权限名称" prop="title">
          <el-input
            v-model="newFormInline.title"
            clearable
            placeholder="请输入权限名称"
          />
        </el-form-item>
        <el-form-item label="权限标识" prop="name">
          <template #label>
            <from-question
              label="权限标识"
              description="控制器中定义的权限字符，如：@PreAuthorize(`@permission.hashPermission('menu:query')`)"
            />
          </template>
          <el-input
            v-model="newFormInline.name"
            clearable
            placeholder="请输入权限标识"
          />
        </el-form-item>
        <el-form-item label="权限路由" prop="path">
          <el-select
            style="width: 100%"
            v-model="newFormInline.path"
            clearable
            placeholder="Select"
            filterable
          >
            <el-option
              v-for="item in props.menuUrlList"
              :key="item.name"
              :label="`${item.name}----${item.url}`"
              :value="item.url"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="请求方式" prop="component">
          <el-select
            v-model="newFormInline.component"
            class="filter-item"
            style="width: 180px"
            clearable
          >
            <el-option
              v-for="item in props.choicesDict"
              :key="item.key"
              :label="item.label"
              :disabled="item.disabled"
              :value="item.key"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="权限状态" prop="is_active">
          <template #label>
            <from-question
              label="权限状态"
              description="选择停用则权限将失效"
            />
          </template>
          <el-radio-group v-model="newFormInline.is_active">
            <el-radio-button
              v-for="(item, index) in ifEnableOptions"
              :label="item.value"
              :key="index"
              >{{ item.label }}</el-radio-button
            >
          </el-radio-group>
        </el-form-item>
      </div>
      <el-form-item
        v-if="
          hasAuth('update:systemMenu') &&
          !newFormInline.is_add &&
          newFormInline.pk
        "
        class="flex float-right"
      >
        <el-popconfirm
          :title="`是否更新  ${transformI18n(newFormInline.title)} 节点?`"
          @confirm="emit('handleConfirm', ruleFormRef, newFormInline)"
        >
          <template #reference>
            <el-button
              :disabled="newFormInline.is_add || !newFormInline.pk"
              plain
              type="danger"
              >更新节点</el-button
            >
          </template>
        </el-popconfirm>
      </el-form-item>
    </el-form>
  </div>
</template>
