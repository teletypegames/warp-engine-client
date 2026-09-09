/**
 * The DOM chores this window has, in one place.
 *
 * `requireElement` throws rather than returning null, and checks what it found
 * against the element type asked for: every id it is called with is in index.html, so
 * a missing or retyped one is a mistake in this repository and should say so loudly
 * instead of silently rendering half a window.
 */
export function requireElement<TElement extends Element> (
  id: string,
  type: abstract new () => TElement
): TElement {
  const found = document.getElementById(id)
  if (found === null) throw new Error(`the element #${id} is missing from index.html`)
  if (!(found instanceof type)) throw new Error(`#${id} is not a ${type.name}`)
  return found
}

export function createElement<TTag extends keyof HTMLElementTagNameMap> (
  tag: TTag,
  className?: string,
  text?: string
): HTMLElementTagNameMap[TTag] {
  const node = document.createElement(tag)
  if (className !== undefined) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

export function setText (node: HTMLElement, value: string | number | null): void {
  node.textContent = value === null ? '' : String(value)
}

/**
 * Sets the `hidden` attribute rather than the `hidden` property: the property exists
 * on HTMLElement only, and an inline `<svg>` is an SVGSVGElement, where assigning
 * `.hidden` creates a plain field and hides nothing. The attribute is what the
 * stylesheet's `[hidden]` rule reads, on either kind of element.
 */
export function setHidden (node: Element, hidden: boolean): void {
  node.toggleAttribute('hidden', hidden)
}

/**
 * Name an icon-only control.
 *
 * `title` is the tooltip a mouse finds and `aria-label` is what a screen reader reads;
 * an icon button needs both, and they are the same sentence.
 */
export function describeControl (element: Element, name: string): void {
  element.setAttribute('title', name)
  element.setAttribute('aria-label', name)
}

/**
 * Close every open `<details>` under `container` when a click lands outside it.
 *
 * A `<details>` does not close when the pointer goes elsewhere, and the entries that
 * carry one cannot own this: they are rebuilt on every render, so a listener per entry
 * would be a listener per render. The container is created once, which makes it the
 * right place for the one listener.
 */
export function closeDetailsOnOutsideClick (container: Element, selector: string): void {
  document.addEventListener('click', (event: MouseEvent): void => {
    const target = event.target
    const clicked = target instanceof Node ? target : null
    for (const menu of container.querySelectorAll(`${selector}[open]`)) {
      if (clicked === null || !menu.contains(clicked)) menu.removeAttribute('open')
    }
  })
}

