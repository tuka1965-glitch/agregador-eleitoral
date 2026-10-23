# Execução com pesquisas reais - 23/10/2026

Esta auditoria executa o módulo experimental original e compara a substituição do componente de house effect com uma referência sem ajuste e com a regra antiga extraída de `app.js`. Não utiliza observações sintéticas e não modifica o estimador original, a branch main ou o Sites.

## Reprodução

Com Python (lxml, numpy, scipy) e Node.js, execute na raiz do repositório:

```bash
python3 experiments/build_real_dataset.py
node experiments/run_real_audit.mjs
python3 experiments/summarize_real_audit.py
```

O código usa o snapshot versionado de 2026 e os excertos históricos rastreáveis em `data/audit_sources`. Não precisa consultar a internet durante a execução. Para o relatório PDF, instale também reportlab e fontes DejaVu, depois execute `python3 experiments/make_audit_report.py`.

## Resultados executados

- 299 levantamentos observados em quatro eleições; sete turnos com referência das urnas e um turno futuro, sem pontuação eleitoral.
- 66 previsões em cortes D-1, D-7, D-14 e 23/10/2026 para o segundo turno corrente.
- MAE no corte D-1: M0 2,83; M1 2,78; M2 2,94 p.p.
- RMSE no corte D-1: M0 4,08; M1 4,11; M2 4,13 p.p.
- Datafolha, Lula, segundo turno de 2026: efeito relativo -0,16 p.p.; intervalo semanal aproximado de 95% [-1,09; +0,77]; três rodadas.
- Corrigida a pesquisa final Datafolha do primeiro turno de 2014: Dilma 44%, não 45%. A média assinada de sete erros PT-urnas passa para +0,16 p.p.
- Os controles temporais e de integridade sobre dados reais passaram. Nenhum teste sintético foi executado.

## Limitações essenciais

M1 reproduz o componente de house effect da branch sob uma base comum de agregação; não é uma reprodução certificada de toda a metodologia v3.0 do Sites. Ratings atuais foram neutralizados para evitar informação futura. Em 2014, a ponderação por n foi uniformizada porque a maioria das amostras está ausente na compilação.

Há 239 datas de divulgação aproximadas por fim de campo + dois dias, além de 60 datas com evidência de referência, URL datada ou confirmação específica. O algoritmo não usa campo futuro nem resultados oficiais na estimação, mas a ausência integral de vazamento por publicação não está certificada. As sensibilidades e o subconjunto com datas documentadas são reportados explicitamente.

O módulo é uma média contemporânea regularizada, não um modelo hierárquico multi-eleições de tendência latente. Os intervalos são exploratórios e condicionais; não representam a incerteza da votação nem o erro comum dos institutos. Não houve tuning supervisionado nem validação prospectiva cega.

**Decisão:** preservar o M2 como diagnóstico experimental. A superioridade necessária para substituir o componente de produção não foi demonstrada.

## Entregáveis

- [Relatório detalhado](REAL_DATA_AUDIT.md)
- [Efeitos por instituto, eleição, turno e candidato](real_results/efeitos_por_instituto.csv)
- [Previsões e erros](real_results/previsoes_e_erros.csv)
- [Comparação de modelos](real_results/comparacao_modelos.csv)
- [Pesquisas harmonizadas](real_results/pesquisas_utilizadas.csv)
- [Sensibilidades](real_results/sensitivity.json)
- [Controles com observações reais](real_results/real_data_checks.json)
- [Referências das urnas](real_data/tse_results.json)
- [Exclusões e conflitos](real_data/exclusions.json)

Os resultados completos, fontes e pressupostos devem acompanhar qualquer divulgação dos coeficientes.
