import fs from 'node:fs'
import type { BrowserWindow } from 'electron'
import {
  asRecord, readBoolean, readNumber, readOptionalString, readString, readStringArray
} from '../../infrastructure/json/JsonRecord'

/**
 * How long to keep waiting for the window to have something on it.
 *
 * This used to be a flat six-second sleep, which is a guess about somebody else's
 * machine: on a cold start — a freshly built app, Gatekeeper checking it, a first DNS
 * lookup and the catalog still in flight — six seconds is sometimes not enough, and the
 * run reported an empty window as a failure. It was not a failure; it was a stopwatch.
 *
 * Now it polls for a settled window and only gives up at the ceiling, so the common
 * case is *faster* than the old fixed wait and the cold case still passes.
 */
const SETTLE_POLL_MS = 400
const SETTLE_CEILING_MS = 30_000
const SETTLE_DELAY_MS = 1_000
const SWITCH_SETTLE_DELAY_MS = 8_000
const SHOT_FRAME_DELAY_MS = 400

/** What the window says about itself once it has painted. */
interface SelfTestReport {
  readonly cards: number
  readonly installed: number
  readonly buttons: number
  readonly gateVisible: boolean
  readonly gateTitle: string
  readonly gateChoices: readonly string[]
  readonly gateAction: string
  readonly appName: string
  readonly storeId: string
  readonly navOpen: boolean
  readonly stores: readonly string[]
  readonly categories: readonly string[]
  readonly activeCategory: string | null
  readonly paths: string
  readonly logLines: number
  readonly locales: readonly string[]
  /** `<accessible name>:<glyph count>` per icon-only control in the footer. */
  readonly iconControls: readonly string[]
  /** `<title> [current|newer] Upgrade:on|off Uninstall:on|off` per installed card. */
  readonly cardMenus: readonly string[]
}

/** What changed after clicking a store that was not open. */
interface StoreSwitchReport {
  readonly storeId: string
  readonly active: string | null
  readonly cards: number
  readonly categories: number
}

/**
 * Drives the window once and reports what rendered.
 *
 * This is the only check that would notice a renderer error at all: the main
 * process log stays empty when the page throws. Counting nodes is not enough on its
 * own — the collapsed-grid bug passed every count while showing neither box art nor
 * buttons — so `SELFTEST_SHOT` has the window photograph itself for a human to look
 * at.
 */
export class SelfTestRunner {
  public constructor (
    private readonly window: BrowserWindow,
    private readonly shotPath: string | null = process.env['SELFTEST_SHOT'] ?? null
  ) {}

  /** A short first wait; `run` does the rest of the waiting itself. */
  public get settleDelayMs (): number {
    return SETTLE_DELAY_MS
  }

  /** True when the window is in a state a user could work with. */
  public async run (): Promise<boolean> {
    await this.awaitSettled()
    const report = await this.readReport()
    console.log(JSON.stringify(report, null, 2))

    const switched = report.stores.length > 1 ? await this.switchStore() : null
    if (switched !== null) console.log(`switched: ${JSON.stringify(switched)}`)

    if (this.shotPath !== null) await this.captureShot(this.shotPath)

    // A gate passes on having something to do, not on having a picker: the picker
    // only appears when the registry offers more than one store, and one store is
    // the ordinary case. Requiring choices here failed a perfectly good window.
    // Both footer icons must be present, named and drawn: refresh and the language
    // picker are the only way to reach those two actions now that neither has a label.
    const iconsNamed = report.iconControls.length === 2 &&
      report.iconControls.every((control: string): boolean => /^.+:1$/.test(control))
    // Every installed card offers both actions, and Upgrade is enabled exactly when the
    // version line says there is something newer. Uninstall is always available.
    const menusAgree = report.cardMenus.every((entry: string): boolean =>
      /\[newer\] \S+:on \S+:on$/.test(entry) || /\[current\] \S+:off \S+:on$/.test(entry))
    const rendered = report.locales.length > 1 && iconsNamed && menusAgree && (
      (report.cards > 0 && !report.gateVisible && report.stores.length > 0 &&
        report.categories.length > 0 && report.activeCategory !== null) ||
      (report.gateVisible && report.gateAction.length > 0))
    const switchedWell = switched === null || (
      switched.storeId.length > 0 && switched.storeId !== report.storeId &&
      switched.cards > 0 && switched.categories > 0)

    const passed = rendered && switchedWell
    console.log(passed ? 'SELFTEST OK' : 'SELFTEST FAILED')
    return passed
  }

  /**
   * Wait until the window is showing something, or until the ceiling.
   *
   * "Something" is a card or the gate: those are the two states a person could act on,
   * and between them they cover every way this application legitimately ends up. Timing
   * out is not treated as a failure here — the report is taken anyway, and the checks
   * below decide, so a genuinely empty window still fails for the right reason rather
   * than as a timeout with no detail.
   */
  private async awaitSettled (): Promise<void> {
    const deadline = Date.now() + SETTLE_CEILING_MS
    while (Date.now() < deadline) {
      const ready = await this.evaluate(
        "String(document.querySelectorAll('.card').length > 0 || " +
        "!document.getElementById('gate').hidden)"
      )
      if (ready === 'true') return
      await delay(SETTLE_POLL_MS)
    }
  }

  private async readReport (): Promise<SelfTestReport> {
    const record = asRecord(JSON.parse(await this.evaluate(`JSON.stringify({
      cards: document.querySelectorAll('.card').length,
      installed: document.querySelectorAll('.card.is-installed').length,
      buttons: document.querySelectorAll('.card .actions button').length,
      gateVisible: !document.getElementById('gate').hidden,
      gateTitle: document.getElementById('gate-title').textContent,
      gateChoices: [...document.getElementById('gate-select').options].map((option) => option.text),
      gateAction: document.getElementById('gate-action').textContent,
      appName: document.getElementById('app-name').textContent,
      storeId: document.getElementById('store-id').textContent,
      navOpen: !document.body.classList.contains('nav-closed'),
      stores: [...document.querySelectorAll('#store-list .store-row')].map((row) => row.textContent),
      categories: [...document.querySelectorAll('#cats .cat')].map((cat) => cat.textContent),
      activeCategory: (document.querySelector('#cats .cat.is-active') || {}).textContent || null,
      paths: document.getElementById('log-paths').textContent.slice(0, 120),
      logLines: document.querySelectorAll('.log-line').length,
      locales: [...document.getElementById('locale').options].map((option) => option.value),
      // The two icon-only controls: a glyph with no accessible name is a button nobody
      // can identify, and the failure is silent because the icon still draws.
      // One entry per installed card: its title, whether the version line shows an
      // upgrade, and the menu's two items with their disabled state. This is the only
      // way to see that Upgrade is offered exactly when there is something newer —
      // a screenshot shows a closed menu.
      cardMenus: [...document.querySelectorAll('.card.is-installed')].map((card) => {
        const items = [...card.querySelectorAll('.menu-item')]
          .map((item) => item.textContent + (item.disabled ? ':off' : ':on'))
        const arrow = card.querySelector('.version.has-update') === null ? 'current' : 'newer'
        return (card.querySelector('h2') || {}).textContent + ' [' + arrow + '] ' + items.join(' ')
      }),
      iconControls: [...document.querySelectorAll('.side-tools .icon-btn')]
        .map((control) => {
          const named = control.getAttribute('aria-label') || control.getAttribute('title') ||
            (control.querySelector('[aria-label]') || {}).ariaLabel || ''
          return named + ':' + control.querySelectorAll('svg.icon').length
        })
    })`))) ?? {}

    return {
      cards: readNumber(record, 'cards'),
      installed: readNumber(record, 'installed'),
      buttons: readNumber(record, 'buttons'),
      gateVisible: readBoolean(record, 'gateVisible'),
      gateTitle: readString(record, 'gateTitle'),
      gateChoices: readStringArray(record, 'gateChoices'),
      gateAction: readString(record, 'gateAction'),
      appName: readString(record, 'appName'),
      storeId: readString(record, 'storeId'),
      navOpen: readBoolean(record, 'navOpen'),
      stores: readStringArray(record, 'stores'),
      categories: readStringArray(record, 'categories'),
      activeCategory: readOptionalString(record, 'activeCategory'),
      paths: readString(record, 'paths'),
      logLines: readNumber(record, 'logLines'),
      locales: readStringArray(record, 'locales'),
      iconControls: readStringArray(record, 'iconControls'),
      cardMenus: readStringArray(record, 'cardMenus')
    }
  }

  /**
   * With two stores on the machine the switcher is the thing most likely to break
   * without anyone noticing, so the test uses it. Skipped with one store, which
   * cannot be switched away from.
   */
  private async switchStore (): Promise<StoreSwitchReport> {
    const record = asRecord(JSON.parse(await this.evaluate(`(async () => {
      const other = [...document.querySelectorAll('#store-list .store-row')]
        .find((row) => !row.classList.contains('is-active'))
      other.click()
      await new Promise((done) => setTimeout(done, ${String(SWITCH_SETTLE_DELAY_MS)}))
      return JSON.stringify({
        storeId: document.getElementById('store-id').textContent,
        active: (document.querySelector('#store-list .store-row.is-active') || {}).textContent || null,
        cards: document.querySelectorAll('.card').length,
        categories: document.querySelectorAll('#cats .cat').length
      })
    })()`))) ?? {}

    return {
      storeId: readString(record, 'storeId'),
      active: readOptionalString(record, 'active'),
      cards: readNumber(record, 'cards'),
      categories: readNumber(record, 'categories')
    }
  }

  /**
   * capturePage hands back the last painted frame, so a window that is behind
   * others — or still loading box art — photographs as a half-drawn page. Focus it,
   * wait for the images, then let one frame go by.
   */
  private async captureShot (target: string): Promise<void> {
    this.window.show()
    this.window.focus()
    await this.evaluate(`(async () => {
      await Promise.all([...document.images].map((image) => image.complete
        ? null
        : new Promise((done) => { image.onload = done; image.onerror = done })))
      await new Promise((done) => requestAnimationFrame(() => setTimeout(done, ${String(SHOT_FRAME_DELAY_MS)})))
      return String(document.images.length)
    })()`)
    const image = await this.window.webContents.capturePage()
    fs.writeFileSync(target, image.toPNG())
    console.log(`shot: ${target}`)
  }

  /** Every probe returns a JSON string, so nothing untyped crosses back. */
  private async evaluate (script: string): Promise<string> {
    const result: unknown = await this.window.webContents.executeJavaScript(script)
    return typeof result === 'string' ? result : JSON.stringify(result ?? null)
  }
}

async function delay (milliseconds: number): Promise<void> {
  await new Promise<void>((resolve: () => void): void => {
    setTimeout((): void => { resolve() }, milliseconds)
  })
}
