const form = document.getElementById("loginForm");
const message = document.getElementById("message");

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const button = form.querySelector('button[type="submit"]');

    button.disabled = true;
    message.textContent = "";
    message.classList.remove("show");

    try {
        const response = await fetch("/admin/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "same-origin",
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.erro || "Falha no login.");
        }

        window.location.assign(data.redirect);

    } catch (err) {
        message.textContent = err.message;
        message.style.color = "#fca5a5";
        message.classList.add("show");
    } finally {
        button.disabled = false;
    }
});