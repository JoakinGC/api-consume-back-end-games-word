
$token = "dvb_XXXX"  
$endpoint = "http://localhost:3000/api/words"
$archivo = "palabras.txt"

Get-Content $archivo | ForEach-Object {
    $campos = $_ -split '\|'
    if ($campos.Count -eq 4) {
        $body = @{
            text = $campos[0].Trim()
            definition = $campos[1].Trim()
            origin = $campos[2].Trim()
            latin = $campos[3].Trim()
        } | ConvertTo-Json -Depth 3

        try {
            $response = Invoke-RestMethod -Uri $endpoint `
                -Method POST `
                -Headers @{ 
                    "Authorization" = "Bearer $token"
                    "Content-Type" = "application/json"
                } `
                -Body $body

            Write-Host "✅ Insertado: $($campos[0])"
        } catch {
            Write-Host "❌ Error al insertar: $($campos[0])"
            Write-Host $_.Exception.Message
        }
    } else {
        Write-Host "❗ Formato incorrecto en línea: $_"
    }
}
