/**
 * 在 imgscode1 容器下只保留第一个带 .mask 的元素，删除其余所有子元素。
 * @param container - 作为 imgscode1 的 DOM 容器（或包含 #imgscode1 / .imgscode1 的根节点）
 */
export function keepFirstMaskOnly(container: Document | Element): void {
  const root = container.querySelector('#imgscode1, .imgscode1');
  if (!root) return;

  const firstMask = root.querySelector('.mask');
  if (!firstMask) return;

  while (root.firstChild) {
    root.removeChild(root.firstChild);
  }
  root.appendChild(firstMask);
}
