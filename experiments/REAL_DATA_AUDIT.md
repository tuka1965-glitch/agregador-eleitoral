AGREGADOR PRESIDENCIAL  |  AUDITORIA METODOLÓGICA

Pesquisas observadas de 2014, 2018, 2022 e 2026<br/>**Data de referência: 23 de outubro de 2026**


### Resultado principal


O estimador contemporâneo foi executado com dados reais. Nesta reconstrução, sua substituição pela regra antiga **não apresentou ganho consistente de precisão**. A evidência não sustenta sua adoção imediata na aplicação publicada.

| Modelo comparado | MAE (p.p.) | RMSE (p.p.) |

| --- | --- | --- |

| M0 - sem efeito de instituto | 2,83 | 4,08 |

| M1 - regra antiga de 60% | 2,78 | 4,11 |

| M2 - estimador contemporâneo | 2,94 | 4,13 |



Avaliação na véspera de sete disputas concluídas, considerando os dois finalistas de cada uma. Os primeiros turnos mantêm a participação nos votos válidos de todos os candidatos. O segundo turno de 2026 não entra no cálculo, pois ainda não ocorreu.


### O que a análise permite concluir sobre o Datafolha


No segundo turno de 2026, o desvio regularizado em relação aos demais institutos é de **-0,16 p.p. para Lula**, com intervalo aproximado de 95% de **-1,09 a +0,77 p.p.**, em três rodadas. A estimativa é compatível com zero e não oferece fundamento para um desconto fixo pró-Lula.

O sinal do efeito muda entre eleições e turnos. O erro eleitoral e o efeito relativo não são equivalentes: um instituto pode estar próximo dos concorrentes e todos se afastarem do resultado das urnas.


### Alcance desta entrega


Foram reunidos 299 levantamentos, executadas 66 combinações de modelo e corte temporal e produzidas tabelas de efeitos, intervalos, MAE e RMSE. Não foram utilizados levantamentos sintéticos. A versão pública e a branch main não foram alteradas.

**Ressalva de reprodução:** M1 representa a regra de house effect localizada no código da branch, sob uma base comum de agregação. Este relatório não certifica reprodução integral da v3.0 do Sites. A cronologia de divulgação não está integralmente documentada; esse limite é quantificado e testado adiante.


---



## 1. Base empírica e controle de qualidade


| Eleição / turno | Pesquisas | Institutos | Início do campo | Fim do campo |

| --- | --- | --- | --- | --- |

| 2014 - 1º turno | 27 | 4 | 2014-08-21 | 2014-10-04 |

| 2014 - 2º turno | 15 | 4 | 2014-10-07 | 2014-10-25 |

| 2018 - 1º turno | 32 | 12 | 2018-09-12 | 2018-10-06 |

| 2018 - 2º turno | 25 | 10 | 2018-10-08 | 2018-10-27 |

| 2022 - 1º turno | 66 | 15 | 2022-08-16 | 2022-10-01 |

| 2022 - 2º turno | 48 | 14 | 2022-10-03 | 2022-10-29 |

| 2026 - 1º turno | 47 | 16 | 2026-09-01 | 2026-10-03 |

| 2026 - 2º turno | 39 | 20 | 2026-10-05 | 2026-10-22 |



Os quantitativos descrevem a base recuperada, não o universo completo de todas as pesquisas eleitorais. As janelas iniciais foram limitadas a regimes comparáveis de candidaturas: após a entrada de Marina em 2014, após a definição de Haddad em 2018, durante a campanha formal em 2022 e setembro de 2026. Para os segundos turnos, foram admitidas somente pesquisas cujo campo começou depois da votação do primeiro turno.


### Procedência


O snapshot de 2026 veio do repositório indicado, coletado em 23/10/2026 às 05:01 UTC. As tabelas históricas foram recuperadas das páginas de pesquisas referenciadas pelos scripts do próprio repositório. Trata-se de uma compilação secundária, complementada por verificações primárias do Datafolha/Folha e referências eleitorais do TSE e TRE-MG. Não houve recertificação individual de todos os relatórios originais.


### Tratamento dos registros


Nomes de institutos foram harmonizados, mantendo Ibope e Ipec separados. Rodadas repetidas não foram contadas como novas amostras. Cenários adicionais da mesma rodada não acrescentaram observações independentes. Foram registrados 21 eventos de qualidade: quatro incompatibilidades de totais, uma duplicata Datafolha com amostra conflitante, dez registros com valores censurados, dois cenários incompletos e quatro cenários alternativos da mesma rodada.

Percentuais como &lt;1% não receberam valores inventados. A rotina conservadora excluiu esses registros. Na presença de percentuais válidos publicados e conferidos, estes tiveram precedência sobre proporções calculadas de totais arredondados. As escolhas residuais foram reunidas em Outros por fechamento contábil, sem gerar entrevistas ou novas pesquisas.

O arquivo Quaest anexado é identificado na capa como **17ª rodada, setembro de 2025**, com campo de 12 a 14/09 e 2.004 entrevistas. Apesar do nome do arquivo, não corresponde à campanha de setembro de 2026 e não foi incorporado.


---



## 2. Comparação dos estimadores


| Modelo | Definição operacional executada |

| --- | --- |

| M0 | Sem ajuste ou reponderação por house effect. |

| M1 | Funções antigas extraídas do app.js: referência das dez pesquisas anteriores, candidato líder da referência, efeito médio por instituto; correção de 60% e reponderação associada. |

| M2 | Módulo experimental original: referência contemporânea dos demais institutos em ±7 dias, contribuição igual por instituto comparador, mínimo de dois comparadores e três rodadas, regularização centrada em zero. |



**Definição de sinal:** efeito positivo significa percentual maior para o candidato do que na referência contemporânea. O ajuste experimental subtrai esse efeito da pesquisa. O efeito é específico de candidato, eleição, turno e cenário.


### Base comum de agregação


Para isolar o componente em estudo, os três modelos usam a mesma base limpa e o mesmo conjunto de cortes. A rotina segue o esqueleto do app da branch: janela e meia-vida de 21 dias, prior empírico de peso 2.500, reforço de peso 2 para as cinco pesquisas mais recentes e meia-vida de 7 dias quando a mudança entre grupos recentes atinge 3 p.p. As estimativas finais são fechadas em 100% sobre o conjunto de candidatos e Outros.

Os ratings atuais dos institutos foram neutralizados em todos os modelos: não há snapshots dos ratings disponíveis antes de cada eleição, e usar os valores atuais retroativamente poderia introduzir informação futura. Em 2014, os pesos por amostra foram uniformizados em 1.000 para toda a eleição, pois a tabela histórica não informa a maioria dos tamanhos amostrais. Em outros anos, preservou-se n quando disponível. Margens ausentes não foram inventadas.


### O que o código experimental ainda não faz


O módulo existente é uma média de desvios contemporâneos com regularização normal. Ele **não estima conjuntamente uma tendência latente e efeitos hierárquicos de todas as eleições**. A janela temporal reduz a defasagem da referência, mas não controla explicitamente a inclinação da tendência dentro da janela. Portanto, não equivale ainda ao modelo hierárquico completo proposto na discussão anterior.

A referência contém todos os institutos elegíveis, sem excluir divergências a posteriori por orientação dos resultados. Sua composição pode influenciar bastante o efeito relativo; uma média dos demais institutos não estabelece a verdade eleitoral.


---



## 3. Validação temporal e disponibilidade


Cada previsão foi reconstruída nos cortes D-1, D-7 e D-14. O estimador recebeu somente pesquisas da eleição correspondente, com fim de campo e disponibilidade não posteriores ao corte. As pesquisas do segundo turno não foram utilizadas para prever o primeiro. O módulo nunca recebeu resultados das urnas para estimar efeitos ou escolher parâmetros.

A comparação usou os parâmetros originais do experimento, sem seleção do melhor prior ou janela a partir das urnas. Não houve treinamento supervisionado multi-eleições. A separação das eleições é uma avaliação de regra fixa com resultados retidos para pontuação; não deve ser descrita como um modelo hierárquico treinado por leave-one-election-out nem como validação prospectiva cega.

| Evidência de disponibilidade | Registros |

| --- | --- |

| field_end_plus_2_days_proxy | 239 |

| publication_date_in_bibliography | 31 |

| confirmed_publication | 10 |

| dated_cited_source_url | 19 |



Os rótulos em inglês são preservados para correspondência exata com a base. Em **239 dos 299 registros**, a data de divulgação não foi certificada: empregou-se o fim do campo mais dois dias como aproximação conservadora. Os demais têm data extraída da bibliografia, de URL datada ou confirmação específica. Essas evidências possuem níveis distintos de verificação.

**Consequência:** os cálculos impedem uso de campo futuro e de resultados eleitorais na estimação, mas não permitem certificar ausência absoluta de vazamento por horário/data de publicação em toda a base. O resultado é um backtest reconstruído, condicionado às datas de disponibilidade informadas. A limitação não deve ser omitida ao divulgar os números.


### Controles efetivamente executados


A exclusão de todos os registros futuros preservou exatamente as 66 previsões. Houve verificações de unicidade de rodadas, ordem das datas, integridade das fontes, corte antes do pleito e ausência de métricas de urnas para o segundo turno de 2026. Todos os controles passaram com observações reais. A contagem de verificações é uma checagem operacional e não comprova validade estatística.

As sensibilidades repetem os cálculos com atrasos de 0, 1, 3 e 7 dias e com o subconjunto que tem alguma evidência de data de divulgação. No subconjunto restrito, vários institutos desaparecem e o mínimo de comparadores deixa de ser atendido; seus resultados não substituem uma auditoria completa dos horários de publicação.


---



## 4. MAE e RMSE contra as urnas


| Disputa | N no corte | M0: MAE / RMSE | M1: MAE / RMSE | M2: MAE / RMSE |

| --- | --- | --- | --- | --- |

| 2014 / 1º | 27 | 6,92 / 7,85 | 7,00 / 7,99 | 6,93 / 7,81 |

| 2014 / 2º | 15 | 0,06 / 0,06 | 0,11 / 0,11 | 0,14 / 0,14 |

| 2018 / 1º | 29 | 5,95 / 6,36 | 5,92 / 6,36 | 4,95 / 5,75 |

| 2018 / 2º | 22 | 1,81 / 1,81 | 1,73 / 1,73 | 2,41 / 2,41 |

| 2022 / 1º | 62 | 2,02 / 2,04 | 2,05 / 2,06 | 2,66 / 2,66 |

| 2022 / 2º | 42 | 0,60 / 0,60 | 0,23 / 0,23 | 0,32 / 0,32 |

| 2026 / 1º | 41 | 2,44 / 2,64 | 2,41 / 2,63 | 3,17 / 3,49 |



Unidade: pontos percentuais. Cada disputa inclui os dois finalistas. MAE = média dos erros absolutos; RMSE = raiz da média dos erros quadráticos. No segundo turno, os erros dos candidatos são complementares: as duas linhas não constituem observações independentes. O erro de 2026 usa os percentuais oficiais publicados pelo TSE com 99,99% das urnas.


### Resultado agregado por horizonte


| Corte | Modelo | MAE | RMSE |

| --- | --- | --- | --- |

| D-1 | M0 | 2,83 | 4,08 |

| D-1 | M1 | 2,78 | 4,11 |

| D-1 | M2 | 2,94 | 4,13 |

| D-7 | M0 | 4,05 | 5,52 |

| D-7 | M1 | 3,90 | 5,42 |

| D-7 | M2 | 4,07 | 5,37 |

| D-14 | M0 | 4,55 | 6,12 |

| D-14 | M1 | 4,53 | 6,11 |

| D-14 | M2 | 4,54 | 6,11 |



No corte principal, M2 aumenta o MAE em **0,16 p.p.** diante de M1. O intervalo aproximado da diferença, agrupado por eleição, vai de **-0,36 a +0,68**. Com apenas quatro eleições, a incerteza é elevada; não há demonstração de superioridade nem de inferioridade estatisticamente estável.

Usando somente 2014, 2018 e 2022, os MAEs são M0: 2,89, M1: 2,84, M2: 2,90 p.p. M2 reduz um pouco o RMSE nesse recorte, mas o ganho não se mantém ao acrescentar o primeiro turno de 2026. A escolha da métrica e da amostra altera a ordenação.


---



## 5. Datafolha: erros diante das urnas


| Disputa | Candidato do PT | Pesquisa válida | Urnas | Erro PT | Erro adversário |

| --- | --- | --- | --- | --- | --- |

| 2014 / 1º | Dilma | 44,00 | 41,59 | +2,41 | -7,55 |

| 2014 / 2º | Dilma | 52,00 | 51,64 | +0,36 | -0,36 |

| 2018 / 1º | Haddad | 25,00 | 29,28 | -4,28 | -6,03 |

| 2018 / 2º | Haddad | 45,00 | 44,87 | +0,13 | -0,13 |

| 2022 / 1º | Lula | 50,00 | 48,43 | +1,57 | -7,20 |

| 2022 / 2º | Lula | 52,00 | 50,90 | +1,10 | -1,10 |

| 2026 / 1º | Lula | 45,00 | 45,16 | -0,16 | -5,03 |



Último levantamento Datafolha de cada turno, com os percentuais válidos publicados e conferidos. Erro = pesquisa menos urnas. Adversários: Aécio em 2014, Jair Bolsonaro em 2018/2022 e Flávio Bolsonaro em 2026. Os valores não são o efeito relativo de instituto.


### Correção da conclusão descritiva anterior


A pesquisa final de 2014 registrou **44% para Dilma**, e não 45%. Seu erro assinado é de +2,41 p.p., não +3,41. Corrigido esse dado, a média assinada das sete observações para candidatos do PT é de **+0,16 p.p.**. A média anterior de aproximadamente +0,30 p.p. não deve ser mantida.

Nos três segundos turnos concluídos, a média permanece em aproximadamente +0,53 p.p. Entretanto, são três eleições e os erros observados não bastam para estabelecer uma correção permanente. Nos primeiros turnos, há mudanças de sinal e dispersão muito maior.


### O primeiro turno de 2026


O Datafolha subestimou Lula em 0,16 p.p. e Flávio em 5,03 p.p. A margem Lula menos Flávio ficou 4,87 p.p. acima da margem oficial. Essa decomposição mostra por que é inadequado atribuir todo o erro à superestimação de Lula.

Já o desvio relativo contemporâneo é outro objeto: aproximadamente +0,63 p.p. para Lula e -1,69 p.p. para Flávio na amostra de seis rodadas comparáveis. A diferença de cerca de 2,32 p.p. entre esses efeitos não coincide com o erro de margem diante das urnas. Os demais institutos também podem errar, e a preferência pode mudar entre pesquisa e votação.


---



## 6. Datafolha: efeitos contemporâneos


| Disputa | Candidato | Rodadas | Efeito e intervalo aproximado de 95% |

| --- | --- | --- | --- |

| 2014 / 1º | Dilma | 8 | -1,90 [-2,67; -1,12] |

| 2014 / 2º | Dilma | 6 | -0,33 [-2,05; +1,39] |

| 2018 / 1º | Haddad | 6 | -2,95 [-5,49; -0,40] |

| 2018 / 2º | Haddad | 4 | +1,11 [-2,53; +4,76] |

| 2022 / 1º | Lula | 7 | +3,75 [+2,85; +4,64] |

| 2022 / 2º | Lula | 5 | +1,17 [+0,45; +1,88] |

| 2026 / 1º | Lula | 6 | +0,63 [-0,60; +1,87] |

| 2026 / 2º | Lula | 3 | -0,16 [-1,09; +0,77] |



Os intervalos apresentados usam escores agrupados por semana e quantis t, mantendo largura pelo menos igual à aproximação do módulo original. São condicionais à referência e à extração dos dados; não constituem intervalos calibrados de votação ou de erro comum entre institutos.


### Interpretação


O padrão não é estável: o Datafolha ficou abaixo da referência para Dilma em 2014 e Haddad no primeiro turno de 2018; acima da referência para Lula em 2022; e próximo da referência em 2026. O sinal positivo em 2022 não pode ser transferido automaticamente para a eleição seguinte.

No segundo turno de 2026, o efeito para Lula é -0,16 p.p.; para Flávio, +0,16 p.p. Com apenas três rodadas, a regularização e os intervalos são particularmente dependentes da especificação. A estimativa atual não valida desconto fixo de 0,53, 1,10 ou 2,90 pontos em Lula.

Os valores descrevem diferenças de mensuração em relação a uma referência estatística. Eles não identificam intenção política, manipulação, preferência partidária da empresa ou a causa dos erros. A literatura de erro total de pesquisa distingue esses componentes do erro compartilhado numa eleição [L1, L2].


### Decisão recomendada


**Manter M2 como ferramenta diagnóstica experimental.** Não o ativar automaticamente como correção de produção com base neste teste. A nova definição conceitual é mais adequada, mas a implementação disponível ainda não demonstrou melhoria preditiva consistente.


---



## 7. Sensibilidades e limites da inferência


| Hipótese de teste | M0: MAE / RMSE | M1: MAE / RMSE | M2: MAE / RMSE |

| --- | --- | --- | --- |

| Divulgação = fim do campo | 2,59 / 3,90 | 2,58 / 3,93 | 2,79 / 3,90 |

| Fim do campo + 1 dia | 2,67 / 3,92 | 2,63 / 3,95 | 2,83 / 3,93 |

| Fim do campo + 3 dias | 2,77 / 4,13 | 2,85 / 4,20 | 2,83 / 4,09 |

| Fim do campo + 7 dias | 3,05 / 4,36 | 3,05 / 4,40 | 2,96 / 4,08 |

| Somente datas documentadas | 3,00 / 4,31 | 3,02 / 4,34 | 3,04 / 4,30 |

| Peso total igual por instituto | 3,01 / 4,12 | 3,04 / 4,17 | 3,03 / 4,15 |



Variações de janela de comparação de 3 a 14 dias e de desvio do prior de 1 a 3 p.p. também foram executadas e estão nos arquivos de resultados. São análises de sensibilidade; não foram usadas para escolher retrospectivamente a configuração vencedora.

**1. Publicação e fonte:** datas incompletas, compilações retrospectivas e valores arredondados impedem certificar uma base exatamente como era conhecida em todos os momentos. O snapshot é atual; não há arquivo histórico completo de cada divulgação.

**2. Comparabilidade:** não há controle completo de modo de coleta, ordem dos nomes, critérios de eleitor provável, ponderações amostrais ou redação da pergunta. Essas características podem explicar diferenças atribuídas ao instituto.

**3. Dependência:** rodadas do mesmo instituto e referências com janelas sobrepostas compartilham informação. Agrupar por semana reduz parte do problema, mas não elimina a dependência nem incorpora toda a incerteza dos comparadores.

**4. Poucas eleições:** sete turnos concluídos, em quatro eleições, oferecem baixo poder para estimar estabilidade. Nenhuma medida permite declarar um viés partidário permanente. A cobertura de intervalos de votação do agregado não foi avaliada: o módulo entrega intervalos de efeito relativo, que são um objeto diferente.

**5. Próximo requisito de adoção:** recuperar a implementação efetiva v3.0 do Sites e datas originais de divulgação; congelar parâmetros antes de novas avaliações; estimar tendência e efeitos por candidato conjuntamente; avaliar erro comum, cobertura e estabilidade em eleições retidas. O trabalho executado oferece um diagnóstico reproduzível, mas não completa essa certificação.


---



## Apêndice: institutos em 2014



### 1º turno: Dilma e Aécio


| Instituto | N | Dilma: efeito [95%] | Aécio: efeito [95%] |

| --- | --- | --- | --- |

| CNT/MDA | 5 | -0,01 [-1,40; +1,37] | +0,34 [-1,11; +1,79] |

| Datafolha | 8 | -1,90 [-2,67; -1,12] | -1,13 [-1,61; -0,65] |

| Ibope | 8 | -0,49 [-1,72; +0,74] | +0,70 [-0,60; +2,00] |

| Vox Populi | 6 | +2,54 [+0,67; +4,40] | -0,15 [-1,05; +0,75] |




### 2º turno: Dilma e Aécio


| Instituto | N | Dilma: efeito [95%] | Aécio: efeito [95%] |

| --- | --- | --- | --- |

| CNT/MDA | 2 | insuficiente | insuficiente |

| Datafolha | 6 | -0,33 [-2,05; +1,39] | +0,33 [-1,39; +2,05] |

| Ibope | 4 | +0,42 [-3,68; +4,52] | -0,42 [-4,52; +3,68] |

| Vox Populi | 3 | +0,93 [-1,46; +3,32] | -0,93 [-3,32; +1,46] |



N é o número de datas de campo distintas com pelo menos dois institutos comparadores, disponíveis até o corte. Insuficiente: menos de três rodadas. Intervalo indisponível: menos de três semanas agrupadas; a estimativa pontual pode existir, mas não se apresenta aqui uma precisão não sustentada. Efeitos em p.p.

O CSV inclui também os candidatos adicionais, os intervalos condicionais originais, as datas de corte e a indicação de insuficiência. A tabela não é ranking de qualidade e não mede viés político.


---



## Apêndice: institutos em 2018



### 1º turno: Haddad e Bolsonaro


| Instituto | N | Haddad: efeito [95%] | Bolsonaro: efeito [95%] |

| --- | --- | --- | --- |

| Brasilis | 2 | insuficiente | insuficiente |

| CNT/MDA | 2 | insuficiente | insuficiente |

| Datafolha | 6 | -2,95 [-5,49; -0,40] | -0,62 [-4,44; +3,20] |

| FSB | 3 | -1,01 [-5,09; +3,08] | +1,18 [-2,97; +5,34] |

| Ibope | 5 | -0,26 [-2,48; +1,95] | -0,20 [-4,34; +3,95] |

| Ipespe | 3 | -2,39 [-3,83; -0,94] | +0,53 [-3,67; +4,73] |

| Movimento Parlamentarista Brasileiro/Amostra | 1 | insuficiente | insuficiente |

| Paraná Pesquisas | 2 | insuficiente | insuficiente |

| PoderData | 2 | insuficiente | insuficiente |

| Real Time Big Data | 2 | insuficiente | insuficiente |

| Sensus | 1 | insuficiente | insuficiente |




### 2º turno: Haddad e Bolsonaro


| Instituto | N | Haddad: efeito [95%] | Bolsonaro: efeito [95%] |

| --- | --- | --- | --- |

| CNT/MDA | 1 | insuficiente | insuficiente |

| Datafolha | 4 | +1,11 [-2,53; +4,76] | -1,11 [-4,76; +2,53] |

| FSB | 2 | insuficiente | insuficiente |

| Ibope | 2 | insuficiente | insuficiente |

| Ideia | 1 | insuficiente | insuficiente |

| Ipespe | 3 | +0,10 [-0,91; +1,11] | -0,10 [-1,11; +0,91] |

| Paraná Pesquisas | 2 | insuficiente | insuficiente |

| PoderData | 1 | insuficiente | insuficiente |

| Real Time Big Data | 4 | +0,05 [-2,71; +2,81] | -0,05 [-2,81; +2,71] |

| Vox Populi | 2 | insuficiente | insuficiente |



N é o número de datas de campo distintas com pelo menos dois institutos comparadores, disponíveis até o corte. Insuficiente: menos de três rodadas. Intervalo indisponível: menos de três semanas agrupadas; a estimativa pontual pode existir, mas não se apresenta aqui uma precisão não sustentada. Efeitos em p.p.

O CSV inclui também os candidatos adicionais, os intervalos condicionais originais, as datas de corte e a indicação de insuficiência. A tabela não é ranking de qualidade e não mede viés político.


---



## Apêndice: institutos em 2022



### 1º turno: Lula e Bolsonaro


| Instituto | N | Lula: efeito [95%] | Bolsonaro: efeito [95%] |

| --- | --- | --- | --- |

| AtlasIntel | 4 | +2,71 [+0,75; +4,67] | +0,19 [-1,91; +2,29] |

| Brasmarket | 4 | -8,06 [-10,87; -5,25] | +11,07 [+10,26; +11,88] |

| CNT/MDA | 2 | insuficiente | insuficiente |

| Datafolha | 7 | +3,75 [+2,85; +4,64] | -4,97 [-6,02; -3,91] |

| Equilíbrio Brasil | 1 | insuficiente | insuficiente |

| FSB | 6 | +0,31 [-1,03; +1,64] | -2,65 [-3,60; -1,70] |

| Futura | 5 | -4,75 [-6,30; -3,20] | +2,92 [+0,67; +5,17] |

| Gerp | 1 | insuficiente | insuficiente |

| Ideia | 2 | insuficiente | insuficiente |

| Ipec | 5 | +5,77 [+4,81; +6,72] | -4,97 [-6,64; -3,31] |

| Ipespe | 5 | +1,56 [+0,11; +3,01] | -2,71 [-3,50; -1,91] |

| Paraná Pesquisas | 6 | -0,25 [-0,90; +0,40] | +0,99 [+0,20; +1,78] |

| PoderData | 5 | +0,53 [-0,21; +1,26] | -1,41 [-2,18; -0,64] |

| Quaest | 5 | +3,23 [+2,16; +4,30] | -2,67 [-4,13; -1,20] |

| Veritá | 4 | -2,12 [-4,37; +0,12] | +4,90 [+3,14; +6,66] |




---



## Apêndice: institutos em 2022 (continuação)



### 2º turno: Lula e Bolsonaro


| Instituto | N | Lula: efeito [95%] | Bolsonaro: efeito [95%] |

| --- | --- | --- | --- |

| AtlasIntel | 3 | +1,54 [intervalo indisponível] | -1,54 [intervalo indisponível] |

| Brasmarket | 3 | -4,27 [intervalo indisponível] | +4,27 [intervalo indisponível] |

| CNT/MDA | 1 | insuficiente | insuficiente |

| Datafolha | 5 | +1,17 [+0,45; +1,88] | -1,17 [-1,88; -0,45] |

| Futura | 4 | -1,44 [-2,02; -0,87] | +1,44 [+0,87; +2,02] |

| Gerp | 2 | insuficiente | insuficiente |

| IFP | 1 | insuficiente | insuficiente |

| Ideia | 1 | insuficiente | insuficiente |

| Ipec | 4 | +2,50 [+1,54; +3,46] | -2,50 [-3,46; -1,54] |

| Ipespe | 4 | +1,94 [+0,62; +3,26] | -1,94 [-3,26; -0,62] |

| Paraná Pesquisas | 3 | -0,24 [intervalo indisponível] | +0,24 [intervalo indisponível] |

| PoderData | 4 | +0,68 [-0,94; +2,30] | -0,68 [-2,30; +0,94] |

| Quaest | 4 | +2,14 [+1,11; +3,16] | -2,14 [-3,16; -1,11] |

| Veritá | 3 | -2,68 [-3,24; -2,12] | +2,68 [+2,12; +3,24] |



N é o número de datas de campo distintas com pelo menos dois institutos comparadores, disponíveis até o corte. Insuficiente: menos de três rodadas. Intervalo indisponível: menos de três semanas agrupadas; a estimativa pontual pode existir, mas não se apresenta aqui uma precisão não sustentada. Efeitos em p.p.

O CSV inclui também os candidatos adicionais, os intervalos condicionais originais, as datas de corte e a indicação de insuficiência. A tabela não é ranking de qualidade e não mede viés político.


---



## Apêndice: institutos em 2026



### 1º turno: Lula e Flávio


| Instituto | N | Lula: efeito [95%] | Flávio: efeito [95%] |

| --- | --- | --- | --- |

| American Analytics | 1 | insuficiente | insuficiente |

| AtlasIntel | 3 | +2,43 [+0,53; +4,33] | +0,89 [-2,95; +4,74] |

| DataTrends | 1 | insuficiente | insuficiente |

| Datafolha | 6 | +0,63 [-0,60; +1,87] | -1,69 [-2,63; -0,74] |

| Futura | 4 | -1,46 [intervalo indisponível] | +0,14 [intervalo indisponível] |

| Gerp | 3 | -2,64 [-4,03; -1,25] | +2,84 [+1,13; +4,54] |

| Ideia | 2 | insuficiente | insuficiente |

| Indexa | 2 | insuficiente | insuficiente |

| Nexus | 3 | +0,61 [-2,51; +3,74] | -1,96 [-4,62; +0,69] |

| Palver | 3 | -0,31 [-2,85; +2,24] | +2,75 [-0,54; +6,03] |

| PoderData | 3 | -1,68 [-5,26; +1,90] | -1,32 [-4,24; +1,60] |

| Quaest | 5 | +1,65 [+0,42; +2,87] | -1,78 [-3,77; +0,21] |

| Veritá | 3 | -0,69 [-3,88; +2,50] | +2,81 [-0,72; +6,35] |

| Vox Brasil | 2 | insuficiente | insuficiente |



N é o número de datas de campo distintas com pelo menos dois institutos comparadores, disponíveis até o corte. Insuficiente: menos de três rodadas. Intervalo indisponível: menos de três semanas agrupadas; a estimativa pontual pode existir, mas não se apresenta aqui uma precisão não sustentada. Efeitos em p.p.

O CSV inclui também os candidatos adicionais, os intervalos condicionais originais, as datas de corte e a indicação de insuficiência. A tabela não é ranking de qualidade e não mede viés político.


---



## Apêndice: institutos em 2026



### 2º turno: Lula e Flávio


| Instituto | N | Lula: efeito [95%] | Flávio: efeito [95%] |

| --- | --- | --- | --- |

| Alfa Inteligência | 1 | insuficiente | insuficiente |

| AtlasIntel | 1 | insuficiente | insuficiente |

| CNT/MDA | 1 | insuficiente | insuficiente |

| DataTrends | 2 | insuficiente | insuficiente |

| Datafolha | 3 | -0,16 [-1,09; +0,77] | +0,16 [-0,77; +1,09] |

| Futura | 4 | -0,10 [-1,19; +1,00] | +0,10 [-1,00; +1,19] |

| Gerp | 4 | -2,24 [intervalo indisponível] | +2,24 [intervalo indisponível] |

| IFP | 1 | insuficiente | insuficiente |

| Ideia | 1 | insuficiente | insuficiente |

| Indexa | 2 | insuficiente | insuficiente |

| Ipespe | 2 | insuficiente | insuficiente |

| Nexus | 2 | insuficiente | insuficiente |

| Palver | 2 | insuficiente | insuficiente |

| Phoenix | 1 | insuficiente | insuficiente |

| PoderData | 5 | -0,32 [-1,07; +0,43] | +0,32 [-0,43; +1,07] |

| Quaest | 1 | insuficiente | insuficiente |

| Ranking | 1 | insuficiente | insuficiente |

| Real Time Big Data | 1 | insuficiente | insuficiente |

| Veritá | 2 | insuficiente | insuficiente |

| Vox Brasil | 2 | insuficiente | insuficiente |



N é o número de datas de campo distintas com pelo menos dois institutos comparadores, disponíveis até o corte. Insuficiente: menos de três rodadas. Intervalo indisponível: menos de três semanas agrupadas; a estimativa pontual pode existir, mas não se apresenta aqui uma precisão não sustentada. Efeitos em p.p.

O CSV inclui também os candidatos adicionais, os intervalos condicionais originais, as datas de corte e a indicação de insuficiência. A tabela não é ranking de qualidade e não mede viés político.


---



## Fontes, arquivos e reprodução


Repositório: tuka1965-glitch/agregador-eleitoral. Branch de referência: experiment/house-effect-contemporaneo. Commit de entrada: 043d4e670d93e0ed4dcbdcfd376d11867160757d. O estimador experimental original foi preservado; o teste acrescenta uma camada isolada de preparação e avaliação.

[R1] <link href="https://www.tse.jus.br/comunicacao/noticias/2018/Outubro/concluida-totalizacao-de-votos-do-1o-turno-das-eleicoes-2018" color="#217C87">TSE: resultado do primeiro turno de 2018</link>

[R2] <link href="https://www.tse.jus.br/comunicacao/noticias/2018/Outubro/eleicoes-2018-justica-eleitoral-conclui-totalizacao-dos-votos-do-segundo-turno" color="#217C87">TSE: totalização do segundo turno de 2018</link>

[R3] <link href="https://www.tre-mg.jus.br/eleicoes/eleicoes-2018/informacoes-para-imprensa-2o-turno/resultados-eleicoes-anteriores-2013-presidente" color="#217C87">TRE-MG: resultados presidenciais de 2014</link>

[R4] <link href="https://www.tse.jus.br/comunicacao/noticias/2021/Julho/fato-ou-boato-e-falsa-a-planilha-que-mostra-inversoes-entre-aecio-neves-e-dilma-rousseff-no-2o-turno-de-2014" color="#217C87">TSE: votos de Dilma e Aécio no segundo turno de 2014</link>

[R5] <link href="https://www.tse.jus.br/comunicacao/noticias/2022/Outubro/100-das-secoes-totalizadas-confira-como-ficou-o-quadro-eleitoral-apos-o-1o-turno" color="#217C87">TSE: resultado do primeiro turno de 2022</link>

[R6] <link href="https://www.tse.jus.br/comunicacao/noticias/2022/Outubro/100-das-secoes-totalizadas-confira-como-ficou-o-quadro-eleitoral-apos-o-2o-turno" color="#217C87">TSE: resultado do segundo turno de 2022</link>

[R7] <link href="https://www.tse.jus.br/comunicacao/noticias/2026/Outubro/flavio-bolsonaro-e-lula-vao-disputar-o-2o-turno-para-a-presidencia-da-republica" color="#217C87">TSE: Flávio e Lula no segundo turno de 2026</link>

[D1] <link href="https://datafolha.folha.uol.com.br/eleicoes/2014/10/1527380-dilma-lidera-com-44-aecio-26-e-marina-24-empatam-por-2-turno.shtml" color="#217C87">Datafolha: último primeiro turno de 2014 (44%, 26%, 24%)</link>

[D2] <link href="https://www1.folha.uol.com.br/poder/2018/10/bolsonaro-alcanca-40-dos-votos-validos-no-datafolha-haddad-tem-25-e-ciro-15.shtml" color="#217C87">Datafolha/Folha: primeiro turno de 2018 (40%, 25%)</link>

[D3] <link href="https://datafolha.folha.uol.com.br/eleicoes/2022/10/na-vespera-da-eleicao-lula-tem-50-e-bolsonaro-36.shtml" color="#217C87">Datafolha: primeiro turno de 2022 (50%, 36%)</link>

[D4] <link href="https://datafolha.folha.uol.com.br/eleicoes/2026/10/na-vespera-da-eleicao-lula-tem-45-dos-validos-no-1o-turno-empatado-com-flavio-bolsonaro-42.shtml" color="#217C87">Datafolha: primeiro turno de 2026 (45%, 42%)</link>

[L1] <link href="https://sites.stat.columbia.edu/gelman/research/published/polling-errors.pdf" color="#217C87">Shirani-Mehr et al. (2018). Disentangling Bias and Variance in Election Polls. JASA 113(522):607-614. DOI: 10.1080/01621459.2018.1448823</link>

[L2] <link href="https://arxiv.org/abs/1703.09430" color="#217C87">Bon, Ballard e Baffour (2019). Polling bias and undecided voter allocations.</link>


### Arquivos reproduzíveis


experiments/build_real_dataset.py: extração, harmonização, exclusões e correções documentadas.<br/>experiments/run_real_audit.mjs: execução do estimador, previsões e controles com pesquisas reais.<br/>experiments/summarize_real_audit.py: intervalos agrupados e tabelas.<br/>experiments/real_data/: observações e resultados oficiais.<br/>experiments/real_results/: estimativas, erros, métricas e CSVs.

Execução, na raiz do repositório: python3 experiments/build_real_dataset.py; node experiments/run_real_audit.mjs; python3 experiments/summarize_real_audit.py. Dependências de análise: Python, lxml, numpy, scipy e Node.js. A geração do PDF também utiliza reportlab e fontes DejaVu. O arquivo input_checksums.json identifica os bytes utilizados.

As páginas de pesquisas da Wikipédia e seus excertos recuperados são fontes de compilação, não comprovação primária de cada registro. As URLs e os localizadores de linha/tabela preservam a trilha de conferência. As tabelas e os cálculos deste relatório são elaboração desta auditoria, a partir das observações documentadas.
