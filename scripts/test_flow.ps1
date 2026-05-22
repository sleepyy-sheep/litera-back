$base = "http://localhost:8000"
$email = "testfix1@gmail.com"
$pass = "password123"
$loginBody = "username=$([uri]::EscapeDataString($email))&password=$([uri]::EscapeDataString($pass))"
$login = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/x-www-form-urlencoded" -Body $loginBody
$token = $login.access_token
$h = @{ Authorization = "Bearer $token" }
Write-Host "Token length:" $token.Length

try {
    $books = Invoke-RestMethod -Uri "$base/books/my" -Headers $h
    Write-Host "books/my OK total=$($books.total) items=$($books.items.Count)"
    if ($books.items.Count -gt 0) {
        Write-Host "first book progress:" ($books.items[0].progress | ConvertTo-Json -Compress)
    }
} catch {
    Write-Host "books/my FAIL:" $_.Exception.Message
    $r = $_.ErrorDetails.Message
    Write-Host $r
}

try {
    $goals = Invoke-RestMethod -Uri "$base/goals/" -Headers $h
    Write-Host "goals GET OK count=$($goals.Count)"
} catch {
    Write-Host "goals GET FAIL:" $_.ErrorDetails.Message
}

try {
    $goalBody = @{ goal_type = "pages_per_day"; target_value = 50 } | ConvertTo-Json
    $g = Invoke-RestMethod -Uri "$base/goals/" -Method Post -Headers $h -ContentType "application/json" -Body $goalBody
    Write-Host "goals POST OK id=$($g.id) type=$($g.goal_type)"
} catch {
    Write-Host "goals POST FAIL:" $_.ErrorDetails.Message
}

# minimal pdf upload
$pdfPath = "$env:TEMP\litera_test.pdf"
"%PDF-1.4`n1 0 obj<<>>endobj`ntrailer<<>>`n%%EOF" | Set-Content -Path $pdfPath -Encoding ascii
try {
    $form = @{
        title = "Test Book"
        format = "pdf"
        file = Get-Item $pdfPath
    }
    $upload = Invoke-RestMethod -Uri "$base/books/" -Method Post -Headers $h -Form $form
    Write-Host "upload OK id=$($upload.id) title=$($upload.title)"
} catch {
    Write-Host "upload FAIL:" $_.ErrorDetails.Message
}

# test trailing slash redirect
try {
    Invoke-WebRequest -Uri "$base/books/my" -Headers $h -Method GET -UseBasicParsing | Select-Object StatusCode
} catch { Write-Host "fetch books/my status issue" }
