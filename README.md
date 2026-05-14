# Agregador presidencial 2026

Protótipo local para ler as tabelas da página da Wikipédia sobre pesquisas de opinião da eleição presidencial brasileira de 2026 e visualizar:

- pontos observados por candidato;
- curva LOESS;
- agregação bayesiana leve, ponderada por tempo, tamanho de amostra e margem de erro;
- exportação CSV em formato longo.

## Como rodar

Abra `index.html` em um navegador moderno, ou rode um servidor estático na pasta:

```powershell
node server.js
```

Depois acesse `http://127.0.0.1:4173/`.

O app busca a página pela API pública da Wikipédia no carregamento:

```text
https://pt.wikipedia.org/wiki/Pesquisas_de_opini%C3%A3o_para_a_elei%C3%A7%C3%A3o_presidencial_no_Brasil_em_2026
```

## Observações metodológicas

Este é um primeiro protótipo exploratório. A curva bayesiana implementada aqui não estima um modelo hierárquico completo; ela usa um prior empírico por candidato e combina pesquisas por proximidade temporal, amostra e margem de erro. Para uma versão analítica mais forte, o próximo passo seria modelar efeitos por instituto, modo de coleta e indecisos/brancos/nulos em um modelo multinomial ou logit-normal.
