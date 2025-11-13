/* Autores: 
            Nicolas Mitjans Nunes
            Pedro Henrique Ribeiro Silva Murta
*/
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("token-form");
  const tokenInput = document.getElementById("token");
  const messageDiv = document.getElementById("message");

  const email = sessionStorage.getItem("recoveryEmail");
  if (!email) {
    alert("Email não encontrado. Volte e insira seu email novamente.");
    window.location.href = "recuperarSenha.html";
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessage();

    const token = tokenInput.value.trim();
    if (!token) return showMessage("Informe o token.", "error");

    try {
      console.log("🔍 Enviando token para verificação...");
      const res = await fetch("http://localhost:3000/api/verify-token", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token })
      });

      const data = await res.json();
      console.log("📦 Resposta do servidor:", data);

      if (!res.ok || !data.ok) {
        showMessage(data.error || "Token inválido ou expirado.", "error");
        return;
      }

      sessionStorage.setItem("recoveryToken", token);
      showMessage("Token validado!", "success");

      setTimeout(() => {
        window.location.href = "RedefinirSenha.html";
      }, 1000);
    } catch (err) {
      console.error("❌ Erro no fetch:", err);
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
