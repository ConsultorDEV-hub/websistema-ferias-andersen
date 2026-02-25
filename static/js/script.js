var calendar;
var colaboradoresDados = [];

document.addEventListener('DOMContentLoaded', function() {
    var calendarEl = document.getElementById('calendar');
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'pt-br',
        height: 'auto',
        headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,dayGridWeek' },
        events: '/listar_ferias',
        eventDataTransform: function(eventData) {
            const cor = stringToColor(eventData.nome);
            return {
                title: eventData.nome,
                start: eventData.inicio,
                end: eventData.fim,
                backgroundColor: cor,
                borderColor: cor,
                allDay: true
            };
        }
    });
    calendar.render();
    carregarColaboradores();
});

function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    let color = '#';
    for (let i = 0; i < 3; i++) {
        let value = (hash >> (i * 8)) & 0xFF;
        color += ('00' + value.toString(16)).substr(-2);
    }
    return color;
}

function carregarColaboradores() {
    fetch('/listar_colaboradores').then(res => res.json()).then(data => {
        colaboradoresDados = data;
        const select = document.getElementById('employee-select');
        const tbody = document.getElementById('tabela-saldos');
        select.innerHTML = '<option value="">Selecione...</option>';
        tbody.innerHTML = '';
        data.forEach(c => {
            select.innerHTML += `<option value="${c.id}">${c.nome}</option>`;
            tbody.innerHTML += `<tr><td>${c.nome}</td><td>${c.dias_direito}</td><td>${c.saldo}</td><td><button onclick="deletarEntidade(${c.id}, 'colaborador')" style="color:red; background:none; border:none; cursor:pointer">Excluir</button></td></tr>`;
        });
    });
}

function carregarHistorico() {
    fetch('/listar_ferias').then(res => res.json()).then(data => {
        const tbody = document.getElementById('tabela-historico');
        tbody.innerHTML = '';
        data.forEach(f => {
            // Calcula dias para exibição (ajustando a data final do calendário)
            const d1 = new Date(f.inicio);
            const d2 = new Date(f.fim);
            d2.setDate(d2.getDate() - 1); // remove o offset do FullCalendar
            const total = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;

            tbody.innerHTML += `<tr>
                <td>${f.nome}</td>
                <td>${f.inicio}</td>
                <td>${d2.toISOString().split('T')[0]}</td>
                <td>${total}</td>
                <td><button onclick="excluirRegistroFerias(${f.id}, ${total}, ${f.colab_id})" style="color:red; background:none; border:none; cursor:pointer">Excluir</button></td>
            </tr>`;
        });
    });
}

function calcularPreviaDias() {
    const inicio = document.getElementById('start-date').value;
    const fim = document.getElementById('end-date').value;
    const select = document.getElementById('employee-select');
    const container = document.getElementById('contador-container');

    if (inicio && fim && select.value) {
        const d1 = new Date(inicio);
        const d2 = new Date(fim);
        const total = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
        const colab = colaboradoresDados.find(c => c.id == select.value);

        if (colab) {
            container.style.display = 'block';
            document.getElementById('dias-selecionados').innerText = total > 0 ? total : 0;
            const saldoFinal = colab.saldo - total;
            document.getElementById('saldo-restante').innerText = saldoFinal;
            document.getElementById('saldo-restante').style.color = saldoFinal < 0 ? '#ff4b4b' : 'white';
        }
    } else {
        container.style.display = 'none';
    }
}

function registrarFerias() {
    const select = document.getElementById('employee-select');
    const inicio = document.getElementById('start-date').value;
    const fim = document.getElementById('end-date').value;

    if (!select.value || !inicio || !fim) { notify('Preencha tudo!'); return; }

    const colab = colaboradoresDados.find(c => c.id == select.value);
    const d1 = new Date(inicio);
    const d2 = new Date(fim);
    const total = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;

    if (total > colab.saldo) { notify('Saldo insuficiente!'); return; }

    let dataFimCal = new Date(fim);
    dataFimCal.setDate(dataFimCal.getDate() + 1);
    const fimFormatado = dataFimCal.toISOString().split('T')[0];

    fetch('/registrar_ferias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            id: colab.id, 
            nome: colab.nome,
            inicio: inicio, 
            fim: fimFormatado, 
            dias_calc: total 
        })
    }).then(() => {
        calendar.refetchEvents();
        notify('Férias registradas!');
        carregarColaboradores();
        carregarHistorico();
        document.getElementById('contador-container').style.display = 'none';
    });
}

function excluirRegistroFerias(idFerias, dias, idColab) {
    const senha = prompt("Digite a senha para excluir o registro:");
    if (senha === "Dev@400") {
        fetch('/deletar_registro_ferias', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_ferias: idFerias, dias: dias, id_colab: idColab })
        }).then(() => {
            notify('Registro removido e saldo devolvido!');
            calendar.refetchEvents();
            carregarColaboradores();
            carregarHistorico();
        });
    } else {
        notify('Senha incorreta!');
    }
}

function salvarColaborador() {
    const nome = document.getElementById('new-name').value;
    const dias = document.getElementById('new-days').value;
    fetch('/cadastrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nome, dias: dias })
    }).then(() => {
        notify('Colaborador cadastrado!');
        document.getElementById('new-name').value = '';
        carregarColaboradores();
    });
}

function deletarEntidade(id, tipo) {
    const msg = tipo === 'colaborador' ? "Excluir colaborador e TODOS os seus registros?" : "Excluir registro?";
    if(confirm(msg)) {
        const senha = prompt("Confirme a senha de administrador:");
        if (senha === "Dev@400") {
            fetch(`/deletar/${id}`, { method: 'DELETE' }).then(() => {
                carregarColaboradores();
                calendar.refetchEvents();
                carregarHistorico();
            });
        } else {
            notify('Senha incorreta!');
        }
    }
}

function openTab(evt, tabName) {
    var contents = document.getElementsByClassName("tab-content");
    var links = document.getElementsByClassName("tab-link");
    var mainPanel = document.getElementById("main-panel");

    for (let i = 0; i < contents.length; i++) contents[i].classList.remove("active");
    for (let i = 0; i < links.length; i++) links[i].classList.remove("active");
    
    if (tabName === 'cadastro') {
        mainPanel.classList.add("centered-mode");
    } else {
        mainPanel.classList.remove("centered-mode");
    }

    if (tabName === 'historico') carregarHistorico();

    document.getElementById(tabName).classList.add("active");
    evt.currentTarget.classList.add("active");
    if (tabName === 'calendario') setTimeout(() => { calendar.updateSize(); }, 300);
}

function toggleInfo() {
    document.getElementById('infoBox').classList.toggle('active');
}

function notify(m) {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = 'toast'; t.innerText = m;
    c.appendChild(t);
    setTimeout(() => { t.remove(); }, 3000);
}