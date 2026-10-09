const form = document.getElementById("lightingForm");
const cancelButton = document.getElementById("cancelButton");
const logoutButton = document.getElementById("logoutButton");
const message = document.getElementById("message");

const ligarInput = document.getElementById("ligar");
const desligarInput = document.getElementById("desligar");

let valoresCarregados = null;

function mostrarMensagem(texto, erro = false) {
    message.textContent = texto;
    message.classList.toggle("error", erro);
    message.classList.add("show");
}

function esconderMensagem() {
    message.textContent = "";
    message.classList.remove("show", "error");
}

async function requisitar(url, options = {}) {
    const response = await fetch(url, {
        credentials: "same-origin",
        cache: "no-store",
        ...options
    });

    if (response.status === 401) {
        window.location.replace("/admin/login");
        throw new Error("Sessão expirada. Faça login novamente.");
    }

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.erro || "Erro na requisição.");
    }

    return data;
}

// Carrega os horários armazenados
async function carregarConfiguracao() {
    form.querySelectorAll("input, button").forEach(el => {
        el.disabled = true;
    });

    try {
        const data = await requisitar("/api/admin/iluminacao");

        ligarInput.value = data.ligar;
        desligarInput.value = data.desligar;

        valoresCarregados = {
            ligar: data.ligar,
            desligar: data.desligar
        };

        if (!data.existe) {
            mostrarMensagem(
                "Ainda não há configuração cadastrada. " +
                "Os horários exibidos são valores iniciais; salve para gravá-los."
            );
        } else {
            esconderMensagem();
        }

    } catch (err) {
        mostrarMensagem(err.message, true);
    } finally {
        form.querySelectorAll("input, button").forEach(el => {
            el.disabled = false;
        });
    }
}

// Salva no PostgreSQL
form.addEventListener("submit", async (event) => {
    event.preventDefault();
    esconderMensagem();

    if (!form.reportValidity()) {
        return;
    }

    const configuracao = {
        ligar: ligarInput.value,
        desligar: desligarInput.value
    };

    const saveButton = form.querySelector(
        'button[type="submit"]'
    );

    saveButton.disabled = true;

    try {
        const data = await requisitar("/api/admin/iluminacao", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(configuracao)
        });

        valoresCarregados = {
            ligar: data.ligar,
            desligar: data.desligar
        };

        ligarInput.value = data.ligar;
        desligarInput.value = data.desligar;

        mostrarMensagem(data.mensagem);

    } catch (err) {
        mostrarMensagem(err.message, true);
    } finally {
        saveButton.disabled = false;
    }
});

// Descarta as alterações ainda não salvas
cancelButton.addEventListener("click", () => {
    if (!valoresCarregados) {
        return;
    }

    ligarInput.value = valoresCarregados.ligar;
    desligarInput.value = valoresCarregados.desligar;

    esconderMensagem();
});

// Encerra a sessão
logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;

    try {
        const data = await requisitar("/admin/logout", {
            method: "POST"
        });

        window.location.replace(data.redirect);

    } catch (err) {
        mostrarMensagem(err.message, true);
        logoutButton.disabled = false;
    }
});

// Inicialização
carregarConfiguracao();