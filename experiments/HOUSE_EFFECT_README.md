# Experimento de efeito de instituto contemporâneo

Este módulo é **experimental** e não modifica a metodologia v3.0 em produção.

## Entrada
Array de observações com campos `pollster`, `date` (ISO), `election`, `round`, `scenario`, `candidate`, `value` (percentual) e `sample` (opcional). As porcentagens devem ser previamente harmonizadas na mesma base de votos. Não combinar cenários diferentes.

## Método
Para cada pesquisa, a referência utiliza outros institutos na janela de ±7 dias, com peso temporal gaussiano e igual contribuição total por instituto. São exigidos dois institutos comparadores. O desvio é agregado por instituto, eleição, turno, cenário e candidato, com regularização centrada em zero. Menos de três rodadas resulta em `insufficient_data`.

## Limitações
O intervalo de 95% é aproximado e não incorpora toda a dependência temporal, a incerteza da tendência latente ou o erro comum entre institutos. Não constitui intervalo de confiança calibrado nem evidência de viés político. Não aplicar automaticamente o resultado como correção.

## Validação necessária
Comparar M0 (sem ajuste), M1 (v3.0) e M2 (experimental), em previsões retrospectivas congeladas antes do pleito, por MAE, RMSE e cobertura. Retirar uma eleição completa de cada vez e impedir dados futuros na estimação. Só considerar integração após ganho fora da amostra e revisão da qualidade dos dados.
