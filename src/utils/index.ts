/**
 * 时间展示口径：ISO 8601（含毫秒/微秒与 Z / 时区偏移）转为本地可读
 * `YYYY-MM-DD HH:mm:ss`；非 ISO 值原样返回字符串（空值返回空串）。
 *
 * 用于后端直出 ISO 原文的场景（`values()` 行数据、手写表格列）——
 * 元数据驱动表格的时间列已由框架渲染器格式化，两处口径保持一致。
 */
export const formatDateTime = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "";
  const text = String(value);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(text)) return text;
  // 微秒（6 位小数）先截到毫秒：运行时只保证 3 位小数可解析
  const date = new Date(text.replace(/(\.\d{3})\d+/, "$1"));
  if (Number.isNaN(date.getTime())) return text;
  const pad = (num: number) => String(num).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
};

/** 菜单树行：`pk` 唯一标识，`parent` 指向父级 pk，`children` 为子树 */
export type MenuTreeNode = {
  pk: number;
  parent?: number;
  children?: MenuTreeNode[];
} & Record<string, unknown>;

/** 前序遍历收集树中全部节点 pk（非数组入参原样返回累计数组） */
export const getMenuOrderPk = (
  data: unknown,
  x: Array<number | string> = []
): Array<number | string> => {
  if (data instanceof Array && data.length > 0) {
    data.forEach((res: MenuTreeNode) => {
      x.push(res.pk);
      const children = res.children;
      if (children instanceof Array && children.length > 0) {
        getMenuOrderPk(children, x);
      }
    });
  }
  return x;
};

//查找父节点（返回 [自身, 父, 祖父...]；沿 parent 上溯时做环检测，脏数据不会无限递归）
export const getMenuFromPk = (
  data: MenuTreeNode[],
  id: number
): MenuTreeNode[] => {
  const temp: MenuTreeNode[] = [];
  const visited = new Set<number>();
  const findNode = (arr: MenuTreeNode[], pk: number): MenuTreeNode | null => {
    for (const item of arr) {
      if (item.pk === pk) return item;
      if (item.children?.length) {
        const found = findNode(item.children, pk);
        if (found) return found;
      }
    }
    return null;
  };
  let current = findNode(data, id);
  // visited 兜底：parent 形成环（或指向自身）时及时终止，避免栈溢出
  while (current && !visited.has(current.pk)) {
    visited.add(current.pk);
    temp.push(current);
    if (current.parent === undefined || current.parent === null) break;
    current = findNode(data, current.parent) as MenuTreeNode;
  }
  return temp;
};

// 最小长度
export const wordMinLength = (word: string, minLength: number) => {
  return word?.match(new RegExp("^(.{" + minLength + ",})$"));
};

// 大写字母
export const wordUpperCase = (word: string) => {
  return word?.match(/([A-Z]+)/);
};

// 小写字母
export const wordLowerCase = (word: string) => {
  return word?.match(/([a-z]+)/);
};

// 数字字符
export const wordNumber = (word: string) => {
  return word.match(/([\d]+)/);
};

// 特殊字符
export const wordSpecialChar = (word: string) => {
  return word?.match(
    /[`,~,!,@,#,\$,%,\^,&,\*,\(,\),\-,_,=,\+,\{,\},\[,\],\|,\\,;,',:,",\,,\.,<,>,\/,\?]+/
  );
};

export const passwordRulesCheck = (
  word: string,
  rules: Array<{ value: number; key: string }>,
  t: (arg0: string, arg1?: object) => string
) => {
  let result = true;
  let msg = t("settingPassword.tips");
  for (const rule of rules) {
    switch (rule.key) {
      case "SECURITY_PASSWORD_MIN_LENGTH":
        result = result && Boolean(wordMinLength(word, rule.value));
        msg = `${msg},${t("settingPassword.minLength", { length: rule.value })}`;
        break;
      case "SECURITY_PASSWORD_UPPER_CASE":
        if (rule.value) {
          msg = `${msg},${t("settingPassword.upperCase")}`;
          result = result && Boolean(wordUpperCase(word));
        }
        break;
      case "SECURITY_PASSWORD_LOWER_CASE":
        if (rule.value) {
          msg = `${msg},${t("settingPassword.lowerCase")}`;
          result = result && Boolean(wordLowerCase(word));
        }
        break;
      case "SECURITY_PASSWORD_NUMBER":
        if (rule.value) {
          msg = `${msg},${t("settingPassword.number")}`;
          result = result && Boolean(wordNumber(word));
        }
        break;
      case "SECURITY_PASSWORD_SPECIAL_CHAR":
        if (rule.value) {
          msg = `${msg},${t("settingPassword.specialChar")}`;
          result = result && Boolean(wordSpecialChar(word));
        }
        break;
    }
  }
  return { result, msg };
};
