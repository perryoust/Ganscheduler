const rev = (str) => {
  if (str == null) return '';
  const reversedStr = String(str).split('').reverse().join('');
  const fixedNums = reversedStr.replace(/([0-9a-zA-Z.,:/\\-]+)/g, match => match.split('').reverse().join(''));
  return fixedNums.replace(/[()]/g, m => m === '(' ? ')' : '(');
};

const tests = [
  "שולם ע\"י - קרנית רייזל",
  "בנק הבינלאומי (31)",
  "סניף 124 | חשבון 30688",
  "תקציב ספטמבר 2026",
  "1,312 :יתרה",
  "181.00 ₪"
];

for (const t of tests) {
  console.log("Original:", t);
  console.log("Reversed:", rev(t));
  console.log("----");
}
