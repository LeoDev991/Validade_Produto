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

    (function () {
        const REFRESH_MS = 5 * 60 * 1000;
        const LAST_REFRESH_KEY = "validade_produto_last_refresh";

        function bloquearAcessoLocal() {
            if (window.location.protocol === "file:") {
                document.body.innerHTML = `
                    <div style="
                        font-family: Arial, sans-serif;
                        display: grid;
                        place-items: center;
                        height: 100vh;
                        text-align: center;
                        color: #222;
                        background: #f8f8f8;
                        padding: 24px;
                        box-sizing: border-box;
                    ">
                        <div>
                            <h2>Acesso restrito</h2>
                            <p>Esta página não pode ser aberta diretamente em arquivo local.</p>
                            <p>Abra o sistema pelo navegador e mantenha a sessão ativa.</p>
                        </div>
                    </div>
                `;
                throw new Error("Acesso local bloqueado.");
            }
        }

        function bloquearCopiasEContexto() {
            const bloquear = (event) => {
                const alvo = event.target;
                if (alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA" || alvo.tagName === "SELECT")) {
                    return;
                }

                event.preventDefault();
            };

            document.addEventListener("contextmenu", bloquear, { passive: false });
            document.addEventListener("dragstart", bloquear, { passive: false });
            document.addEventListener("selectstart", bloquear, { passive: false });
            document.addEventListener("copy", bloquear, { passive: false });

            document.addEventListener("keydown", (event) => {
                const tecla = event.key.toLowerCase();
                const teclasBloqueadas = ["c", "v", "s", "u", "i", "j", "k", "f", "f12"];

                if ((event.ctrlKey || event.metaKey) && teclasBloqueadas.includes(tecla)) {
                    event.preventDefault();
                }

                if (tecla === "printscreen" || event.key === "F12") {
                    event.preventDefault();
                }
            });
        }

        function forcarAtualizacao() {
            const agora = Date.now();
            const ultimoRefresh = Number(sessionStorage.getItem(LAST_REFRESH_KEY) || "0");

            if (!ultimoRefresh || agora - ultimoRefresh >= REFRESH_MS) {
                sessionStorage.setItem(LAST_REFRESH_KEY, String(agora));
            }

            setInterval(() => {
                sessionStorage.setItem(LAST_REFRESH_KEY, String(Date.now()));
                window.location.reload();
            }, REFRESH_MS);
        }

        bloquearAcessoLocal();
        bloquearCopiasEContexto();
        forcarAtualizacao();
    })();
