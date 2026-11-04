# Bundle e cache — F3-7

Medição em 04/11/2026, com Node 24.16 e as mesmas dependências isoladas de Vite 7.3.7. O build usa a configuração do projeto com um coletor Rollup de chunks/módulos, gzip por chunk, envDir=false e valores públicos fictícios. Não lê .env, não instala visualizer e não regenera o MCP. Esta é uma análise do output real do Rollup, sem o plugin rollup-plugin-visualizer.

| Ponto medido | Chunks JS | JS total | Soma gzip dos chunks | Chunk Home | Home gzip |
|---|---:|---:|---:|---:|---:|
| Base antes da Home, a70c1c0 | 145 | 4.832.573 B | 1.436.861 B | 50.020 B | 13.639 B |
| Controle isolado da Home/RQ, d016dc4 | 146 | 4.839.931 B | 1.440.272 B | 43.964 B | 11.786 B |
| Conjunto integrado, 7079906 | 151 | 4.926.450 B | 1.472.039 B | 43.964 B | 11.783 B |

O chunk próprio da Home diminuiu 6.056 bytes (12,1%) e 1.853 bytes gzip (13,6%) no controle. O total JS desse controle aumentou 7.358 bytes (0,15%), com a lógica compartilhada dos hooks. O conjunto posterior inclui outras funcionalidades e não isola o efeito da Home. A soma dos chunks não é o download inicial de uma rota, pois há imports dinâmicos e cache do navegador.

O maior chunk continua vendor-pdf-xlsx: 1.425.339 bytes, 427.268 gzip, igual nos três builds. O gráfico de linhas tem cerca de 393.837 bytes; html2canvas tem 201.041 bytes. O limite de 600 kB continua gerando aviso para a biblioteca de exportação. A Home ainda referencia chunks compartilhados que incluem exportação; a redução do arquivo próprio não prova a remoção de toda biblioteca pesada do caminho de carregamento. O coletor não mediu latência de rede, transferência HTTP, memória ou LCP.

Os quatro hooks usam React Query com staleTime de cinco minutos, chaves por identidade/escopo e invalidação após finalização. Testes funcionais verificam reuso do cache e transições; esse efeito sobre consultas é distinto do tamanho do bundle. A Home deixou de carregar diretamente useSimuladoDetail/useExamResult para descobrir a pior área.

Os JSONs completos, imports e módulos por chunk e os logs ficam nos artefatos locais ignorados .superpowers/editions/bundle-before-home.json, bundle-home-control.json e bundle-integrated-7079906.json. O controle foi um checkout detached próprio, sem alterar o checkout principal. Nenhuma redução global foi presumida. Builds posteriores precisam de nova medição se alterarem o grafo.
