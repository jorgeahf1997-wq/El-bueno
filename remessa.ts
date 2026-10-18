/**
 * Remessa Conforme: estimate of the taxes on international purchases sent by post/courier.
 *
 * Rules used (checked in October 2026; the regime has changed several times, so review this file
 * whenever the Ministério da Fazenda or the Receita Federal publishes a new rule):
 *  - Customs value up to US$ 50: import tax 0% (in force since 12 May 2026, MP 1.357/2026 plus a Fazenda
 *    portaria; it used to be 20%).
 *  - From US$ 50.01 to US$ 3,000: import tax of 60% minus a fixed deduction of US$ 30. Lei 15.502/2026
 *    (10 Sep 2026) lets the Minister of Finance lower this band to 30%; no such act had been published when
 *    this was checked, so 60% - US$ 30 stays until one is.
 *  - These rates are for stores enrolled in Remessa Conforme; outside it the rate is 60% with no deduction.
 *  - ICMS (state tax, 17% to 20%) is charged on top, "por dentro" (the tax is part of its own base).
 *  - Customs value = product + international shipping (+ insurance, not modelled here).
 * It is an estimate: the store (or the carrier) calculates the real amount at checkout.
 */
export const REMESSA = {
  asOf: 'outubro de 2026',
  freeUpToUSD: 50,
  importRate: 0.6,
  deductionUSD: 30,
  regimeLimitUSD: 3000,
  /** Reference exchange rate (R$ per US$). The visitor can edit it on screen. */
  defaultRate: 5,
  icmsOptions: [17, 18, 19, 20]
} as const;

export interface RemessaInput {
  goodsUSD: number;
  shippingUSD: number;
  /** ICMS rate as a percentage, e.g. 17 */
  icmsPercent: number;
}

export interface RemessaResult {
  customsUSD: number;
  importTaxUSD: number;
  icmsUSD: number;
  totalTaxesUSD: number;
  finalUSD: number;
  /** true when the value is above the simplified regime (US$ 3,000) */
  overLimit: boolean;
  /** true when the import tax is zero because of the US$ 50 rule */
  exempt: boolean;
}

const nonNegative = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

export function calcRemessa({ goodsUSD, shippingUSD, icmsPercent }: RemessaInput): RemessaResult {
  const customsUSD = nonNegative(goodsUSD) + nonNegative(shippingUSD);
  const exempt = customsUSD <= REMESSA.freeUpToUSD;
  const importTaxUSD = exempt ? 0 : Math.max(0, customsUSD * REMESSA.importRate - REMESSA.deductionUSD);

  const rate = Math.min(Math.max(icmsPercent, 0), 40) / 100;
  // "Por dentro": price with ICMS = (value + import tax) / (1 - rate)
  const withIcms = (customsUSD + importTaxUSD) / (1 - rate);
  const icmsUSD = withIcms - (customsUSD + importTaxUSD);

  return {
    customsUSD,
    importTaxUSD,
    icmsUSD,
    totalTaxesUSD: importTaxUSD + icmsUSD,
    finalUSD: customsUSD + importTaxUSD + icmsUSD,
    overLimit: customsUSD > REMESSA.regimeLimitUSD,
    exempt
  };
}

/**
 * Reads a number the way people in Brazil type it: "12,5", "12.5", "1.234,56" and "1.299" (one thousand
 * two hundred and ninety-nine). A price copied from an English-language store ("1,234.56") also works: when
 * both separators appear, the LAST one is the decimal mark. Returns 0 for anything that is not a positive number.
 */
export function parseDecimal(text: string): number {
  if (/^\s*-/.test(text)) return 0;
  const clean = text.replace(/[^\d.,]/g, '');
  if (!clean) return 0;
  const lastComma = clean.lastIndexOf(',');
  const lastDot = clean.lastIndexOf('.');
  let normalized = clean;
  if (lastComma >= 0 && lastDot >= 0) {
    normalized =
      lastComma > lastDot ? clean.replace(/\./g, '').replace(',', '.') : clean.replace(/,/g, '');
  } else if (lastComma >= 0) {
    // "12,5" is a decimal comma; "1,234,567" (several commas) can only be thousands separators.
    normalized = (clean.match(/,/g) || []).length > 1 ? clean.replace(/,/g, '') : clean.replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(clean)) {
    normalized = clean.replace(/\./g, '');
  }
  const n = parseFloat(normalized);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
