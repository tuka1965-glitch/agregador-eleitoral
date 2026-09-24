# Calibração temporal da incerteza do 2º turno

Esta pasta documenta a calibração da incerteza usada nas simulações de segundo turno.

## Regra

A probabilidade exibida não deve usar apenas `margem_media / sqrt(n_pesquisas)` como incerteza total. A calibração final deve separar:

```
sigma_total^2 = sigma_amostral_agregado^2 + tau_entre_pesquisas^2 + sigma_historico(dias_ate_eleicao)^2
```

O componente histórico deve ser estimado fora da amostra usando eleições presidenciais anteriores (2014, 2018 e 2022), nos checkpoints D-30, D-21, D-14, D-7, D-3 e D-1.

## Critérios de implantação

1. Usar somente pesquisas de segundo turno do confronto correspondente.
2. Em cada checkpoint, usar apenas pesquisas cujo campo terminou até aquela data.
3. Comparar a margem agregada A-B com a margem final oficial em votos válidos.
4. Estimar MAE, RMSE e viés da margem, por horizonte.
5. Não reduzir sigma_historico pelo número de pesquisas.
6. Não fixar 3,1 p.p. como parâmetro definitivo: esse valor é apenas diagnóstico preliminar.
7. Enquanto a calibração temporal não estiver concluída, o rótulo recomendado é "Probabilidade de liderança no 2º turno".
8. Preservar 100.000 simulações; a correção é na distribuição de incerteza, não no número de simulações.

## Resultados oficiais de referência

- 2014: Dilma 51,64%; Aécio 48,36%.
- 2018: Bolsonaro 55,13%; Haddad 44,87%.
- 2022: Lula 50,90%; Bolsonaro 49,10%.

Os scripts `backtest_2014.js`, `backtest_2018.js` e `backtest_2022.js` permanecem a base para a extração e agregação histórica.
