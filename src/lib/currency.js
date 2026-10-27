export const SUPPORTED_CURRENCIES = ['NGN','USD','CAD','GHS','KES','ZAR','GBP','EUR','AUD','INR','PKR','UGX','TZS','RWF','XOF','XAF','AED'];
export const CURRENCY_LABELS = {
  NGN:'Nigerian Naira', USD:'US Dollar', CAD:'Canadian Dollar', GHS:'Ghanaian Cedi',
  KES:'Kenyan Shilling', ZAR:'South African Rand', GBP:'Pound Sterling', EUR:'Euro',
  AUD:'Australian Dollar', INR:'Indian Rupee', PKR:'Pakistani Rupee', UGX:'Ugandan Shilling',
  TZS:'Tanzanian Shilling', RWF:'Rwandan Franc', XOF:'West African CFA Franc',
  XAF:'Central African CFA Franc', AED:'UAE Dirham'
};
export function getPreferredCurrency() {
  try { const value = localStorage.getItem('hysmart-company-currency'); return SUPPORTED_CURRENCIES.includes(value) ? value : 'NGN'; }
  catch { return 'NGN'; }
}
export function formatMoney(value, currency = getPreferredCurrency()) {
  const safeCurrency = SUPPORTED_CURRENCIES.includes(currency) ? currency : 'NGN';
  try { return new Intl.NumberFormat(undefined, {style:'currency',currency:safeCurrency,maximumFractionDigits:2}).format(Number(value || 0)); }
  catch { return `${safeCurrency} ${Number(value || 0).toLocaleString()}`; }
}
