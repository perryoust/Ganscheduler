$path = "index.html"
$text = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
$bytes = [System.Text.Encoding]::GetEncoding(1255).GetBytes($text)
[System.IO.File]::WriteAllBytes($path, $bytes)
