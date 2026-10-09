let grafico24h = null;
let grafico7d = null;

// Definição das métricas
const metricas = [
  { nome:"Temperatura", unidade:"°C", valorId:"tempValor", trendId:"tempTrend", deltaId:"tempDelta", rowId:"rowTemp", data:[] },
  { nome:"Umidade", unidade:"%", valorId:"humValor", trendId:"humTrend", deltaId:"humDelta", rowId:"rowHum", data:[] },
  { nome:"Luminosidade", unidade:"%", valorId:"luxValor", trendId:"luxTrend", deltaId:"luxDelta", rowId:"rowLux", data:[] }
];

// Atualiza timestamp do dashboard
function atualizarTimestamp(){
    const agora = new Date();
    const hora = agora.toLocaleTimeString();
    document.getElementById("timestamp").innerText = hora;
}

// Função principal para atualizar os dados a partir da API
function novaLeitura(){
    fetch("/ultimas-leituras")
    .then(res => res.json())
    .then(data => {
        const times = data.time;

        // Atualiza cabeçalho da tabela com horários
        const headerCells = document.querySelectorAll("table th");
        for(let i=1;i<headerCells.length;i++){
            headerCells[i].innerText = times[i-1] || "-";
        }

        metricas.forEach(metrica => {
            const valores = data[metrica.nome.toLowerCase()];
            if(!valores || valores.length===0) return;

            // Recria array interno da métrica
            metrica.data = [...valores];

            // Atualiza tabela
            const cells = document.querySelectorAll("#"+metrica.rowId+" td");
            for(let i=1;i<cells.length;i++){
                cells[i].innerText = metrica.data[i-1];
            }

            // Valor principal
            const novoValor = parseFloat(valores[0]);
            const valorAnterior = parseFloat(valores[1] || valores[0]);

            const elValor = document.getElementById(metrica.valorId);
            elValor.innerText = (novoValor).toFixed(1);
            elValor.classList.remove("valorAtualizado");
            void elValor.offsetWidth;
            elValor.classList.add("valorAtualizado");

            // Delta
            const elDelta = document.getElementById(metrica.deltaId);
            const delta = (novoValor - valorAnterior).toFixed(1);
            elDelta.innerText = delta>0?`(+${delta})`:(delta<0?`(${delta})`:"(0)");
            elDelta.classList.remove("deltaAnimar");
            void elDelta.offsetWidth;
            elDelta.classList.add("deltaAnimar");

            // Trend
            const elTrend = document.getElementById(metrica.trendId);
            if(novoValor>valorAnterior) elTrend.innerHTML='<i class="fa-solid fa-arrow-up"></i>';
            else if(novoValor<valorAnterior) elTrend.innerHTML='<i class="fa-solid fa-arrow-down"></i>';
            else elTrend.innerHTML='<i class="fa-solid fa-minus"></i>';
            elTrend.classList.remove("animar");
            void elTrend.offsetWidth;
            elTrend.classList.add("animar");
        });

        atualizarTimestamp();
    })
    .catch(err => console.error("Erro ao buscar leituras:", err));
}

// Chamada para dados 24 horas
async function carregarHistorico24h(){
    try {
        const res = await fetch("/historico-24h");
        const data = await res.json();
        criarGrafico24h(data);
    } catch(err){
        console.error("Erro ao carregar gráfico 24h:", err);
    }
}

// Plota grafico 24 horas
function criarGrafico24h(data){

    const canvas = document.getElementById("grafico24h");
    if(!canvas) return;

    const ctx = canvas.getContext("2d");

    if(grafico24h && typeof grafico24h.destroy === "function"){
        grafico24h.destroy();
    }

    grafico24h = new Chart(ctx, {

        type: "line",

        data: {
            labels: data.time,
            datasets: [
                {
                    label: "Temperatura °C",
                    data: data.temperatura,
                    borderColor: "#ff5733",
                    backgroundColor: "rgba(255,87,51,0.1)",
                    tension: 0.3,
                    fill: true
                },
                {
                    label: "Umidade %",
                    data: data.umidade,
                    borderColor: "#3498db",
                    backgroundColor: "rgba(52,152,219,0.1)",
                    tension: 0.3,
                    fill: true
                },
                {
                    label: "Luminosidade %",
                    data: data.luminosidade,
                    borderColor: "#f1c40f",
                    backgroundColor: "rgba(241,196,15,0.1)",
                    tension: 0.3,
                    fill: true
                }
            ]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: "index",
                intersect: false
            },
            plugins: {
                tooltip: {
                    mode: "index",
                    intersect: false
                },
                legend: {
                    labels: {
                        color: "#333"
                    },
                    legend: {
                        position: "top"
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: "#333"
                    },
                    grid: {
                        color: "rgba(0,0,0,0.05)"
                    }
                },
                y: {
                    ticks: {
                        color: "#333"
                    },
                    grid: {
                        color: "rgba(0,0,0,0.05)"
                    }
                }
            }
        }
    });
}

// Chamada para dados ultimos 7 dias
async function carregarHistorico7d() {
    try {
        const res = await fetch("/historico-7d");
        const data = await res.json();
        criarGrafico7d(data);
    } catch (err) {
        console.error("Erro ao carregar gráfico 7d:", err);
    }
}

// Plota grafico ultimos 7 dias
function criarGrafico7d(data) {

    const canvas = document.getElementById("grafico7d");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    // destrói gráfico anterior com segurança
    if (grafico7d && typeof grafico7d.destroy === "function") {
        grafico7d.destroy();
    }

    grafico7d = new Chart(ctx, {
        type: "line",
        data: {
            labels: data.time,
            datasets: [
                {
                    label: "Temperatura °C",
                    data: data.temperatura,
                    borderColor: "#ff5733",
                    backgroundColor: "rgba(255,87,51,0.1)",
                    tension: 0.4,
                    fill: false
                },
                {
                    label: "Umidade %",
                    data: data.umidade,
                    borderColor: "#3498db",
                    backgroundColor: "rgba(52,152,219,0.1)",
                    tension: 0.4,
                    fill: false
                },
                {
                    label: "Luminosidade %",
                    data: data.luminosidade,
                    borderColor: "#f1c40f",
                    backgroundColor: "rgba(241,196,15,0.1)",
                    tension: 0.4,
                    fill: false
                }
            ]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: "index",
                intersect: false
            },
            plugins: {
                legend: {
                    labels: {
                        color: "#333"
                    }
                },
                tooltip: {
                    mode: "index",
                    intersect: false
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: "#333"
                    },
                    grid: {
                        color: "rgba(0,0,0,0.05)"
                    }
                },
                y: {
                    ticks: {
                        color: "#333"
                    },
                    grid: {
                        color: "rgba(0,0,0,0.05)"
                    }
                }
            }
        }
    });
}

// Atualiza a cada 30 segundos
setInterval(novaLeitura,30000);

// Atualiza a cada 5 minutos
setInterval(carregarHistorico24h,300000);

// Atualiza a cada 10 minutos
setInterval(carregarHistorico7d, 600000);


// Chamada inicial
novaLeitura();
carregarHistorico24h();
carregarHistorico7d();