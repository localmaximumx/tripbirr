/**
 * Modular regex patterns for Telebirr (Sender ID 127) messages.
 * Supports varying whitespace, line breaks, capitalization, date formats,
 * punctuation variations, and English + basic Amharic Telebirr keywords.
 */

export const TELEBIRR_OFFICIAL_SENDER_ID = '127';

export const SMS_CLASSIFICATION_PATTERNS = {
  // Incoming payment / transfer received
  PAYMENT_RECEIVED: [
    /\byou\s+have\s+received\s+ETB\s*[\d,]+(?:\.\d{1,2})?\b/i,
    /\breceived\s+ETB\s*[\d,]+(?:\.\d{1,2})?\s+from\b/i,
    /\bpayment\s+of\s+ETB\s*[\d,]+(?:\.\d{1,2})?\s+received\s+from\b/i,
    /ተቀብለዋል/i,
  ],
  TRANSFER_RECEIVED: [
    /\btransferred\s+ETB\s*[\d,]+(?:\.\d{1,2})?\s+to\s+your\s+account\b/i,
    /\baccount\s+has\s+been\s+credited\s+with\s+ETB\s*[\d,]+(?:\.\d{1,2})?\b/i,
  ],
  // Outgoing payments & transfers
  PAYMENT_SENT: [
    /\byou\s+have\s+paid\s+ETB\s*[\d,]+(?:\.\d{1,2})?\b/i,
    /\bpaid\s+ETB\s*[\d,]+(?:\.\d{1,2})?\s+to\b/i,
    /\byou\s+have\s+purchased\b/i,
    /ከፍለዋል/i,
    /ተቀንሷል/i,
    /ወጪ\s+ሆኗል/i,
  ],
  TRANSFER_SENT: [
    /\byou\s+have\s+transferred\s+ETB\s*[\d,]+(?:\.\d{1,2})?\s+to\b/i,
    /\bsent\s+ETB\s*[\d,]+(?:\.\d{1,2})?\s+to\b/i,
    /\btransferred\s+ETB\s*[\d,]+(?:\.\d{1,2})?\s+to\b/i,
    /አስተላልፈዋል/i,
    /\bdebited\b/i,
    /\bwithdrawn\b/i,
  ],
  // Reversals and Refunds (must check before generic received/sent)
  PAYMENT_REVERSED: [
    /\bhas\s+been\s+reversed\b/i,
    /\breversal\s+of\s+transaction\b/i,
    /\btransaction\s+[A-Z0-9]+\s+is\s+reversed\b/i,
    /\breversed\s+ETB\s*[\d,]+(?:\.\d{1,2})?\b/i,
  ],
  REFUND: [
    /\bhas\s+been\s+refunded\b/i,
    /\brefund\s+of\s+ETB\s*[\d,]+(?:\.\d{1,2})?\b/i,
    /\brefunded\s+ETB\s*[\d,]+(?:\.\d{1,2})?\b/i,
  ],
  // Failed transactions
  PAYMENT_FAILED: [
    /\btransaction\s+(?:has\s+)?failed\b/i,
    /\bunable\s+to\s+process\s+your\s+(?:payment|transaction)\b/i,
    /\binsufficient\s+balance\b/i,
    /\bfailed\s+to\s+(?:send|pay|transfer)\b/i,
  ],
  // Balance updates
  ACCOUNT_BALANCE_UPDATE: [
    /\byour\s+current\s+(?:e-money\s+)?account\s+balance\s+is\s+ETB\b/i,
    /\bbalance\s+enquiry\b/i,
  ],
  // Promotional & Service messages
  PROMOTIONAL_MESSAGE: [
    /\bwin\s+up\s+to\b/i,
    /\bbonus\s+offer\b/i,
    /\bdiscount\s+when\s+you\s+pay\b/i,
    /\bdownload\s+telebirr\s+superapp\b/i,
    /\bpromo\b/i,
    /\blucky\s+draw\b/i,
  ],
  SERVICE_NOTIFICATION: [
    /\bscheduled\s+maintenance\b/i,
    /\bpin\s+has\s+been\s+changed\b/i,
    /\bone-time\s+password\b/i,
    /\botp\s+is\b/i,
    /\bsystem\s+upgrade\b/i,
    /\bdear\s+customer,\s+telebirr\s+service\b/i,
  ],
  RECHARGE: [
    /\brecharge(?:d)?\b/i,
    /\bairtime\b/i,
    /\bpackage\b/i,
    /\btop-?up\b/i,
    /የአየር\s*ሰዓት/i,
    /ሞልተዋል/i,
    /ጥቅል/i,
  ],
};

export const SMS_EXTRACTION_PATTERNS = {
  // Greeting / Recipient: "Dear Biniyam" or "Dear Biniyam Zenebe,"
  recipient: /\bDear\s+([A-Za-z\u1200-\u137F][A-Za-z\u1200-\u137F\s.'-]{0,40}?)(?=[,\n\r]|\s+You\s+have|\s+Your\b)/i,

  // Primary Transaction Amount: "received ETB 50.00", "50.00 ብር ተቀብለዋል", "paid ETB 120.50", "reversed ETB 50.00", "refund of ETB 50.00"
  transactionAmount: /(?:received|paid|transferred|sent|credited\s+with|reversed|refund(?:ed)?(?:\s+of)?|amount(?:\s+of)?)\s*(?:(ETB|Birr|ብር)\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*(ETB|Birr|ብር)?)|(?:([\d,]+(?:\.\d{1,2})?)\s*(?:ETB|Birr|ብር)?\s*ተቀብለዋል)/i,

  // Fallback amount (avoid matching balance if primary verb is unusual)
  fallbackAmount: /(?:(ETB|Birr|ብር)\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*(?:ETB|Birr|ብር))/i,

  // Sender or Counterparty with masked/unmasked phone: "from Natnael Birhanu(2519****8747)" or "ከ Natnael Birhanu (0911****23)"
  counterpartyWithPhone: /(?:from|to|by|ከ|ለ)\s+([^()\n\r]+?)\s*\(\s*([+\d*]{6,16})\s*\)/i,

  // Sender or Counterparty without phone: "from Natnael Birhanu on 21/10/2026"
  counterpartyWithoutPhone: /(?:from|to|by|ከ|ለ)\s+([A-Za-z\u1200-\u137F][A-Za-z\u1200-\u137F\s.'-]{1,45}?)(?=\s+on\s+\d|\s+at\s+\d|\.\s+Your|\.|$)/i,

  // Standalone phone pattern inside parentheses
  phoneInParens: /\(\s*((?:\+?251|0)?[97][\d*]{6,12})\s*\)/,

  // Date & Time: "on 21/10/2026 23:43:07" or "on 2026-10-21 at 23:43:07" or "ቀን 21/10/2026"
  dateTime: /(?:on|ቀን)\s+(\d{1,4}[/-]\d{1,2}[/-]\d{1,4})(?:\s+(?:at\s+)?(\d{1,2}:\d{2}(?::\d{2})?))?/i,

  // Transaction ID: "Your transaction number is DJL25NAFRW." or "transaction ID: DJL25NAFRW" or "የሂሳብ ቁጥር DJL25NAFRW"
  transactionId: /(?:transaction\s+(?:number|id|no\.?|ref)|txn\s*(?:id|no\.?)|የሂሳብ\s*ቁጥር)\s*(?:is|:)?\s*([A-Z0-9]{6,20})/i,

  // Original Transaction ID for reversals/refunds: "reversal of transaction DJL25NAFRW" or "original transaction DJL25NAFRW"
  originalTransactionId: /(?:reversal\s+of\s+transaction|original\s+transaction(?:\s+number|\s+id)?|refund\s+for\s+transaction)\s*(?:is|:)?\s*([A-Z0-9]{6,20})/i,

  // Account Balance: "Your current E-Money Account balance is ETB 332.62" or "ቀሪ ሂሳብዎ 332.62 ብር"
  accountBalance: /(?:(?:current\s+(?:e-money\s+)?(?:account\s+)?balance|new\s+balance)\s+is|(?:ቀሪ\s*ሂሳብዎ))\s*(?:ETB|Birr|ብር)?\s*([\d,]+(?:\.\d{1,2})?)/i,
};
