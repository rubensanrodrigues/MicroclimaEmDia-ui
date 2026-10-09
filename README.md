# Microclima em Dia — Interface Web

Interface web da plataforma **Microclima em Dia** para acompanhar as condições ambientais de um laboratório. O dashboard apresenta leituras recentes e gráficos de histórico; uma área administrativa protegida por login permite configurar os horários programados para a iluminação.

## Funcionalidades

- Dashboard com temperatura, umidade e luminosidade.
- Exibição das cinco leituras mais recentes, com horário, tendência e variação em relação à leitura anterior.
- Gráficos com agregados das últimas 24 horas e dos últimos 7 dias.
- Atualização automática das leituras e dos históricos.
- Área administrativa com autenticação por usuário e senha.
- Consulta, edição e gravação dos horários de ligar e desligar a iluminação.
- Sessão administrativa com cookie `httpOnly`, `sameSite: strict` e validade de 30 minutos.

> A área administrativa grava a programação na tabela `pi6.iluminacao`. O acionamento físico da iluminação depende do dispositivo ou serviço que consome essa configuração; esta interface não se conecta diretamente ao hardware.

## Tecnologias

- Node.js e Express
- PostgreSQL, acessado pelo pacote `pg`
- HTML, CSS e JavaScript no frontend
- Chart.js para os gráficos
- `express-session` para a sessão administrativa
- `dotenv` para carregar variáveis de ambiente durante o desenvolvimento

## Requisitos

- Node.js e npm
- Instância PostgreSQL acessível pela aplicação
- Banco de dados preparado com as tabelas e views descritas em [Banco de dados](#banco-de-dados)

## Configuração

Defina as variáveis abaixo no ambiente de execução ou em um arquivo `.env` na raiz do projeto:

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `DATABASE_URL` | Sim | String de conexão PostgreSQL |
| `ADMIN_SESSION_SECRET` | Sim | Segredo longo e aleatório usado para assinar as sessões |
| `ADMIN_USERNAME` | Sim | Usuário para entrar na área administrativa |
| `ADMIN_PASSWORD` | Sim | Senha para entrar na área administrativa |
| `PORT` | Não | Porta HTTP; padrão `3000` |
| `NODE_ENV` | Não | Use `production` em produção; nesse modo, o cookie da sessão é marcado como `secure` e exige HTTPS |

Exemplo de `.env` para desenvolvimento:

```dotenv
DATABASE_URL=postgresql://localhost:5432/microclima
ADMIN_SESSION_SECRET=gere-um-segredo-longo-e-aleatorio
ADMIN_USERNAME=admin
ADMIN_PASSWORD=defina-uma-senha-forte
PORT=3000
NODE_ENV=development
```

Use credenciais fortes e não inclua o `.env` nem segredos reais no controle de versão. Em produção, sirva a aplicação por HTTPS e defina `NODE_ENV=production`.

## Instalação e execução

Na raiz do projeto:

```bash
npm install
npm start
```

Por padrão, a aplicação fica disponível em `http://localhost:3000`.

## Uso

- **Dashboard:** `/`
- **Entrada da área administrativa:** `/admin` (redireciona para o login ou para a configuração, conforme a sessão)
- **Login:** `/admin/login`
- **Configuração da iluminação:** `/admin/iluminacao` (requer login)

Na área administrativa, informe usuário e senha, defina os horários de **Ligar** e **Desligar** e selecione **Salvar**. Se ainda não houver configuração no banco, a tela mostra `18:00` e `23:00` como valores iniciais; eles só são gravados depois de salvar. **Cancelar** restaura os valores carregados e **Sair da área administrativa** encerra a sessão.

Os horários devem ser válidos no formato `HH:MM` de 24 horas. O login e as operações administrativas usam a mesma origem da aplicação e um cookie de sessão.

## Atualização do dashboard

- Leituras recentes: a cada 30 segundos.
- Histórico de 24 horas: a cada 5 minutos.
- Histórico de 7 dias: a cada 10 minutos.

Os históricos são lidos de materialized views do PostgreSQL. Para que os gráficos reflitam novos dados, elas precisam ser atualizadas, por exemplo, pelos endpoints operacionais descritos abaixo.

## API

### Leituras e históricos

| Método e rota | Descrição |
| --- | --- |
| `GET /ultimas-leituras` | Retorna as cinco leituras mais recentes |
| `GET /historico-24h` | Retorna os agregados horários das últimas 24 horas |
| `GET /historico-7d` | Retorna os agregados diários dos últimos 7 dias |

As três rotas aceitam o parâmetro opcional `sensor`. Sem ele, é usado o sensor padrão `ESP32-001`. As respostas incluem os arrays `time`, `temperatura`, `umidade` e `luminosidade`.

Exemplo de resposta de `/ultimas-leituras`:

```json
{
  "time": ["10:10", "10:05"],
  "temperatura": ["23.1", "23.0"],
  "umidade": ["45.2", "45.5"],
  "luminosidade": ["78.0", "76.3"]
}
```

As rotas de histórico permitem cache por 60 segundos.

### Administração da iluminação

As rotas de consulta, gravação e logout exigem uma sessão autenticada. O endpoint de login recebe as credenciais:

| Método e rota | Descrição |
| --- | --- |
| `POST /admin/login` | Valida usuário e senha; recebe JSON `{ "username": "...", "password": "..." }` |
| `POST /admin/logout` | Encerra a sessão |
| `GET /api/admin/iluminacao` | Consulta a programação; retorna `ligar`, `desligar` e `existe` |
| `PUT /api/admin/iluminacao` | Salva a programação; recebe JSON `{ "ligar": "18:00", "desligar": "23:00" }` |

Sem autenticação, a API administrativa responde `401`. O login responde `401` quando as credenciais são inválidas, e a gravação responde `400` se os horários não estiverem no formato `HH:MM`.

### Atualização das materialized views

| Método e rota | View atualizada |
| --- | --- |
| `GET /jobs/refresh-hora` | `pi6.mv_sensor_hora` |
| `GET /jobs/refresh-dia` | `pi6.mv_sensor_dia` |

Essas rotas são destinadas a um agendador ou scheduler. Elas não têm autenticação implementada pela aplicação; restrinja o acesso a elas à rede ou infraestrutura confiável.

## Banco de dados

A conexão é fornecida por `DATABASE_URL`. A aplicação espera encontrar no schema `pi6`:

- `sensor_data`, com as colunas `sensor_id`, `temperatura`, `umidade`, `luminosidade` e `datahora`.
- `mv_sensor_hora`, com os agregados horários `sensor_id`, `hora`, `temp_avg`, `umi_avg` e `lum_avg_claro`.
- `mv_sensor_dia`, com os agregados diários `sensor_id`, `dia`, `temp_avg`, `umi_avg` e `lum_avg_dia_claro`.
- `iluminacao`, com `id`, `liga_hora`, `liga_minuto`, `desliga_hora` e `desliga_minuto`. A coluna `id` deve ser chave primária ou possuir restrição `UNIQUE` para permitir a gravação/atualização.

O identificador usado pelo dashboard e pela configuração da iluminação é `ESP32-001`. As rotas de leitura aceitam outro sensor por meio do parâmetro `sensor`.

As materialized views devem existir antes do uso dos históricos. Como os endpoints de atualização usam `REFRESH MATERIALIZED VIEW CONCURRENTLY`, cada view também precisa ter um índice `UNIQUE` válido que cubra todas as linhas, conforme os requisitos do PostgreSQL.

## Estrutura principal

```text
.
├── server.js
├── package.json
└── public/
    ├── index.html
    ├── css/
    ├── js/
    │   └── script.js
    └── admin/
        ├── login.html
        ├── iluminacao.html
        └── assets/
            ├── app.js
            ├── login.js
            └── style.css
```

- `server.js`: servidor Express, endpoints, conexão com PostgreSQL e autenticação administrativa.
- `public/`: dashboard e recursos estáticos.
- `public/admin/`: telas e scripts da área administrativa.

## Observações

- O dashboard usa o Chart.js servido por CDN; a visualização dos gráficos depende de acesso ao endereço do CDN pelo navegador.
- O cookie seguro de sessão em produção requer HTTPS.
- Os endpoints de atualização de materialized views devem ser protegidos pela infraestrutura que os expõe.

## Licença

Este projeto foi criado para fins educacionais.

O uso, modificação e redistribuição são permitidos livremente **desde que a autoria original seja mantida**.

Remover ou ocultar a autoria original é expressamente proibido. Caso a autoria seja removida, **você não tem permissão para usar este código em nenhuma forma**.
