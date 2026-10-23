"""Produce a source-linked analytical report from the executed real-data audit."""
import pathlib,json,collections,math,html as H
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table,TableStyle,PageBreak,KeepTogether
from reportlab.lib.styles import getSampleStyleSheet,ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_LEFT

ROOT=pathlib.Path(__file__).resolve().parents[1];R=ROOT/'experiments/real_results'
DEST=ROOT.parent/'output/pdf';DEST.mkdir(parents=True,exist_ok=True)
load=lambda n:json.loads((R/n).read_text())
effects=load('effects_with_uncertainty.json');forecasts=load('forecasts.json');summary=load('summary.json');sens=load('sensitivity.json');paired=load('paired_comparison.json');last=load('datafolha_last_poll.json')
ps=json.loads((ROOT/'experiments/real_data/polls.json').read_text());truth=json.loads((ROOT/'experiments/real_data/tse_results.json').read_text())
FONT='/usr/share/fonts/truetype/dejavu/'
for name,file in [('DV','DejaVuSans.ttf'),('DVB','DejaVuSans-Bold.ttf'),('DVI','DejaVuSans.ttf')]:pdfmetrics.registerFont(TTFont(name,FONT+file))
pdfmetrics.registerFontFamily('DV',normal='DV',bold='DVB',italic='DVI',boldItalic='DVB')
navy=colors.HexColor('#142B45');teal=colors.HexColor('#217C87');gray=colors.HexColor('#526170');light=colors.HexColor('#EFF4F7')
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='BodyPT',fontName='DV',fontSize=9.3,leading=14,textColor=navy,spaceAfter=8))
styles.add(ParagraphStyle(name='SmallPT',fontName='DV',fontSize=7.6,leading=10.7,textColor=gray,spaceAfter=6))
styles.add(ParagraphStyle(name='TablePT',fontName='DV',fontSize=8,leading=11,textColor=navy))
styles.add(ParagraphStyle(name='HeadPT',fontName='DVB',fontSize=18,leading=23,textColor=navy,spaceAfter=14))
styles.add(ParagraphStyle(name='SubPT',fontName='DVB',fontSize=11,leading=15,textColor=teal,spaceBefore=10,spaceAfter=7))
styles.add(ParagraphStyle(name='TitlePT',fontName='DVB',fontSize=28,leading=33,textColor=navy,spaceAfter=12))
story=[];md=[]
def fmt(x,n=2):return ('-' if x is None else f'{x:.{n}f}'.replace('.',','))
def signed(x):return '-' if x is None else ('+' if x>=0 else '')+fmt(x)
def P(t,kind='BodyPT'):return Paragraph(t,styles[kind])
def para(t,kind='BodyPT'):
    story.append(P(t,kind));md.append(t.replace('<b>','**').replace('</b>','**'))
def title(t):story.append(P(t,'HeadPT'));md.append('\n## '+t+'\n')
def sub(t):story.append(P(t,'SubPT'));md.append('\n### '+t+'\n')
def page():story.append(PageBreak());md.append('\n---\n')
def table(headers,rows,widths=None,small=False):
    k='SmallPT' if small else 'TablePT'
    white=ParagraphStyle(name='WhiteHeader',parent=styles[k],textColor=colors.white,fontName='DVB')
    data=[[Paragraph(H.escape(str(v)),white) for v in headers]]+[[P(H.escape(str(v)),k) for v in row] for row in rows]
    t=Table(data,colWidths=widths,repeatRows=1,hAlign='LEFT')
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),navy),('TEXTCOLOR',(0,0),(-1,0),colors.white),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,light]),('LINEBELOW',(0,0),(-1,0),.6,navy)]))
    story.append(t);story.append(Spacer(1,9));md.append('| '+' | '.join(headers)+' |');md.append('| '+' | '.join('---' for _ in headers)+' |')
    md.extend('| '+' | '.join(str(v) for v in row)+' |' for row in rows);md.append('')
def ci(e):
    if not e or e['effect'] is None:return 'insuficiente'
    c=e['weekly_ci95']
    return signed(e['effect'])+(f' [{signed(c[0])}; {signed(c[1])}]' if c else ' [intervalo indisponível]')
def modelrow(m,years=4,h=1):return next(x for x in summary if x['model']==m and len(x['years'])==years and x['horizon']==h)

para('AGREGADOR PRESIDENCIAL  |  AUDITORIA METODOLÓGICA','SmallPT')
story.append(P('Efeitos de instituto<br/>e precisão eleitoral','TitlePT'))
para('Pesquisas observadas de 2014, 2018, 2022 e 2026<br/><b>Data de referência: 23 de outubro de 2026</b>')
sub('Resultado principal')
para('O estimador contemporâneo foi executado com dados reais. Nesta reconstrução, sua substituição pela regra antiga <b>não apresentou ganho consistente de precisão</b>. A evidência não sustenta sua adoção imediata na aplicação publicada.')
table(['Modelo comparado','MAE (p.p.)','RMSE (p.p.)'],[[m+' - '+{'M0':'sem efeito de instituto','M1':'regra antiga de 60%','M2':'estimador contemporâneo'}[m],fmt(modelrow(m)['mae']),fmt(modelrow(m)['rmse'])] for m in ['M0','M1','M2']],[323,85,85])
para('Avaliação na véspera de sete disputas concluídas, considerando os dois finalistas de cada uma. Os primeiros turnos mantêm a participação nos votos válidos de todos os candidatos. O segundo turno de 2026 não entra no cálculo, pois ainda não ocorreu.','SmallPT')
sub('O que a análise permite concluir sobre o Datafolha')
para('No segundo turno de 2026, o desvio regularizado em relação aos demais institutos é de <b>-0,16 p.p. para Lula</b>, com intervalo aproximado de 95% de <b>-1,09 a +0,77 p.p.</b>, em três rodadas. A estimativa é compatível com zero e não oferece fundamento para um desconto fixo pró-Lula.')
para('O sinal do efeito muda entre eleições e turnos. O erro eleitoral e o efeito relativo não são equivalentes: um instituto pode estar próximo dos concorrentes e todos se afastarem do resultado das urnas.')
sub('Alcance desta entrega')
para('Foram reunidos 299 levantamentos, executadas 66 combinações de modelo e corte temporal e produzidas tabelas de efeitos, intervalos, MAE e RMSE. Não foram utilizados levantamentos sintéticos. A versão pública e a branch main não foram alteradas.')
para('<b>Ressalva de reprodução:</b> M1 representa a regra de house effect localizada no código da branch, sob uma base comum de agregação. Este relatório não certifica reprodução integral da v3.0 do Sites. A cronologia de divulgação não está integralmente documentada; esse limite é quantificado e testado adiante.','SmallPT')

page();title('1. Base empírica e controle de qualidade')
counts=collections.Counter((p['election'],p['round']) for p in ps)
rows=[]
for y in [2014,2018,2022,2026]:
 for r in [1,2]:
  xs=[p for p in ps if p['election']==y and p['round']==r];rows.append([f'{y} - {r}º turno',len(xs),len(set(p['pollster'] for p in xs)),min(p['field_start'] for p in xs),max(p['field_end'] for p in xs)])
table(['Eleição / turno','Pesquisas','Institutos','Início do campo','Fim do campo'],rows,[138,65,65,112,113])
para('Os quantitativos descrevem a base recuperada, não o universo completo de todas as pesquisas eleitorais. As janelas iniciais foram limitadas a regimes comparáveis de candidaturas: após a entrada de Marina em 2014, após a definição de Haddad em 2018, durante a campanha formal em 2022 e setembro de 2026. Para os segundos turnos, foram admitidas somente pesquisas cujo campo começou depois da votação do primeiro turno.')
sub('Procedência')
para('O snapshot de 2026 veio do repositório indicado, coletado em 23/10/2026 às 05:01 UTC. As tabelas históricas foram recuperadas das páginas de pesquisas referenciadas pelos scripts do próprio repositório. Trata-se de uma compilação secundária, complementada por verificações primárias do Datafolha/Folha e referências eleitorais do TSE e TRE-MG. Não houve recertificação individual de todos os relatórios originais.')
sub('Tratamento dos registros')
para('Nomes de institutos foram harmonizados, mantendo Ibope e Ipec separados. Rodadas repetidas não foram contadas como novas amostras. Cenários adicionais da mesma rodada não acrescentaram observações independentes. Foram registrados 21 eventos de qualidade: quatro incompatibilidades de totais, uma duplicata Datafolha com amostra conflitante, dez registros com valores censurados, dois cenários incompletos e quatro cenários alternativos da mesma rodada.')
para('Percentuais como &lt;1% não receberam valores inventados. A rotina conservadora excluiu esses registros. Na presença de percentuais válidos publicados e conferidos, estes tiveram precedência sobre proporções calculadas de totais arredondados. As escolhas residuais foram reunidas em Outros por fechamento contábil, sem gerar entrevistas ou novas pesquisas.')
para('O arquivo Quaest anexado é identificado na capa como <b>17ª rodada, setembro de 2025</b>, com campo de 12 a 14/09 e 2.004 entrevistas. Apesar do nome do arquivo, não corresponde à campanha de setembro de 2026 e não foi incorporado.')

page();title('2. Comparação dos estimadores')
table(['Modelo','Definição operacional executada'],[
 ['M0','Sem ajuste ou reponderação por house effect.'],
 ['M1','Funções antigas extraídas do app.js: referência das dez pesquisas anteriores, candidato líder da referência, efeito médio por instituto; correção de 60% e reponderação associada.'],
 ['M2','Módulo experimental original: referência contemporânea dos demais institutos em ±7 dias, contribuição igual por instituto comparador, mínimo de dois comparadores e três rodadas, regularização centrada em zero.']],[54,439])
para('<b>Definição de sinal:</b> efeito positivo significa percentual maior para o candidato do que na referência contemporânea. O ajuste experimental subtrai esse efeito da pesquisa. O efeito é específico de candidato, eleição, turno e cenário.')
sub('Base comum de agregação')
para('Para isolar o componente em estudo, os três modelos usam a mesma base limpa e o mesmo conjunto de cortes. A rotina segue o esqueleto do app da branch: janela e meia-vida de 21 dias, prior empírico de peso 2.500, reforço de peso 2 para as cinco pesquisas mais recentes e meia-vida de 7 dias quando a mudança entre grupos recentes atinge 3 p.p. As estimativas finais são fechadas em 100% sobre o conjunto de candidatos e Outros.')
para('Os ratings atuais dos institutos foram neutralizados em todos os modelos: não há snapshots dos ratings disponíveis antes de cada eleição, e usar os valores atuais retroativamente poderia introduzir informação futura. Em 2014, os pesos por amostra foram uniformizados em 1.000 para toda a eleição, pois a tabela histórica não informa a maioria dos tamanhos amostrais. Em outros anos, preservou-se n quando disponível. Margens ausentes não foram inventadas.')
sub('O que o código experimental ainda não faz')
para('O módulo existente é uma média de desvios contemporâneos com regularização normal. Ele <b>não estima conjuntamente uma tendência latente e efeitos hierárquicos de todas as eleições</b>. A janela temporal reduz a defasagem da referência, mas não controla explicitamente a inclinação da tendência dentro da janela. Portanto, não equivale ainda ao modelo hierárquico completo proposto na discussão anterior.')
para('A referência contém todos os institutos elegíveis, sem excluir divergências a posteriori por orientação dos resultados. Sua composição pode influenciar bastante o efeito relativo; uma média dos demais institutos não estabelece a verdade eleitoral.')

page();title('3. Validação temporal e disponibilidade')
para('Cada previsão foi reconstruída nos cortes D-1, D-7 e D-14. O estimador recebeu somente pesquisas da eleição correspondente, com fim de campo e disponibilidade não posteriores ao corte. As pesquisas do segundo turno não foram utilizadas para prever o primeiro. O módulo nunca recebeu resultados das urnas para estimar efeitos ou escolher parâmetros.')
para('A comparação usou os parâmetros originais do experimento, sem seleção do melhor prior ou janela a partir das urnas. Não houve treinamento supervisionado multi-eleições. A separação das eleições é uma avaliação de regra fixa com resultados retidos para pontuação; não deve ser descrita como um modelo hierárquico treinado por leave-one-election-out nem como validação prospectiva cega.')
table(['Evidência de disponibilidade','Registros'],[[k, n] for k,n in collections.Counter(p['availability_basis'] for p in ps).items()],[408,85])
para('Os rótulos em inglês são preservados para correspondência exata com a base. Em <b>239 dos 299 registros</b>, a data de divulgação não foi certificada: empregou-se o fim do campo mais dois dias como aproximação conservadora. Os demais têm data extraída da bibliografia, de URL datada ou confirmação específica. Essas evidências possuem níveis distintos de verificação.')
para('<b>Consequência:</b> os cálculos impedem uso de campo futuro e de resultados eleitorais na estimação, mas não permitem certificar ausência absoluta de vazamento por horário/data de publicação em toda a base. O resultado é um backtest reconstruído, condicionado às datas de disponibilidade informadas. A limitação não deve ser omitida ao divulgar os números.')
sub('Controles efetivamente executados')
para('A exclusão de todos os registros futuros preservou exatamente as 66 previsões. Houve verificações de unicidade de rodadas, ordem das datas, integridade das fontes, corte antes do pleito e ausência de métricas de urnas para o segundo turno de 2026. Todos os controles passaram com observações reais. A contagem de verificações é uma checagem operacional e não comprova validade estatística.')
para('As sensibilidades repetem os cálculos com atrasos de 0, 1, 3 e 7 dias e com o subconjunto que tem alguma evidência de data de divulgação. No subconjunto restrito, vários institutos desaparecem e o mínimo de comparadores deixa de ser atendido; seus resultados não substituem uma auditoria completa dos horários de publicação.')

page();title('4. MAE e RMSE contra as urnas')
rows=[]
for kr,tr in truth.items():
 if not tr['values']:continue
 y,r=map(int,kr.split('-'));ff=[next(f for f in forecasts if f['year']==y and f['round']==r and f['horizon']==1 and f['model']==m) for m in ['M0','M1','M2']]
 rows.append([f'{y} / {r}º',ff[0]['polls']]+[fmt(f['metrics']['mae'])+' / '+fmt(f['metrics']['rmse']) for f in ff])
table(['Disputa','N no corte','M0: MAE / RMSE','M1: MAE / RMSE','M2: MAE / RMSE'],rows,[78,62,118,118,117])
para('Unidade: pontos percentuais. Cada disputa inclui os dois finalistas. MAE = média dos erros absolutos; RMSE = raiz da média dos erros quadráticos. No segundo turno, os erros dos candidatos são complementares: as duas linhas não constituem observações independentes. O erro de 2026 usa os percentuais oficiais publicados pelo TSE com 99,99% das urnas.','SmallPT')
sub('Resultado agregado por horizonte')
table(['Corte','Modelo','MAE','RMSE'],[[f'D-{h}',m,fmt(modelrow(m,h=h)['mae']),fmt(modelrow(m,h=h)['rmse'])] for h in [1,7,14] for m in ['M0','M1','M2']],[98,98,148,149])
para('No corte principal, M2 aumenta o MAE em <b>'+fmt(paired[0]['delta_mae'])+' p.p.</b> diante de M1. O intervalo aproximado da diferença, agrupado por eleição, vai de <b>'+signed(paired[0]['ci95_election_cluster'][0])+' a '+signed(paired[0]['ci95_election_cluster'][1])+'</b>. Com apenas quatro eleições, a incerteza é elevada; não há demonstração de superioridade nem de inferioridade estatisticamente estável.')
para('Usando somente 2014, 2018 e 2022, os MAEs são '+', '.join(m+': '+fmt(modelrow(m,years=3)['mae']) for m in ['M0','M1','M2'])+' p.p. M2 reduz um pouco o RMSE nesse recorte, mas o ganho não se mantém ao acrescentar o primeiro turno de 2026. A escolha da métrica e da amostra altera a ordenação.')

page();title('5. Datafolha: erros diante das urnas')
table(['Disputa','Candidato do PT','Pesquisa válida','Urnas','Erro PT','Erro adversário'],[[f"{d['year']} / {d['round']}º",d['candidate'],fmt(d['published']),fmt(d['official']),signed(d['error']),signed(d['opponent_error'])] for d in last],[69,108,85,73,77,81])
para('Último levantamento Datafolha de cada turno, com os percentuais válidos publicados e conferidos. Erro = pesquisa menos urnas. Adversários: Aécio em 2014, Jair Bolsonaro em 2018/2022 e Flávio Bolsonaro em 2026. Os valores não são o efeito relativo de instituto.','SmallPT')
sub('Correção da conclusão descritiva anterior')
para('A pesquisa final de 2014 registrou <b>44% para Dilma</b>, e não 45%. Seu erro assinado é de +2,41 p.p., não +3,41. Corrigido esse dado, a média assinada das sete observações para candidatos do PT é de <b>+0,16 p.p.</b>. A média anterior de aproximadamente +0,30 p.p. não deve ser mantida.')
para('Nos três segundos turnos concluídos, a média permanece em aproximadamente +0,53 p.p. Entretanto, são três eleições e os erros observados não bastam para estabelecer uma correção permanente. Nos primeiros turnos, há mudanças de sinal e dispersão muito maior.')
sub('O primeiro turno de 2026')
para('O Datafolha subestimou Lula em 0,16 p.p. e Flávio em 5,03 p.p. A margem Lula menos Flávio ficou 4,87 p.p. acima da margem oficial. Essa decomposição mostra por que é inadequado atribuir todo o erro à superestimação de Lula.')
para('Já o desvio relativo contemporâneo é outro objeto: aproximadamente +0,63 p.p. para Lula e -1,69 p.p. para Flávio na amostra de seis rodadas comparáveis. A diferença de cerca de 2,32 p.p. entre esses efeitos não coincide com o erro de margem diante das urnas. Os demais institutos também podem errar, e a preferência pode mudar entre pesquisa e votação.')

page();title('6. Datafolha: efeitos contemporâneos')
df=[]
for kr,tr in truth.items():
 y,r=kr.split('-');c=tr['focal'][0];e=next(e for e in effects if e['pollster']=='Datafolha' and e['election']==y and e['round']==r and e['candidate']==c);df.append(e)
table(['Disputa','Candidato','Rodadas','Efeito e intervalo aproximado de 95%'],[[e['election']+' / '+e['round']+'º',e['candidate'],e['n'],ci(e)] for e in df],[80,85,60,268])
para('Os intervalos apresentados usam escores agrupados por semana e quantis t, mantendo largura pelo menos igual à aproximação do módulo original. São condicionais à referência e à extração dos dados; não constituem intervalos calibrados de votação ou de erro comum entre institutos.','SmallPT')
sub('Interpretação')
para('O padrão não é estável: o Datafolha ficou abaixo da referência para Dilma em 2014 e Haddad no primeiro turno de 2018; acima da referência para Lula em 2022; e próximo da referência em 2026. O sinal positivo em 2022 não pode ser transferido automaticamente para a eleição seguinte.')
para('No segundo turno de 2026, o efeito para Lula é -0,16 p.p.; para Flávio, +0,16 p.p. Com apenas três rodadas, a regularização e os intervalos são particularmente dependentes da especificação. A estimativa atual não valida desconto fixo de 0,53, 1,10 ou 2,90 pontos em Lula.')
para('Os valores descrevem diferenças de mensuração em relação a uma referência estatística. Eles não identificam intenção política, manipulação, preferência partidária da empresa ou a causa dos erros. A literatura de erro total de pesquisa distingue esses componentes do erro compartilhado numa eleição [L1, L2].')
sub('Decisão recomendada')
para('<b>Manter M2 como ferramenta diagnóstica experimental.</b> Não o ativar automaticamente como correção de produção com base neste teste. A nova definição conceitual é mais adequada, mas a implementação disponível ainda não demonstrou melhoria preditiva consistente.')

page();title('7. Sensibilidades e limites da inferência')
rows=[]
for opt,label in [({'lag':0},'Divulgação = fim do campo'),({'lag':1},'Fim do campo + 1 dia'),({'lag':3},'Fim do campo + 3 dias'),({'lag':7},'Fim do campo + 7 dias'),({'strict':True},'Somente datas documentadas'),({'equalInstitutes':True},'Peso total igual por instituto')]:
 ss=[next(s for s in sens if s['options']==opt and s['model']==m) for m in ['M0','M1','M2']];rows.append([label]+[fmt(s['mae'])+' / '+fmt(s['rmse']) for s in ss])
table(['Hipótese de teste','M0: MAE / RMSE','M1: MAE / RMSE','M2: MAE / RMSE'],rows,[187,102,102,102])
para('Variações de janela de comparação de 3 a 14 dias e de desvio do prior de 1 a 3 p.p. também foram executadas e estão nos arquivos de resultados. São análises de sensibilidade; não foram usadas para escolher retrospectivamente a configuração vencedora.','SmallPT')
para('<b>1. Publicação e fonte:</b> datas incompletas, compilações retrospectivas e valores arredondados impedem certificar uma base exatamente como era conhecida em todos os momentos. O snapshot é atual; não há arquivo histórico completo de cada divulgação.')
para('<b>2. Comparabilidade:</b> não há controle completo de modo de coleta, ordem dos nomes, critérios de eleitor provável, ponderações amostrais ou redação da pergunta. Essas características podem explicar diferenças atribuídas ao instituto.')
para('<b>3. Dependência:</b> rodadas do mesmo instituto e referências com janelas sobrepostas compartilham informação. Agrupar por semana reduz parte do problema, mas não elimina a dependência nem incorpora toda a incerteza dos comparadores.')
para('<b>4. Poucas eleições:</b> sete turnos concluídos, em quatro eleições, oferecem baixo poder para estimar estabilidade. Nenhuma medida permite declarar um viés partidário permanente. A cobertura de intervalos de votação do agregado não foi avaliada: o módulo entrega intervalos de efeito relativo, que são um objeto diferente.')
para('<b>5. Próximo requisito de adoção:</b> recuperar a implementação efetiva v3.0 do Sites e datas originais de divulgação; congelar parâmetros antes de novas avaliações; estimar tendência e efeitos por candidato conjuntamente; avaliar erro comum, cobertura e estabilidade em eleições retidas. O trabalho executado oferece um diagnóstico reproduzível, mas não completa essa certificação.')

def appendix(y,rounds):
 page();title(f'Apêndice: institutos em {y}')
 for r in rounds:
  if y==2022 and r==2:
   page();title('Apêndice: institutos em 2022 (continuação)')
  tr=truth[f'{y}-{r}'];a,b=tr['focal'];sub(f'{r}º turno: {a} e {b}')
  es=[e for e in effects if e['election']==str(y) and e['round']==str(r) and e['candidate']==a]
  rows=[]
  for e in sorted(es,key=lambda e:e['pollster']):
   other=next((o for o in effects if o['election']==str(y) and o['round']==str(r) and o['candidate']==b and o['pollster']==e['pollster']),None)
   rows.append([e['pollster'],e['n'],ci(e),ci(other)])
  table(['Instituto','N',a+': efeito [95%]',b+': efeito [95%]'],rows,[137,28,164,164],small=True)
 para('N é o número de datas de campo distintas com pelo menos dois institutos comparadores, disponíveis até o corte. Insuficiente: menos de três rodadas. Intervalo indisponível: menos de três semanas agrupadas; a estimativa pontual pode existir, mas não se apresenta aqui uma precisão não sustentada. Efeitos em p.p.','SmallPT')
 para('O CSV inclui também os candidatos adicionais, os intervalos condicionais originais, as datas de corte e a indicação de insuficiência. A tabela não é ranking de qualidade e não mede viés político.','SmallPT')

appendix(2014,[1,2]);appendix(2018,[1,2]);appendix(2022,[1,2]);appendix(2026,[1]);appendix(2026,[2])

page();title('Fontes, arquivos e reprodução')
para('Repositório: tuka1965-glitch/agregador-eleitoral. Branch de referência: experiment/house-effect-contemporaneo. Commit de entrada: 043d4e670d93e0ed4dcbdcfd376d11867160757d. O estimador experimental original foi preservado; o teste acrescenta uma camada isolada de preparação e avaliação.')
sources=[
 ('R1','TSE: resultado do primeiro turno de 2018',truth['2018-1']['source']),('R2','TSE: totalização do segundo turno de 2018',truth['2018-2']['source']),('R3','TRE-MG: resultados presidenciais de 2014',truth['2014-1']['source']),('R4','TSE: votos de Dilma e Aécio no segundo turno de 2014',truth['2014-2']['source']),('R5','TSE: resultado do primeiro turno de 2022',truth['2022-1']['source']),('R6','TSE: resultado do segundo turno de 2022',truth['2022-2']['source']),('R7','TSE: Flávio e Lula no segundo turno de 2026',truth['2026-1']['source']),
 ('D1','Datafolha: último primeiro turno de 2014 (44%, 26%, 24%)',last[0]['source']),('D2','Datafolha/Folha: primeiro turno de 2018 (40%, 25%)',last[2]['source']),('D3','Datafolha: primeiro turno de 2022 (50%, 36%)',last[4]['source']),('D4','Datafolha: primeiro turno de 2026 (45%, 42%)',last[6]['source']),
 ('L1','Shirani-Mehr et al. (2018). Disentangling Bias and Variance in Election Polls. JASA 113(522):607-614. DOI: 10.1080/01621459.2018.1448823','https://sites.stat.columbia.edu/gelman/research/published/polling-errors.pdf'),('L2','Bon, Ballard e Baffour (2019). Polling bias and undecided voter allocations.','https://arxiv.org/abs/1703.09430')]
for code,label,url in sources:para(f'[{code}] <link href="{H.escape(url,quote=True)}" color="#217C87">{H.escape(label)}</link>','SmallPT')
sub('Arquivos reproduzíveis')
para('experiments/build_real_dataset.py: extração, harmonização, exclusões e correções documentadas.<br/>experiments/run_real_audit.mjs: execução do estimador, previsões e controles com pesquisas reais.<br/>experiments/summarize_real_audit.py: intervalos agrupados e tabelas.<br/>experiments/real_data/: observações e resultados oficiais.<br/>experiments/real_results/: estimativas, erros, métricas e CSVs.','SmallPT')
para('Execução, na raiz do repositório: python3 experiments/build_real_dataset.py; node experiments/run_real_audit.mjs; python3 experiments/summarize_real_audit.py. Dependências de análise: Python, lxml, numpy, scipy e Node.js. A geração do PDF também utiliza reportlab e fontes DejaVu. O arquivo input_checksums.json identifica os bytes utilizados.','SmallPT')
para('As páginas de pesquisas da Wikipédia e seus excertos recuperados são fontes de compilação, não comprovação primária de cada registro. As URLs e os localizadores de linha/tabela preservam a trilha de conferência. As tabelas e os cálculos deste relatório são elaboração desta auditoria, a partir das observações documentadas.','SmallPT')

def decoration(c,doc):
    w,h=doc.pagesize;c.setStrokeColor(teal);c.setLineWidth(2);c.line(50,h-35,w-50,h-35);c.setFont('DV',7.2);c.setFillColor(gray);c.drawString(50,27,'Agregador Presidencial | Auditoria experimental | 23/10/2026');c.drawRightString(w-50,27,str(doc.page))

pdf=DEST/'Auditoria_House_Effect_Agregador_2026-10-23.pdf'
doc=SimpleDocTemplate(str(pdf),pagesize=(595.28,841.89),leftMargin=51,rightMargin=51,topMargin=49,bottomMargin=49,title='Auditoria do house effect - Agregador Presidencial',author='Auditoria metodológica - Agregador Presidencial')
doc.build(story,onFirstPage=decoration,onLaterPages=decoration)
(ROOT/'experiments/REAL_DATA_AUDIT.md').write_text('\n\n'.join(md)+'\n',encoding='utf-8')
print(pdf)
