# Experimento de melhoria do agregador - 26/10/2026

Experimento retrospectivo; produção não alterada. Não reproduz integralmente previsões originalmente publicadas. Ratings neutralizados, mesmas entradas e cortes para comparação controlada.

## Resultado em D-1

Modelo | MAE | RMSE | Ordem correta
---|---:|---:|---:
B0 | 2.683 | 3.530 | 6/8
B1 | 3.364 | 4.491 | 6/8
R0 | 3.139 | 4.218 | 6/8
R1 | 3.088 | 4.140 | 6/8
R2 | 3.084 | 4.137 | 6/8
R3 | 2.447 | 3.429 | 6/8
R4 | 2.999 | 4.065 | 6/8

R3 estima tendência e efeitos de instituto conjuntamente. Seu MAE foi 2,447 pontos, contra 2,683 da última rodada por instituto e 3,139 da reconstrução controlada do núcleo publicado. Todos acertaram a ordem em 6 de 8 disputas; R3 continuou invertendo a liderança nos dois turnos de 2026.

R3 melhorou em três dos quatro ciclos, mas piorou 0,658 ponto frente à referência simples em 2014. No subconjunto com evidência documental de divulgação, R3 teve MAE 2,786, contra 2,728 da referência simples. Não há evidência suficiente para promover R3 automaticamente.

O componente de erro eleitoral comum foi estimado apenas com ciclos anteriores. Seus intervalos nominais gaussianos são exploratórios, não calibração prospectiva certificada. A avaliação cronológica de incerteza abrange apenas quatro disputas, em dois ciclos.

## Reprodução

Python com numpy/scipy e Node.js:
```sh
python experiments/validation_2026/run_experiment.py
```

O runner usa apenas entradas congeladas, sem rede. prepare_inputs.py documenta a preparação original e depende da captura do Sites identificada em inputs/provenance.json. O protocolo, as sensibilidades, os cortes, as previsões e os escores completos estão nos arquivos JSON/CSV. Não houve escolha de parâmetros por otimização dos resultados.

480 registros observados, incluindo cenários hipotéticos anteriores ao primeiro turno para testar sua exclusão. Três registros com categorias negativas foram excluídos de todos os modelos, mantendo os originais. O corte de indecisos identificados inferior a 3% aplica-se somente ao primeiro turno; não há exclusões por indecisos no segundo. Datas de divulgação desconhecidas usam fim de campo +2 dias no protocolo principal, com sensibilidades de 0,1,3,7 dias e subconjunto documental.

As reconstruções deste experimento não substituem os indicadores dos boletins arquivados na aba Validação. Os parâmetros foram examinados após conhecer 2026; confirmação prospectiva exige eleições futuras.
