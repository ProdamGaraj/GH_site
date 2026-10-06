/**
 * Рантайм ленты новостей (runtime/news-feed-runtime.js): поиск, фильтры и
 * бесконечная подгрузка на странице со списком новостей. Вставляется, только
 * если на странице есть корень ленты [data-news-feed].
 */
import { runtimeScript } from './runtimeFile'

/** Атрибут корня ленты; data-news-filters, data-news-card и прочие — не он. */
const FEED_ROOT = /\sdata-news-feed(?=[\s=>/])/

export function hasNewsFeed(bodyHtml: string): boolean {
  return FEED_ROOT.test(bodyHtml)
}

export function generateNewsFeedRuntime(bodyHtml: string): string {
  return hasNewsFeed(bodyHtml) ? runtimeScript('news-feed-runtime.js') : ''
}
