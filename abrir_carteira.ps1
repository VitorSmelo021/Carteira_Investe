$ErrorActionPreference = 'Stop'

$projectDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$url = 'http://127.0.0.1:4173/Controle_Carteira_de_investimento'
$port = 4173

function Test-PortfolioServer {
    try {
        $response = Invoke-WebRequest -Uri $url -TimeoutSec 2 -UseBasicParsing
        return $response.StatusCode -eq 200 -and $response.Content -match '<title>.*Carteira'
    }
    catch {
        return $false
    }
}

if (-not (Test-PortfolioServer)) {
    $listener = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($listener) {
        throw "A porta $port já está ocupada por outro serviço; o sistema não foi iniciado."
    }

    $node = (Get-Command node.exe -ErrorAction Stop).Source
    Start-Process -FilePath $node -ArgumentList 'server.js' -WorkingDirectory $projectDirectory -WindowStyle Hidden

    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Milliseconds 500
        if (Test-PortfolioServer) {
            $ready = $true
            break
        }
    }

    if (-not $ready) {
        throw 'O servidor local não iniciou. Verifique o Node.js e tente novamente.'
    }
}

Start-Process $url
