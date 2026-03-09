Option Explicit

Const PI As Double = 3.14159265358979
Const R_NM As Double = 3440.1 ' Earth Radius in Nautical Miles
' --- MAIN SUBROUTINE ---
Sub ImportWaypoints()
    Dim fd As FileDialog
    Dim fileName As String
    Dim wsTarget As Worksheet
    Dim wbText As Workbook
    Dim wsText As Worksheet
    Dim lastRow As Long, i As Long
    Dim targetRow As Long
    Dim latDD As Double, lonDD As Double
    Dim wpName As String
    Dim lastTargetRow As Long
    Dim finalRow As Long
    Dim nameColIndex As Long
    
    ' New variables for Bingo Input
    Dim bingoInput As String
    Dim bingoFuel As Double
    
    ' --- CONFIGURATION ---
    Set wsTarget = ThisWorkbook.Sheets("FlightPlan")
    targetRow = 5 ' DATA STARTS AT ROW 5
    
    ' 0. ASK USER FOR BINGO FUEL (Defaults to 2600)
    bingoInput = InputBox("Enter the required Bingo Fuel (lbs):", "Mission Configuration", "2600")
    
    ' Handle Cancel (Empty string) or Non-Numeric input
    If bingoInput = "" Then Exit Sub ' User pressed Cancel
    If Not IsNumeric(bingoInput) Then
        MsgBox "Invalid fuel amount entered. Please try again.", vbCritical
        Exit Sub
    End If
    bingoFuel = CDbl(bingoInput)
    
    ' 1. Open File Picker
    Set fd = Application.FileDialog(msoFileDialogFilePicker)
    fd.Title = "Select GPS Visualizer Text File"
    fd.Filters.Clear
    fd.Filters.Add "Text/CSV Files", "*.txt;*.csv"
    
    If fd.Show = -1 Then
        fileName = fd.SelectedItems(1)
    Else
        Exit Sub
    End If
    
    Application.ScreenUpdating = False
    
    ' 2. SMART CLEAR
    lastTargetRow = wsTarget.Cells(wsTarget.Rows.Count, "A").End(xlUp).Row
    If lastTargetRow < 6 Then lastTargetRow = 6
    
    ' A. Clear DATA (Cols A-C) from Row 5 downwards
    wsTarget.Range("A5:C" & lastTargetRow).ClearContents
    
    ' B. Clear FORMULAS (Cols D-L) from Row 7 downwards (Preserve 5 & 6)
    If lastTargetRow > 6 Then
        wsTarget.Range("D7:L" & lastTargetRow).ClearContents
    End If
    
    ' 3. OPEN FILE
    Workbooks.OpenText fileName:=fileName, _
        Origin:=437, startRow:=1, DataType:=xlDelimited, TextQualifier:=xlDoubleQuote, _
        ConsecutiveDelimiter:=False, Tab:=True, Semicolon:=False, Comma:=False, Space:=False, Other:=False
        
    Set wbText = ActiveWorkbook
    Set wsText = wbText.Sheets(1)
    
    lastRow = wsText.Cells(wsText.Rows.Count, "A").End(xlUp).Row
    
    ' Find LAST column for Name
    nameColIndex = wsText.Cells(1, wsText.Columns.Count).End(xlToLeft).Column
    
    ' 4. Loop through Data
    For i = 2 To lastRow
        If Len(wsText.Cells(i, 2).Value) > 0 Then
            
            ' GRAB DATA
            latDD = VBA.val(wsText.Cells(i, 2).Value)
            lonDD = VBA.val(wsText.Cells(i, 3).Value)
            wpName = wsText.Cells(i, nameColIndex).Value
            
            ' WRITE TO FLIGHT PLAN
            wsTarget.Cells(targetRow, 1).Value = wpName
            wsTarget.Cells(targetRow, 2).Value = DD_to_DDM(latDD, True)
            wsTarget.Cells(targetRow, 3).Value = DD_to_DDM(lonDD, False)
            
            targetRow = targetRow + 1
        End If
    Next i
    
    ' 5. Close Temp File
    wbText.Close SaveChanges:=False
    
    ' 6. HANDLE FORMULAS
    finalRow = targetRow - 1
    
    If finalRow >= 6 Then
        If wsTarget.Range("D6").Formula = "" Then
             MsgBox "Warning: Row 6 (D6) is empty. I need formulas in Row 6 to copy down!", vbExclamation
        Else
             wsTarget.Range("D6:L6").AutoFill Destination:=wsTarget.Range("D6:L" & finalRow)
        End If
        
        ' BINGO LOGIC (Using the variable bingoFuel)
        If finalRow > 6 Then
            wsTarget.Cells(finalRow - 1, 12).Value = bingoFuel
            
            If IsNumeric(wsTarget.Cells(finalRow - 1, 10).Value) Then
                wsTarget.Cells(finalRow, 12).Value = bingoFuel - wsTarget.Cells(finalRow, 10).Value
            End If
        End If
    End If
    
    Application.ScreenUpdating = True
    MsgBox "Import Complete! " & (finalRow - 4) & " waypoints loaded with Bingo Req: " & bingoFuel, vbInformation
End Sub

' --- HELPER: Convert Decimal Degrees to DDM String ---
' Renamed argument 'val' to 'coordVal' to avoid keyword conflict
Function DD_to_DDM(coordVal As Double, isLat As Boolean) As String
    Dim degrees As Integer
    Dim minutes As Double
    Dim direction As String
    Dim valAbs As Double
    
    valAbs = Abs(coordVal)
    degrees = Int(valAbs)
    minutes = (valAbs - degrees) * 60
    
    If isLat Then
        If coordVal >= 0 Then direction = "N" Else direction = "S"
        DD_to_DDM = direction & Format(degrees, "00") & " " & Format(minutes, "00.000")
    Else
        If coordVal >= 0 Then direction = "E" Else direction = "W"
        DD_to_DDM = direction & Format(degrees, "000") & " " & Format(minutes, "00.000")
    End If
End Function

' --- HELPER: Convert Degrees to Radians ---
Function ToRad(deg As Double) As Double
    ToRad = deg * PI / 180
End Function

' --- HELPER: Convert Radians to Degrees ---
Function ToDeg(rad As Double) As Double
    ToDeg = rad * 180 / PI
End Function

' --- CORE: Parse Any Coordinate to Decimal Degrees ---
Function ParseCoord(txt As String) As Double
    Dim cleanTxt As String
    Dim parts() As String
    Dim degrees As Double, minutes As Double, seconds As Double
    Dim sign As Integer
    
    ' 1. cleanup
    cleanTxt = UCase(txt)
    If Trim(cleanTxt) = "" Then ParseCoord = 0: Exit Function
    
    sign = 1
    If InStr(cleanTxt, "S") > 0 Or InStr(cleanTxt, "W") > 0 Then sign = -1
    
    ' Remove N/S/E/W and symbols so we just have numbers
    cleanTxt = Replace(cleanTxt, "N", "")
    cleanTxt = Replace(cleanTxt, "S", "")
    cleanTxt = Replace(cleanTxt, "E", "")
    cleanTxt = Replace(cleanTxt, "W", "")
    cleanTxt = Replace(cleanTxt, "°", " ")
    cleanTxt = Replace(cleanTxt, "'", " ")
    cleanTxt = Replace(cleanTxt, """", " ")
    
    ' Ensure single spaces between numbers
    cleanTxt = Application.Trim(cleanTxt)
    
    parts = Split(cleanTxt, " ")
    
    ' 2. Parse using Val() instead of CDbl()
    ' Val() is safer because it always accepts dots "." as decimals,
    ' whereas CDbl crashes if your computer expects a comma.
    If UBound(parts) >= 0 Then degrees = val(parts(0)) Else degrees = 0
    If UBound(parts) >= 1 Then minutes = val(parts(1)) Else minutes = 0
    If UBound(parts) >= 2 Then seconds = val(parts(2)) Else seconds = 0
    
    ParseCoord = sign * (degrees + (minutes / 60) + (seconds / 3600))
End Function

' --- CORE: Calculate Distance (NM) ---
Function GetDistNM(lat1 As String, lon1 As String, lat2 As String, lon2 As String) As Double
    Dim dLat As Double, dLon As Double
    Dim a As Double, c As Double
    Dim lat1Rad As Double, lat2Rad As Double
    
    If lat1 = "" Or lon1 = "" Or lat2 = "" Or lon2 = "" Then GetDistNM = 0: Exit Function

    lat1Rad = ToRad(ParseCoord(lat1))
    lat2Rad = ToRad(ParseCoord(lat2))
    dLat = ToRad(ParseCoord(lat2) - ParseCoord(lat1))
    dLon = ToRad(ParseCoord(lon2) - ParseCoord(lon1))
    
    a = Sin(dLat / 2) ^ 2 + Cos(lat1Rad) * Cos(lat2Rad) * Sin(dLon / 2) ^ 2
    
    ' FIX: Use WorksheetFunction.Atan2
    c = 2 * Application.WorksheetFunction.Atan2(Sqr(1 - a), Sqr(a))
    
    GetDistNM = R_NM * c
End Function

' --- CORE: Calculate True Heading ---
Function GetHeading(lat1 As String, lon1 As String, lat2 As String, lon2 As String) As Double
    Dim y As Double, x As Double
    Dim lat1Rad As Double, lat2Rad As Double, dLon As Double
    Dim bearing As Double
    
    If lat1 = "" Or lon1 = "" Or lat2 = "" Or lon2 = "" Then GetHeading = 0: Exit Function
    
    lat1Rad = ToRad(ParseCoord(lat1))
    lat2Rad = ToRad(ParseCoord(lat2))
    dLon = ToRad(ParseCoord(lon2) - ParseCoord(lon1))
    
    y = Sin(dLon) * Cos(lat2Rad)
    x = Cos(lat1Rad) * Sin(lat2Rad) - Sin(lat1Rad) * Cos(lat2Rad) * Cos(dLon)
    
    If Abs(x) < 0.0000001 And Abs(y) < 0.0000001 Then GetHeading = 0: Exit Function

    ' FIX: Use WorksheetFunction.Atan2
    bearing = ToDeg(Application.WorksheetFunction.Atan2(x, y))
    
    If bearing < 0 Then bearing = bearing + 360
    GetHeading = bearing
End Function

Sub GenerateCard()
    Dim wsSource As Worksheet
    Dim wsCard As Worksheet
    Dim lastRow As Long, c As Long
    Dim startRow As Long, targetRow As Long
    Dim wptIndex As Integer
    Dim blockStart As Integer
    
    ' --- CONFIGURATION ---
    Set wsSource = ThisWorkbook.Sheets("FlightPlan")
    startRow = 5
    
    ' Column Mapping (A-L Layout)
    Const Col_Name As String = "A"
    Const Col_Lat As String = "B"
    Const Col_Long As String = "C"
    Const Col_Hdg As String = "D"
    Const Col_Dist As String = "E"
    Const Col_Alt As String = "F"
    Const Col_GS As String = "G"
    Const Col_Time As String = "H"
    Const Col_Elapsed As String = "I"
    Const Col_Burn As String = "J"
    Const Col_FuelRem As String = "K"
    Const Col_Bingo As String = "L"
    
    ' --- SETUP TARGET SHEET ---
    Application.ScreenUpdating = False
    
    On Error Resume Next
    Set wsCard = ThisWorkbook.Sheets("FlightCard")
    On Error GoTo 0
    
    If wsCard Is Nothing Then
        Set wsCard = ThisWorkbook.Sheets.Add(After:=wsSource)
        wsCard.Name = "FlightCard"
    Else
        wsCard.Cells.Clear
    End If
    
    lastRow = wsSource.Cells(wsSource.Rows.Count, Col_Name).End(xlUp).Row
    
    ' --- LOOP THROUGH DATA ---
    targetRow = 1
    wptIndex = 1
    
    For blockStart = startRow To lastRow Step 5
        
        ' 1. Draw Labels
        With wsCard
            .Cells(targetRow, 1).Value = "WPT"
            .Cells(targetRow + 1, 1).Value = "FROM/TO"
            .Cells(targetRow + 2, 1).Value = "LAT/LONG"
            .Cells(targetRow + 3, 1).Value = "HDG"
            .Cells(targetRow + 4, 1).Value = "ALT"
            .Cells(targetRow + 5, 1).Value = "DIST"
            .Cells(targetRow + 6, 1).Value = "TIME"
            .Cells(targetRow + 7, 1).Value = "REL ETA"
            .Cells(targetRow + 8, 1).Value = "FUEL REM'G"
            .Cells(targetRow + 9, 1).Value = "FUEL REQ'D"
            .Cells(targetRow + 10, 1).Value = "FUEL BURN"
            .Cells(targetRow + 11, 1).Value = "G/S"
            
            With .Range(.Cells(targetRow, 1), .Cells(targetRow + 11, 1))
                .Font.Bold = True
                .HorizontalAlignment = xlLeft
                .Borders.LineStyle = xlContinuous
                .Interior.Color = RGB(240, 240, 240)
            End With
        End With
        
        ' 2. Fill Data
        For c = 0 To 4
            Dim currentRow As Long
            currentRow = blockStart + c
            
            If currentRow <= lastRow Then
                Dim colOffset As Integer
                colOffset = c + 2
                
                With wsCard
                    ' WPT & Name
                    .Cells(targetRow, colOffset).Value = wptIndex
                    .Cells(targetRow + 1, colOffset).Value = wsSource.Range(Col_Name & currentRow).Value
                    
                    ' Lat/Long
                    .Cells(targetRow + 2, colOffset).Value = _
                        wsSource.Range(Col_Lat & currentRow).Text & " " & vbCrLf & _
                        wsSource.Range(Col_Long & currentRow).Text
                        
                    ' Heading: Round to nearest whole number
                    If IsNumeric(wsSource.Range(Col_Hdg & currentRow).Value) Then
                        .Cells(targetRow + 3, colOffset).Value = Round(wsSource.Range(Col_Hdg & currentRow).Value, 0)
                    Else
                        .Cells(targetRow + 3, colOffset).Value = wsSource.Range(Col_Hdg & currentRow).Value
                    End If
                    
                    ' Alt
                    .Cells(targetRow + 4, colOffset).Value = wsSource.Range(Col_Alt & currentRow).Value
                    
                    ' Distance: Round to 1 decimal place
                    If IsNumeric(wsSource.Range(Col_Dist & currentRow).Value) Then
                        .Cells(targetRow + 5, colOffset).Value = Format(wsSource.Range(Col_Dist & currentRow).Value, "0.0")
                    Else
                        .Cells(targetRow + 5, colOffset).Value = 0
                    End If
                    
                    ' Time: Format as hh:mm:ss
                    ' Ensure source cells (Col H/I) are calculated as (Minutes/1440) or (Hours/24)
                    .Cells(targetRow + 6, colOffset).Value = Format(wsSource.Range(Col_Time & currentRow).Value, "hh:mm:ss")
                    .Cells(targetRow + 7, colOffset).Value = Format(wsSource.Range(Col_Elapsed & currentRow).Value, "hh:mm:ss")
                    
                    ' Fuels
                    .Cells(targetRow + 8, colOffset).Value = Format(wsSource.Range(Col_FuelRem & currentRow).Value, "#,##0")
                    .Cells(targetRow + 9, colOffset).Value = Format(wsSource.Range(Col_Bingo & currentRow).Value, "#,##0")
                    .Cells(targetRow + 10, colOffset).Value = Format(wsSource.Range(Col_Burn & currentRow).Value, "#,##0")
                    
                    ' GS
                    .Cells(targetRow + 11, colOffset).Value = wsSource.Range(Col_GS & currentRow).Value
                    
                    wptIndex = wptIndex + 1
                End With
            End If
        Next c
        
        ' 3. Formatting
        Dim blockRange As Range
        Set blockRange = wsCard.Range(wsCard.Cells(targetRow, 1), wsCard.Cells(targetRow + 11, 6))
        
        With blockRange
            .Borders.LineStyle = xlContinuous
            .HorizontalAlignment = xlCenter
            .VerticalAlignment = xlCenter
            .WrapText = True
            .Font.Name = "Arial"
            .Font.Size = 9
        End With
        
        targetRow = targetRow + 13
    Next blockStart
    
    wsCard.Columns("A").ColumnWidth = 14
    wsCard.Columns("B:F").ColumnWidth = 12
    wsCard.Rows.AutoFit
    
    Application.ScreenUpdating = True
    MsgBox "Flight Card Generated!", vbInformation
End Sub

Sub ExportToPPT()
    Dim pptApp As Object
    Dim pptPres As Object
    Dim pptSlide As Object
    Dim ws As Worksheet
    Dim lastRow As Long, r As Long
    Dim copyRange As Range
    Dim shp As Object
    
    ' Variables for positioning 3 items per slide
    Dim itemIndex As Integer    ' Tracks 0, 1, or 2
    Dim slideHeight As Single
    Dim slideWidth As Single
    Dim slotHeight As Single
    
    ' --- CONFIGURATION ---
    Set ws = ThisWorkbook.Sheets("FlightCard")
    
    ' Check if FlightCard exists/has data
    If ws.Range("A1").Value = "" Then
        MsgBox "Please run 'GenerateCard' first!", vbExclamation
        Exit Sub
    End If
    
    lastRow = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row
    
    ' --- INITIALIZE POWERPOINT ---
    On Error Resume Next
        Set pptApp = GetObject(, "PowerPoint.Application")
        If Err.Number <> 0 Then
            Set pptApp = CreateObject("PowerPoint.Application")
        End If
    On Error GoTo 0
    
    pptApp.Visible = True
    Set pptPres = pptApp.Presentations.Add
    
    ' --- SET PAGE SETUP TO A4 PORTRAIT (Metric) ---
    With pptPres.PageSetup
        .SlideOrientation = 2 ' msoOrientationVertical
        ' PowerPoint uses Points (72 points = 1 inch)
        ' 210mm = ~595 pts
        ' 297mm = ~842 pts
        .slideWidth = 595
        .slideHeight = 842
    End With
    
    ' Get Dimensions for math later
    slideHeight = pptPres.PageSetup.slideHeight
    slideWidth = pptPres.PageSetup.slideWidth
    slotHeight = slideHeight / 3 ' Each slot is 1/3 of the A4 height
    
    ' Initialize counter
    itemIndex = 0
    
    ' --- LOOP THROUGH BLOCKS ---
    For r = 1 To lastRow Step 13
        
        ' Define the block range (Current row to +11 rows down, Col A to F)
        Set copyRange = ws.Range(ws.Cells(r, 1), ws.Cells(r + 11, 6))
        
        ' Safety check to ensure we aren't copying empty space
        If Application.WorksheetFunction.CountA(copyRange) > 0 Then
            
            ' 1. CREATE NEW SLIDE only if itemIndex is 0
            If itemIndex = 0 Then
                Set pptSlide = pptPres.Slides.Add(pptPres.Slides.Count + 1, 12) ' 12 = Blank Layout
            End If
            
            ' 2. COPY & PASTE
            copyRange.Copy
            
            On Error Resume Next
            pptSlide.Shapes.PasteSpecial DataType:=2 ' Enhanced Metafile (Vector)
            If Err.Number <> 0 Then pptSlide.Shapes.Paste ' Fallback
            On Error GoTo 0
            
            ' 3. POSITIONING
            Set shp = pptSlide.Shapes(pptSlide.Shapes.Count)
            
            ' A: Force Full Width (Edge-to-Edge)
            shp.LockAspectRatio = msoTrue ' Keep text readable
            shp.Width = slideWidth        ' Stretch to full 210mm width
            shp.Left = 0                  ' Align to very left edge
            
            ' B: Check Vertical Fit
            ' If stretching to full width makes it taller than the 1/3 slot,
            ' we shrink it slightly to fit the slot height (priority is visibility)
            If shp.Height > slotHeight Then
                shp.Height = slotHeight
                ' Re-center horizontally if we had to shrink it
                shp.Left = (slideWidth - shp.Width) / 2
            End If
            
            ' C: Position Vertically based on which "row" (0, 1, or 2)
            ' This centers the image within its specific "third" of the page
            shp.Top = (itemIndex * slotHeight) + ((slotHeight - shp.Height) / 2)
            
            ' 4. INCREMENT COUNTER
            itemIndex = itemIndex + 1
            
            ' If we hit 3, reset to 0 so the NEXT loop makes a new slide
            If itemIndex = 3 Then itemIndex = 0
            
        End If
        
        ' Clear Clipboard
        Application.CutCopyMode = False
        
    Next r
    
    ' Bring PPT to front
    pptApp.Activate
    MsgBox "Export Complete! " & pptPres.Slides.Count & " slides generated.", vbInformation

End Sub
