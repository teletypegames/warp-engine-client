import type { MessageKey } from './EnglishMessages'

/** One complete language. Partial bundles are not a thing: the type forbids them. */
export type MessageBundle = Readonly<Record<MessageKey, string>>

/** The languages the window speaks. The public site has the same two. */
export const LOCALES = ['en', 'hu'] as const

export type Locale = (typeof LOCALES)[number]
