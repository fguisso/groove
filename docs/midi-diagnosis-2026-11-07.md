# Avaliação MIDI: diagnóstico e correção

Em 07/11/2026 foi confirmado um erro de relógio capaz de produzir marcadores vermelhos mesmo com toques exatamente nas notas programadas. A correção preserva notas, andamento e estrutura do estudo Stand By Me. A publicação foi autorizada pelo usuário pelo fluxo existente de GitHub Pages, com teste físico adiado por decisão explícita. A sessão de prática aberta, os dispositivos de áudio, o Moisés, o GarageBand e a Wiki não foram operados.

## Evidências e causa

As três primeiras capturas preservadas mostram reprodução ativa. A terceira contém 312 marcadores: 252 `off-time`, 22 atrasados, 13 no tempo, 2 de outra peça e 23 adiantados. As cinco capturas seguintes mostram a reprodução encerrada e os marcadores já apagados. Essas imagens e os DOMs estão em `../one-man-band/local/estudos/stand-by-me/midi-diagnostico-2026-11-07/`, relativamente à raiz do repositório. São estados visuais acumulados, sem timestamps MIDI brutos.

Na implementação anterior, vermelho significava `off-time`: a subdivisão selecionada estava vazia em todas as vozes. Amarelo significava outra peça na mesma subdivisão. Azul e laranja significavam antecipação e atraso de uma voz encontrada naquela posição. Verde usava apenas 40% da tolerância configurada, com piso de 8 ms. Não havia detecção de omissões. Portanto, vermelho não significava necessariamente instrumento incorreto, nem uma nota esperada que o músico tivesse omitido.

O caminho `Transport.seconds -> Clock.seconds -> TickSource.seconds -> getSecondsAtTime(now())` chega ao `Context.now()`, que soma `lookAhead` ao `AudioContext.currentTime`. O Tone 15.1.22 instalado usa 0,1 segundo por padrão. A 122 BPM, uma semicolcheia dura aproximadamente 122,95 ms. O arredondamento de um avanço de 100 ms seleciona a semicolcheia seguinte. Nos padrões deste estudo, ela quase sempre está vazia. A compensação manual era subtraída somente depois dessa escolha e apenas quando a voz esperada já havia sido encontrada, impedindo o offset de reparar a associação.

A mesma lógica foi conferida diretamente nos bundles publicados em `https://guisso.dev/groove/assets/PracticeClock-ik83wnTz.js`, `EditorView-sh1hjzhe.js` e `tone-uCzZr4G0.js`, dependências da página observada `index-D5M-0Hnb.js`. Logo, o defeito não estava limitado ao checkout local.

A reprodução sintética usa o payload público exato salvo em `stand-by-me-segunda-parte.json`: 11 blocos, 25 compassos executados, 400 subdivisões, 318 notas esperadas. Toques ideais, sem latência adicional, produzem 312 falsos vermelhos sob o deslocamento antigo de 100 ms. Com a correção, as 318 notas ideais são associadas uma vez cada e avaliadas no tempo. Isso demonstra o defeito do software, sem afirmar que a execução real tenha sido idêntica à simulação.

Outros problemas confirmados: o watcher assíncrono de `lastHit` podia consolidar mensagens simultâneas; o reinício de um compasso repetido podia ser confundido com o reinício da música e apagar marcadores quando count-in estava desligado; hits sem timing podiam usar a última posição visual; e o cálculo geométrico fixado no Play não acompanhava alterações de andamento ou o swing efetivamente agendado.

## Correção

| Antes                                                        | Depois                                                                                                                                                             |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Relógio do agendador com antecipação                         | Horário MIDI de recebimento convertido para o relógio da saída audível                                                                                             |
| Horário do callback JavaScript substituía o recebimento MIDI | `MIDIMessageEvent.timeStamp`, preservando eventos entregues com atraso                                                                                             |
| Offset aplicado depois da seleção de subdivisão              | Offset residual aplicado antes da associação                                                                                                                       |
| Grade uniforme calculada ao iniciar                          | Notas esperadas usam os tempos exatos do callback de áudio, com identidade de passagem e ciclo                                                                     |
| Arredondamento podia cair em uma célula vazia                | Associação busca a nota próxima da mesma voz e consome cada toque/nota uma única vez                                                                               |
| Hits simultâneos dependiam do flush de renderização          | Captura síncrona de cada evento antes de qualquer renderização                                                                                                     |
| Verde usava uma fração oculta da tolerância                  | Verde respeita a tolerância configurada, sem mudar seu valor salvo                                                                                                 |
| Vermelho uniforme para célula vazia                          | Azul com `‹` para antecipação, laranja com `›` para atraso, anel cinza para omissão, `+` vermelho para extra e losango roxo para outra peça/articulação de chimbal |
| Chimbal aberto, fechado e pedal equivalentes                 | Estados 46, 42 e 44 são distinguidos; acento e ghost continuam sem avaliação de dinâmica                                                                           |
| Resultado apagado ao encerrar ou repetir                     | Totais acumulam todas as passagens e permanecem até o próximo Play; partitura e grade mostram o resultado mais recente por célula                                  |
| Leitura fugaz de timing                                      | Resumo legível com contagens, último toque, sinal em ms, passagem, mediana do desvio e dispersão típica                                                            |
| Ajuste de latência sem procedimento claro                    | Instruções para conferir o offset residual com 16 a 32 pulsos simples e validar em nova passagem                                                                   |

A conversão usa `getOutputTimestamp()` quando há uma amostra válida. A API relaciona o tempo de áudio na saída física com o relógio de `performance.now()`, permitindo projetar o timestamp MIDI para essa saída. Não se subtrai a latência novamente nesse caso. Quando a amostra não está disponível, o fallback usa `currentTime`, o delta de performance, `baseLatency` e `outputLatency` informados pelo navegador. A precisão continua limitada pelas estimativas fornecidas pelo browser. [Web Audio, getOutputTimestamp](https://www.w3.org/TR/webaudio/#dom-audiocontext-getoutputtimestamp).

O Web MIDI define o `timeStamp` como o horário de recebimento da mensagem pelo sistema. Isso remove a espera da fila JavaScript da medida, mas não mede o intervalo físico entre o impacto no pad e a chegada USB. Esse intervalo residual continua ajustável. [Web MIDI, MIDIInput](https://www.w3.org/TR/webmidi/#midiinput-interface).

A janela de associação, distinta da tolerância verde, é limitada a 90% de uma subdivisão e no máximo 180 ms. Assim um toque próximo fora da tolerância pode ser descrito como antecipado ou atrasado sem virar verde. Fora da associação, pode haver uma omissão e um toque extra. Há 120 ms adicionais apenas para aguardar entrega de mensagens antes de finalizar um resultado; essa espera não amplia a tolerância musical. O feedback consolidado costuma aparecer em cerca de 0,2 a 0,3 segundo. Não há quantização ou swing automático.

## Validação e limites

Validação final: 86 testes passaram. Build de produção com typecheck, lint, formatação e `git diff --check` passaram.

Os testes cobrem relógio de saída e fallback, antecipação do Tone, offset antes da associação, fronteira exata da tolerância, antecipação/atraso em subdivisão vazia, mensagens simultâneas, consumo único, omissão, extra, outra peça, estados de chimbal, entrega atrasada, count-in, pausa de revisão, Stop com eventos já agendados, tempos não uniformes, mudança de BPM, ciclos e repetições. A integração com Tone é simulada e não abre áudio. O teste com o payload salvo também confirma que o conteúdo do estudo permanece intacto.

A prévia foi conferida em aba local separada, sem reprodução ou conexão MIDI. A imagem `feedback-corrigido-simulado.jpg`, na pasta das evidências, usa dados explicitamente simulados para exibir todas as categorias. Não representa uma nova execução do usuário. A tentativa de navegador headless não concluiu; seus processos isolados foram encerrados. Não foi alterado o tamanho da janela usada pelo músico.

Não há dados suficientes para medir a latência real da Aroma/MiniFuse nesta execução, sua dispersão, eventual deslocamento de fase em relação ao Moisés ou swing executado. As capturas apoiam a hipótese do deslocamento constante, mas não permitem reconstruir os impactos. Não foi atribuída culpa ao músico ou ao hardware. Uma nova passagem será necessária para confirmar o comportamento com o kit físico.

Quando houver uma pausa no estudo, iniciar a versão local com `npm run dev -- --host 127.0.0.1 --port 5187 --strictPort`, abrir o mesmo payload do estudo nessa origem e conectar o MIDI explicitamente. O offset anterior pertence à origem pública e pode ter compensado parcialmente o bug; conferir o valor e começar com zero na nova referência, se não houver calibração física conhecida. Tocar um padrão simples por 16 a 32 pulsos com metrônomo, revisar desvio e dispersão, ajustar somente o offset residual se houver deslocamento consistente e repetir. Depois conferir outra peça, uma omissão e uma nota extra. O Stop deve conservar os totais. Não usar a execução ao vivo atual para esse teste.
