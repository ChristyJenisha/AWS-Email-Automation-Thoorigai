$ErrorActionPreference = "Stop"

$docxPath = (Resolve-Path "docs\CollectFlow_Comprehensive_Project_and_Remediation_Report.docx").Path
$pdfPath = [System.IO.Path]::ChangeExtension($docxPath, ".pdf")
$desktopPath = "C:\Users\acer\Desktop\CollectFlow_Comprehensive_Project_and_Remediation_Report.pdf"
$artifactPath = "C:\Users\acer\.gemini\antigravity\brain\adb0c921-3096-46ef-bd98-d47613b337bd\CollectFlow_Comprehensive_Project_and_Remediation_Report.pdf"

Write-Output "Converting: $docxPath -> $pdfPath"

$word = New-Object -ComObject Word.Application
$word.Visible = $false
try {
    $doc = $word.Documents.Open($docxPath)
    # wdFormatPDF = 17
    $doc.SaveAs([ref]$pdfPath, [ref]17)
    $doc.Close()
    Write-Output "Successfully generated: $pdfPath"
    
    # Copy to Desktop
    Copy-Item $pdfPath -Destination $desktopPath -Force
    Write-Output "Successfully copied to Desktop: $desktopPath"

    # Copy to Artifact directory
    Copy-Item $pdfPath -Destination $artifactPath -Force
    Write-Output "Successfully copied to Artifacts: $artifactPath"
}
finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}
