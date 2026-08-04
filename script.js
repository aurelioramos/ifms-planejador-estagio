/**
 * SISTEMA DE PLANEJAMENTO DO ESTÁGIO SUPERVISIONADO
 */

// --- ESTADO DA APLICAÇÃO ---
const WEEKDAYS = [
    { id: 1, name: 'Segunda-feira', defaultHours: 3, defaultTime: '' },
    { id: 2, name: 'Terça-feira', defaultHours: 0, defaultTime: '' },
    { id: 3, name: 'Quarta-feira', defaultHours: 3, defaultTime: '' },
    { id: 4, name: 'Quinta-feira', defaultHours: 0, defaultTime: '' },
    { id: 5, name: 'Sexta-feira', defaultHours: 3, defaultTime: '' },
    { id: 6, name: 'Sábado', defaultHours: 0, defaultTime: '' },
    { id: 0, name: 'Domingo', defaultHours: 0, defaultTime: '' }
];

let state = {
    obsHours: 35,
    partHours: 45,
    regHours: 15,
    startDate: '',
    endDate: '',
    availability: {},
    blackoutDates: [
        { date: '2026-09-07', desc: 'Independência do Brasil' },
        { date: '2026-10-11', desc: 'Divisão do Estado' },
        { date: '2026-10-12', desc: 'Padroeira do Brasil' },
        { date: '2026-11-02', desc: 'Finados' },
        { date: '2026-11-15', desc: 'Proclamação da República' },
        { date: '2026-11-20', desc: 'Dia da Consciência Negra' }
    ],
    schedule: []
};

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    initDefaultDates();
    renderAvailabilityTable();
    setupEventListeners();
    calculateTotalRequired();
    loadStateFromLocalStorage();
    renderBlackoutList();
});

function initDefaultDates() {
    const currentYear = new Date().getFullYear();
    const start = `${currentYear}-08-17`;
    const end = `${currentYear}-11-23`;

    document.getElementById('startDate').value = start;
    document.getElementById('endDate').value = end;
}

function renderAvailabilityTable() {
    const tbody = document.getElementById('availabilityBody');
    tbody.innerHTML = '';

    WEEKDAYS.forEach(day => {
        const isChecked = day.defaultHours > 0;
        const tr = document.createElement('tr');

        tr.innerHTML = `
            <td>
                <input type="checkbox" id="check_day_${day.id}" ${isChecked ? 'checked' : ''} onchange="toggleDayRow(${day.id})">
            </td>
            <td><label for="check_day_${day.id}">${day.name}</label></td>
            <td>
                <input type="number" id="hours_day_${day.id}" value="${day.defaultHours}" min="1" max="6" ${!isChecked ? 'disabled' : ''}>
            </td>
            <td>
                <input type="time" id="time_day_${day.id}" value="${day.defaultTime}" ${!isChecked ? 'disabled' : ''}>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function toggleDayRow(dayId) {
    const isChecked = document.getElementById(`check_day_${dayId}`).checked;
    const hoursInput = document.getElementById(`hours_day_${dayId}`);
    const timeInput = document.getElementById(`time_day_${dayId}`);

    hoursInput.disabled = !isChecked;
    timeInput.disabled = !isChecked;
    if (isChecked && !hoursInput.value) hoursInput.value = 4;
}

function setupEventListeners() {
    ['obsHours', 'partHours', 'regHours'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            calculateTotalRequired();
            if (state.schedule.length > 0) updateUI();
        });
    });

    document.getElementById('addBlackoutBtn').addEventListener('click', addBlackoutDate);
    document.getElementById('generateScheduleBtn').addEventListener('click', generateSchedule);
    document.getElementById('saveStateBtn').addEventListener('click', saveStateToLocalStorage);
    document.getElementById('exportIcsBtn').addEventListener('click', exportToICS);
    document.getElementById('btnAddManual').addEventListener('click', addManualActivity);
    document.getElementById('btn-exportar-pdf').addEventListener('click', () => {
        queueFichaPdfGeneration({ download: true });
    });
    document.getElementById('btn-atualizar-pdf').addEventListener('click', () => {
        queueFichaPdfGeneration({ download: false });
    });

    window.addEventListener('beforeunload', () => {
        if (currentFichaPdfUrl) URL.revokeObjectURL(currentFichaPdfUrl);
    });
}

function calculateTotalRequired() {
    const obs = parseFloat(document.getElementById('obsHours').value) || 0;
    const part = parseFloat(document.getElementById('partHours').value) || 0;
    const reg = parseFloat(document.getElementById('regHours').value) || 0;

    if (obs < 0 || part < 0 || reg < 0) {
        showAlert('As horas não podem ser valores negativos.');
        return 0;
    }

    const total = obs + part + reg;
    document.getElementById('totalRequiredHours').textContent = `${total}h`;
    return total;
}

// ADICIONAR DATAS INDISPONÍVEIS / FERIADOS E RECESSOS
function addBlackoutDate() {
    hideAlert();
    const startDateVal = document.getElementById('blackoutStartDateInput').value;
    let endDateVal = document.getElementById('blackoutEndDateInput').value;
    const desc = document.getElementById('blackoutDescInput').value.trim() || 'Data Indisponível';

    if (!startDateVal) {
        showAlert('Por favor, selecione ao menos a Data Inicial do bloqueio.');
        return;
    }

    if (!endDateVal) {
        endDateVal = startDateVal;
    }

    const start = new Date(startDateVal + 'T00:00:00');
    const end = new Date(endDateVal + 'T00:00:00');

    if (end < start) {
        showAlert('A Data Final deve ser igual ou posterior à Data Inicial.');
        return;
    }

    const current = new Date(start);

    while (current <= end) {
        const isoDate = current.toISOString().split('T')[0];

        if (!state.blackoutDates.some(b => b.date === isoDate)) {
            state.blackoutDates.push({
                date: isoDate,
                desc: desc
            });
        }

        current.setDate(current.getDate() + 1);
    }

    state.blackoutDates.sort((a, b) => new Date(a.date) - new Date(b.date));

    document.getElementById('blackoutStartDateInput').value = '';
    document.getElementById('blackoutEndDateInput').value = '';
    document.getElementById('blackoutDescInput').value = '';

    renderBlackoutList();
}

function removeBlackoutDate(dateStr) {
    state.blackoutDates = state.blackoutDates.filter(b => b.date !== dateStr);
    renderBlackoutList();
}

function renderBlackoutList() {
    const list = document.getElementById('blackoutList');
    list.innerHTML = '';

    if (state.blackoutDates.length === 0) {
        return;
    }

    state.blackoutDates.forEach(b => {
        const li = document.createElement('li');
        li.className = 'blackout-item';
        li.innerHTML = `
            <span>📅 <strong>${formatDateBR(b.date)}</strong> (${b.desc})</span>
            <button type="button" onclick="removeBlackoutDate('${b.date}')" title="Remover data">&times;</button>
        `;
        list.appendChild(li);
    });
}

// --- ALGORITMO PRINCIPAL: GERAÇÃO DO CRONOGRAMA ---
function generateSchedule() {
    hideAlert();

    const obsVal = parseFloat(document.getElementById('obsHours').value) || 0;
    const partVal = parseFloat(document.getElementById('partHours').value) || 0;
    const regVal = parseFloat(document.getElementById('regHours').value) || 0;
    const totalRequired = obsVal + partVal + regVal;

    const startDateStr = document.getElementById('startDate').value;
    const endDateStr = document.getElementById('endDate').value;

    if (!startDateStr || !endDateStr) {
        showAlert('Por favor, defina o período de realização.');
        return;
    }

    const start = new Date(startDateStr + 'T00:00:00');
    const end = new Date(endDateStr + 'T00:00:00');

    if (end < start) {
        showAlert('A data final deve ser igual ou posterior à data inicial.');
        return;
    }

    const availability = {};
    let hasSelectedDay = false;
    let limitExceeded = false;
    let weeklyConfiguredHours = 0;

    WEEKDAYS.forEach(day => {
        const chk = document.getElementById(`check_day_${day.id}`);
        if (chk && chk.checked) {
            hasSelectedDay = true;
            const hours = parseFloat(document.getElementById(`hours_day_${day.id}`).value) || 0;
            const startTime = document.getElementById(`time_day_${day.id}`).value;

            if (hours > 6) {
                limitExceeded = true;
            }

            weeklyConfiguredHours += hours;
            availability[day.id] = { hours, startTime };
        }
    });

    if (limitExceeded) {
        showAlert('A carga horária diária não pode ultrapassar 6 horas.');
        return;
    }

    // Validação do Limite Semanal (Max 30h)
    if (weeklyConfiguredHours > 30) {
        showAlert(`A carga horária semanal configurada (${weeklyConfiguredHours}h) ultrapassa o limite máximo de 30 horas por semana.`);
        return;
    }

    if (!hasSelectedDay) {
        showAlert('Selecione pelo menos um dia da semana para realizar o estágio.');
        return;
    }

    const modalities = [
        { type: 'Observação', remaining: obsVal },
        { type: 'Participação', remaining: partVal },
        { type: 'Regência', remaining: regVal }
    ];

    let currentModIndex = 0;
    const schedule = [];
    const currentDate = new Date(start);
    const blackoutSet = new Set(state.blackoutDates.map(b => b.date));

    while (currentDate <= end && currentModIndex < modalities.length) {
        const isoDate = currentDate.toISOString().split('T')[0];
        const dayOfWeek = currentDate.getDay();

        if (availability[dayOfWeek] && !blackoutSet.has(isoDate)) {
            let availableHoursToday = availability[dayOfWeek].hours;
            const startTime = availability[dayOfWeek].startTime || '08:00';

            while (availableHoursToday > 0 && currentModIndex < modalities.length) {
                const mod = modalities[currentModIndex];

                if (mod.remaining <= 0) {
                    currentModIndex++;
                    continue;
                }

                const hoursToAssign = Math.min(availableHoursToday, mod.remaining);

                schedule.push({
                    id: Date.now() + Math.random(),
                    date: isoDate,
                    dayOfWeek: getDayName(dayOfWeek),
                    modality: mod.type,
                    hours: hoursToAssign,
                    startTime: startTime,
                    endTime: calculateEndTime(startTime, hoursToAssign)
                });

                mod.remaining -= hoursToAssign;
                availableHoursToday -= hoursToAssign;

                if (mod.remaining <= 0) {
                    currentModIndex++;
                }
            }
        }

        currentDate.setDate(currentDate.getDate() + 1);
    }

    state.schedule = schedule;
    updateUI(totalRequired);
}

function addManualActivity() {
    hideAlert();
    const dateVal = document.getElementById('manualDate').value;
    const modalityVal = document.getElementById('manualModality').value;
    const hoursVal = parseFloat(document.getElementById('manualHours').value);
    const timeVal = document.getElementById('manualTime').value;

    if (!dateVal) {
        showAlert('Por favor, informe a data para a nova atividade.');
        return;
    }

    if (isNaN(hoursVal) || hoursVal <= 0) {
        showAlert('Por favor, informe uma quantidade de horas válida.');
        return;
    }

    // Validação do Limite Diário Acumulado (Máx 6h)
    const existingDailyHours = getDailyHoursForDate(state.schedule, dateVal);
    if (existingDailyHours + hoursVal > 6) {
        showAlert(`A carga horária diária total para ${formatDateBR(dateVal)} ultrapassaria 6 horas (já existem ${existingDailyHours}h planejadas).`);
        return;
    }

    // Validação do Limite Semanal Acumulado (Máx 30h)
    const existingWeeklyHours = getWeeklyHoursForDate(state.schedule, dateVal);
    if (existingWeeklyHours + hoursVal > 30) {
        showAlert(`A carga horária semanal total ultrapassaria 30 horas (a semana de ${formatDateBR(dateVal)} já conta com ${existingWeeklyHours}h planejadas).`);
        return;
    }

    const dateObj = new Date(dateVal + 'T00:00:00');
    const dayOfWeekName = getDayName(dateObj.getDay());

    state.schedule.push({
        id: Date.now() + Math.random(),
        date: dateVal,
        dayOfWeek: dayOfWeekName,
        modality: modalityVal,
        hours: hoursVal,
        startTime: timeVal || '08:00',
        endTime: calculateEndTime(timeVal || '08:00', hoursVal)
    });

    state.schedule.sort((a, b) => new Date(a.date) - new Date(b.date));

    document.getElementById('manualDate').value = '';
    document.getElementById('manualModality').value = 'Observação';
    document.getElementById('manualHours').value = '';
    document.getElementById('manualTime').value = '08:00';

    updateUI();
}

function updateUI(totalRequired) {
    if (totalRequired === undefined) {
        totalRequired = calculateTotalRequired();
    }

    const schedule = state.schedule;
    const plannedHours = schedule.reduce((sum, item) => sum + item.hours, 0);
    const remaining = totalRequired - plannedHours;
    const percent = totalRequired > 0 ? Math.min(100, Math.round((plannedHours / totalRequired) * 100)) : 0;

    const currentObs = schedule.filter(i => i.modality === 'Observação').reduce((sum, i) => sum + i.hours, 0);
    const currentPart = schedule.filter(i => i.modality === 'Participação').reduce((sum, i) => sum + i.hours, 0);
    const currentReg = schedule.filter(i => i.modality === 'Regência').reduce((sum, i) => sum + i.hours, 0);

    const targetObs = parseFloat(document.getElementById('obsHours').value) || 0;
    const targetPart = parseFloat(document.getElementById('partHours').value) || 0;
    const targetReg = parseFloat(document.getElementById('regHours').value) || 0;

    document.getElementById('currentObs').textContent = `${currentObs}h`;
    document.getElementById('targetObs').textContent = `${targetObs}h`;

    document.getElementById('currentPart').textContent = `${currentPart}h`;
    document.getElementById('targetPart').textContent = `${targetPart}h`;

    document.getElementById('currentReg').textContent = `${currentReg}h`;
    document.getElementById('targetReg').textContent = `${targetReg}h`;

    document.getElementById('metricRequired').textContent = `${totalRequired}h`;
    document.getElementById('metricPlanned').textContent = `${plannedHours}h`;
    document.getElementById('metricRemaining').textContent = `${remaining > 0 ? remaining : 0}h`;

    const uniqueDatesCount = new Set(schedule.map(i => i.date)).size;
    document.getElementById('metricDaysCount').textContent = uniqueDatesCount;
    document.getElementById('metricPercent').textContent = `${percent}%`;

    const statusBanner = document.getElementById('statusBanner');
    statusBanner.className = 'status-banner';

    if (plannedHours >= totalRequired) {
        const lastActivity = schedule[schedule.length - 1];
        const completionDate = lastActivity ? formatDateBR(lastActivity.date) : '-';

        document.getElementById('metricCompletionDate').textContent = completionDate;

        if (plannedHours === totalRequired) {
            statusBanner.classList.add('status-sufficient');
            statusBanner.innerHTML = `<strong>Planejamento Suficiente!</strong> A carga horária total exigida será concluída em ${completionDate}.`;
        } else {
            const excess = plannedHours - totalRequired;
            statusBanner.classList.add('status-exceeding');
            statusBanner.innerHTML = `<strong>Planejamento Excedente:</strong> Foram planejadas ${excess} hora(s) a mais que o necessário. Data de conclusão: ${completionDate}.`;
        }
    } else {
        document.getElementById('metricCompletionDate').textContent = 'Incompleto';
        statusBanner.classList.add('status-insufficient');
        statusBanner.innerHTML = `<strong>Planejamento Insuficiente:</strong> Com a disponibilidade informada, será possível cumprir ${plannedHours} das ${totalRequired} horas obrigatórias. Ainda faltam <strong>${remaining} horas</strong>.`;
    }

    renderScheduleTable();

    document.getElementById('scheduleSection').classList.remove('hidden');
    scheduleFichaPdfPreview();
}

// function renderScheduleTable() {
//     const tbody = document.getElementById('scheduleBody');
//     tbody.innerHTML = '';

//     if (state.schedule.length === 0) {
//         tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Nenhuma atividade no cronograma.</td></tr>';
//         return;
//     }

//     const grouped = {};
//     state.schedule.forEach((item, index) => {
//         if (!grouped[item.date]) {
//             grouped[item.date] = {
//                 date: item.date,
//                 dayOfWeek: item.dayOfWeek,
//                 totalHours: 0,
//                 items: []
//             };
//         }
//         grouped[item.date].items.push({ ...item, originalIndex: index });
//         grouped[item.date].totalHours += item.hours;
//     });

//     Object.keys(grouped).sort().forEach(dateKey => {
//         const group = grouped[dateKey];

//         const headerTr = document.createElement('tr');
//         headerTr.className = 'date-header-row';
//         headerTr.innerHTML = `
//             <td colspan="3">
//                 📅 <strong>${formatDateBR(group.date)}</strong> — ${group.dayOfWeek}
//             </td>
//             <td colspan="3" style="text-align: right;">
//                 Total do Dia: <strong>${group.totalHours}h</strong>
//             </td>
//         `;
//         tbody.appendChild(headerTr);

//         group.items.forEach(item => {
//             const tr = document.createElement('tr');
//             const index = item.originalIndex;

//             let badgeClass = 'badge-obs';
//             let badgeCode = '[OBS]';
//             if (item.modality === 'Participação') { badgeClass = 'badge-part'; badgeCode = '[PAR]'; }
//             if (item.modality === 'Regência') { badgeClass = 'badge-reg'; badgeCode = '[REG]'; }

//             tr.innerHTML = `
//                 <td><input type="date" value="${item.date}" onchange="updateActivity(${index}, 'date', this.value)"></td>
//                 <td>${item.dayOfWeek}</td>
//                 <td>
//                     <select onchange="updateActivity(${index}, 'modality', this.value)">
//                         <option value="Observação" ${item.modality === 'Observação' ? 'selected' : ''}>Observação</option>
//                         <option value="Participação" ${item.modality === 'Participação' ? 'selected' : ''}>Participação</option>
//                         <option value="Regência" ${item.modality === 'Regência' ? 'selected' : ''}>Regência</option>
//                     </select>
//                     <span class="badge ${badgeClass}">${badgeCode}</span>
//                 </td>
//                 <td>
//                     <input type="number" min="0.5" max="6" step="0.5" value="${item.hours}" style="width:70px" onchange="updateActivity(${index}, 'hours', this.value)">
//                 </td>
//                 <td>
//                     <input type="time" value="${item.startTime || ''}" onchange="updateActivity(${index}, 'startTime', this.value)">
//                 </td>
//                 <td>
//                     <button type="button" class="btn btn-sm btn-danger" onclick="deleteActivity(${index})">Remover</button>
//                 </td>
//             `;
//             tbody.appendChild(tr);
//         });
//     });
// }
function renderScheduleTable() {
    const tbody = document.getElementById('scheduleBody');
    tbody.innerHTML = '';

    if (state.schedule.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Nenhuma atividade no cronograma.</td></tr>';
        return;
    }

    // Agrupamento por Semana (Chave: Data de início da semana)
    const weeksGrouped = {};

    state.schedule.forEach((item, index) => {
        const weekRange = getWeekRange(item.date);
        const weekKey = weekRange.start;

        if (!weeksGrouped[weekKey]) {
            weeksGrouped[weekKey] = {
                start: weekRange.start,
                end: weekRange.end,
                totalHours: 0,
                items: []
            };
        }

        weeksGrouped[weekKey].items.push({ ...item, originalIndex: index });
        weeksGrouped[weekKey].totalHours += item.hours;
    });

    // Ordena as semanas cronologicamente
    const sortedWeekKeys = Object.keys(weeksGrouped).sort();

    sortedWeekKeys.forEach((weekKey, weekIndex) => {
        const week = weeksGrouped[weekKey];

        // Cabeçalho da Semana
        const weekHeaderTr = document.createElement('tr');
        weekHeaderTr.className = 'week-header-row';
        weekHeaderTr.style.backgroundColor = '#e9ecef';
        weekHeaderTr.style.fontWeight = 'bold';

        weekHeaderTr.innerHTML = `
            <td colspan="3" style="padding: 10px 12px;">
                🗓️ <strong>Semana ${weekIndex + 1}</strong> (${formatDateBR(week.start)} a ${formatDateBR(week.end)})
            </td>
            <td colspan="3" style="text-align: right; padding: 10px 12px;">
                Total da Semana: <strong>${week.totalHours}h / 30h</strong>
            </td>
        `;
        tbody.appendChild(weekHeaderTr);

        // Atividades pertencentes a esta semana
        week.items.forEach(item => {
            const tr = document.createElement('tr');
            const index = item.originalIndex;

            let badgeClass = 'badge-obs';
            let badgeCode = '[OBS]';
            if (item.modality === 'Participação') { badgeClass = 'badge-part'; badgeCode = '[PAR]'; }
            if (item.modality === 'Regência') { badgeClass = 'badge-reg'; badgeCode = '[REG]'; }

            tr.innerHTML = `
                <td>
                    <input type="date" value="${item.date}" onchange="updateActivity(${index}, 'date', this.value)">
                </td>
                <td>${item.dayOfWeek}</td>
                <td>
                    <select onchange="updateActivity(${index}, 'modality', this.value)">
                        <option value="Observação" ${item.modality === 'Observação' ? 'selected' : ''}>Observação</option>
                        <option value="Participação" ${item.modality === 'Participação' ? 'selected' : ''}>Participação</option>
                        <option value="Regência" ${item.modality === 'Regência' ? 'selected' : ''}>Regência</option>
                    </select>
                    <span class="badge ${badgeClass}">${badgeCode}</span>
                </td>
                <td>
                    <input type="number" min="0.5" max="6" step="0.5" value="${item.hours}" style="width:70px" onchange="updateActivity(${index}, 'hours', this.value)">
                </td>
                <td>
                    <input type="time" value="${item.startTime || ''}" onchange="updateActivity(${index}, 'startTime', this.value)">
                </td>
                <td>
                    <button type="button" class="btn btn-sm btn-danger" onclick="deleteActivity(${index})">Remover</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    });

    renderAtividadesTable(state.schedule);
}

function renderAtividadesTable(atividades) {

    // 3. Preenche a tabela dinamicamente
    const tbody = document.querySelector('#pdf-tabela-atividades tbody');
    tbody.innerHTML = ''; // Limpa antes de popular

    // Insere as atividades do planejamento
    atividades.forEach(ativ => {
        let modalidadeClass = 'badge-pill-obs';
        let modalidade = ativ.modality;
        if (modalidade == 'Participação') {
            modalidadeClass = 'badge-pill-part';
        }
        else if (modalidade == 'Regência') {
            modalidadeClass = 'badge-pill-reg';
        }
        tbody.innerHTML += `
            <tr>
                <td>${formatDate(ativ.date)}</td>
                <td>${ativ.hours}</td>
                <td style="text-align: start; vertical-align: baseline;"><span class="badge-pill ${modalidadeClass}">${ativ.modality}</span></td>
                <td></td>
            </tr>
        `;
    });

    // Insere linhas vazias adicionais para manter o visual de ficha padrão (opcional)
    for (let i = 0; i < 3; i++) {
        tbody.innerHTML += `
            <tr>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
            </tr>
        `;
    }
}

function updateActivity(index, field, value) {
    hideAlert();

    if (field === 'hours') {
        const val = parseFloat(value);
        const targetDate = state.schedule[index].date;

        const dailyHoursExcludingSelf = getDailyHoursForDate(state.schedule, targetDate, index);
        if (dailyHoursExcludingSelf + val > 6) {
            showAlert(`A carga horária diária total em ${formatDateBR(targetDate)} não pode ultrapassar 6 horas.`);
            renderScheduleTable();
            return;
        }

        const weeklyHoursExcludingSelf = getWeeklyHoursForDate(state.schedule, targetDate, index);
        if (weeklyHoursExcludingSelf + val > 30) {
            showAlert(`A carga horária semanal total não pode ultrapassar 30 horas.`);
            renderScheduleTable();
            return;
        }

        state.schedule[index].hours = val;
    } else if (field === 'date') {
        const targetDate = value;
        const currentHours = state.schedule[index].hours;

        const dailyHoursTarget = getDailyHoursForDate(state.schedule, targetDate, index);
        if (dailyHoursTarget + currentHours > 6) {
            showAlert(`A carga horária diária em ${formatDateBR(targetDate)} ultrapassaria 6 horas com essa alteração.`);
            renderScheduleTable();
            return;
        }

        const weeklyHoursTarget = getWeeklyHoursForDate(state.schedule, targetDate, index);
        if (weeklyHoursTarget + currentHours > 30) {
            showAlert(`A carga horária semanal da nova data ultrapassaria 30 horas com essa alteração.`);
            renderScheduleTable();
            return;
        }

        state.schedule[index].date = value;
        const dateObj = new Date(value + 'T00:00:00');
        state.schedule[index].dayOfWeek = getDayName(dateObj.getDay());
        state.schedule.sort((a, b) => new Date(a.date) - new Date(b.date));
    } else if (field === 'startTime') {
        state.schedule[index].startTime = value;
        state.schedule[index].endTime = calculateEndTime(value, state.schedule[index].hours);
    } else {
        state.schedule[index][field] = value;
    }

    updateUI();
}

function deleteActivity(index) {
    state.schedule.splice(index, 1);
    updateUI();
}

function exportToICS() {
    if (!state.schedule || state.schedule.length === 0) {
        showAlert('Não há nenhuma atividade planejada para exportar.');
        return;
    }

    let icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Sistema Planejamento Estagio Supervisionado//PT-BR',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH'
    ];

    state.schedule.forEach(item => {
        const dateClean = item.date.replace(/-/g, '');
        const startTimeClean = item.startTime ? item.startTime.replace(':', '') + '00' : '080000';
        const endTimeClean = item.endTime ? item.endTime.replace(':', '') + '00' : '120000';

        const dtStart = `${dateClean}T${startTimeClean}`;
        const dtEnd = `${dateClean}T${endTimeClean}`;

        icsContent.push('BEGIN:VEVENT');
        icsContent.push(`SUMMARY:Estágio Supervisionado — ${item.modality}`);
        icsContent.push(`DESCRIPTION:Atividade de ${item.modality} (${item.hours}h) pelo Estágio Supervisionado.`);
        icsContent.push(`DTSTART:${dtStart}`);
        icsContent.push(`DTEND:${dtEnd}`);
        icsContent.push(`STATUS:CONFIRMED`);
        icsContent.push('END:VEVENT');
    });

    icsContent.push('END:VCALENDAR');

    const blob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'planejamento_estagio.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function saveStateToLocalStorage() {
    state.obsHours = document.getElementById('obsHours').value;
    state.partHours = document.getElementById('partHours').value;
    state.regHours = document.getElementById('regHours').value;
    state.startDate = document.getElementById('startDate').value;
    state.endDate = document.getElementById('endDate').value;

    localStorage.setItem('estagio_planning_state', JSON.stringify(state));
    alert('Planejamento salvo com sucesso!');
}

function loadStateFromLocalStorage() {
    const saved = localStorage.getItem('estagio_planning_state');
    if (saved) {
        try {
            state = JSON.parse(saved);
            document.getElementById('obsHours').value = state.obsHours || 35;
            document.getElementById('partHours').value = state.partHours || 45;
            document.getElementById('regHours').value = state.regHours || 15;
            if (state.startDate) document.getElementById('startDate').value = state.startDate;
            if (state.endDate) document.getElementById('endDate').value = state.endDate;

            if (state.blackoutDates) {
                state.blackoutDates.sort((a, b) => new Date(a.date) - new Date(b.date));
                renderBlackoutList();
            }

            if (state.schedule && state.schedule.length > 0) {
                updateUI();
            }
        } catch (e) {
            console.error('Erro ao carregar dados salvos', e);
        }
    }
}

// --- FUNÇÕES AUXILIARES DE CÁLCULO DE PERÍODOS E LIMITES ---

function getWeekRange(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay(); // 0 = Domingo, 1 = Segunda, ...
    const diffToMonday = (day === 0 ? -6 : 1 - day);

    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
        start: monday.toISOString().split('T')[0],
        end: sunday.toISOString().split('T')[0]
    };
}

function getDailyHoursForDate(schedule, targetDateStr, excludeIndex = -1) {
    return schedule.reduce((sum, item, idx) => {
        if (idx === excludeIndex) return sum;
        if (item.date === targetDateStr) {
            return sum + item.hours;
        }
        return sum;
    }, 0);
}

function getWeeklyHoursForDate(schedule, targetDateStr, excludeIndex = -1) {
    const targetWeek = getWeekRange(targetDateStr);
    return schedule.reduce((sum, item, idx) => {
        if (idx === excludeIndex) return sum;
        if (item.date >= targetWeek.start && item.date <= targetWeek.end) {
            return sum + item.hours;
        }
        return sum;
    }, 0);
}

function getDayName(dayIdx) {
    const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    return days[dayIdx] || '';
}

function formatDateBR(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function calculateEndTime(startTimeStr, hours) {
    if (!startTimeStr) return '12:00';
    const [h, m] = startTimeStr.split(':').map(Number);
    const totalMinutes = h * 60 + m + Math.round(hours * 60);
    const endH = Math.floor(totalMinutes / 60) % 24;
    const endM = totalMinutes % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}
function showAlert(msg) {
    const box = document.getElementById('alertBox');
    box.textContent = msg;
    box.classList.remove('hidden');
}

function hideAlert() {
    const box = document.getElementById('alertBox');
    box.classList.add('hidden');
}

function formatDate(date) {
    return date?.split('-').reverse().join('/') || '';
}

// --- GERAÇÃO, PAGINAÇÃO E VISUALIZAÇÃO DA FICHA EM PDF ---
let currentFichaPdfUrl = null;
let pdfPreviewTimer = null;
let pdfGenerationQueue = Promise.resolve();

function getFichaMetadata() {
    // Estes valores podem ser substituídos futuramente por campos do formulário.
    return {
        nomeAluno: '',
        nomeOrientador: 'Aurélio Vargas Ramos Júnior',
        ano: new Date().getFullYear()
    };
}

function syncFichaTemplateData() {
    const metadata = getFichaMetadata();

    renderAtividadesTable(state.schedule);
    document.getElementById('pdf-nome-aluno').textContent =
        metadata.nomeAluno || '_______________________________________';
    document.getElementById('pdf-nome-orientador').textContent =
        metadata.nomeOrientador || '____________________________';
    document.getElementById('pdf-ano').textContent = metadata.ano;

    return metadata;
}

function removeIdsFromClone(element) {
    element.removeAttribute('id');
    element.querySelectorAll('[id]').forEach(child => child.removeAttribute('id'));
    return element;
}

function createFichaPdfPage(isFirstPage, pageNumber) {
    const staging = document.getElementById('ficha-pdf-pages');
    const sourceHeader = document.getElementById('ficha-cabecalho-modelo');
    const sourceTitle = document.getElementById('ficha-titulo-modelo');
    const sourceStudentTable = document.getElementById('pdf-tabela-dados-aluno');
    const sourceActivitiesTable = document.getElementById('pdf-tabela-atividades');

    const page = document.createElement('section');
    page.className = 'ficha-pdf-page';
    page.dataset.pageNumber = String(pageNumber);

    const content = document.createElement('div');
    content.className = 'ficha-pdf-page-content';
    page.appendChild(content);

    const header = removeIdsFromClone(sourceHeader.cloneNode(true));
    header.className = 'ficha-page-header';
    content.appendChild(header);

    const title = removeIdsFromClone(sourceTitle.cloneNode(true));
    title.className = `ficha-page-title${isFirstPage ? '' : ' is-continuation'}`;
    if (!isFirstPage) {
        title.textContent = `${title.textContent.trim()} - CONTINUAÇÃO`;
    }
    content.appendChild(title);

    if (isFirstPage) {
        const studentTable = removeIdsFromClone(sourceStudentTable.cloneNode(true));
        studentTable.className = 'ficha-page-student-table';
        content.appendChild(studentTable);
    }

    const activitiesTable = removeIdsFromClone(sourceActivitiesTable.cloneNode(true));
    activitiesTable.className = 'ficha-page-activities-table';
    const tbody = activitiesTable.querySelector('tbody');
    tbody.innerHTML = '';
    content.appendChild(activitiesTable);

    const pageNumberElement = document.createElement('div');
    pageNumberElement.className = 'ficha-pdf-page-number';
    pageNumberElement.textContent = `Página ${pageNumber}`;
    page.appendChild(pageNumberElement);

    staging.appendChild(page);

    return { page, content, tbody, pageNumberElement };
}

function pageHasOverflow(page) {
    // Pequena tolerância para diferenças de arredondamento entre px e mm.
    return page.scrollHeight > page.clientHeight + 2;
}

function waitForNextPaint() {
    return new Promise(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
}

async function waitForImages(root) {
    const images = Array.from(root.querySelectorAll('img'));

    await Promise.all(images.map(image => {
        if (image.complete && image.naturalWidth > 0) {
            return typeof image.decode === 'function'
                ? image.decode().catch(() => undefined)
                : Promise.resolve();
        }

        return new Promise(resolve => {
            const finish = () => resolve();
            image.addEventListener('load', finish, { once: true });
            image.addEventListener('error', finish, { once: true });
        });
    }));
}

async function buildPaginatedFicha() {
    syncFichaTemplateData();

    const staging = document.getElementById('ficha-pdf-pages');
    const sourceRows = Array.from(
        document.querySelectorAll('#pdf-tabela-atividades tbody tr')
    ).map(row => row.cloneNode(true));

    staging.innerHTML = '';

    let pageNumber = 1;
    let currentPage = createFichaPdfPage(true, pageNumber);

    await waitForImages(staging);
    await waitForNextPaint();

    for (const sourceRow of sourceRows) {
        const row = sourceRow.cloneNode(true);
        currentPage.tbody.appendChild(row);

        if (pageHasOverflow(currentPage.page)) {
            row.remove();
            pageNumber += 1;
            currentPage = createFichaPdfPage(false, pageNumber);
            currentPage.tbody.appendChild(row);

            if (pageHasOverflow(currentPage.page)) {
                throw new Error('Uma linha da ficha é maior do que a área útil de uma página A4.');
            }
        }
    }

    const signatures = removeIdsFromClone(
        document.getElementById('ficha-assinaturas-modelo').cloneNode(true)
    );
    signatures.className = 'ficha-page-signatures';
    currentPage.content.appendChild(signatures);

    if (pageHasOverflow(currentPage.page)) {
        signatures.remove();

        // Leva a última linha para a página das assinaturas, garantindo que
        // essa nova página também contenha a tabela e seu thead.
        const lastRow = currentPage.tbody.lastElementChild;
        pageNumber += 1;
        const signaturesPage = createFichaPdfPage(false, pageNumber);

        if (lastRow) {
            signaturesPage.tbody.appendChild(lastRow);
        }
        signaturesPage.content.appendChild(signatures);
        currentPage = signaturesPage;

        if (pageHasOverflow(currentPage.page)) {
            throw new Error('Não foi possível acomodar as assinaturas na página A4.');
        }
    }

    const pages = Array.from(staging.querySelectorAll('.ficha-pdf-page'));
    const totalPages = pages.length;
    pages.forEach((page, index) => {
        const number = page.querySelector('.ficha-pdf-page-number');
        number.textContent = `Página ${index + 1} de ${totalPages}`;
    });

    await waitForImages(staging);
    await waitForNextPaint();

    return staging;
}

async function createFichaPdfBlob() {
    const staging = await buildPaginatedFicha();
    const pageElements = Array.from(staging.querySelectorAll('.ficha-pdf-page'));

    if (pageElements.length === 0) {
        throw new Error('Nenhuma página foi montada para a ficha.');
    }

    const offsets = pageElements.map(page => page.offsetTop);
    const currentScrollY = window.scrollY;
    const previousInlineStyle = staging.getAttribute('style');

    const baseOptions = {
        margin: 0,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
            scale: 1.6,
            useCORS: true,
            allowTaint: false,
            logging: false,
            backgroundColor: '#ffffff',
            scrollX: 0,
            scrollY: 0
        },
        jsPDF: {
            unit: 'mm',
            format: 'a4',
            orientation: 'portrait',
            compress: true
        }
    };

    // Cada página é capturada separadamente. Isso evita que o html2pdf
    // transforme todo o conjunto em uma única imagem longa e garante que o
    // cabeçalho e o thead já presentes em cada página sejam preservados.
    staging.style.position = 'absolute';
    staging.style.left = '0';
    staging.style.zIndex = '-1';

    try {
        staging.style.top = `${currentScrollY - offsets[0]}px`;
        await waitForNextPaint();

        const firstWorker = html2pdf()
            .set(baseOptions)
            .from(pageElements[0])
            .toPdf();

        const pdf = await firstWorker.get('pdf');

        // Uma página com exatamente 297 mm pode gerar uma página vazia extra
        // por arredondamento de pixels. Mantemos somente a primeira.
        while (pdf.getNumberOfPages() > 1) {
            pdf.deletePage(pdf.getNumberOfPages());
        }

        for (let index = 1; index < pageElements.length; index += 1) {
            staging.style.top = `${currentScrollY - offsets[index]}px`;
            await waitForNextPaint();

            const canvasWorker = html2pdf()
                .set(baseOptions)
                .from(pageElements[index])
                .toCanvas();

            const canvas = await canvasWorker.get('canvas');
            const imageData = canvas.toDataURL('image/jpeg', 0.98);

            pdf.addPage('a4', 'portrait');
            pdf.addImage(imageData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
        }

        return pdf.output('blob');
    } finally {
        if (previousInlineStyle === null) {
            staging.removeAttribute('style');
        } else {
            staging.setAttribute('style', previousInlineStyle);
        }
    }
}

function updateFichaPdfViewer(blob) {
    const viewer = document.getElementById('ficha-pdf-viewer');
    const placeholder = document.getElementById('pdf-viewer-placeholder');

    if (currentFichaPdfUrl) {
        URL.revokeObjectURL(currentFichaPdfUrl);
    }

    currentFichaPdfUrl = URL.createObjectURL(blob);
    viewer.src = `${currentFichaPdfUrl}#view=FitH&toolbar=1&navpanes=0`;
    placeholder.classList.add('hidden');
}

function downloadFichaPdf(blob, metadata) {
    const safeName = (metadata.nomeAluno || 'Aluno')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '');

    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `Ficha_Acompanhamento_${safeName || 'Aluno'}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
}

async function generateFichaPdf({ download = false } = {}) {
    const exportButton = document.getElementById('btn-exportar-pdf');
    const refreshButton = document.getElementById('btn-atualizar-pdf');
    const status = document.getElementById('pdf-preview-status');

    if (!state.schedule || state.schedule.length === 0) {
        showAlert('Gere o planejamento antes de criar a ficha em PDF.');
        status.textContent = 'Não há atividades para gerar a ficha.';
        return;
    }

    exportButton.disabled = true;
    refreshButton.disabled = true;
    status.textContent = download
        ? 'Gerando e preparando o arquivo PDF...'
        : 'Atualizando a visualização do PDF...';

    try {
        const metadata = getFichaMetadata();
        const blob = await createFichaPdfBlob();
        updateFichaPdfViewer(blob);

        if (download) {
            downloadFichaPdf(blob, metadata);
            status.textContent = 'PDF atualizado e arquivo exportado com sucesso.';
        } else {
            status.textContent = 'Visualização do PDF atualizada.';
        }
    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        status.textContent = 'Não foi possível gerar o PDF.';
        showAlert(`Erro ao gerar a ficha em PDF: ${error.message}`);
    } finally {
        document.getElementById('ficha-pdf-viewer').classList.remove('hidden');
        exportButton.disabled = false;
        refreshButton.disabled = false;
        document.getElementById('ficha-pdf-pages').innerHTML = '';
    }
}

function queueFichaPdfGeneration(options) {
    pdfGenerationQueue = pdfGenerationQueue
        .catch(() => undefined)
        .then(() => generateFichaPdf(options));

    return pdfGenerationQueue;
}

function scheduleFichaPdfPreview() {
    clearTimeout(pdfPreviewTimer);

    if (!state.schedule || state.schedule.length === 0) {
        return;
    }

    const status = document.getElementById('pdf-preview-status');
    status.textContent = 'Aguardando atualização da visualização...';

    pdfPreviewTimer = setTimeout(() => {
        queueFichaPdfGeneration({ download: false });
    }, 500);
}
