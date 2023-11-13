export const getMenuOrderPk = (data: any, x = []) => {
  if (data instanceof Array && data.length > 0) {
    data.forEach(res => {
      // @ts-expect-error
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

export const getIndexType = (index: number) => {
  if (index === 1) {
    return "danger";
  } else if (index === 2) {
    return "warning";
  } else if (index === 3) {
    return "";
  } else if (index === 4) {
    return "success";
  } else return "info";
};
