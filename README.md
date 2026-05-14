# Analisador Temporal SINESP VDE

Este workspace recebeu o pacote `sinesp vde new 2.twbx` e ele foi extraido em `tableau_extract/`.

O workbook aponta para uma base original chamada `BancoVDE 2015.xlsx` e contem um extrato Tableau `.hyper`. Os campos identificados foram:

- `uf`
- `municipio`
- `evento`
- `data_referencia`
- `agente`
- `arma`
- `faixa_etaria`
- `feminino`
- `masculino`
- `nao_informado`
- `total_vitima`
- `total`
- `total_peso`
- `abrangencia`
- `formulario`

## Como usar

1. Publique o projeto no GitHub Pages ou abra `index.html` em um servidor local.
2. O app tenta carregar automaticamente `data/sinesp_manifest.json` e os CSVs oficiais listados nele. Se o manifesto ainda nao existir, ele tenta `data/sinesp_vde.csv`.
3. Se a base oficial ainda nao estiver no repositorio, use **Abrir CSV local** como alternativa.
4. Confirme os campos:
   - Data: `data_referencia`
   - Valor: `total_vitima` ou `total`
   - Formato da data: comece com `Automatico`; se os meses ficarem errados, teste `Dia/Mes/Ano` ou `Mes/Dia/Ano`
   - Campo UF: `uf`, quando existir
   - Campo indicador: `evento`, quando existir
   - Filtro extra: `municipio`, `arma`, `agente`, `faixa_etaria` ou `(sem comparacao)`
5. Clique em **Analisar**.

O painel mostra quantas linhas foram ignoradas. Se esse numero for alto, o problema quase sempre esta no formato da data ou em valores numericos exportados como texto.

## Atualizacao automatica da base oficial

O repositorio agora inclui o script `scripts/atualiza_sinesp.py`, que acessa a pagina oficial do Ministerio da Justica e Seguranca Publica:

`https://www.gov.br/mj/pt-br/assuntos/sua-seguranca/seguranca-publica/estatistica/dados-nacionais-1/base-de-dados-e-notas-metodologicas-dos-gestores-estaduais-sinesp-vde-2022-e-2023`

O script baixa os arquivos anuais `bancovde-2015.xlsx` a `bancovde-2026.xlsx`, converte cada ano para `data/sinesp_vde_AAAA.csv`, gera tambem `data/sinesp_vde.csv` consolidado e escreve `data/sinesp_manifest.json`.

Para rodar localmente:

```bash
python -m pip install pandas openpyxl requests
python scripts/atualiza_sinesp.py --years all
```

Para reduzir tamanho e tempo de execucao durante testes:

```bash
python scripts/atualiza_sinesp.py --years 2024-2026
```

No GitHub, o workflow `.github/workflows/atualiza-sinesp.yml` pode ser executado manualmente em **Actions > Atualizar base SINESP VDE > Run workflow**. Ele tambem roda automaticamente todo dia 5 de cada mes e commita os CSVs atualizados em `data/`.

Os filtros de UF, indicador e filtro extra têm atalhos **Todos/Todas** e **Nenhum/Nenhuma** para facilitar combinações rápidas.

A secao **Analise automatica** escreve alguns paragrafos sobre tendencia, volatilidade, sazonalidade mensal, quebras abruptas e pontos anômalos. Use o botao **Copiar** para levar o texto para um relatorio ou documento.

Na tabela de resumo, a coluna **Var. ano anterior** compara cada periodo com o mesmo periodo do ano anterior, reduzindo distorcoes em series com sazonalidade.

A secao **Generalizacao territorial** compara uma janela pre e uma janela pos por UF. Ela calcula a variacao de cada estado, a mediana estadual, a variacao nacional agregada e classifica o padrao como queda generalizada, queda ampla mas desigual, queda concentrada, estabilidade ampla, padrao divergente ou mudanca heterogenea.

Para testar a pergunta sobre homicidios depois de 2017:

- Pre inicio: `2015`
- Pre fim: `2017`
- Pos inicio: `2018`
- Pos fim: `2020` ou outro ano final desejado
- Limiar relevante: `10`

Depois selecione o indicador de homicidios no filtro **Indicador**. Se a queda nacional vier acompanhada de queda na mediana estadual e em grande parte das UFs, o app classifica como tendencia generalizada. Se o agregado nacional cair mas a mediana estadual nao cair, a leitura aponta concentracao em poucas UFs.

A secao **Participacao dos estados** calcula quanto cada UF representa no total do indicador selecionado dentro do intervalo de anos escolhido. Ela mostra o ranking estadual, a participacao do maior estado, a soma dos top estados e um texto explicando se o indicador esta concentrado ou disperso territorialmente. Use essa leitura junto com a generalizacao territorial para saber se a tendencia nacional esta sendo puxada por estados de grande peso.

A secao **Taxas por 100 mil habitantes** cruza os casos filtrados com `data/populacao_uf_ano.csv` e calcula taxas estaduais ajustadas pelo tamanho da populacao. A base incluida usa a Projecao da Populacao do IBGE/SIDRA, tabela 7358, edicao 2018, sexo total e idade total, para UFs entre 2015 e 2026. No GitHub Pages o arquivo e carregado automaticamente; abrindo o HTML direto no computador, alguns navegadores bloqueiam esse carregamento e voce pode selecionar manualmente o CSV pelo controle da propria secao.

O modulo **Mapas de taxas** calcula, para o ultimo ano disponivel na base filtrada, a taxa por 100 mil habitantes em cada UF e desenha um mapa coropletico. Quando o ultimo ano esta incompleto, como 2026 com dados ate marco, a taxa e anualizada: os casos observados sao multiplicados por `12 / meses_observados` antes da divisao pela populacao estadual. As cores mais escuras indicam maior intensidade relativa do evento selecionado. O mapa usa a malha de UFs do servico de dados do IBGE e a base populacional estadual ja incluida no projeto. Mapas municipais exigem uma base populacional municipal anual para evitar interpretar volume absoluto como taxa.

A secao **Atipicidade por Estado** identifica o evento analisado pelo nome selecionado no filtro **Indicador** e calcula atipicidades dentro da serie historica de cada UF. O criterio padrao marca pontos com pelo menos 2 desvios-padrao em relacao a media mensal da propria UF. O texto diferencia picos atipicos e quedas atipicas, destacando os estados e meses mais extremos sem gerar grafico.

A secao **Projecao linear** estima os proximos 3 periodos da serie filtrada usando regressao linear simples. A projecao e apenas uma extrapolacao de tendencia e nao substitui modelos sazonais ou revisao substantiva dos dados.

O modulo **Destaques** compara os ultimos 3 meses existentes na base com o mesmo periodo do ano anterior, para cada evento selecionado e para cada local. Quando a coluna `municipio` existir, a lista usa municipios; caso contrario, usa UF. Entram na lista os evento-locais com aumento superior ao limiar configurado, por padrao 10%, ajudando a apontar onde a gestao de seguranca deve concentrar atencao.

Use o botao **Salvar relatorio em PDF** para abrir a impressao do navegador e escolher **Salvar como PDF**. O layout de impressao oculta controles e botoes para deixar o relatorio mais limpo.

Para o arquivo `grafico vitmas (3)_data.csv` baixado do Tableau Public, use:

- Data: `Mês de Data Referencia`
- Valor: `Total Vitima`
- Formato da data: `Automatico`
- Campo UF: `(nenhum)`
- Campo indicador: `(nenhum)`
- Filtro extra: `(sem comparacao)`

## CSV completo por UF e indicador

Para analisar os 28 indicadores por UF, exporte ou monte um CSV com pelo menos estas colunas:

- `data_referencia`
- `uf`
- `evento`
- `total_vitima` ou `total`

No app, use:

- Campo UF: `uf`
- Campo indicador: `evento`
- Filtro extra: opcional, por exemplo `municipio`, `arma`, `agente` ou `faixa_etaria`

O arquivo `.twbx` contem esses campos, mas as linhas estao dentro de um extrato `.hyper`. O fluxo preferencial agora e atualizar a base oficial pelo script acima e deixar o app carregar os CSVs de `data/` automaticamente.

## Como obter o CSV no Tableau Public

1. Abra a visualizacao no Tableau Public.
2. Use **Download > Dados** ou **Download > Crosstab**.
3. Se necessario, clique antes em uma marca, tabela, mapa ou grafico para habilitar os dados da selecao.
4. Baixe em CSV e carregue no app.

## Observacao

O arquivo `.hyper` dentro do `.twbx` e um formato proprietario do Tableau. Para extrair todas as linhas automaticamente, e necessario instalar o Tableau Hyper API, Tableau Desktop, Tableau Prep ou exportar o CSV pelo Tableau Public/Desktop.
