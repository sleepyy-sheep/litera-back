$base = "http://localhost:8000"
$email = "integration_test@gmail.com"
$user = "integration_test"
$pass = "password123"

# Login or register
$loginBody = "username=$([uri]::EscapeDataString($email))&password=$([uri]::EscapeDataString($pass))"
$login = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/x-www-form-urlencoded" -Body $loginBody -ErrorAction SilentlyContinue
if (-not $login) {
    $reg = @{ username = $user; email = $email; password = $pass } | ConvertTo-Json
    Invoke-RestMethod -Uri "$base/auth/register" -Method Post -ContentType "application/json" -Body $reg | Out-Null
    $login = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/x-www-form-urlencoded" -Body $loginBody
}
$token = $login.access_token
$headers = @{ Authorization = "Bearer $token" }

Write-Host "OK: auth"

$books = Invoke-RestMethod -Uri "$base/books/my" -Headers $headers
Write-Host "OK: books/my count=$($books.total)"

$stats = Invoke-RestMethod -Uri "$base/stats/reading" -Headers $headers
Write-Host "OK: stats/reading pages=$($stats.total_pages)"

$goals = Invoke-RestMethod -Uri "$base/goals/" -Headers $headers
Write-Host "OK: goals count=$($goals.Count)"

$shelves = Invoke-RestMethod -Uri "$base/shelves/" -Headers $headers
Write-Host "OK: shelves count=$($shelves.Count)"

# PATCH book test if any book exists
if ($books.items.Count -gt 0) {
    $id = $books.items[0].id
    $patch = @{ title = $books.items[0].title } | ConvertTo-Json
    $updated = Invoke-RestMethod -Uri "$base/books/$id" -Method Patch -Headers $headers -ContentType "application/json" -Body $patch
    Write-Host "OK: PATCH book id=$id progress=$($updated.progress -ne $null)"
} else {
    Write-Host "SKIP: no books for PATCH test"
}

Write-Host "All integration checks passed"
