[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# D:\백업 파일\KONGBAB_BACKUPS_JSON (순수 유니코드 코드로 지정하여 인코딩 변형 방지)
$targetDir = "D:\" + [char]0xBC31 + [char]0xC5C5 + " " + [char]0xD30C + [char]0xC77C + "\KONGBAB_BACKUPS_JSON"
$maxBackups = 20
$port = 38888

if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
}

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  콩밥특별시 GTA RP 외부 JSON 백업 동기화 서버" -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  📁 저장 대상 경로: $targetDir" -ForegroundColor Green
Write-Host "  📦 최대 유지 개수: $maxBackups 개 (초과 시 오래된 파일 1개씩 자동 삭제)" -ForegroundColor Green
Write-Host "  🌐 대기 주소: http://localhost:$port/" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  이 창을 닫지 마시고 최소화해두시면 웹에서 변경 시 즉시 외부 폴더로 자동 저장됩니다." -ForegroundColor DarkGray
Write-Host ""

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
    Write-Host "  ✓ 백업 수신 준비 완료! (포트 $port 대기 중)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ 포트 $port 시작 실패: $_" -ForegroundColor Red
    exit 1
}

function Clean-OldBackups {
    param([string]$dir, [int]$max)
    $files = Get-ChildItem -Path $dir -Filter "kongbab_backup_*.json" | Sort-Object Name
    $count = $files.Count
    while ($count -gt $max) {
        $oldest = $files[0]
        Remove-Item -Path $oldest.FullName -Force
        Write-Host "  🗑️ [20개 초과] 가장 오래된 백업 자동 삭제: $($oldest.Name)" -ForegroundColor DarkYellow
        if ($files.Count -gt 1) {
            $files = $files[1..($files.Count - 1)]
        } else {
            $files = @()
        }
        $count--
    }
}

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        # CORS Headers
        $response.Headers.Add("Access-Control-Allow-Origin", "*")
        $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type")

        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 200
            $response.Close()
            continue
        }

        $url = $request.Url.AbsolutePath

        if ($url -eq "/api/status" -and $request.HttpMethod -eq "GET") {
            $files = Get-ChildItem -Path $targetDir -Filter "kongbab_backup_*.json" | Sort-Object Name -Descending
            $fileList = @($files | ForEach-Object { $_.Name })
            $statusObj = @{
                status = "ok"
                directory = $targetDir
                maxBackups = $maxBackups
                count = $files.Count
                files = $fileList
            }
            $jsonStr = $statusObj | ConvertTo-Json -Compress
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonStr)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        if ($url -eq "/api/backup" -and $request.HttpMethod -eq "POST") {
            try {
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $body = $reader.ReadToEnd()
                $reader.Close()

                $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
                $fileName = "kongbab_backup_$timestamp.json"
                $filePath = Join-Path $targetDir $fileName
                $latestPath = Join-Path $targetDir "backup.json"

                # 1. 일자별 백업 저장
                [System.IO.File]::WriteAllText($filePath, $body, [System.Text.Encoding]::UTF8)
                # 2. 최신 덮어쓰기 백업 저장 (backup.json)
                [System.IO.File]::WriteAllText($latestPath, $body, [System.Text.Encoding]::UTF8)

                # 3. 20개 롤링 정리
                Clean-OldBackups -dir $targetDir -max $maxBackups

                $currentFiles = Get-ChildItem -Path $targetDir -Filter "kongbab_backup_*.json"
                Write-Host "  💾 [외부 저장 완료] $fileName (총 $($currentFiles.Count)/$maxBackups 개) -> $targetDir" -ForegroundColor Green

                $respObj = @{
                    success = $true
                    fileName = $fileName
                    directory = $targetDir
                    count = $currentFiles.Count
                }
                $jsonStr = $respObj | ConvertTo-Json -Compress
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonStr)
                $response.ContentType = "application/json; charset=utf-8"
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
                $response.Close()
            } catch {
                Write-Host "❌ 백업 저장 중 오류: $_" -ForegroundColor Red
                $respObj = @{ success = $false; error = "$_" }
                $jsonStr = $respObj | ConvertTo-Json -Compress
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonStr)
                $response.StatusCode = 500
                $response.ContentType = "application/json; charset=utf-8"
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
                $response.Close()
            }
            continue
        }

        $response.StatusCode = 404
        $response.Close()
    } catch {
        # 루프 유지
    }
}
