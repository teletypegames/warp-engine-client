/** The glyphs the window draws itself. */
export type IconName = 'dots' | 'trash'

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

/**
 * An inline icon, drawn rather than typed.
 *
 * A character would depend on the font having the symbol — one that lacks it shows a
 * box — and these sit on buttons that have no text to fall back on. Every icon is a
 * 16-unit box so the stylesheet can size them alike, and every one is hidden from
 * assistive technology: the control it decorates carries the name.
 */
export function createIcon (name: IconName): SVGSVGElement {
  const svg = document.createElementNS(SVG_NAMESPACE, 'svg')
  svg.setAttribute('class', `icon icon-${name}`)
  svg.setAttribute('viewBox', '0 0 16 16')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  for (const shape of SHAPES[name]()) svg.appendChild(shape)
  return svg
}

const SHAPES: Readonly<Record<IconName, () => readonly SVGElement[]>> = {
  dots: (): readonly SVGElement[] => [3.5, 8, 12.5].map((y: number): SVGElement => {
    const dot = document.createElementNS(SVG_NAMESPACE, 'circle')
    dot.setAttribute('cx', '8')
    dot.setAttribute('cy', String(y))
    dot.setAttribute('r', '1.35')
    return dot
  }),
  trash: (): readonly SVGElement[] =>
    ['M3 4.5h10', 'M6.5 4.5V3h3v1.5', 'M4.5 4.5 5 13h6l.5-8.5', 'M6.8 7v3.5', 'M9.2 7v3.5']
      .map((d: string): SVGElement => {
        const stroke = document.createElementNS(SVG_NAMESPACE, 'path')
        stroke.setAttribute('d', d)
        return stroke
      })
}
