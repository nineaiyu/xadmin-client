import { ref, type VNode } from "vue";
import { describe, expect, it } from "vitest";
import { useRoleFormOptions } from "../useRoleFormOptions";

type RenderField = (
  value: unknown,
  onChange: (value: unknown) => void
) => VNode;

function setup() {
  const { addOrEditOptions } = useRoleFormOptions({
    api: {},
    auth: {},
    menuTreeData: ref([])
  });
  return addOrEditOptions.value!.props!;
}

function formOptions(isAdd: boolean) {
  return { isAdd, t: (key: string) => key, title: "", rawRow: {} };
}

async function submit({
  touch = false,
  isAdd = false,
  treeFields = {}
}: {
  touch?: boolean;
  isAdd?: boolean;
  treeFields?: Record<string, Array<string | number>>;
} = {}) {
  const props = setup();
  const row = props.row!;
  if (typeof row.field === "function") {
    row.field({ rawRow: { field: [] } });
  }
  if (touch) {
    const handler = props.columns!.menu;
    if (typeof handler === "function") {
      const column = handler({
        column: { prop: "menu" },
        formValue: ref({})
      });
      const render = column?.renderField as RenderField | undefined;
      const vnode = render?.([], () => undefined);
      const change = vnode?.props?.onChange as
        | ((payload: { fields: object; menu: Array<string | number> }) => void)
        | undefined;
      change?.({ fields: treeFields, menu: [] });
    }
  }
  return props.beforeSubmit!({
    formData: { pk: 1, name: "角色", menu: [], fields: {} },
    formRef: ref(),
    formOptions: formOptions(isAdd)
  });
}

describe("角色表单授权载荷", () => {
  it("编辑态未触碰授权树：menu/fields 不提交（后端保留原授权）", async () => {
    const payload = await submit();
    expect(payload).toEqual({ pk: 1, name: "角色" });
  });

  it("编辑态触碰授权树：提交树的最新字段字典（不以隐藏列的旧值提交）", async () => {
    const payload = await submit({ touch: true, treeFields: { "9": ["11"] } });
    expect(payload).toEqual({
      pk: 1,
      name: "角色",
      menu: [],
      fields: { "9": ["11"] }
    });
  });

  it("编辑态清空全部字段：空字典照常提交（显式撤销白名单）", async () => {
    const payload = await submit({ touch: true });
    expect(payload).toEqual({ pk: 1, name: "角色", menu: [], fields: {} });
  });

  it("新增态即使未触碰授权树也提交空字典（后端 create 必填）", async () => {
    const payload = await submit({ isAdd: true });
    expect(payload).toEqual({ pk: 1, name: "角色", menu: [], fields: {} });
  });
});
