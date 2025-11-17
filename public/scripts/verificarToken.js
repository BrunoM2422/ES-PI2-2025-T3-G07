/* Autores: 
            Nicolas Mitjans Nunes
*/

/*
  Essa página verifica o Token enviado por email ao usuário, ao solicitar o serviço
  de recuperar senha
*/

//Faz com que o script só rode após todo o conteúdo HTML for carregado
document.addEventListener("DOMContentLoaded", () => {
  //Armazena os elementos HTML do formulário
  const form = document.getElementById("token-form");
  const tokenInput = document.getElementById("token");
  const messageDiv = document.getElementById("message");

  //Verifica o Email
  const email = sessionStorage.getItem("recoveryEmail");
  if (!email) {
    alert("Email não encontrado. Volte e insira seu email novamente.");
    window.location.href = "recuperarSenha.html";
    return;
  }

  //Executado quando o usuário clica enviar
  form.addEventListener("submit", async (e) => {
    e.preventDefault();//Impede que o form recarregue a página
    clearMessage();

    const token = tokenInput.value.trim(); //captura o valor digitado, removendo espaços em branco
    if (!token) return showMessage("Informe o token.", "error"); //controle de se o campo está vazio

    //Bloco para tentar comunicalçao com o servidor
    try {
      console.log("🔍 Enviando token para verificação...");
      //envia uma requisição assincrona para o servidor
      const res = await fetch("http://localhost:3000/api/verify-token", { 
        method: "POST", //post envia dados
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token }) //envia o email e o token ao servidor no modelo JSON
      });

      //Faz o tratamento da resposta
      const data = await res.json(); //Pega a resposta do servidor e converte para objeto JS
      console.log("📦 Resposta do servidor:", data);

      //Controle de erro
      if (!res.ok || !data.ok) {
        showMessage(data.error || "Token inválido ou expirado.", "error");
        return;
      }


      sessionStorage.setItem("recoveryToken", token); //Armazena o token
      showMessage("Token validado!", "success");

      setTimeout(() => {
        window.location.href = "RedefinirSenha.html";
      }, 1000);
    } catch (err) {
      console.error("❌ Erro no fetch:", err);
      showMessage("Erro no servidor.", "error");
    }
  });

  //Atualiza o messageDiv e aplica o design
  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type === "success" ? "msg-success" : "msg-error";
  }

  //Limpa o texto e a classe messageDiv
  function clearMessage() {
    messageDiv.textContent = "";
    messageDiv.className = "";
  }
});
