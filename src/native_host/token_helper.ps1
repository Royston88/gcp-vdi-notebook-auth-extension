# Ensure output is UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Read 4-byte length header from stdin
$inputBuffer = New-Object Byte[] 4
$bytesRead = [Console]::OpenStandardInput().Read($inputBuffer, 0, 4)
if ($bytesRead -ne 4) {
    Exit
}
$messageLength = [System.BitConverter]::ToInt32($inputBuffer, 0)

# Read the JSON message
$messageBuffer = New-Object Byte[] $messageLength
$offset = 0
while ($offset -lt $messageLength) {
    $read = [Console]::OpenStandardInput().Read($messageBuffer, $offset, $messageLength - $offset)
    if ($read -le 0) { break }
    $offset += $read
}

$messageJson = [System.Text.Encoding]::UTF8.GetString($messageBuffer)

# Get GCP access token using gcloud
try {
    $token = (gcloud auth print-access-token).Trim()
    $response = @{
        status = "success"
        token = $token
    }
} catch {
    $response = @{
        status = "error"
        error = $_.Exception.Message
    }
}

# Serialize response to JSON
$responseJson = $response | ConvertTo-Json -Compress
$responseBytes = [System.Text.Encoding]::UTF8.GetBytes($responseJson)
$responseLength = $responseBytes.Length
$lengthBytes = [System.BitConverter]::GetBytes($responseLength)

# Write output to stdout
$stdout = [Console]::OpenStandardOutput()
$stdout.Write($lengthBytes, 0, 4)
$stdout.Write($responseBytes, 0, $responseBytes.Length)
$stdout.Flush()
