
$path = 'c:\Users\Perry\רשת תיכוני טומשין בע מ (חל ץ)\צהרונים - מסמכים\פרי\הורדות\Ganscheduler-main\Ganscheduler\activity.js'
$content = Get-Content -Path $path -Raw

# This is a bit tricky because the content is corrupted with unknown characters.
# I will use a regex or just find markers.

$startMarker = 'dateCards.forEach(card => {'
$endMarker = 'window.dashCheckAll = function(groupId, checked) {'

$startIndex = $content.IndexOf($startMarker)
$endIndex = $content.IndexOf($endMarker)

if ($startIndex -ge 0 -and $endIndex -gt $startIndex) {
    $prefix = $content.Substring(0, $startIndex)
    $suffix = $content.Substring($endIndex)
    
    $newCode = @"
dateCards.forEach(card => {
        html += _renderDashCard(card);
      });
    });

    html += ``</div></details>``;
  });

  list.innerHTML = html || ``<div style="padding:40px; text-align:center; color:#94a3b8">
    <div style="font-size:3rem; margin-bottom:10px">📅</div>
    <div style="font-weight:700">אין פעילויות ליום זה</div>
  </div>``;
}

function _renderDashCard(card) {
  const { type, obj, evs } = card;
  const isSolo = type === 'solo';
  const firstG = window.G(evs[0].g);
  const clr = window.CITY_COLORS ? window.CITY_COLORS(firstG.city) : {solid:'#1a237e', light:'#f8fafc', border:'#e2e8f0'};

  return window.ui.renderStandardPairCard(obj, evs, {
    ds: evs[0].d,
    clr: clr,
    context: 'dash',
    isSolo: isSolo
  });
}

"@
    # Fix backticks in Here-string (PS uses double backticks to escape)
    $newCode = $newCode.Replace("``", "`")
    
    $finalContent = $prefix + $newCode + $suffix
    [System.IO.File]::WriteAllText($path, $finalContent, [System.Text.Encoding]::UTF8)
    Write-Host "Successfully repaired activity.js"
} else {
    Write-Host "Markers not found! start: $startIndex, end: $endIndex"
}
