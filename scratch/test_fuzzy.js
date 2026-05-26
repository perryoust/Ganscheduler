const numbersInName = ['0524102021', '2165015272'];
const inv = {
  num: '0524102021-2165015272',
  supName: 'קרביץ'
};
const score = 4; // Because cleanFileBase includes supName

const cleanInv = String(inv.num || '').replace(/\D/g, '').replace(/^0+/, '');

const isYear = (val) => {
  const num = parseInt(val, 10);
  return num >= 2010 && num <= 2035;
};

const checkFuzzyMatch = (targetNum) => {
  if (!targetNum) return false;
  if (score === 0) {
    if (targetNum.length < 3) return false;
    if (isYear(targetNum)) return false;
    if (targetNum.length < 4) return false; // Prevent generic short number fuzzy matches
  } else {
    // Supplier matches! We can allow shorter target numbers.
    if (isYear(targetNum)) return false;
  }
  // Exact match in individual number blocks (ignoring leading zeros)
  if (numbersInName.map(n => n.replace(/^0+/, '')).includes(targetNum)) return true;
  if (isYear(targetNum)) return false; // Don't combine blocks for years
  
  // Check combining adjacent blocks (e.g. "500" and "076" for invoice "500076")
  for (let i = 0; i < numbersInName.length; i++) {
    let combined = numbersInName[i];
    if (combined.replace(/^0+/, '') === targetNum) return true;
    for (let j = i + 1; j < numbersInName.length; j++) {
      combined += numbersInName[j];
      if (combined.replace(/^0+/, '') === targetNum) return true;
      if (combined.length > targetNum.length + 2) break; // Optimization
    }
  }
  return false;
};

console.log("cleanInv:", cleanInv);
console.log("checkFuzzyMatch:", checkFuzzyMatch(cleanInv));
