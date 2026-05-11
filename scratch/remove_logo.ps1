$path = "index.html"
$content = Get-Content $path
$newContent = $content[0..28] + $content[32..($content.Length - 1)]
$newContent | Set-Content $path -Encoding utf8
