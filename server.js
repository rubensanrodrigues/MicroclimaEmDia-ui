// Carrega variáveis do .env (fallback para ambiente do sistema)
try {
    require("dotenv").config();
} catch (e) {
    console.log(".env não encontrado, usando variáveis do sistema");
}

const express = require("express");
const session = require("express-session");

const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

// Sensor padrão utilizado pelo dashboard
const SENSOR_DEFAULT = "ESP32-001";

// Controle simples para evitar refresh simultâneo das materialized views
let atualizandoHora = false;
let atualizandoDia = false;

// Verifica se a string de conexão foi definida
if (!process.env.DATABASE_URL) {
    console.error("ERRO: variável DATABASE_URL não definida!");
    process.exit(1);
}

// Pool PostgreSQL reutilizável para consultas e refresh das MVs
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,

    /*
    ssl: {
        rejectUnauthorized: false
    }
    */
});

// Servir arquivos estáticos (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, "public")));

// Permite receber JSON nas APIs
app.use(express.json());

// Configura sessão administrativa
if (!process.env.ADMIN_SESSION_SECRET) {
    console.error("ERRO: ADMIN_SESSION_SECRET não definida!");
    process.exit(1);
}

if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
    console.error("ERRO: credenciais administrativas não definidas!");
    process.exit(1);
}

app.use(session({
    name: "microclima.admin.sid",
    secret: process.env.ADMIN_SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 30 * 60 * 1000 // 30 minutos
    }
}));

// ======================================================
// REALTIME
// ======================================================

// Busca leituras realtime diretamente da tabela principal
async function buscarUltimasLeituras(sensor_id, limite = 5) {
    const query = `
        SELECT
            temperatura,
            umidade,
            luminosidade,
            datahora
        FROM pi6.sensor_data
        WHERE sensor_id = $1
        ORDER BY datahora DESC
        LIMIT $2
    `;

    try {
        const res = await pool.query(query, [sensor_id, limite]);

        const time = [];
        const temperatura = [];
        const umidade = [];
        const luminosidade = [];

        res.rows.forEach(row => {

            time.push(
                row.datahora.toLocaleTimeString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                    hour: "2-digit",
                    minute: "2-digit"
                })
            );

            temperatura.push(Number(row.temperatura).toFixed(1));
            umidade.push(Number(row.umidade).toFixed(1));
            luminosidade.push(Number(row.luminosidade).toFixed(1));
        });

        return {
            time,
            temperatura,
            umidade,
            luminosidade
        };

    } catch (err) {

        console.error("Erro ao buscar leituras realtime:", err);

        return {
            time: [],
            temperatura: [],
            umidade: [],
            luminosidade: []
        };
    }
}


// ======================================================
// HISTÓRICO 24 HORAS
// ======================================================

// Busca histórico agregado por hora das últimas 24h
// Fonte: materialized view pi6.mv_sensor_hora
async function buscarHistorico24h(sensor_id) {

    const query = `
        SELECT
            hora,
            temp_avg,
            umi_avg,
            lum_avg_claro
        FROM pi6.mv_sensor_hora
        WHERE sensor_id = $1
        AND hora >= NOW() - INTERVAL '24 hours'
        ORDER BY hora ASC
    `;

    try {

        const res = await pool.query(query, [sensor_id]);

        const time = [];
        const temperatura = [];
        const umidade = [];
        const luminosidade = [];

        res.rows.forEach(row => {

            time.push(
                row.hora.toLocaleTimeString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                    hour: "2-digit",
                    minute: "2-digit"
                })
            );

            temperatura.push(
                row.temp_avg !== null
                    ? Number(row.temp_avg).toFixed(1)
                    : null
            );

            umidade.push(
                row.umi_avg !== null
                    ? Number(row.umi_avg).toFixed(1)
                    : null
            );

            luminosidade.push(
                row.lum_avg_claro !== null
                    ? Number(row.lum_avg_claro).toFixed(1)
                    : null
            );
        });

        return {
            time,
            temperatura,
            umidade,
            luminosidade
        };

    } catch (err) {

        console.error("Erro ao buscar histórico 24h:", err);

        return {
            time: [],
            temperatura: [],
            umidade: [],
            luminosidade: []
        };
    }
}


// ======================================================
// HISTÓRICO 7 DIAS
// ======================================================

// Busca histórico agregado por dia dos últimos 7 dias
// Fonte: materialized view pi6.mv_sensor_dia
async function buscarHistorico7d(sensor_id) {

    const query = `
        SELECT
            dia,
            temp_avg,
            umi_avg,
            lum_avg_dia_claro
        FROM pi6.mv_sensor_dia
        WHERE sensor_id = $1
        AND dia >= NOW() - INTERVAL '7 days'
        ORDER BY dia ASC
    `;

    try {

        const res = await pool.query(query, [sensor_id]);

        const time = [];
        const temperatura = [];
        const umidade = [];
        const luminosidade = [];

        res.rows.forEach(row => {

            time.push(
                row.dia.toLocaleDateString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                    day: "2-digit",
                    month: "2-digit"
                })
            );

            temperatura.push(
                row.temp_avg !== null
                    ? Number(row.temp_avg).toFixed(1)
                    : null
            );

            umidade.push(
                row.umi_avg !== null
                    ? Number(row.umi_avg).toFixed(1)
                    : null
            );

            luminosidade.push(
                row.lum_avg_dia_claro !== null
                    ? Number(row.lum_avg_dia_claro).toFixed(1)
                    : null
            );
        });

        return {
            time,
            temperatura,
            umidade,
            luminosidade
        };

    } catch (err) {

        console.error("Erro ao buscar histórico 7d:", err);

        return {
            time: [],
            temperatura: [],
            umidade: [],
            luminosidade: []
        };
    }
}


// ======================================================
// API
// ======================================================

// Endpoint realtime do dashboard
app.get("/ultimas-leituras", async (req, res) => {

    const sensor = req.query.sensor || SENSOR_DEFAULT;

    const dados = await buscarUltimasLeituras(sensor, 5);

    res.json(dados);
});


// Endpoint histórico agregado 24h
app.get("/historico-24h", async (req, res) => {

    const sensor = req.query.sensor || SENSOR_DEFAULT;

    const dados = await buscarHistorico24h(sensor);

    // Permite cache por 60 segundos para reduzir carga no backend
    res.set("Cache-Control", "public, max-age=60");

    res.json(dados);
});


// Endpoint histórico agregado 7 dias
app.get("/historico-7d", async (req, res) => {

    const sensor = req.query.sensor || SENSOR_DEFAULT;

    const dados = await buscarHistorico7d(sensor);

    // Permite cache por 60 segundos para reduzir carga no backend
    res.set("Cache-Control", "public, max-age=60");

    res.json(dados);
});


// ======================================================
// JOBS / MATERIALIZED VIEWS
// ======================================================

// Endpoint operacional para atualização da MV horária
// Recomendado uso via cron/scheduler
app.get("/jobs/refresh-hora", async (req, res) => {

    if (atualizandoHora) {

        return res.status(429).json({
            status: "BUSY"
        });
    }

    atualizandoHora = true;

    try {

        await pool.query(`
            REFRESH MATERIALIZED VIEW CONCURRENTLY pi6.mv_sensor_hora
        `);

        res.set("Cache-Control", "no-store");

        res.json({
            status: "OK",
            updated_at: new Date()
        });

    } catch (err) {

        console.error("Erro refresh MV hora:", err);

        res.status(500).json({
            status: "FAIL"
        });

    } finally {

        atualizandoHora = false;
    }
});


// Endpoint operacional para atualização da MV diária
// Recomendado uso via cron/scheduler
app.get("/jobs/refresh-dia", async (req, res) => {

    if (atualizandoDia) {

        return res.status(429).json({
            status: "BUSY"
        });
    }

    atualizandoDia = true;

    try {

        await pool.query(`
            REFRESH MATERIALIZED VIEW CONCURRENTLY pi6.mv_sensor_dia
        `);

        res.set("Cache-Control", "no-store");

        res.json({
            status: "OK",
            updated_at: new Date()
        });

    } catch (err) {

        console.error("Erro refresh MV dia:", err);

        res.status(500).json({
            status: "FAIL"
        });

    } finally {

        atualizandoDia = false;
    }
});


// Protege páginas e APIs administrativas
function exigirAutenticacao(req, res, next) {
    if (req.session && req.session.adminAutenticado === true) {
        return next();
    }

    if (req.path.startsWith("/api/")) {
        return res.status(401).json({
            erro: "Não autenticado"
        });
    }

    return res.redirect("/admin/login");
}

// Entrada da área administrativa
app.get("/admin", (req, res) => {
    if (req.session?.adminAutenticado === true) {
        return res.redirect("/admin/iluminacao");
    }

    return res.redirect("/admin/login");
});

// Tela de login
app.get("/admin/login", (req, res) => {
    if (req.session?.adminAutenticado === true) {
        return res.redirect("/admin/iluminacao");
    }

    res.set("Cache-Control", "no-store");
    res.sendFile(path.join(__dirname, "/public/admin/login.html"));
});

// Autenticação
app.post("/admin/login", (req, res, next) => {
    const { username, password } = req.body || {};

    const usuarioValido =
        typeof username === "string" &&
        username === process.env.ADMIN_USERNAME;

    const senhaValida =
        typeof password === "string" &&
        password === process.env.ADMIN_PASSWORD;

    if (!usuarioValido || !senhaValida) {
        return res.status(401).json({
            erro: "Usuário ou senha inválidos."
        });
    }

    // Regenera a sessão para reduzir risco de session fixation
    req.session.regenerate((err) => {
        if (err) {
            return next(err);
        }

        req.session.adminAutenticado = true;

        req.session.save((saveErr) => {
            if (saveErr) {
                return next(saveErr);
            }

            res.set("Cache-Control", "no-store");

            return res.json({
                sucesso: true,
                redirect: "/admin/iluminacao"
            });
        });
    });
});

// Logout
app.post("/admin/logout", exigirAutenticacao, (req, res, next) => {
    req.session.destroy((err) => {
        if (err) {
            return next(err);
        }

        res.clearCookie("microclima.admin.sid", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict"
        });

        return res.json({
            sucesso: true,
            redirect: "/admin/login"
        });
    });
});

// Página de iluminação protegida
app.get(
    "/admin/iluminacao",
    exigirAutenticacao,
    (req, res) => {
        res.set("Cache-Control", "no-store");
        res.sendFile(
            path.join(__dirname, "/public/admin/iluminacao.html")
        );
    }
);

// Recursos visuais da área administrativa
// Estes arquivos não contêm credenciais nem dados privados.
app.use(
    "/admin/assets",
    express.static(path.join(__dirname, "admin/assets"))
);

// ======================================================
// FRONTEND
// ======================================================

// Rota principal do dashboard
app.get("/", (req, res) => {

    res.sendFile(path.join(__dirname, "public/index.html"));
});

// ======================================================
// API ADMINISTRATIVA - ILUMINAÇÃO
// ======================================================

// Consultar configuração
app.get(
    "/api/admin/iluminacao",
    exigirAutenticacao,
    async (req, res) => {
        try {
            const query = `
                SELECT
                    liga_hora,
                    liga_minuto,
                    desliga_hora,
                    desliga_minuto
                FROM pi6.iluminacao
                WHERE id = $1
            `;

            const result = await pool.query(
                query,
                [SENSOR_DEFAULT]
            );

            res.set("Cache-Control", "no-store");

            if (result.rowCount === 0) {
                return res.json({
                    existe: false,
                    ligar: "18:00",
                    desligar: "23:00"
                });
            }

            const row = result.rows[0];

            const formatarHora = (hora, minuto) =>
                `${String(hora).padStart(2, "0")}:` +
                `${String(minuto).padStart(2, "0")}`;

            return res.json({
                existe: true,
                ligar: formatarHora(
                    row.liga_hora,
                    row.liga_minuto
                ),
                desligar: formatarHora(
                    row.desliga_hora,
                    row.desliga_minuto
                )
            });

        } catch (err) {
            console.error(
                "Erro ao consultar configuração da iluminação:",
                err
            );

            return res.status(500).json({
                erro: "Não foi possível consultar a configuração."
            });
        }
    }
);

// Salvar configuração
app.put(
    "/api/admin/iluminacao",
    exigirAutenticacao,
    async (req, res) => {
        const { ligar, desligar } = req.body || {};

        // Valida o formato HH:MM
        const formatoHora = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

        if (
            typeof ligar !== "string" ||
            typeof desligar !== "string" ||
            !formatoHora.test(ligar) ||
            !formatoHora.test(desligar)
        ) {
            return res.status(400).json({
                erro: "Informe horários válidos no formato HH:MM."
            });
        }

        const [ligaHora, ligaMinuto] = ligar
            .split(":")
            .map(Number);

        const [desligaHora, desligaMinuto] = desligar
            .split(":")
            .map(Number);

        try {
            const query = `
                INSERT INTO pi6.iluminacao (
                    id,
                    liga_hora,
                    liga_minuto,
                    desliga_hora,
                    desliga_minuto
                )
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (id)
                DO UPDATE SET
                    liga_hora = EXCLUDED.liga_hora,
                    liga_minuto = EXCLUDED.liga_minuto,
                    desliga_hora = EXCLUDED.desliga_hora,
                    desliga_minuto = EXCLUDED.desliga_minuto
                RETURNING
                    liga_hora,
                    liga_minuto,
                    desliga_hora,
                    desliga_minuto
            `;

            const result = await pool.query(query, [
                SENSOR_DEFAULT,
                ligaHora,
                ligaMinuto,
                desligaHora,
                desligaMinuto
            ]);

            res.set("Cache-Control", "no-store");

            return res.json({
                sucesso: true,
                mensagem: "Configuração salva com sucesso.",
                ligar,
                desligar
            });

        } catch (err) {
            console.error(
                "Erro ao salvar configuração da iluminação:",
                err
            );

            return res.status(500).json({
                erro: "Não foi possível salvar a configuração."
            });
        }
    }
);

// ======================================================
// SERVER
// ======================================================

// Inicializa servidor HTTP
app.listen(PORT, () => {

    console.log(`Servidor rodando na porta ${PORT}`);
});