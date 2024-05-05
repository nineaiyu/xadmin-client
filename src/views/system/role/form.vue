<script lang="ts" setup>
import {
  computed,
  getCurrentInstance,
  nextTick,
  onMounted,
  ref,
  watch
} from "vue";
import { match } from "pinyin-pro";
import { useI18n } from "vue-i18n";
import { formRules } from "./utils/rule";
import { FormProps } from "./utils/types";
import { transformI18n } from "@/plugins/i18n";
import Reset from "@iconify-icons/ri/restart-line";
import More2Fill from "@iconify-icons/ri/more-2-fill";
import { MenuChoices } from "@/views/system/constants";
import { getKeyList, isAllEmpty } from "@pureadmin/utils";
import { useApiAuth, useSystemRoleForm } from "./utils/hook";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";

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

const { locale } = useI18n();
const { api, auth } = useApiAuth();
const { t, columns } = useSystemRoleForm(props);

const formRef = ref();
const treeRoleRef = ref();
const searchValue = ref("");
const loading = ref(false);
const newFormInline = ref(props.formInline);

function getRef() {
  formatMenuFields();
  return formRef.value?.formInstance;
}

const customNodeClass = data => {
  if (data?.menu_type === MenuChoices.DIRECTORY) {
    return "is-penultimate";
  } else if (data?.menu_type === MenuChoices.MENU) {
    return "is-permission";
  }
  return null;
};

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

const formatMenuFields = () => {
  const menu = treeRoleRef.value!.getCheckedKeys(false);
  newFormInline.value.menu = menu.filter(x => {
    return x.indexOf("+") === -1;
  });
  menu.filter(x => {
    return x.toString().indexOf("+") > -1;
  });
  const fields = {};
  menu.forEach(item => {
    if (item.indexOf("+") > -1 && !item.startsWith("+")) {
      let data = item.split("+");
      let val = fields[data[0]];
      if (!val) {
        fields[data[0]] = [data[1]];
      } else {
        fields[data[0]].push(data[1]);
      }
    }
  });
  newFormInline.value.fields = fields;
  delete newFormInline.value.field;
};

watch(searchValue, val => {
  treeRoleRef.value!.filter(val);
});
const initData = () => {
  nextTick(() => {
    treeRoleRef.value!.setCheckedKeys(
      [...newFormInline.value.menu, ...newFormInline.value.field],
      false
    );
  });
};
const getCheckedMenu = pk => {
  if (pk && auth.detail) {
    loading.value = true;
    api.detail(pk).then(({ code, data }) => {
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

function toggleSelectAll(status, keys: Array<string> | null = null) {
  selectAll.value = status;
  const nodes = (proxy.$refs["treeRoleRef"] as any).store._getAllNodes();
  for (let i = 0; i < nodes.length; i++) {
    if ((keys && keys.indexOf(nodes[i].key) > -1) || !keys) {
      nodes[i].checked = status;
    }
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

defineExpose({ getRef });
</script>

<template>
  <PlusForm
    ref="formRef"
    v-model="newFormInline"
    :columns="columns"
    :hasFooter="false"
    :row-props="{ gutter: 24 }"
    :rules="formRules"
    label-position="right"
    label-width="120px"
  >
    <template #plus-field-menu>
      <div class="flex items-center h-[34px] w-full mb-2">
        <el-input
          v-model="searchValue"
          :placeholder="t('systemRole.menuTitle')"
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
                    isExpand ? t("buttons.collapseAll") : t("buttons.expendAll")
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
                  {{ t("buttons.reset") }}
                </el-button>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
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
                  <template v-if="data?.label">
                    {{ `${data?.label} (${data?.name})` }}
                    <el-button-group>
                      <el-button
                        v-if="data.parent === null"
                        plain
                        text
                        type="success"
                        @click.stop="
                          toggleSelectAll(true, getKeyList(data.children, 'pk'))
                        "
                        >全选</el-button
                      >
                      <el-button
                        v-if="data.parent === null"
                        plain
                        text
                        type="warning"
                        @click.stop="
                          toggleSelectAll(
                            false,
                            getKeyList(data.children, 'pk')
                          )
                        "
                        >{{ t("buttons.cancel") }}</el-button
                      >
                    </el-button-group>
                  </template>
                  <template v-else>
                    {{ transformI18n(data?.meta?.title) }}
                  </template>
                </template>
              </span>
            </div>
          </template>
        </el-tree>
      </div>
    </template>
  </PlusForm>
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
