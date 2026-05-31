const fs = require('fs');
const path = require('path');

const filepath = path.join(__dirname, '..', 'backup.js');
let content = fs.readFileSync(filepath, 'utf8');

const targetBlock = `function startAutoBackup(){
  if(_autoBackupTimer) clearInterval(_autoBackupTimer);
  const cfg=loadAutoBackupSettings();
  if(!cfg||!cfg.enabled) return;
  const ms=cfg.freq==='daily'?24*60*60*1000:7*24*60*60*1000;
  _autoBackupTimer=setInterval(()=>{ triggerAutoBackup(); },ms);
  // Check if overdue
  if(cfg.lastBackup){
    const diff=Date.now()-new Date(cfg.lastBackup).getTime();
    if(diff>ms) triggerAutoBackup();
  }
}
function triggerAutoBackup(){
  const cfg=loadAutoBackupSettings()||{};
  exportFullBackup();
  cfg.lastBackup=new Date().toISOString();
  saveAutoBackupSettings(cfg);
  showToast('💾 גיבוי אוטומטי הורד');
}`;

const replacementBlock = `function startAutoBackup(){
  if(_autoBackupTimer) clearInterval(_autoBackupTimer);
  const cfg=loadAutoBackupSettings();
  if(!cfg||!cfg.enabled) return;
  const ms=cfg.freq==='daily'?24*60*60*1000:7*24*60*60*1000;
  _autoBackupTimer=setInterval(()=>{ triggerAutoBackup(); },ms);
  // Check if overdue or not initialized
  if(!cfg.lastBackup){
    triggerAutoBackup();
  } else {
    const diff=Date.now()-new Date(cfg.lastBackup).getTime();
    if(diff>ms) triggerAutoBackup();
  }
}
function triggerAutoBackup(){
  const cfg=loadAutoBackupSettings()||{};
  if(confirm("💾 הגיע הזמן לגיבוי אוטומטי של המערכת. האם ברצונך להוריד את קובץ הגיבוי למחשב כעת?")) {
    exportFullBackup();
    cfg.lastBackup=new Date().toISOString();
    saveAutoBackupSettings(cfg);
    showToast('💾 גיבוי אוטומטי הורד');
  }
}`;

if (content.includes(targetBlock)) {
  content = content.replace(targetBlock, replacementBlock);
  console.log("Auto-backup logic updated successfully");
} else {
  const normOld = targetBlock.replace(/\r\n/g, '\n');
  const normNew = replacementBlock.replace(/\r\n/g, '\n');
  const normContent = content.replace(/\r\n/g, '\n');
  if (normContent.includes(normOld)) {
    content = normContent.replace(normOld, normNew).replace(/\n/g, '\r\n');
    console.log("Auto-backup logic updated successfully (normalized)");
  } else {
    console.log("Warning: Auto-backup target block not found");
  }
}

fs.writeFileSync(filepath, content, 'utf8');
console.log("Done");
