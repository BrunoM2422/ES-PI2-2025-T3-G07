document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("recover-form");
    const emailInput = document.getElementById("email");
    const messageDiv = document.getElementById("message");
  
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearMessage();
  
      const email = emailInput.value.trim();
      if (!email) return showMessage("Informe seu email.", "error");
  
      try {
        const res = await fetch("/api/request-password-reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email })
        });
        const data = await res.json();
  
        if (!res.ok || !data.ok) {
          showMessage(data.error || "Erro ao enviar token.", "error");
          return;
        }
  
        // guarda o email na sessão
        sessionStorage.setItem("recoveryEmail", email);
        showMessage("Token enviado! Verifique seu email.", "success");
  
        setTimeout(() => {
          window.location.href = "verificarToken.html";
        }, 1000);
      } catch (err) {
        console.error(err);
        showMessage("Erro no servidor.", "error");
      }
    });
  
    function showMessage(text, type) {
      messageDiv.textContent = text;
      messageDiv.className = type === "success" ? "msg-success" : "msg-error";
    }
  
    function clearMessage() {
      messageDiv.textContent = "";
      messageDiv.className = "";
    }
  });
  