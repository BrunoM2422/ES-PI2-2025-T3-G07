document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("reset-form");
    const newPasswordInput = document.getElementById("newPassword");
    const confirmInput = document.getElementById("confirmPassword");
    const messageDiv = document.getElementById("message");
  
    const email = sessionStorage.getItem("recoveryEmail");
    const token = sessionStorage.getItem("recoveryToken");
  
    if (!email || !token) {
      alert("Sessão expirada. Inicie o processo novamente.");
      window.location.href = "recuperarSenha.html";
      return;
    }
  
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearMessage();
  
      const newPassword = newPasswordInput.value;
      const confirm = confirmInput.value;
  
      if (newPassword.length < 6)
        return showMessage("A senha deve ter pelo menos 6 caracteres.", "error");
  
      if (newPassword !== confirm)
        return showMessage("As senhas não coincidem.", "error");
  
      try {
        const res = await fetch("/api/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, token, newPassword })
        });
        const data = await res.json();
  
        if (!res.ok || !data.ok) {
          showMessage(data.error || "Erro ao redefinir senha.", "error");
          return;
        }
  
        showMessage("Senha redefinida com sucesso!", "success");
        sessionStorage.clear();
  
        setTimeout(() => {
          window.location.href = "index.html"; // volta ao login
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
  