Add-Type -AssemblyName System.IO.Compression.FileSystem

$outputPath = Join-Path $PSScriptRoot "documentacao-metodologia-agregador-eleitoral.docx"
$tempRoot = Join-Path $PSScriptRoot "_docx_tmp"

if (Test-Path $tempRoot) {
  Remove-Item -LiteralPath $tempRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $tempRoot | Out-Null
New-Item -ItemType Directory -Path (Join-Path $tempRoot "_rels") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $tempRoot "word") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $tempRoot "word\_rels") | Out-Null

$contentTypes = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>
'@

$rels = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>
'@

$documentRels = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>
'@

$styles = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
    <w:rPr><w:sz w:val="22"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:rPr><w:b/><w:sz w:val="32"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:rPr><w:b/><w:sz w:val="28"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:rPr><w:b/><w:sz w:val="24"/></w:rPr>
  </w:style>
</w:styles>
'@

function Escape-Xml([string]$text) {
  return [System.Security.SecurityElement]::Escape($text)
}

function Paragraph([string]$text, [string]$style = "Normal") {
  $escaped = Escape-Xml $text
  return "<w:p><w:pPr><w:pStyle w:val=`"$style`"/></w:pPr><w:r><w:t xml:space=`"preserve`">$escaped</w:t></w:r></w:p>"
}

function EmptyParagraph() {
  return "<w:p/>"
}

function TableRow([string[]]$cells, [bool]$header = $false) {
  $cellXml = foreach ($cell in $cells) {
    $escaped = Escape-Xml $cell
    $boldStart = if ($header) { "<w:b/>" } else { "" }
    "<w:tc><w:tcPr><w:tcW w:w=`"0`" w:type=`"auto`"/></w:tcPr><w:p><w:r><w:rPr>$boldStart</w:rPr><w:t xml:space=`"preserve`">$escaped</w:t></w:r></w:p></w:tc>"
  }
  return "<w:tr>$($cellXml -join '')</w:tr>"
}

function Table([string[][]]$rows) {
  $body = @()
  for ($i = 0; $i -lt $rows.Count; $i++) {
    $body += TableRow $rows[$i] ($i -eq 0)
  }
  return "<w:tbl><w:tblPr><w:tblBorders><w:top w:val=`"single`" w:sz=`"4`"/><w:left w:val=`"single`" w:sz=`"4`"/><w:bottom w:val=`"single`" w:sz=`"4`"/><w:right w:val=`"single`" w:sz=`"4`"/><w:insideH w:val=`"single`" w:sz=`"4`"/><w:insideV w:val=`"single`" w:sz=`"4`"/></w:tblBorders></w:tblPr>$($body -join '')</w:tbl>"
}

$body = @()
$body += Paragraph "Metodologia do Agregador Eleitoral" "Title"
$body += Paragraph "Documentação técnica do cálculo da estimativa bayesiana, dos pesos e dos ajustes utilizados no projeto."
$body += EmptyParagraph

$sections = @(
  @("1. Visão geral", @(
    "O agregador combina uma curva LOESS, usada apenas para visualização exploratória, com uma estimativa principal chamada no projeto de média bayesiana ponderada. Tecnicamente, a estimativa é uma média posterior empírica com prior, pesos observacionais e correções calibradas por backtests."
  )),
  @("2. Dados de entrada", @(
    "Cada observação é composta por instituto, data de campo, turno, cenário, candidato, percentual, tamanho da amostra e margem de erro.",
    "Pesquisas do mesmo instituto e da mesma data são tratadas como cenários alternativos do mesmo levantamento, não como pesquisas independentes.",
    "Linhas de eventos políticos e textos que parecem datas são descartados para não entrarem como institutos."
  )),
  @("3. Janela temporal", @(
    "A estimativa exibida na tabela usa apenas as pesquisas dentro da janela definida pelo controle de meia-vida bayesiana.",
    "Se T é a data da pesquisa mais recente dentro dos filtros e H é a meia-vida escolhida em dias, entram no resumo pesquisas com data maior ou igual a T - H.",
    "O controle atualmente permite escolher a meia-vida entre 14 e 180 dias."
  )),
  @("4. Prior", @(
    "Para cada candidato, o prior empírico é a média simples das observações disponíveis do próprio candidato.",
    "O peso do prior é fixo em 2500. Esse parâmetro evita que poucas pesquisas recentes produzam oscilações excessivas."
  )),
  @("5. Peso total de cada observação", @(
    "Para cada observação i, o peso total é: wi = peso_amostra × peso_margem × peso_tempo × peso_qualidade_instituto × peso_house_effect."
  )),
  @("5.1. Peso da amostra", @(
    "peso_amostra = max(300, n).",
    "Quando a amostra não é informada, o sistema usa 1000 como valor substituto dentro do cálculo."
  )),
  @("5.2. Peso da margem de erro", @(
    "peso_margem = 1 / margem².",
    "Para evitar divisão por zero, usa-se 1 / max(0,0001, margem²).",
    "Se a margem não estiver disponível, o peso da margem é 1."
  )),
  @("5.3. Peso temporal", @(
    "Se d é a idade da pesquisa em dias e H é a meia-vida escolhida, então peso_tempo = 0,5^(d/H).",
    "Uma pesquisa com idade igual à meia-vida recebe metade do peso de uma pesquisa publicada na data-alvo."
  )),
  @("5.4. Peso de qualidade histórica do instituto", @(
    "O projeto incorpora um ranking histórico de institutos com erro percentual médio, número de pesquisas analisadas, índice de desempenho final e nota.",
    "peso_erro = (4 / max(2, erro_médio))².",
    "peso_score = exp(-0,18 × índice_desempenho).",
    "peso_confiança = clamp(log10(pesquisas_analisadas + 1) / 2, 0,75, 1,15).",
    "peso_qualidade = clamp(peso_erro × peso_score × peso_confiança, 0,35, 2,20).",
    "Quando não há rating disponível para o instituto, peso_qualidade = 1."
  )),
  @("6. House effect", @(
    "O house effect é calculado por instituto. Para cada pesquisa, observam-se as 10 pesquisas anteriores do mesmo turno, calcula-se a média bayesiana de referência dos candidatos e identifica-se o líder dessa referência.",
    "house_effect = percentual do instituto para o líder - média bayesiana de referência.",
    "Para cada instituto, o house effect médio é a média dessas diferenças."
  )),
  @("6.1. Peso por house effect", @(
    "O peso adicional só é aplicado quando o instituto possui mais de 2 comparações.",
    "peso_house_effect = 1 / (1 + |house_effect| / 4), limitado ao intervalo [0,35; 1,10].",
    "Institutos com house effect absoluto maior recebem menos peso."
  )),
  @("6.2. Correção parcial do valor observado", @(
    "Além de alterar o peso, o valor observado recebe correção parcial quando o instituto possui mais de 2 comparações e o percentual observado é de pelo menos 15%.",
    "valor_corrigido = valor_observado - 0,6 × house_effect.",
    "O parâmetro atual HOUSE_EFFECT_CORRECTION é 0,6."
  )),
  @("7. Ajuste sistêmico Bolsonaro", @(
    "Os backtests de 2018 e 2022 mostraram subestimação recorrente de candidatos chamados Bolsonaro. Por isso, após a média ponderada, o sistema aplica ajuste sistêmico de +2,5 pontos percentuais quando o nome do candidato contém Bolsonaro.",
    "O parâmetro atual BOLSONARO_SYSTEMIC_BIAS é 2,5."
  )),
  @("8. Fórmula final da estimativa", @(
    "posterior_c = (w0 × m0 + soma_i(wi × yi_corrigido)) / (w0 + soma_i wi).",
    "w0 = 2500.",
    "m0 = média simples histórica do candidato.",
    "wi = peso_amostra × peso_margem × peso_tempo × peso_qualidade × peso_house_effect.",
    "yi_corrigido = valor observado após correção parcial de house effect.",
    "estimativa_final_c = posterior_c + ajuste_sistêmico_c, limitada ao intervalo de 0% a 100%."
  )),
  @("9. Curva no gráfico", @(
    "A linha tracejada do gráfico usa a mesma lógica de ponderação e é recalculada em cada ponto temporal da série.",
    "A linha cheia é LOESS e serve apenas como suavização visual exploratória; ela não entra no cálculo principal."
  )),
  @("10. Campos exportados no CSV", @(
    "O CSV inclui, entre outros: pollster_grade, pollster_mean_error, pollster_quality_weight, house_effect_n, house_effect, house_effect_abs, house_effect_weight, house_effect_correction e systemic_candidate_bias."
  )),
  @("11. Limitações atuais", @(
    "O modelo ainda não é um modelo bayesiano hierárquico completo.",
    "O ajuste sistêmico Bolsonaro foi calibrado em eleições passadas e pode não generalizar perfeitamente para eleições futuras.",
    "A conversão de intenção de voto total para voto válido ainda não é modelada de forma estrutural no aplicativo principal.",
    "O house effect é estimado apenas com base no líder das 10 pesquisas anteriores, e não simultaneamente para todos os candidatos."
  ))
)

foreach ($section in $sections) {
  $body += Paragraph $section[0] "Heading1"
  foreach ($paragraph in $section[1]) {
    $body += Paragraph $paragraph
  }
  $body += EmptyParagraph
}

$body += Paragraph "12. Desempenho nos backtests" "Heading1"
$body += Paragraph "As modificações foram consolidadas somente após melhora dos backtests de 2018 e 2022."
$body += Table @(
  @("Ano", "Turno", "MAE antes", "MAE depois"),
  @("2018", "1º turno", "2,84 pp", "2,34 pp"),
  @("2018", "2º turno", "1,42 pp", "0,04 pp"),
  @("2022", "1º turno", "3,23 pp", "2,57 pp"),
  @("2022", "2º turno", "1,78 pp", "0,41 pp")
)
$body += EmptyParagraph
$body += Paragraph "13. Resumo" "Heading1"
$body += Paragraph "A estimativa bayesiana do agregador é uma média posterior empírica que combina pesquisas recentes, tamanho de amostra, margem de erro, qualidade histórica dos institutos, house effect e um ajuste sistêmico calibrado por backtests para produzir uma estimativa suavizada e menos sensível a vieses recorrentes."

$document = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    $($body -join "`n")
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>
"@

Set-Content -LiteralPath (Join-Path $tempRoot "[Content_Types].xml") -Value $contentTypes -Encoding UTF8
Set-Content -LiteralPath (Join-Path $tempRoot "_rels\.rels") -Value $rels -Encoding UTF8
Set-Content -LiteralPath (Join-Path $tempRoot "word\document.xml") -Value $document -Encoding UTF8
Set-Content -LiteralPath (Join-Path $tempRoot "word\styles.xml") -Value $styles -Encoding UTF8
Set-Content -LiteralPath (Join-Path $tempRoot "word\_rels\document.xml.rels") -Value $documentRels -Encoding UTF8

if (Test-Path $outputPath) {
  Remove-Item -LiteralPath $outputPath -Force
}

[System.IO.Compression.ZipFile]::CreateFromDirectory($tempRoot, $outputPath)
Remove-Item -LiteralPath $tempRoot -Recurse -Force
Write-Output $outputPath
