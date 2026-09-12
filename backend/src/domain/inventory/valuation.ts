import { DatabaseSync } from 'node:sqlite';

export interface ItemStockSummary {
  itemId: string;
  itemName: string;
  unitSymbol: string;
  totalQuantity: number;
  weightedAverageRatePaise: number;
  totalValuePaise: number;
}

export interface GodownStockSummary {
  godownId: string;
  godownName: string;
  quantity: number;
}

export class InventoryEngine {
  /**
   * Derive current stock quantity and weighted average cost for an item up to a specific date.
   * Completely transaction-driven: derived from opening balances and stock_entries.
   */
  public static getItemStockSummary(
    db: DatabaseSync,
    itemId: string,
    asOfDate?: string
  ): ItemStockSummary {
    const item = db.prepare(`
      SELECT si.item_id, si.item_name, si.opening_qty, si.opening_rate_paise, u.symbol AS unit_symbol
      FROM stock_items si
      JOIN units u ON si.unit_id = u.unit_id
      WHERE si.item_id = ?
    `).get(itemId) as {
      item_id: string;
      item_name: string;
      opening_qty: number;
      opening_rate_paise: number;
      unit_symbol: string;
    } | undefined;

    if (!item) {
      throw new Error(`Stock Item with ID '${itemId}' does not exist.`);
    }

    // Query all inward and outward movements chronologically
    let query = `
      SELECT movement_type, quantity, rate_paise, value_paise, entry_date
      FROM stock_entries
      WHERE item_id = ?
    `;
    const params: any[] = [itemId];

    if (asOfDate) {
      query += ` AND entry_date <= ?`;
      params.push(asOfDate);
    }
    query += ` ORDER BY entry_date ASC, created_at ASC, rowid ASC`;

    const movements = db.prepare(query).all(...params) as Array<{
      movement_type: 'IN' | 'OUT';
      quantity: number;
      rate_paise: number;
      value_paise: number;
    }>;

    let currentQty = 0;
    let currentAvgRatePaise = 0;

    for (const m of movements) {
      const mQty = Number(m.quantity);
      const mRate = Math.round(Number(m.rate_paise));

      if (m.movement_type === 'IN') {
        const totalPreviousValue = currentQty * currentAvgRatePaise;
        const incomingValue = mQty * mRate;
        const newTotalQty = currentQty + mQty;

        if (newTotalQty > 0) {
          currentAvgRatePaise = Math.round((totalPreviousValue + incomingValue) / newTotalQty);
        }
        currentQty = newTotalQty;
      } else if (m.movement_type === 'OUT') {
        currentQty -= mQty;
        // In outward movement, unit rate remains the current weighted average rate
        if (currentQty <= 0) {
          currentAvgRatePaise = 0;
        }
      }
    }

    const totalValuePaise = Math.round(currentQty * currentAvgRatePaise);

    return {
      itemId: item.item_id,
      itemName: item.item_name,
      unitSymbol: item.unit_symbol,
      totalQuantity: Math.max(0, currentQty),
      weightedAverageRatePaise: currentAvgRatePaise,
      totalValuePaise: Math.max(0, totalValuePaise)
    };
  }

  /**
   * Validate if sufficient stock is available in a godown prior to an outward posting
   */
  public static validateStockAvailability(
    db: DatabaseSync,
    itemId: string,
    godownId: string,
    requestedOutwardQty: number,
    allowNegative: boolean = false
  ): { isValid: boolean; currentQty: number; message?: string } {
    if (allowNegative) return { isValid: true, currentQty: 999999 };

    const row = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN movement_type = 'IN' THEN quantity ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN movement_type = 'OUT' THEN quantity ELSE 0 END), 0) AS balance_qty
      FROM stock_entries
      WHERE item_id = ? AND godown_id = ?
    `).get(itemId, godownId) as { balance_qty: number };

    const currentQty = Number(row?.balance_qty || 0);

    if (currentQty < requestedOutwardQty) {
      return {
        isValid: false,
        currentQty,
        message: `Insufficient stock for item. Available: ${currentQty}, Requested: ${requestedOutwardQty}`
      };
    }

    return { isValid: true, currentQty };
  }
}
