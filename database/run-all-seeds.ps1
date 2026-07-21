[CmdletBinding()]
param(
  [ValidatePattern('^\d{4}-\d{2}-\d{2}$')]
  [string]$AnchorDate = (Get-Date).ToString('yyyy-MM-dd'),
  [switch]$Local,
  [switch]$Linked,
  [string]$DatabaseUrl,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'

function Split-PostgresStatements {
  param([Parameter(Mandatory)][string]$Sql)

  $statements = [System.Collections.Generic.List[string]]::new()
  $buffer = [System.Text.StringBuilder]::new()
  $state = 'normal'
  $dollarTag = ''
  $blockCommentDepth = 0
  $index = 0

  while ($index -lt $Sql.Length) {
    $char = $Sql[$index]
    $next = if ($index + 1 -lt $Sql.Length) { $Sql[$index + 1] } else { [char]0 }

    if ($state -eq 'normal') {
      if ($char -eq "'") {
        $state = 'single_quote'
        [void]$buffer.Append($char)
      } elseif ($char -eq '"') {
        $state = 'double_quote'
        [void]$buffer.Append($char)
      } elseif ($char -eq '-' -and $next -eq '-') {
        $state = 'line_comment'
        [void]$buffer.Append('--')
        $index++
      } elseif ($char -eq '/' -and $next -eq '*') {
        $state = 'block_comment'
        $blockCommentDepth = 1
        [void]$buffer.Append('/*')
        $index++
      } elseif ($char -eq '$') {
        $remaining = $Sql.Substring($index)
        $match = [regex]::Match($remaining, '^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$')
        if ($match.Success) {
          $dollarTag = $match.Value
          $state = 'dollar_quote'
          [void]$buffer.Append($dollarTag)
          $index += $dollarTag.Length - 1
        } else {
          [void]$buffer.Append($char)
        }
      } elseif ($char -eq ';') {
        $statement = $buffer.ToString().Trim()
        if ($statement) {
          $statements.Add($statement)
        }
        [void]$buffer.Clear()
      } else {
        [void]$buffer.Append($char)
      }
    } elseif ($state -eq 'single_quote') {
      [void]$buffer.Append($char)
      if ($char -eq "'") {
        if ($next -eq "'") {
          [void]$buffer.Append($next)
          $index++
        } else {
          $state = 'normal'
        }
      }
    } elseif ($state -eq 'double_quote') {
      [void]$buffer.Append($char)
      if ($char -eq '"') {
        if ($next -eq '"') {
          [void]$buffer.Append($next)
          $index++
        } else {
          $state = 'normal'
        }
      }
    } elseif ($state -eq 'dollar_quote') {
      if ($Sql.Substring($index).StartsWith($dollarTag)) {
        [void]$buffer.Append($dollarTag)
        $index += $dollarTag.Length - 1
        $state = 'normal'
      } else {
        [void]$buffer.Append($char)
      }
    } elseif ($state -eq 'line_comment') {
      [void]$buffer.Append($char)
      if ($char -eq "`n") {
        $state = 'normal'
      }
    } elseif ($state -eq 'block_comment') {
      if ($char -eq '/' -and $next -eq '*') {
        $blockCommentDepth++
        [void]$buffer.Append('/*')
        $index++
      } elseif ($char -eq '*' -and $next -eq '/') {
        $blockCommentDepth--
        [void]$buffer.Append('*/')
        $index++
        if ($blockCommentDepth -eq 0) {
          $state = 'normal'
        }
      } else {
        [void]$buffer.Append($char)
      }
    }

    $index++
  }

  if ($state -notin @('normal', 'line_comment')) {
    throw "Unterminated PostgreSQL construct while composing seed SQL: $state"
  }

  $lastStatement = $buffer.ToString().Trim()
  if ($lastStatement) {
    $statements.Add($lastStatement)
  }

  return $statements
}

if (($Local -and $Linked) -or (($Local -or $Linked) -and $DatabaseUrl)) {
  throw 'Choose exactly one database target: -Local, -Linked, or -DatabaseUrl.'
}

$databaseRoot = $PSScriptRoot
$repoRoot = Split-Path -Parent $databaseRoot
$seedRoot = Join-Path $databaseRoot 'supabase\seeds'
$seedFiles = @(
  'seed.sql',
  'seed_operational_snapshots.sql',
  'seed_person_positions.sql',
  'seed_alarms.sql',
  'seed_alarm_workflow.sql',
  'seed_person_health.sql',
  'seed_device_realtime_observation.sql',
  'seed_device_maintenance_records.sql',
  'seed_video_ai.sql',
  'verify_seed_last_7_days.sql'
)

$videoSeedIndex = [Array]::IndexOf($seedFiles, 'seed_video_ai.sql')
$verificationIndex = [Array]::IndexOf($seedFiles, 'verify_seed_last_7_days.sql')
if ($videoSeedIndex -lt 0 -or $verificationIndex -lt 0 -or $videoSeedIndex -gt $verificationIndex) {
  throw 'Video AI seed must be included before the final seed verification.'
}

foreach ($seedFile in $seedFiles) {
  $seedPath = Join-Path $seedRoot $seedFile
  if (-not (Test-Path -LiteralPath $seedPath)) {
    throw "Missing seed file: $seedPath"
  }
}

if (-not $Local -and -not $Linked -and -not $DatabaseUrl) {
  $backendEnv = Join-Path $repoRoot 'backend\.env'
  if (Test-Path -LiteralPath $backendEnv) {
    foreach ($line in Get-Content -LiteralPath $backendEnv -Encoding UTF8) {
      if ($line -match '^\s*(DATABASE_URL|SUPABASE_DB_URL)\s*=\s*(.+?)\s*$') {
        $candidate = $Matches[2].Trim().Trim('"').Trim("'")
        if ($candidate) {
          $DatabaseUrl = $candidate
          break
        }
      }
    }
  }
}

$targetArguments = @()
$targetLabel = ''
if ($Local) {
  $targetArguments = @('--local')
  $targetLabel = 'local Supabase'
} elseif ($Linked) {
  $targetArguments = @('--linked')
  $targetLabel = 'linked Supabase project'
} elseif ($DatabaseUrl) {
  try {
    $uri = [Uri]$DatabaseUrl
    $targetLabel = "database $($uri.Host):$($uri.Port)"
  } catch {
    $targetLabel = 'database configured in backend/.env'
  }
  $targetArguments = @('--db-url', $DatabaseUrl)
} else {
  throw 'No database target found. Configure backend/.env or use -Local, -Linked, or -DatabaseUrl.'
}

Write-Host 'PetroShield rolling 7-day seed' -ForegroundColor Cyan
Write-Host "Anchor date (Asia/Shanghai): $AnchorDate"
Write-Host "Target: $targetLabel"
Write-Host 'Only fixed PetroShield seed IDs and seed_source-marked rows will be refreshed.'
Write-Host 'Risk-control areas are preserved; all generated entities will use the currently enabled areas.'

if (-not $Force) {
  $confirmation = Read-Host 'Type SEED to continue'
  if ($confirmation -cne 'SEED') {
    Write-Host 'Cancelled.'
    exit 0
  }
}

$sourceSql = [System.Text.StringBuilder]::new()
[void]$sourceSql.AppendLine("select set_config('petroshield.seed_anchor_date', '$AnchorDate', true);")

foreach ($seedFile in $seedFiles) {
  [void]$sourceSql.AppendLine("`n-- ===== $seedFile =====")
  [void]$sourceSql.AppendLine(
    (Get-Content -LiteralPath (Join-Path $seedRoot $seedFile) -Raw -Encoding UTF8)
  )
}

$statements = @(Split-PostgresStatements -Sql $sourceSql.ToString())
if ($statements.Count -eq 0) {
  throw 'No seed statements were generated.'
}

$wrappedSql = [System.Text.StringBuilder]::new()
[void]$wrappedSql.AppendLine('do $petroshield_runner$')
[void]$wrappedSql.AppendLine('begin')
for ($statementIndex = 0; $statementIndex -lt $statements.Count; $statementIndex++) {
  $tag = '$petroshield_stmt_{0:D4}$' -f ($statementIndex + 1)
  if ($statements[$statementIndex].Contains($tag)) {
    throw "Generated dollar tag collides with seed statement $($statementIndex + 1)."
  }
  [void]$wrappedSql.Append('  execute ')
  [void]$wrappedSql.Append($tag)
  [void]$wrappedSql.AppendLine()
  [void]$wrappedSql.AppendLine($statements[$statementIndex])
  [void]$wrappedSql.Append($tag)
  [void]$wrappedSql.AppendLine(';')
}
[void]$wrappedSql.AppendLine('end;')
[void]$wrappedSql.AppendLine('$petroshield_runner$;')

$tempSql = Join-Path ([IO.Path]::GetTempPath()) "petroshield-seed-$([Guid]::NewGuid().ToString('N')).sql"
$utf8WithoutBom = [System.Text.UTF8Encoding]::new($false)
[IO.File]::WriteAllText($tempSql, $wrappedSql.ToString(), $utf8WithoutBom)

try {
  Push-Location $databaseRoot
  try {
    & supabase db query @targetArguments --file $tempSql --output table
    if ($LASTEXITCODE -ne 0) {
      throw "Supabase seed failed with exit code $LASTEXITCODE."
    }
  } finally {
    Pop-Location
  }
} finally {
  Remove-Item -LiteralPath $tempSql -Force -ErrorAction SilentlyContinue
}

Write-Host "Seed completed for $AnchorDate and the preceding 6 days." -ForegroundColor Green
