<script lang="ts" setup>
import {
  computed,
  getCurrentInstance,
  nextTick,
  onMounted,
  ref,
  watch
} from "vue";
import { formRules } from "./utils/rule";
import { FormProps } from "./utils/types";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { isAllEmpty } from "@pureadmin/utils";
import { match } from "pinyin-pro";
import { useI18n } from "vue-i18n";
import { transformI18n } from "@/plugins/i18n";
import More2Fill from "@iconify-icons/ri/more-2-fill";
import Reset from "@iconify-icons/ri/restart-line";
import { MenuChoices } from "@/views/system/constants";
import { getRoleDetailApi } from "@/api/system/role";
import { hasAuth } from "@/router/utils";

const props = withDefaults(defineProps<FormProps>(), {
  isAdd: () => true,
  showColumns: () => [],
  menuTreeData: () => [],
  formInline: () => ({
    pk: 0,
    name: "",
    code: "",
    description: "",
    menu: [],
    field: [],
    is_active: true
  })
});
const customNodeClass = data => {
  if (data?.menu_type === MenuChoices.DIRECTORY) {
    return "is-penultimate";
  } else if (data?.menu_type === MenuChoices.MENU) {
    return "is-permission";
  }
  return null;
};
const { locale } = useI18n();

const filterMenuNode = (value: string, data: any) => {
  if (!value) return true;
  return value
    ? transformI18n(data?.meta?.title)
        .toLocaleLowerCase()
        .includes(value.toLocaleLowerCase().trim()) ||
        (locale.value === "zh" &&
          !isAllEmpty(
            match(
              transformI18n(data?.meta?.title).toLocaleLowerCase(),
              value.toLocaleLowerCase().trim()
            )
          ))
    : false;
};
const ruleFormRef = ref();
const treeRoleRef = ref();
const newFormInline = ref(props.formInline);
const searchValue = ref("");
const loading = ref(false);

function getRef() {
  return ruleFormRef.value;
}

function getTreeRef() {
  return treeRoleRef.value;
}

const { t } = useI18n();
const ifEnableOptions = [
  { label: t("labels.enable"), value: true },
  { label: t("labels.disable"), value: false }
];
watch(searchValue, val => {
  treeRoleRef.value!.filter(val);
});
defineExpose({ getRef, getTreeRef });
const initData = () => {
  nextTick(() => {
    treeRoleRef.value!.setCheckedKeys(
      [...newFormInline.value.menu, ...newFormInline.value.field],
      false
    );
  });
};
const getCheckedMenu = pk => {
  if (pk && hasAuth("detail:systemRole")) {
    loading.value = true;
    getRoleDetailApi(pk).then(({ code, data }) => {
      if (code === 1000) {
        newFormInline.value.menu = data?.menu;
        Object.keys(data?.field).forEach(key => {
          data?.field[key].forEach(val => {
            newFormInline.value.field.push(`${key}+${val}`);
          });
        });
        initData();
      }
      loading.value = false;
    });
  }
};
onMounted(() => {
  getCheckedMenu(newFormInline.value.pk);
});
const buttonClass = computed(() => {
  return [
    "!h-[20px]",
    "reset-margin",
    "!text-gray-500",
    "dark:!text-white",
    "dark:hover:!text-primary"
  ];
});
const isExpand = ref(false);
const selectAll = ref(false);
const checkStrictly = ref(true);
const { proxy } = getCurrentInstance();

function toggleRowExpansionAll(status) {
  isExpand.value = status;
  const nodes = (proxy.$refs["treeRoleRef"] as any).store._getAllNodes();
  for (let i = 0; i < nodes.length; i++) {
    if (
      status &&
      (nodes[i].data?.model?.length > 0 ||
        nodes[i].data?.pk?.toString().indexOf("+") > -1)
    ) {
      continue;
    }
    nodes[i].expanded = status;
  }
}

function toggleSelectAll(status) {
  selectAll.value = status;
  const nodes = (proxy.$refs["treeRoleRef"] as any).store._getAllNodes();
  for (let i = 0; i < nodes.length; i++) {
    nodes[i].checked = status;
  }
}

function nodeClick(value, node) {
  if (
    value.pk.toString().indexOf("+") > 0 &&
    ((props.showColumns.length > 0 &&
      props.showColumns.indexOf("field") > -1) ||
      true)
  ) {
    node.checked = !node.checked;
  }
}

function onReset() {
  searchValue.value = "";
  initData();
  toggleRowExpansionAll(false);
}
</script>

<template>
  <el-form
    ref="ruleFormRef"
    :model="newFormInline"
    :rules="formRules"
    label-width="82px"
  >
    <el-form-item :label="t('role.name')" prop="name">
      <el-input
        v-model="newFormInline.name"
        :disabled="!props.isAdd && props.showColumns.indexOf('name') === -1"
        :placeholder="t('role.verifyRoleName')"
        clearable
      />
    </el-form-item>

    <el-form-item :label="t('role.code')" prop="code">
      <el-input
        v-model="newFormInline.code"
        :disabled="!props.isAdd && props.showColumns.indexOf('code') === -1"
        :placeholder="t('role.verifyRoleCode')"
        clearable
      />
    </el-form-item>
    <el-form-item :label="t('labels.status')" prop="is_active">
      <el-radio-group
        v-model="newFormInline.is_active"
        :disabled="
          !props.isAdd && props.showColumns.indexOf('is_active') === -1
        "
      >
        <el-radio-button
          v-for="item in ifEnableOptions"
          :key="item.label"
          :value="item.value"
          >{{ item.label }}
        </el-radio-button>
      </el-radio-group>
    </el-form-item>
    <el-form-item :label="t('labels.description')">
      <el-input
        v-model="newFormInline.description"
        :disabled="
          !props.isAdd && props.showColumns.indexOf('description') === -1
        "
        :placeholder="t('labels.verifyDescription')"
        type="textarea"
      />
    </el-form-item>
    <el-form-item :label="t('role.permissions')">
      <div class="flex items-center h-[34px] w-full mb-2">
        <el-input
          v-model="searchValue"
          :placeholder="t('menu.verifyTitle')"
          class="flex-1"
          clearable
        >
          <template #suffix>
            <el-icon class="el-input__icon">
              <IconifyIconOffline
                v-show="searchValue.length === 0"
                icon="ri:search-line"
              />
            </el-icon>
          </template>
        </el-input>
        <el-dropdown :hide-on-click="false">
          <IconifyIconOffline
            :icon="More2Fill"
            class="w-[28px] cursor-pointer"
            width="18px"
          />
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item>
                <el-button
                  :class="buttonClass"
                  link
                  type="primary"
                  @click="toggleSelectAll(!selectAll)"
                >
                  {{
                    selectAll
                      ? t("buttons.unSelectAll")
                      : t("buttons.selectAll")
                  }}
                </el-button>
              </el-dropdown-item>
              <el-dropdown-item>
                <el-button
                  :class="buttonClass"
                  link
                  type="primary"
                  @click="toggleRowExpansionAll(!isExpand)"
                >
                  {{
                    isExpand
                      ? t("buttons.hscollapseAll")
                      : t("buttons.hsexpendAll")
                  }}
                </el-button>
              </el-dropdown-item>
              <el-dropdown-item>
                <el-button
                  :class="buttonClass"
                  link
                  type="primary"
                  @click="checkStrictly = !checkStrictly"
                >
                  {{
                    checkStrictly
                      ? t("menu.checkUnStrictly")
                      : t("menu.checkStrictly")
                  }}
                </el-button>
              </el-dropdown-item>
              <el-dropdown-item>
                <el-button
                  :class="buttonClass"
                  :icon="useRenderIcon(Reset)"
                  link
                  type="primary"
                  @click="onReset"
                >
                  {{ t("buttons.hsreset") }}
                </el-button>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
      <!--      <div class="overflow-y-auto w-full h-[30vh]">-->
      <div>
        <el-tree
          ref="treeRoleRef"
          v-loading="loading"
          :check-strictly="checkStrictly"
          :data="props.menuTreeData"
          :default-expand-all="isExpand"
          :expand-on-click-node="true"
          :filter-node-method="filterMenuNode"
          :props="{ class: customNodeClass }"
          :show-checkbox="
            props.isAdd ||
            (props.showColumns.indexOf('field') > -1 &&
              props.showColumns.indexOf('menu') > -1)
          "
          class="w-full"
          highlight-current
          node-key="pk"
          @node-click="nodeClick"
        >
          <template #default="{ data }">
            <div style="height: 30px">
              <span
                :class="[
                  'pr-1',
                  'rounded',
                  'flex',
                  'items-center',
                  'select-none',
                  'w-full'
                ]"
              >
                <component :is="useRenderIcon(data?.meta?.icon)" class="m-1" />
                <template v-if="data.model">
                  {{ `${transformI18n(data?.meta?.title)}` }}
                  <!--                  <component :is="useRenderIcon('ep:reading')" class="m-1" />-->
                </template>
                <template v-else>
                  {{
                    `${transformI18n(data?.meta?.title)}` ||
                    `${data?.label} (${data?.name})`
                  }}
                </template>
              </span>
            </div>
          </template>
        </el-tree>
      </div>
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
