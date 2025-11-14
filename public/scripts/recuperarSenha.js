/*
  Autores: 
    Nicolas Mitjans Nunes
    Pedro Henrique Ribeiro Silva Murta
    Matheus Antony Lucas Lima
*/

/* --------------------------
   FUNÇÃO DE NAVEGAÇÃO
-------------------------- */
function showPage(id) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

/* --------------------------
   1) recuperarSenha.js
-------------------------- */
document.addEventListener("DOMContentLoaded", () => {

  const recoverForm = document.getElementById("recover-form");
  const recoverEmailInput = document.getElementById("email");
  const recoverMessage = document.getElementById("message-recover");

  if (recoverForm) {
    recoverForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      recoverMessage.textContent = "";
      recoverMessage.className = "";

      const email = recoverEmailInput.value.trim();
      if (!email) {
        recoverMessage.textContent = "Informe seu email.";
        recoverMessage.className = "msg-error";
        return;
      }

      try {
        const res = await fetch("/api/request-password-reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email })
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
          recoverMessage.textContent = data.error || "Erro ao enviar token.";
          recoverMessage.className = "msg-error";
          return;
        }

        sessionStorage.setItem("recoveryEmail", email);

        recoverMessage.textContent = "Token enviado! Verifique seu email.";
        recoverMessage.className = "msg-success";

        setTimeout(() => {
          showPage("page-token");
        }, 1000);

      } catch (err) {
        console.error(err);
        recoverMessage.textContent = "Erro no servidor.";
        recoverMessage.className = "msg-error";
      }
    });
  }

  /* --------------------------
     2) verificarToken.js
  -------------------------- */
  const tokenForm = document.getElementById("token-form");
  const tokenInput = document.getElementById("token");
  const tokenMessage = document.getElementById("message-token");

  if (tokenForm) {

    const email = sessionStorage.getItem("recoveryEmail");
    if (!email) {
      alert("Email não encontrado. Volte e insira seu email novamente.");
      showPage("page-recover");
      return;
    }

    tokenForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      tokenMessage.textContent = "";
      tokenMessage.className = "";

      const token = tokenInput.value.trim();
      if (!token) {
        tokenMessage.textContent = "Informe o token.";
        tokenMessage.className = "msg-error";
        return;
      }

      try {
        const res = await fetch("/api/verify-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, token })
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
          tokenMessage.textContent = data.error || "Token inválido ou expirado.";
          tokenMessage.className = "msg-error";
          return;
        }

        sessionStorage.setItem("recoveryToken", token);

        tokenMessage.textContent = "Token validado!";
        tokenMessage.className = "msg-success";

        setTimeout(() => {
          showPage("page-reset");
        }, 1000);

      } catch (err) {
        console.error(err);
        tokenMessage.textContent = "Erro no servidor.";
        tokenMessage.className = "msg-error";
      }
    });

    const backButton = document.getElementById("back-to-recover");
    backButton.addEventListener("click", () => showPage("page-recover"));
  }

  /* --------------------------
     3) redefinir_senha.js
  -------------------------- */
  const resetForm = document.getElementById("reset-form");
  const newPasswordInput = document.getElementById("newPassword");
  const confirmInput = document.getElementById("confirmPassword");
  const resetMessage = document.getElementById("message-reset");

  if (resetForm) {

    const email = sessionStorage.getItem("recoveryEmail");
    const token = sessionStorage.getItem("recoveryToken");

    if (!email || !token) {
      alert("Sessão expirada. Inicie o processo novamente.");
      showPage("page-recover");
      return;
    }

    resetForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      resetMessage.textContent = "";
      resetMessage.className = "";

      const newPassword = newPasswordInput.value;
      const confirm = confirmInput.value;

      if (newPassword.length < 6) {
        resetMessage.textContent = "A senha deve ter pelo menos 6 caracteres.";
        resetMessage.className = "msg-error";
        return;
      }

      if (newPassword !== confirm) {
        resetMessage.textContent = "As senhas não coincidem.";
        resetMessage.className = "msg-error";
        return;
      }

      try {
        const res = await fetch("/api/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, token, newPassword })
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
          resetMessage.textContent = data.error || "Erro ao redefinir senha.";
          resetMessage.className = "msg-error";
          return;
        }

        resetMessage.textContent = "Senha redefinida com sucesso!";
        resetMessage.className = "msg-success";

        sessionStorage.clear();

        setTimeout(() => {
          window.location.href = "index.html"; // volta ao login
        }, 1000);

      } catch (err) {
        console.error(err);
        resetMessage.textContent = "Erro no servidor.";
        resetMessage.className = "msg-error";
      }
    });
  }

});
