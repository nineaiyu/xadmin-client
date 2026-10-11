import {
  computed,
  defineComponent,
  h,
  ref,
  type PropType,
  type VNode
} from "vue";
import {
  ElButton,
  ElDivider,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu
} from "element-plus";
import { useI18n } from "vue-i18n";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { hasAuth } from "@/router/utils";
import More from "~icons/ep/more-filled";
import OperationButton from "@/components/RePlusPage/src/components/ButtonOperation/src/OperationButton";
import {
  checkActionVisible,
  toOperationRow,
  type PermissionResolver
} from "./action-rows";
import type { ActionItem, TableActionAuth, TableActionProps } from "./types";
import "./style.css";

/**
 * 通用表格操作列：把「行内主操作 + 更多下拉」收敛为一个可复用组件，
 * 契约对齐 vben `VbenTableAction`（actions / dropdownActions / auth / danger /
 * icon / ifShow / popConfirm / moreText）。
 *
 * 单个按钮的渲染复用操作按钮渲染器（`OperationButton`），从而沿用 RePlusPage
 * 既有的图标与确认框约定（`useRenderIcon`、确认框在下拉内的交互兜底），
 * 不改变 RePlusPage 内部实现。
 */
export default defineComponent({
  name: "ReTableAction",
  props: {
    actions: {
      type: Array as PropType<ActionItem[]>,
      default: () => []
    },
    dropdownActions: {
      type: Array as PropType<ActionItem[]>,
      default: () => []
    },
    align: {
      type: String as PropType<TableActionProps["align"]>,
      default: "end"
    },
    divider: { type: Boolean, default: false },
    hasPermission: {
      type: Function as PropType<(auth?: TableActionAuth) => boolean>,
      default: undefined
    },
    moreText: { type: String, default: "" },
    row: {
      type: Object as PropType<Record<string, unknown>>,
      default: () => ({})
    },
    size: {
      type: String as PropType<TableActionProps["size"]>,
      default: "default"
    }
  },
  setup(props) {
    const { t } = useI18n();

    /** 缺省权限判断：auth 为数组时任一命中即通过 */
    const resolveAuth: PermissionResolver = auth => {
      if (!auth) return true;
      const codes = Array.isArray(auth) ? auth : [auth];
      return codes.length === 0 || codes.some(code => hasAuth(code));
    };

    const permission = computed<PermissionResolver>(
      () => props.hasPermission ?? resolveAuth
    );

    const visibleActions = computed(() =>
      props.actions.filter(item => checkActionVisible(item, permission.value))
    );
    const visibleDropdown = computed(() =>
      props.dropdownActions.filter(item =>
        checkActionVisible(item, permission.value)
      )
    );

    // 「更多」下拉实例：hide-on-click=false 后由子按钮在手势完成后回调收起
    const dropdownRef = ref<{ handleClose?: () => void }>();
    const closeDropdown = () => dropdownRef.value?.handleClose?.();

    const buildRow = (item: ActionItem, index: number) =>
      toOperationRow(
        item,
        index,
        permission.value,
        t("tableAction.confirmTitle")
      );

    return (): VNode => {
      const children: VNode[] = [];

      visibleActions.value.forEach((item, index) => {
        children.push(
          h(OperationButton, {
            row: props.row,
            buttonRow: buildRow(item, index),
            size: props.size
          })
        );
        if (props.divider && index < visibleActions.value.length - 1) {
          children.push(h(ElDivider, { direction: "vertical" }));
        }
      });

      if (visibleDropdown.value.length > 0) {
        const label = props.moreText || t("layout.more");
        children.push(
          h(
            ElDropdown,
            {
              ref: dropdownRef,
              trigger: "click",
              hideOnClick: false,
              popperClass: "re-table-action-more",
              class: "re-table-action__more"
            },
            {
              default: () =>
                h(
                  ElButton,
                  {
                    icon: useRenderIcon(More),
                    size: props.size,
                    link: true,
                    type: "primary",
                    "aria-label": label
                  },
                  props.moreText ? () => props.moreText : undefined
                ),
              dropdown: () =>
                h(ElDropdownMenu, {}, () =>
                  visibleDropdown.value.map((item, index) =>
                    h(ElDropdownItem, { key: item.key ?? index }, () =>
                      h(OperationButton, {
                        row: props.row,
                        buttonRow: buildRow(item, index),
                        size: props.size,
                        isSubButton: true,
                        closeDropdown
                      })
                    )
                  )
                )
            }
          )
        );
      }

      return h(
        "div",
        {
          class: [
            "re-table-action",
            `re-table-action--${props.align}`,
            { "re-table-action--divider": props.divider }
          ]
        },
        children
      );
    };
  }
});
