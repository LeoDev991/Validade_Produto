    function gerarEtiqueta() {
        const produto = document.getElementById("produto").value;
        const dias = parseInt(document.getElementById("dias").value);

        if (!produto || isNaN(dias)) {
            alert("Preencha todos os campos corretamente.");
            return;
        }

        const hoje = new Date();
        const validade = new Date();
        validade.setDate(hoje.getDate() + dias);

        const formatarData = (data) => {
            return data.toLocaleDateString("pt-BR");
        };

        document.getElementById("nomeProduto").innerText = produto.toUpperCase();
        document.getElementById("fabricacao").innerText = formatarData(hoje);
        document.getElementById("validade").innerText = formatarData(validade);
    }
