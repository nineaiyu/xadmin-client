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
import { transformI18n } from "@/plugins/i18n";
import Reset from "~icons/ri/restart-line";
import More2Fill from "~icons/ri/more-2-fill";
import SearchIcon from "~icons/ri/search-line";
import { MenuChoices } from "@/views/system/constants";
import { getKeyList, isAllEmpty } from "@pureadmin/utils";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { Auths } from "@/router/utils";
import type { BaseApi } from "@/api/base";

interface FormProps {
  pk?: string;
  field?: any[];
  fields?: object;
  api?: Partial<BaseApi>;
  auth?: Auths;
  menuTreeData?: any[];
}

const props = withDefaults(defineProps<FormProps>(), {
  menuTreeData: () => [],
  pk: undefined,
  fields: () => ({}),
  api: () => ({}),
  auth: () => ({}),
  field: () => []
});

const menu = defineModel({ type: Array<any> });

const { locale, t } = useI18n();
const treeRoleRef = ref();
const searchValue = ref("");
const loading = ref(false);

const formData = ref({
  menu: menu.value,
  fields: props.fields,
  field: props.field
});

const emit = defineEmits<{
  change: [values: { fields: FormProps["fields"]; menu: any[] }];
}>();

const handleChange = () => {
  formatMenuFields();
  emit("change", { ...formData.value });
};

const customNodeClass = data => {
  if (data?.menu_type?.value === MenuChoices.DIRECTORY) {
    return "is-penultimate";
  } else if (data?.menu_type?.value === MenuChoices.MENU) {
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
  formData.value.menu = menu.filter(x => {
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
  formData.value.fields = fields;
};

watch(searchValue, val => {
  treeRoleRef.value!.filter(val);
});
const initData = () => {
  nextTick(() => {
    treeRoleRef.value!.setCheckedKeys(
      [...formData.value.menu, ...formData.value.field],
      false
    );
  });
};
const getCheckedMenu = pk => {
  if (pk && props.auth.retrieve) {
    loading.value = true;
    props.api.retrieve(pk).then(({ code, data }) => {
      if (code === 1000) {
        formData.value.menu = getKeyList(data?.menu ?? [], "pk");
        Object.keys(data?.field).forEach(key => {
          data?.field[key].forEach(val => {
            formData.value.field.push(`${key}+${val}`);
          });
        });
        initData();
      }
      loading.value = false;
    });
  }
};
onMounted(() => {
  getCheckedMenu(props.pk);
});
const buttonClass = computed(() => {
  return [
    "h-[20px]!",
    "reset-margin",
    "text-gray-500!",
    "dark:text-white!",
    "dark:hover:text-primary!"
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
  handleChange();
}

function nodeClick(value, node) {
  if (value.pk.toString().indexOf("+") > 0) {
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
            :icon="SearchIcon"
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
                selectAll ? t("buttons.unSelectAll") : t("buttons.selectAll")
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
              {{ isExpand ? t("buttons.collapseAll") : t("buttons.expendAll") }}
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
                  ? t("buttons.checkUnStrictly")
                  : t("buttons.checkStrictly")
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
      :data="menuTreeData"
      :default-expand-all="isExpand"
      :expand-on-click-node="true"
      :filter-node-method="filterMenuNode"
      :props="{ class: customNodeClass }"
      :show-checkbox="true"
      class="w-full"
      highlight-current
      node-key="pk"
      @checkChange="handleChange"
      @node-click="nodeClick"
    >
      <template #default="{ data }">
        <div style="height: 30px">
          <span
            :class="[
              'pr-1',
              'rounded-sm',
              'flex',
              'items-center',
              'select-none',
              'w-full'
            ]"
          >
            <component
              :is="useRenderIcon(data?.meta?.icon)"
              v-if="data?.meta?.icon"
              class="m-1"
            />
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
                        getKeyList(data.children ?? [], 'pk')
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
