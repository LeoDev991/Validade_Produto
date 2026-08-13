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

    const formatarData = (data) => data.toLocaleDateString("pt-BR");

    document.getElementById("nomeProduto").innerText = produto.toUpperCase();
    document.getElementById("fabricacao").innerText = formatarData(hoje);
    document.getElementById("validade").innerText = formatarData(validade);
}

(function () {
    const REFRESH_MS = 5 * 60 * 1000;
    const LAST_REFRESH_KEY = "validade_produto_last_refresh";
    const ACCESS_COOKIE = "validade_acesso";
    const ACCESS_LOG_KEY = "validade_access_log";
    const BLOCKED_KEY = "validade_access_bloqueados";
    const COOKIE_CONSENT_KEY = "validade_cookie_consent";

    function setCookie(name, value, days) {
        const expires = new Date();
        expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
        document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
    }

    function getCookie(name) {
        const cookies = document.cookie.split(";");
        for (const cookie of cookies) {
            const [key, value] = cookie.trim().split("=");
            if (key === name) {
                try {
                    return decodeURIComponent(value);
                } catch (error) {
                    return value;
                }
            }
        }
        return "";
    }

    function salvarLog(chave, valor) {
        try {
            const atual = JSON.parse(localStorage.getItem(chave) || "[]");
            const lista = Array.isArray(atual) ? atual : [];
            lista.unshift(valor);
            localStorage.setItem(chave, JSON.stringify(lista.slice(0, 100)));
        } catch (error) {
            console.warn("Não foi possível salvar o log local:", error);
        }
    }

    function gerarFingerprint() {
        const dados = [
            navigator.userAgent,
            navigator.language,
            screen.width,
            screen.height,
            Intl.DateTimeFormat().resolvedOptions().timeZone || "",
            location.hostname,
            location.pathname
        ].join("|");

        return btoa(unescape(encodeURIComponent(dados))).slice(0, 32);
    }

    function coletarDadosAcesso() {
        const data = new Date();
        const referrer = document.referrer || "Acesso direto";
        const url = `${location.origin}${location.pathname}`;

        return {
            id: gerarFingerprint(),
            data: data.toISOString(),
            url,
            origem: referrer,
            host: location.host,
            pagina: location.pathname,
            navegador: navigator.userAgent,
            idioma: navigator.language,
            plataforma: navigator.platform,
            resolucao: `${screen.width}x${screen.height}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
            cookiesAtivados: navigator.cookieEnabled
        };
    }

    async function salvarConsentimentoServidor(dados) {
        try {
            await fetch('/api/consent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    deviceId: dados.id,
                    browser: dados.navegador,
                    platform: dados.plataforma,
                    language: dados.idioma,
                    screen: dados.resolucao,
                    hostname: dados.host,
                    pathname: dados.pagina,
                    referrer: dados.origem
                })
            });
        } catch (error) {
            console.warn('Não foi possível gravar o consentimento no servidor:', error);
        }
    }

    function bloquearAcessoLocal() {
        if (window.location.protocol === 'file:') {
            document.body.innerHTML = `
                <div style="font-family: Arial, sans-serif; display: grid; place-items: center; height: 100vh; text-align: center; color: #222; background: #f8f8f8; padding: 24px; box-sizing: border-box;">
                    <div>
                        <h2>Acesso restrito</h2>
                        <p>Esta página não pode ser aberta diretamente em arquivo local.</p>
                        <p>Abra o sistema no navegador e mantenha a sessão ativa.</p>
                    </div>
                </div>
            `;
            throw new Error('Acesso local bloqueado.');
        }
    }

    function bloquearCopiasEContexto() {
        const bloquear = (event) => {
            const alvo = event.target;
            if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.tagName === 'SELECT')) {
                return;
            }

            event.preventDefault();
        };

        document.addEventListener('contextmenu', bloquear, { passive: false });
        document.addEventListener('dragstart', bloquear, { passive: false });
        document.addEventListener('selectstart', bloquear, { passive: false });
        document.addEventListener('copy', bloquear, { passive: false });

        document.addEventListener('keydown', (event) => {
            const tecla = event.key.toLowerCase();
            const teclasBloqueadas = ['c', 'v', 's', 'u', 'i', 'j', 'k', 'f', 'f12'];

            if ((event.ctrlKey || event.metaKey) && teclasBloqueadas.includes(tecla)) {
                event.preventDefault();
            }

            if (tecla === 'printscreen' || event.key === 'F12') {
                event.preventDefault();
            }
        });
    }

    function forcarAtualizacao() {
        const agora = Date.now();
        const ultimoRefresh = Number(sessionStorage.getItem(LAST_REFRESH_KEY) || '0');

        if (!ultimoRefresh || agora - ultimoRefresh >= REFRESH_MS) {
            sessionStorage.setItem(LAST_REFRESH_KEY, String(agora));
        }

        setInterval(() => {
            sessionStorage.setItem(LAST_REFRESH_KEY, String(Date.now()));
            window.location.reload();
        }, REFRESH_MS);
    }

    function resetCookieConsent() {
        document.cookie = `${COOKIE_CONSENT_KEY}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Lax`;
    }

    function salvarAcessoNoStorage(dados) {
        try {
            const atual = JSON.parse(localStorage.getItem(ACCESS_LOG_KEY) || '[]');
            const lista = Array.isArray(atual) ? atual : [];
            lista.unshift(dados);
            localStorage.setItem(ACCESS_LOG_KEY, JSON.stringify(lista.slice(0, 200)));
        } catch (error) {
            console.warn('Não foi possível salvar o acesso no storage:', error);
        }
    }

    function aceitarTodosCookies() {
        const dados = coletarDadosAcesso();
        salvarAcessoNoStorage(dados);
        setCookie(COOKIE_CONSENT_KEY, JSON.stringify({ aceito: true, data: new Date().toISOString() }), 365);
        void salvarConsentimentoServidor(dados);
        window.location.reload();
    }

    function cookiesAceitos() {
        const valor = getCookie(COOKIE_CONSENT_KEY);
        if (valor) {
            try {
                const dados = JSON.parse(valor);
                if (dados && dados.aceito) {
                    return true;
                }
            } catch (error) {
                return false;
            }
        }

        return false;
    }

    function exibirTelaConsentimento() {
        document.body.innerHTML = `
            <div style="font-family: Arial, sans-serif; min-height: 100vh; display: grid; place-items: center; background: linear-gradient(135deg, #f3f4f6, #e5e7eb); color: #111827; padding: 24px; box-sizing: border-box;">
                <div style="max-width: 520px; width: 100%; background: #ffffff; border: 1px solid #d1d5db; border-radius: 16px; box-shadow: 0 12px 32px rgba(0,0,0,0.08); padding: 30px 24px; text-align: left;">
                    <h2 style="margin-top: 0; margin-bottom: 12px;">Consentimento de cookies</h2>
                    <p style="margin: 0 0 16px; line-height: 1.6; color: #374151;">
                        Este site exige que você aceite todos os cookies para liberar o acesso.
                        Sem essa autorização, o sistema permanece bloqueado.
                    </p>
                    <ul style="margin: 0 0 18px 18px; color: #374151; line-height: 1.8;">
                        <li>Registro de acesso e identificação do dispositivo</li>
                        <li>Controle de bloqueio e liberação</li>
                        <li>Manutenção de sessão e atualização automática</li>
                    </ul>
                    <button id="aceitarCookies" style="width: 100%; background: #2563eb; color: white; border: none; border-radius: 10px; padding: 14px 18px; font-size: 16px; font-weight: bold; cursor: pointer;">Aceitar todos os cookies</button>
                </div>
            </div>
        `;

        const botao = document.getElementById('aceitarCookies');
        if (botao) {
            botao.addEventListener('click', aceitarTodosCookies);
        }

        return false;
    }

    function validarAcesso() {
        try {
            const params = new URLSearchParams(window.location.search);
            if (params.get('consent') === 'reset') {
                resetCookieConsent();
                window.location.href = window.location.pathname;
                return;
            }

            if (!cookiesAceitos()) {
                exibirTelaConsentimento();
                throw new Error('Cookies não aceitos.');
            }

            const bloqueados = JSON.parse(localStorage.getItem(BLOCKED_KEY) || '[]');
            const dados = coletarDadosAcesso();
            const cookieAtual = getCookie(ACCESS_COOKIE);

            if (cookieAtual) {
                try {
                    const cookieDados = JSON.parse(cookieAtual);
                    if (cookieDados && cookieDados.id) {
                        dados.id = cookieDados.id;
                    }
                } catch (error) {
                    console.warn('Cookie de acesso inválido.', error);
                }
            }

            if (bloqueados.includes(dados.id)) {
                document.body.innerHTML = `
                    <div style="font-family: Arial, sans-serif; text-align: center; padding: 40px; color: #611a15; background: #fff2f2; min-height: 100vh; display: grid; place-items: center;">
                        <div>
                            <h2>Acesso bloqueado</h2>
                            <p>Este dispositivo foi bloqueado pelo desenvolvedor.</p>
                            <p>Entre em contato para liberar o acesso.</p>
                        </div>
                    </div>
                `;
                throw new Error('Acesso bloqueado pelo desenvolvedor.');
            }

            salvarAcessoNoStorage(dados);
            setCookie(ACCESS_COOKIE, JSON.stringify({ id: dados.id, host: dados.host, url: dados.url, data: dados.data }), 365);
            salvarLog(ACCESS_LOG_KEY, dados);
            void salvarConsentimentoServidor(dados);
        } catch (error) {
            if (error.message !== 'Acesso bloqueado pelo desenvolvedor.' && error.message !== 'Cookies não aceitos.') {
                console.warn('Erro ao validar acesso:', error);
            }
        }
    }

    bloquearAcessoLocal();
    validarAcesso();
    bloquearCopiasEContexto();
    forcarAtualizacao();
})();
