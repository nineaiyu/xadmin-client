import {
  computed,
  getCurrentInstance,
  h,
  onMounted,
  reactive,
  shallowRef
} from "vue";
import { useI18n } from "vue-i18n";
import { addDialog } from "@/components/ReDialog";
import { getDefaultAuths, hasAuth } from "@/router/utils";
import { maskApi } from "@/api/system/mask";
import { modelLabelFieldApi } from "@/api/system/field";
import { FieldChoices } from "@/views/system/constants";
import type {
  OperationProps,
  PageTableColumn,
  RePlusPageProps
} from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import View from "~icons/ep/view";
import MaskPreview from "../components/MaskPreview.vue";

/** 模型/字段候选条目（value = 协议字段名） */
interface LabelValueOption {
  value: string;
  label: string;
}

/** `parent` 为 object_related_field 下发对象（根节点为空），兼容裸 pk 形态 */
const parentPkOf = (parent: unknown) =>
  parent && typeof parent === "object"
    ? (parent as { pk?: string }).pk
    : (parent as string | undefined);

/** labeled_choice 可能是 {value,label} 或裸字符串 */
const rawValueOf = (value: unknown) =>
  value && typeof value === "object"
    ? (value as { value?: string }).value
    : (value as string | undefined);

/**
 * 从列表行提取预览所需规则（行内「脱敏预览」预填当前行）。
 *
 * 只取掩码相关字段：model/field 等业务字段与预览无关，且 pattern 仅在 custom 时使用。
 */
export function buildPreviewRule(row: Record<string, unknown>) {
  return {
    // model/field 仅用于弹窗展示「预览的是哪条规则」
    model: row?.model,
    field: row?.field,
    mask_type: rawValueOf(row?.mask_type),
    keep_head: row?.keep_head,
    keep_tail: row?.keep_tail,
    mask_char: row?.mask_char,
    pattern: row?.pattern
  };
}

/** 字段级数据脱敏规则页：RePlusPage 元数据驱动列表，附自定义「脱敏预览」弹窗 */
export function useMask() {
  const api = reactive(maskApi);
  const auth = reactive({
    preview: false,
    ...getDefaultAuths(getCurrentInstance(), ["preview"])
  });
  const { t } = useI18n();

  /** 模型/字段候选来自模型字段字典；无该权限时退回手填（下拉降级为输入框） */
  const canPickModel = hasAuth("list:SystemModelLabelField");
  const modelOptions = shallowRef<LabelValueOption[]>([]);
  /** model(label_lower) → 该模型的序列化字段候选（field 口径与脱敏钩子一致） */
  const fieldOptionsMap = shallowRef<Record<string, LabelValueOption[]>>({});

  /** 一次拉取全部角色侧模型字段（模型 + 字段，量级几百行），前端本地分组联动 */
  const loadModelFieldOptions = () => {
    if (!canPickModel) return;
    modelLabelFieldApi
      .list({ page: 1, size: 1000, field_type: FieldChoices.ROLE })
      .then(res => {
        if (res.code !== 1000 || !res.data) return;
        const rows = res.data.results as Array<{
          pk: string;
          name: string;
          label?: string;
          parent?: unknown;
        }>;
        const nameOfPk = new Map(rows.map(row => [row.pk, row.name]));
        const labelOfPk = new Map(
          rows.map(row => [row.pk, row.label ?? row.name])
        );
        // 根节点（无 parent）= 模型
        const modelPks = new Set(
          rows.filter(row => !parentPkOf(row.parent)).map(row => row.pk)
        );
        modelOptions.value = rows
          .filter(row => modelPks.has(row.pk))
          .map(row => ({
            value: row.name,
            label:
              row.label && row.label !== row.name
                ? `${row.label} (${row.name})`
                : row.name
          }))
          .sort((a, b) => a.value.localeCompare(b.value));
        const map: Record<string, LabelValueOption[]> = {};
        rows.forEach(row => {
          const parentPk = parentPkOf(row.parent);
          const modelName = parentPk ? nameOfPk.get(parentPk) : undefined;
          if (!modelName || !parentPk || !modelPks.has(parentPk)) return;
          if (!map[modelName]) map[modelName] = [];
          map[modelName].push({
            value: row.name,
            label: labelOfPk.get(row.pk) ?? row.name
          });
        });
        fieldOptionsMap.value = map;
      })
      .catch(() => undefined);
  };
  onMounted(loadModelFieldOptions);

  /** 打开脱敏预览弹窗；传 rule 时预填当前行规则 */
  const openPreview = (rule?: Record<string, unknown>) => {
    addDialog({
      title: t("mask.preview"),
      width: "40%",
      draggable: true,
      closeOnClickModal: false,
      hideFooter: true,
      props: rule ? { rule } : {},
      contentRenderer: () => h(MaskPreview)
    });
  };

  /** 工具栏：新增/批量删除/导出/导入为框架内建，另加「脱敏预览」自定义弹窗 */
  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        code: "preview",
        text: t("mask.preview"),
        props: { type: "primary", icon: useRenderIcon(View), plain: true },
        onClick: () => openPreview(),
        show: auth.preview && 2
      }
    ]
  });

  /** 行内操作：以当前行规则打开预览（列数据为掩码值，预览用于确认规则效果） */
  const operationButtonsProps = shallowRef<OperationProps>({
    // 放大到 6 / 360，保证内建按钮与「脱敏预览」平铺展示，不落进「更多」
    showNumber: 6,
    width: 360,
    buttons: [
      {
        code: "preview",
        text: t("mask.preview"),
        props: { type: "primary", icon: useRenderIcon(View), link: true },
        onClick: ({ row }) =>
          openPreview(buildPreviewRule(row as Record<string, unknown>)),
        show: auth.preview && -15
      }
    ]
  });

  /** 新增/编辑弹窗列调整：模型/字段候选下拉 + pattern 仅在 mask_type=custom 时展示 */
  const addOrEditOptions = shallowRef<RePlusPageProps["addOrEditOptions"]>({
    props: {
      columns: {
        model: ({ column }) => {
          if (canPickModel) {
            column["valueType"] = "select";
            // 候选是字典快照：未同步进字典的模型仍允许手填
            column["fieldProps"] = {
              ...(column["fieldProps"] ?? {}),
              filterable: true,
              allowCreate: true
            };
            column["options"] = computed(() => modelOptions.value);
          }
          return column;
        },
        field: ({ column, formValue }) => {
          if (canPickModel) {
            column["valueType"] = "select";
            column["fieldProps"] = {
              ...(column["fieldProps"] ?? {}),
              filterable: true,
              allowCreate: true
            };
            // computed 内读取表单值：模型切换后字段候选自动联动
            column["options"] = computed(
              () =>
                fieldOptionsMap.value[
                  rawValueOf(formValue.value?.model) ?? ""
                ] ?? []
            );
          }
          return column;
        },
        pattern: ({ column, formValue }) => {
          const isCustom = () => {
            const v = formValue.value?.mask_type;
            return v?.value === "custom" || v === "custom";
          };
          column["hideInForm"] = computed(() => !isCustom());
          return column;
        }
      }
    }
  });

  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "mask_type":
          // labeled_choice 可能为字符串或 {value,label}，做兼容展示
          column.cellRenderer = ({ row }) =>
            (row.mask_type as { label?: string })?.label ??
            row.mask_type ??
            "—";
          break;
        case "roles":
          // M2M 输出 [ {pk,name} ]，默认逗号连接名字展示
          column.cellRenderer = ({ row }) =>
            Array.isArray(row.roles)
              ? (row.roles as Array<{ name?: string }>)
                  .map(r => r?.name ?? "")
                  .filter(Boolean)
                  .join(", ") || "—"
              : (row.roles ?? "—");
          break;
      }
    });
    return columns;
  };

  return {
    api,
    auth,
    addOrEditOptions,
    listColumnsFormat,
    tableBarButtonsProps,
    operationButtonsProps
  };
}
