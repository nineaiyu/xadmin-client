interface optionsItem {
  path: string;
  type: "history" | "collect";
  meta: {
    icon?: string;
    title?: string;
  };
  /** 菜单树子级（查询前扁平化时使用） */
  children?: optionsItem[];
}

interface dragItem {
  oldIndex: number;
  newIndex: number;
}

interface Props {
  value: string;
  options: Array<optionsItem>;
}

export type { optionsItem, dragItem, Props };
