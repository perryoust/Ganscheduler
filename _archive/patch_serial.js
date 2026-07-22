const fs = require('fs');
let code = fs.readFileSync('invoices.js', 'utf8');

const target = const colMapping = [
            "serialNum", // 0: מס"ד
            "orderNum", // 1
            "orderDate", // 2
            "supName", // 3
            "orderDesc", // 4
            "orderType", // 5
            "orderAssign", // 6
            "orderMonth", // 7
            "locCity", // 8
            "locType", // 9
            "locName", // 10
            "orderTotal", // 11
            "orderNotes", // 12
            "txNum", // 13
            "txDate", // 14
            "txAmt", // 15
            "txTotal", // 16
            "num", // 17
            "date", // 18
            "amt", // 19
            "total", // 20
            "notes" // 21
          ];;

const replacement = const colMapping = [
            "serialNum", // 0: מס"ד
            "orderNum", // 1
            "orderDate", // 2
            "supName", // 3
            "orderDesc", // 4
            "orderType", // 5
            "orderAssign", // 6
            "orderMonth", // 7
            "locCity", // 8
            "locType", // 9
            "locName", // 10
            "orderTotal", // 11
            "orderNotes", // 12
            "txNum", // 13
            "txDate", // 14
            "txAmt", // 15
            "txTotal", // 16
            "num", // 17
            "date", // 18
            "amt", // 19
            "total", // 20
            "notes" // 21
          ];
          
          // Dynamically find serial number column just in case the format changed slightly
          const serialIdx = headerStrs.findIndex(x => x && (x.includes('מס"ד') || x.includes("מס''ד") || x.includes("מס'ד") || x.includes("מסד") || x.includes("מסד")));
          if (serialIdx !== -1 && serialIdx !== 0) {
             colMapping[0] = null; // remove from 0
             colMapping[serialIdx] = "serialNum";
          };

code = code.replace(target, replacement);

fs.writeFileSync('invoices.js', code);
console.log('Success applying dynamic serial index');
