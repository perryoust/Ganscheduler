const item = {
    supName: "עליזה קריבושי",
    orderDesc: "חוגים - גנים",
    txNum: 40554,
    txDate: "2/8/26",
    txAmt: 33762.71,
    txTotal: 39840.00,
    num: "",
    date: "",
    amt: "0.0",
    total: "0.0"
};

const isValidStr = (val) => val !== undefined && val !== null && String(val).trim() !== '' && String(val).trim() !== '-' && String(val).trim() !== '0' && String(val).trim() !== '0.0' && String(val).trim() !== '0.00';
const isNonZeroRaw = (val) => isValidStr(val) && val !== 0;

const _rawHasTax = !!(isValidStr(item.num) || isValidStr(item.date) || isNonZeroRaw(item.total) || isNonZeroRaw(item.amt));
const _rawHasTx = !!(isValidStr(item.txNum) || isValidStr(item.txDate) || isNonZeroRaw(item.txTotal) || isNonZeroRaw(item.txAmt));

let status = 'order';
const hasTaxDetails = _rawHasTax || !!(isValidStr(item.num) || isValidStr(item.date) || item.total > 0 || item.amt > 0);
const hasTxDetails  = _rawHasTx  || !!(isValidStr(item.txNum) || isValidStr(item.txDate) || item.txTotal > 0 || item.txAmt > 0);

if (hasTaxDetails) {
    status = 'tax_invoice';
} else if (hasTxDetails) {
    status = 'tx_invoice';
}

console.log("hasTaxDetails:", hasTaxDetails);
console.log("hasTxDetails:", hasTxDetails);
console.log("status:", status);
