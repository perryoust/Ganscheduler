const n = "ריקי LIKE - ג'ליקו"; 
const m=n.match(/^(.*?)\s*([-\u2010-\u2015\u2212\u05BE\uFE58\uFE63\uFF0D\/])\s*(.*)$/); 
console.log(m ? m[3].trim() : 'no match');
