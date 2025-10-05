//Author: Matheus Antony Lucas Lima
//Start date: 05/10/2025

document.getElementById("forms-institution").addEventListener("submit", function(e){
    const instituition = document.getElementById("instituition").ariaValueMax.trim();

    if(!instituition){
        alert("Preencha a instituição!");
    }else{
        document.getElementById("form-institution");
    }
});

