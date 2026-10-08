<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { IconSelect } from "@/components/ReIcon";
import { menuApi } from "@/api/system/menu";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { transformI18n } from "@/plugins/i18n";
import type { CodegenModelItem } from "@/api/system/codegen";
import type { CodegenFormState } from "../utils/payload";

defineOptions({ name: "CodegenBaseConfig" });

defineProps<{
  models: CodegenModelItem[];
  modelsLoading: boolean;
  planLoading: boolean;
}>();

/** 共享表单状态（父级持有，嵌套变更直接生效） */
const state = defineModel<CodegenFormState>({ required: true });

const emit = defineEmits<{
  /** 模型切换：父级据此加载字段计划（避免 watch 与方案载入双重触发） */
  modelChange: [label: string];
}>();

const { t } = useI18n();

/** 上级菜单树节点（仅目录 / 菜单，权限点不可作上级） */
type MenuNode = { value: string; label: string; children: MenuNode[] };

const menuTree = ref<MenuNode[]>([]);
const menuLoading = ref(false);

const selectedMeta = computed(() =>
  state.value.model
    ? `${state.value.model} → ${t("codegen.defaultDerive")}`
    : t("codegen.modelPlaceholder")
);

async function loadMenus() {
  menuLoading.value = true;
  try {
    // fetchAllRows 用 size 分页参数自动翻页；菜单行 menu_type/parent 是 {label,value/pk} 形态
    const res = await fetchAllRows(menuApi.list);
    const rows = (res.data?.results ?? []) as Array<Record<string, unknown>>;
    const pickValue = (raw: unknown): number =>
      typeof raw === "object" && raw !== null
        ? Number((raw as { value?: unknown }).value)
        : Number(raw);
    const pickPk = (raw: unknown): string | null =>
      raw == null
        ? null
        : typeof raw === "object"
          ? String((raw as { pk?: unknown }).pk ?? "")
          : String(raw);
    const nodes = new Map<string, MenuNode>();
    for (const row of rows) {
      if (pickValue(row.menu_type) !== 0 && pickValue(row.menu_type) !== 1)
        continue;
      if (row.is_active === false) continue;
      const meta = row.meta as { title?: string } | undefined;
      nodes.set(String(row.pk), {
        value: String(row.pk),
        // 内置菜单标题存的是词条 key（menus.xxx）：走 transformI18n，普通标题原样返回
        label: transformI18n(String(meta?.title || row.name || row.pk)),
        children: []
      });
    }
    const tree: MenuNode[] = [];
    for (const row of rows) {
      const node = nodes.get(String(row.pk));
      if (!node) continue;
      const parentPk = pickPk(row.parent);
      const parent = parentPk ? nodes.get(parentPk) : null;
      if (parent && parent !== node) parent.children.push(node);
      else tree.push(node);
    }
    menuTree.value = tree;
  } finally {
    menuLoading.value = false;
  }
}

onMounted(loadMenus);
</script>

<template>
  <el-form label-width="92px" label-position="left" class="codegen-base">
    <el-form-item :label="t('codegen.model')" required>
      <el-select
        v-model="state.model"
        data-testid="codegen-model-select"
        filterable
        :loading="modelsLoading"
        :placeholder="t('codegen.modelPlaceholder')"
        @change="label => emit('modelChange', String(label ?? ''))"
      >
        <el-option
          v-for="item in models"
          :key="item.label"
          :value="item.label"
          :label="`${item.label}（${item.verbose_name}）`"
        />
      </el-select>
    </el-form-item>
    <el-form-item :label="t('codegen.component')">
      <el-input
        v-model="state.component"
        :placeholder="t('codegen.defaultDerive')"
      />
    </el-form-item>
    <el-form-item :label="t('codegen.urlPrefix')">
      <el-input
        v-model="state.url_prefix"
        :placeholder="t('codegen.defaultDerive')"
      />
    </el-form-item>
    <el-form-item :label="t('codegen.frontendDir')">
      <el-input
        v-model="state.frontend_dir"
        :placeholder="t('codegen.defaultDerive')"
      />
    </el-form-item>
    <el-form-item :label="t('codegen.ordering')">
      <el-input
        v-model="state.ordering"
        :placeholder="t('codegen.orderingPlaceholder')"
      />
    </el-form-item>
    <el-form-item :label="t('codegen.menuTitle')">
      <el-input
        v-model="state.menu_title"
        :placeholder="t('codegen.menuTitlePlaceholder')"
      />
    </el-form-item>
    <el-form-item :label="t('codegen.menuParent')">
      <el-tree-select
        v-model="state.menu_parent"
        :data="menuTree"
        :loading="menuLoading"
        check-strictly
        clearable
        filterable
        :placeholder="t('codegen.menuParentPlaceholder')"
      />
    </el-form-item>
    <el-form-item :label="t('codegen.menuIcon')">
      <icon-select v-model="state.menu_icon" />
    </el-form-item>
    <div v-if="planLoading" class="text-xs text-gray-400">
      {{ t("codegen.planLoading") }}
    </div>
    <div v-else-if="state.model" class="text-xs text-gray-400">
      {{ selectedMeta }}
    </div>
  </el-form>
</template>
