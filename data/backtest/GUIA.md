# Backtest histórico

O backtest compara previsões salvas pelo agregador com resultados observados. Ele não altera as fórmulas usadas na página pública.

## Estrutura de um snapshot

Crie arquivos JSON em `data/backtest/snapshots/`, por exemplo:

```json
{
  "election_date": "2026-10-04",
  "forecast_date": "2026-09-20",
  "forecast": {
    "Candidato A": 32.4,
    "Candidato B": 28.1
  },
  "observed": {
    "Candidato A": 30.2,
    "Candidato B": 29.0
  }
}
```

Os valores devem estar na mesma escala (percentuais ou proporções). Execute:

```bash
node backtest.mjs
```

O resultado será gravado em `data/backtest/results.json`, com erro absoluto médio, viés médio e número de observações. Com a base atual, o resultado esperado é `insufficient_data`, pois ainda não existem snapshots históricos compatíveis nem resultado observado da eleição de 2026.
