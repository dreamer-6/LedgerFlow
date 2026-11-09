/**
 * printPagination.ts — Deterministic A4 Multi-Page Pagination Engine
 *
 * Implements automatic, content-aware pagination for multi-page documents (Invoices & Quotations)
 * ensuring exact A4 physical page boundaries, repeated continuation headers,
 * repeated table column headers, and graceful totals/footer placement.
 */

export interface PaginationConfig {
  totalPageHeight: number;        // Total printable height in px (e.g. 1000px for A4)
  page1HeaderHeight: number;      // Height of full header + parties card on Page 1
  continuationHeaderHeight: number; // Height of compact header on Page 2..N
  tableHeaderHeight: number;      // Height of repeated table column headers
  footerHeight: number;           // Height of totals + amount in words + terms + bank + signature
  pageNumberHeight: number;       // Height of bottom page numbering bar
  minItemsOnFinalPageWithFooter?: number;
  maxPage1Items?: number;         // Layout preference: target max items on Page 1 (e.g. 7)
}

export interface PageChunk<T> {
  pageIndex: number;
  totalPages: number;
  items: T[];
  isFirstPage: boolean;
  isLastPage: boolean;
  hasFooter: boolean;
}

export const DEFAULT_A4_PAGINATION_CONFIG: PaginationConfig = {
  totalPageHeight: 1020,
  page1HeaderHeight: 290,
  continuationHeaderHeight: 52,
  tableHeaderHeight: 40,
  footerHeight: 330,
  pageNumberHeight: 30,
  minItemsOnFinalPageWithFooter: 1,
  maxPage1Items: 7
};

export const A4_LANDSCAPE_PAGINATION_CONFIG: PaginationConfig = {
  totalPageHeight: 720,
  page1HeaderHeight: 250,
  continuationHeaderHeight: 48,
  tableHeaderHeight: 38,
  footerHeight: 270,
  pageNumberHeight: 26,
  minItemsOnFinalPageWithFooter: 1
};

export const A5_PORTRAIT_PAGINATION_CONFIG: PaginationConfig = {
  totalPageHeight: 780,
  page1HeaderHeight: 260,
  continuationHeaderHeight: 48,
  tableHeaderHeight: 38,
  footerHeight: 280,
  pageNumberHeight: 26,
  minItemsOnFinalPageWithFooter: 1
};

export const A5_LANDSCAPE_PAGINATION_CONFIG: PaginationConfig = {
  totalPageHeight: 530,
  page1HeaderHeight: 210,
  continuationHeaderHeight: 44,
  tableHeaderHeight: 36,
  footerHeight: 230,
  pageNumberHeight: 24,
  minItemsOnFinalPageWithFooter: 1
};

export const LETTER_PORTRAIT_PAGINATION_CONFIG: PaginationConfig = {
  totalPageHeight: 980,
  page1HeaderHeight: 290,
  continuationHeaderHeight: 52,
  tableHeaderHeight: 40,
  footerHeight: 330,
  pageNumberHeight: 30,
  minItemsOnFinalPageWithFooter: 1
};

export const LETTER_LANDSCAPE_PAGINATION_CONFIG: PaginationConfig = {
  totalPageHeight: 740,
  page1HeaderHeight: 250,
  continuationHeaderHeight: 48,
  tableHeaderHeight: 38,
  footerHeight: 270,
  pageNumberHeight: 26,
  minItemsOnFinalPageWithFooter: 1
};

export function getPaginationConfigForFormat(
  format: string = 'A4',
  orientation: string = 'PORTRAIT',
  paperMargin?: 'compact' | 'normal' | 'spacious'
): PaginationConfig {
  const normFormat = (format || 'A4').toUpperCase();
  const normOrient = (orientation || 'PORTRAIT').toUpperCase();

  let baseConfig: PaginationConfig;
  if (normFormat.includes('A5')) {
    baseConfig = normOrient === 'LANDSCAPE' || normFormat.includes('LANDSCAPE')
      ? A5_LANDSCAPE_PAGINATION_CONFIG
      : A5_PORTRAIT_PAGINATION_CONFIG;
  } else if (normFormat.includes('LETTER')) {
    baseConfig = normOrient === 'LANDSCAPE' || normFormat.includes('LANDSCAPE')
      ? LETTER_LANDSCAPE_PAGINATION_CONFIG
      : LETTER_PORTRAIT_PAGINATION_CONFIG;
  } else {
    // Default A4
    baseConfig = normOrient === 'LANDSCAPE' || normFormat.includes('LANDSCAPE')
      ? A4_LANDSCAPE_PAGINATION_CONFIG
      : DEFAULT_A4_PAGINATION_CONFIG;
  }

  // Adjust available page height and item capacity based on user-selected margins
  if (paperMargin === 'compact') {
    return {
      ...baseConfig,
      totalPageHeight: baseConfig.totalPageHeight + 40,
      maxPage1Items: (baseConfig.maxPage1Items || 7) + 1
    };
  } else if (paperMargin === 'spacious') {
    return {
      ...baseConfig,
      totalPageHeight: baseConfig.totalPageHeight - 50,
      maxPage1Items: Math.max(4, (baseConfig.maxPage1Items || 7) - 1)
    };
  }

  return baseConfig;
}

/**
 * Calculates deterministic line item height based on description length, serial number, etc.
 */
export function estimateItemRowHeight(item: {
  description?: string;
  itemName?: string;
  subtext?: string;
  serialNumber?: string;
  serials?: string[];
  warrantyMonths?: number;
}): number {
  let height = 36; // Base row height
  const name = item.itemName || item.description || '';
  if (name.length > 40) {
    height += 16 * Math.floor(name.length / 40);
  }
  const sub = item.subtext || '';
  if (sub) {
    height += 16;
  }
  const serialText = item.serialNumber || (item.serials && item.serials.length > 0 ? item.serials.join(', ') : '');
  if (serialText) {
    const serialLines = Math.max(1, Math.ceil(serialText.length / 45));
    height += 16 * serialLines;
  }
  if (item.warrantyMonths && Number(item.warrantyMonths) > 0) {
    height += 16;
  }
  return height;
}

/**
 * Paginates an arbitrary array of items into discrete A4 page chunks.
 * Guarantee invariants:
 * 1. No item is duplicated or lost.
 * 2. Order of items is strictly preserved.
 * 3. Page count is accurate (Page X of Y).
 * 4. Totals & footer are NEVER placed before remaining items.
 * 5. If footer cannot fit with remaining items, it cleanly flows to an overflow final page.
 */
export function paginateItems<T>(
  items: T[],
  getItemHeight: (item: T) => number,
  config: PaginationConfig = DEFAULT_A4_PAGINATION_CONFIG
): PageChunk<T>[] {
  if (!items || items.length === 0) {
    return [
      {
        pageIndex: 0,
        totalPages: 1,
        items: [],
        isFirstPage: true,
        isLastPage: true,
        hasFooter: true
      }
    ];
  }

  // Calculate item heights
  const itemHeights = items.map(getItemHeight);
  const totalItemHeight = itemHeights.reduce((sum, h) => sum + h, 0);

  // Check if everything fits on a single page
  const page1CapacityWithFooter =
    config.totalPageHeight -
    config.page1HeaderHeight -
    config.tableHeaderHeight -
    config.footerHeight -
    config.pageNumberHeight;

  if (totalItemHeight <= page1CapacityWithFooter && (!config.maxPage1Items || items.length <= config.maxPage1Items)) {
    return [
      {
        pageIndex: 0,
        totalPages: 1,
        items: [...items],
        isFirstPage: true,
        isLastPage: true,
        hasFooter: true
      }
    ];
  }

  // Multi-page distribution
  const pages: { items: T[]; hasFooter: boolean }[] = [];
  let currentIndex = 0;
  let isFirst = true;

  while (currentIndex < items.length) {
    const isContinuation = !isFirst;
    const headerH = isFirst ? config.page1HeaderHeight : config.continuationHeaderHeight;
    const availableHeightWithoutFooter =
      config.totalPageHeight - headerH - config.tableHeaderHeight - config.pageNumberHeight;
    const availableHeightWithFooter = availableHeightWithoutFooter - config.footerHeight;

    // Check if ALL remaining items can fit on this page WITH the footer
    let remainingHeight = 0;
    for (let i = currentIndex; i < items.length; i++) {
      remainingHeight += itemHeights[i];
    }

    // On Page 1, if maxPage1Items is configured and items remain beyond maxPage1Items, do not force footer on Page 1
    const allowedFitWithFooter = isFirst && config.maxPage1Items && (items.length - currentIndex) > config.maxPage1Items
      ? false
      : remainingHeight <= availableHeightWithFooter;

    if (allowedFitWithFooter) {
      // All remaining items and the footer fit on this page!
      pages.push({
        items: items.slice(currentIndex),
        hasFooter: true
      });
      break;
    }

    // Not everything fits with footer. Pack as many items as possible on this page.
    let currentHeight = 0;
    let itemsForThisPage: T[] = [];
    let nextIndex = currentIndex;

    while (nextIndex < items.length) {
      const h = itemHeights[nextIndex];
      // On Page 1, respect maxPage1Items preference if set
      if (isFirst && config.maxPage1Items && itemsForThisPage.length >= config.maxPage1Items) {
        break;
      }
      if (currentHeight + h > availableHeightWithoutFooter && itemsForThisPage.length > 0) {
        break;
      }
      currentHeight += h;
      itemsForThisPage.push(items[nextIndex]);
      nextIndex++;
    }

    // Safety check: ensure at least 1 item is placed to prevent infinite loop
    if (itemsForThisPage.length === 0 && nextIndex < items.length) {
      itemsForThisPage.push(items[nextIndex]);
      nextIndex++;
    }

    pages.push({
      items: itemsForThisPage,
      hasFooter: false
    });

    currentIndex = nextIndex;
    isFirst = false;
  }

  // If the last page does not have the footer, add a final page for the footer
  if (pages.length > 0 && !pages[pages.length - 1].hasFooter) {
    pages.push({
      items: [],
      hasFooter: true
    });
  }

  const totalPages = pages.length;

  return pages.map((page, idx) => ({
    pageIndex: idx,
    totalPages,
    items: page.items,
    isFirstPage: idx === 0,
    isLastPage: idx === totalPages - 1,
    hasFooter: page.hasFooter
  }));
}
