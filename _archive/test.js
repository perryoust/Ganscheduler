const _SUP_ALIASES={};
function supAct(fullName){
  if(!fullName) return '';
  const norm = _SUP_ALIASES[fullName]||fullName;
  const match = norm.match(/^(.*?)\s*([-\u2010-\u2015\u2212\u05BE\uFE58\uFE63\uFF0D])\s*(.*)$/);
  if(match) return match[3].trim();
  return '';
}
console.log("Act for 'ריקי LIKE - ג\\'ליקו':", supAct("ריקי LIKE - ג'ליקו"));
