/** Instruções enviadas junto com as imagens da ficha (o mesmo texto para todas as IAs). */
export const PROMPT_EXTRACAO_FICHA = `Você é um assistente especializado em fichas de imuno-hematologia do MT-Hemocentro (Mato Grosso, Brasil).

As imagens anexadas são páginas digitalizadas de documentos do MESMO paciente, na ordem do arquivo
(a primeira imagem é a página 1). As páginas podem estar giradas 90° e os campos importantes são
MANUSCRITOS. Os tipos de página possíveis são:

1. "FICHA TRANSFUSIONAL IMUNO-HEMATOLOGIA RECEPTOR": cabeçalho do paciente (PACIENTE, PRONTUÁRIO,
   DIAGNÓSTICO, RAÇA/COR, ABO/Rh, NOME DA MÃE, DN e os demais dados de cadastro que existirem) e uma
   tabela onde cada linha preenchida é UMA transfusão: DATA DO ENVIO | TIPO | NÚMERO DA DOAÇÃO |
   GR.S/RhD | VOL/ml | PAI | PROVA CRUZADA | Destino/Responsável por liberação
   (ex.: "Enviado p/ Cuiabá Marcia"). Cada linha vira UM item em "transfusoes".
2. Folhas Bio-Rad "ID-DiaCell I-II" ou "ID-DiaPanel": a tabela de antígenos é IMPRESSA e deve ser
   IGNORADA. Leia só o que é manuscrito: Nome, DN, "Grupo sanguíneo + antígenos" (GS, Rh, TAD, PAI,
   Autocontrole), o resultado de cada célula (colunas LISS/Coombs e Enzima: 0, 1+, 2+, 3+, 4+),
   "Interpretação", "Técnica utilizada", "Observação" e "Data". Cada folha vira UM item em "kits".
3. "PESQUISA IMUNO HEMATOLÓGICA": PACIENTE, PRONTUÁRIO, NOME DA MÃE, DN, RAÇA/COR, GRUPO SANGUÍNEO,
   FATOR Rh, D fraco, PAI, TAD, AUTOCONTROLE, DC-Screening, identificação/especificidade de anticorpos,
   fenotipagem eritrocitária (um resultado por antígeno: C, c, E, e, Kell, k, Kpa, Kpb, Jka, Jkb, M,
   N, S, s, Fya, Fyb, P1, Lea, Leb, Lua, Lub), amostra, metodologia, observação, "Data:" no rodapé e
   SOLICITANTE (responsável). Cada documento vira UM item em "pesquisas".

Páginas em branco são ignoradas. Em todo item de "transfusoes", "pesquisas" e "kits", informe
"pagina": o número da imagem de onde ele foi lido.

Valores aceitos:
- paciente.raca: um de [Branco, Preto, Pardo, Amarelo, Indígena]
  (pode vir como código: 1=Branco, 2=Preto, 3=Pardo, 4=Amarelo, 5=Indígena)
- paciente.sexo: "F" ou "M"
- paciente.aboRh e transfusoes[].grsRhd: grupo e Rh, ex.: "O+", "A-"
- gs: só o grupo, ex.: "O", "AB". rh: "Positivo", "Negativo" ou "Não determinado"
- testesPai e provaCruzada: um de [NR, POSITIVO, NEGATIVO]; "NR" = não realizado
- kits[].tipo: "DIACELL" ou "DIAPANEL"
- cpf e cartaoSus: só dígitos. numeroDoacao: só dígitos, mantenha zeros à esquerda
- ufDestino e ufMunicipio: sigla, ex.: "MT"
- dataAtendimento e motivo: data e motivo do atendimento, se a ficha trouxer

Regras:
- NÃO invente valores. Campo vazio, riscado, ilegível ou que não existe na ficha = null.
- Datas manuscritas estão no formato brasileiro (dia/mês/ano): converta para AAAA-MM-DD.

Retorne APENAS um JSON válido. Formato obrigatório:
{"dataAtendimento":null,"motivo":null,
"paciente":{"nome":"Exemplo da Silva","nomeSocial":null,"prontuario":1234,"dataNascimento":"1990-01-31","sexo":"F","raca":"Pardo","aboRh":"O+","cpf":null,"cartaoSus":null,"diagnostico":null,"nomeMae":null,"nomePai":null,"alergias":null,"municipio":"Cuiabá","ufMunicipio":"MT"},
"transfusoes":[{"dataEnvio":"2026-01-15","tipoHemocomponente":"CHDF","numeroDoacao":"0152260418058","numeroServico":null,"tracejador":null,"grsRhd":"O+","volMl":250,"testesPai":"NR","provaCruzada":"NR","cidadeDestino":"Cuiabá","ufDestino":"MT","responsavelLiberacao":"Maria","pagina":1}],
"pesquisas":[{"dataPesquisa":"2026-01-10","gs":"O","rh":"Positivo","dFraco":null,"pai":"Negativo","tad":"Negativo","autocontrole":"Negativo","dcScreening":null,"especificidade":null,"interpretacao":null,"observacao":null,"amostra":"EDTA","metodologia":"Gel/Centrifugação","responsavel":null,"fenotipagem":[{"antigeno":"C","resultado":"4+"}],"pagina":4}],
"kits":[{"tipo":"DIACELL","dataPesquisa":"2025-12-10","gs":"O","rh":"Positivo","tad":"Negativo","pai":"Positivo","autocontrole":"Negativo","interpretacao":"Anti-c pequeno","tecnica":null,"observacao":null,"resultados":[{"celula":1,"lissCoombs":"0","enzima":"0"},{"celula":2,"lissCoombs":"2+","enzima":"3+"}],"pagina":2}]}`;
