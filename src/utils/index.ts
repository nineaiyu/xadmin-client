export const getMenuOrderPk = (data: any, x = []) => {
  if (data instanceof Array && data.length > 0) {
    data.forEach(res => {
      x.push(res.pk);
      const children = res.children;
      if (children instanceof Array && children.length > 0) {
        getMenuOrderPk(children, x);
      }
    });
  }
  return x;
};

//查找父节点
export const getMenuFromPk = (data: any[] | any, id: number) => {
  const temp: any[] = [];
  const forFn = (arr: any, pk: number) => {
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];
      if (item.pk === pk) {
        temp.push(item);
        forFn(data, item.parent);
        break;
      } else {
        if (item.children) {
          forFn(item.children, pk);
        }
      }
    }
  };
  forFn(data, id);
  return temp;
};

// 最小长度
export const wordMinLength = (word: string, minLength: number) => {
  return word.match(new RegExp("^(.{" + minLength + ",})$"));
};

// 大写字母
export const wordUpperCase = (word: string) => {
  return word.match(/([A-Z]+)/);
};

// 小写字母
export const wordLowerCase = (word: string) => {
  return word.match(/([a-z]+)/);
};

// 数字字符
export const wordNumber = (word: string) => {
  return word.match(/([\d]+)/);
};

// 特殊字符
export const wordSpecialChar = (word: string) => {
  return word.match(
    /[`,~,!,@,#,\$,%,\^,&,\*,\(,\),\-,_,=,\+,\{,\},\[,\],\|,\\,;,',:,",\,,\.,<,>,\/,\?]+/
  );
};

export const passwordRulesCheck = (
  word: string,
  rules: Array<{ value: number; key: string }>,
  t: Function
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
