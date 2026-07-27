/**
 * פתרון גיבוי למערכת מערכת שעות גנים
 * 
 * הוראות התקנה:
 * 1. היכנסו לכתובת: https://script.google.com/
 * 2. צרו פרויקט חדש.
 * 3. מחקו את הקוד שיש שם, והדביקו את כל הקוד מקובץ זה.
 * 4. לחצו על "פריסה" (Deploy) -> "פריסה חדשה" (New deployment).
 * 5. בחרו בצד שמאל את גלגל השיניים ⚙️ וסמנו "אפליקציית אינטרנט" (Web app).
 * 6. תחת "למי יש גישה" (Who has access), בחרו "כל אחד" (Anyone). 
 *    (הקוד עדיין מאובטח באמצעות טוקן שנמצא בפונקציה).
 * 7. לחצו על פריסה (Deploy). ייתכן שתתבקשו לאשר הרשאות.
 * 8. העתיקו את ה-"Web app URL" והדביקו אותו במערכת הגנים.
 */

const SECURITY_TOKEN = "ganscheduler-backup-2026-xyz"; // ניתן לשנות את זה לכל מחרוזת, אך יש לעדכן גם באפליקציה

function doPost(e) {
  try {
    let token = "";
    let data = "";
    
    // Support both raw JSON post (fetch) and Form post (bypasses CORS/tracking blocks)
    if (e.parameter && e.parameter.token) {
      token = e.parameter.token;
      data = e.parameter.data;
    } else if (e.postData && e.postData.contents) {
      const payload = JSON.parse(e.postData.contents);
      token = payload.token;
      data = payload.data;
    }
    
    // בדיקת טוקן אבטחה
    if (token !== SECURITY_TOKEN) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Access Denied" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    const folderName = "Ganscheduler_Backups";
    let folder = getOrCreateFolder(folderName);
    
    // שם הקובץ עם תאריך
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = "Backup_" + dateStr + ".json";
    
    // יצירת הקובץ בתיקייה
    const file = folder.createFile(fileName, data, MimeType.PLAIN_TEXT);
    
    // ניקוי אוטומטי: שמירת 30 הגיבויים האחרונים ומחיקת הישנים
    cleanOldBackups(folder);
    
    return ContentService.createTextOutput(JSON.stringify({ 
      success: true, 
      url: file.getUrl(),
      fileName: fileName
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// פונקציית עזר לניקוי קבצים ישנים - שומרת רק את 30 הקבצים האחרונים
function cleanOldBackups(folder) {
  const maxFiles = 30; // ניתן לשנות את המספר כדי לשמור יותר או פחות גיבויים
  const files = folder.getFiles();
  const fileList = [];
  
  while (files.hasNext()) {
    const file = files.next();
    fileList.push({
      file: file,
      date: file.getDateCreated()
    });
  }
  
  // מיון לפי תאריך יצירה (מהחדש לישן)
  fileList.sort((a, b) => b.date - a.date);
  
  // אם יש יותר מ-30 קבצים, מחק את הישנים ביותר
  if (fileList.length > maxFiles) {
    for (let i = maxFiles; i < fileList.length; i++) {
      fileList[i].file.setTrashed(true); // מעביר לפח האשפה של גוגל דרייב
    }
  }
}

// פונקציית עזר למציאת או יצירת תיקייה
function getOrCreateFolder(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(folderName);
}

// פונקציה חובה כדאי שה-URL יעבוד, גם אם אנחנו לא משתמשים ב-GET
function doGet(e) {
  return ContentService.createTextOutput("Ganscheduler Backup Webhook Active.");
}
