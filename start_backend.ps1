# start_backend.ps1
# Set environment variables for all microservices
$env:DATABASE_URL = "sqlite:///C:\Users\hp\Desktop\Nexus_Academics\admitos_prediction.db"
$env:JWT_SECRET = "super-secret-access-key-12345"
$env:JWT_REFRESH_SECRET = "super-secret-refresh-key-54321"
$env:ENVIRONMENT = "development"
$env:REDIS_URL = "redis://localhost:6379/0" # Redis is optional, endpoints handle fallback
$env:PYTHONPATH = "C:\Users\hp\Desktop\Nexus_Academics"

# Load .env file if it exists
if (Test-Path "C:\Users\hp\Desktop\Nexus_Academics\.env") {
    Get-Content "C:\Users\hp\Desktop\Nexus_Academics\.env" | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#")) {
            if ($line -match '^([^=]+)=(.*)$') {
                $key = $Matches[1].Trim()
                $value = $Matches[2].Trim()
                Set-Item "env:\$key" $value
            }
        }
    }
}

# Create logs directory if it doesn't exist
New-Item -ItemType Directory -Force -Path "C:\Users\hp\Desktop\Nexus_Academics\logs" | Out-Null

# Define services with their port numbers
$services = @(
    @{ name = "auth"; port = 8011; app = "services.auth.main:app" },
    @{ name = "user"; port = 8002; app = "services.user.main:app" },
    @{ name = "prediction"; port = 8003; app = "services.prediction.main:app" },
    @{ name = "career"; port = 8004; app = "services.career.main:app" },
    @{ name = "notification"; port = 8005; app = "services.notification.main:app" },
    @{ name = "counseling"; port = 8006; app = "services.counseling.main:app" },
    @{ name = "analytics"; port = 8007; app = "services.analytics.main:app" }
)

Write-Host "Starting all 7 ADMIT OS microservices..." -ForegroundColor Green

$processes = @()

foreach ($svc in $services) {
    $name = $svc.name
    $port = $svc.port
    $app = $svc.app
    
    $stdoutLog = "C:\Users\hp\Desktop\Nexus_Academics\logs\logs_$name.log"
    $stderrLog = "C:\Users\hp\Desktop\Nexus_Academics\logs\logs_${name}_err.log"
    
    Write-Host "Launching $name service on port $port..." -ForegroundColor Cyan
    
    $proc = Start-Process -FilePath "C:\Users\hp\Desktop\Nexus_Academics\.venv\Scripts\python.exe" `
                          -ArgumentList "-m uvicorn $app --host 0.0.0.0 --port $port" `
                          -WorkingDirectory "C:\Users\hp\Desktop\Nexus_Academics" `
                          -NoNewWindow `
                          -PassThru `
                          -RedirectStandardOutput $stdoutLog `
                          -RedirectStandardError $stderrLog
                          
    $processes += $proc
}

Write-Host "All services launched. parent session is active to keep processes running." -ForegroundColor Green

# Register cleanup on exit
Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action {
    foreach ($proc in $processes) {
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
}

try {
    while ($true) {
        Start-Sleep -Seconds 2
    }
} finally {
    Write-Host "Exiting and stopping child processes..." -ForegroundColor Red
    foreach ($proc in $processes) {
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
}
