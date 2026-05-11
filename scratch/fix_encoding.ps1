$path = "index.html"
$lines = Get-Content $path -Encoding UTF8
$lines[10] = '  <meta name="apple-mobile-web-app-title" content="קידס שיבוץ">'
$lines[12] = '  <title>Ganscheduler v101.6</title>'
$lines[14] = '    href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📅</text></svg>">'
$lines | Set-Content $path -Encoding UTF8
