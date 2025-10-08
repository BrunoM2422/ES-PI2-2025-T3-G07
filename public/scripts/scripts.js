//Author: Matheus Antony Lucas Lima
//Start date: 05/10/2025
// ====== seu código original até a função performAccountCreation ======

function performAccountCreation(accountData) {
    setSubmitButtonState('loading', 'Criando conta...');

    // Enviar os dados para o servidor Node via API REST
    fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accountData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.message.includes('sucesso')) {
            // Salvar temporariamente os dados no navegador
            localStorage.setItem('lastRegisteredUser', JSON.stringify(data.data));

            // Redirecionar para página de sucesso
            window.location.href = '/success.html';
        } else {
            handleAccountCreationError(data.message);
        }
    })
    .catch(err => {
        console.error(err);
        handleAccountCreationError('Erro ao conectar ao servidor.');
    })
    .finally(() => {
        setSubmitButtonState('normal', 'Criar Conta');
    });
}
