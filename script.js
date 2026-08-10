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
    studentName: '',
    advisorName: '',
    supervisorName: '',
    internshipStage: 'III',
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
    document.getElementById('generateScheduleBtn').addEventListener('click', handleHeaderPlanningAction);
    document.getElementById('saveStateBtn').addEventListener('click', saveStateToLocalStorage);
    document.getElementById('generateScheduleBtnAction').addEventListener('click', generateSchedule);
    document.getElementById('saveStateBtnAction').addEventListener('click', saveStateToLocalStorage);
    document.getElementById('removeStateBtn').addEventListener('click', removeStoredPlanningData);
    document.getElementById('exportIcsBtn').addEventListener('click', exportToICS);
    document.getElementById('btnAddManual').addEventListener('click', addManualActivity);
    document.getElementById('btn-exportar-pdf').addEventListener('click', () => {
        queueFichaPdfGeneration({ download: true });
    });
    document.getElementById('btn-atualizar-pdf').addEventListener('click', () => {
        scheduleFichaPdfPreview({ immediate: true });
    });

    ['studentName', 'advisorName', 'supervisorName'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            state[id] = document.getElementById(id).value;
            if (state.schedule.length > 0) schedulePdfPreviewRefresh();
        });
    });

    document.querySelectorAll('input[name="internshipStage"]').forEach(radio => {
        radio.addEventListener('change', () => {
            if (!radio.checked) return;
            state.internshipStage = radio.value;
            if (state.schedule.length > 0) schedulePdfPreviewRefresh();
        });
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
function updateHeaderPlanningAction() {
    const button = document.getElementById('generateScheduleBtn');
    if (!button) return;

    const hasPlanning = Array.isArray(state.schedule) && state.schedule.length > 0;
    button.textContent = hasPlanning ? 'Atualizar visualização' : 'Gerar Planejamento';
    button.title = hasPlanning
        ? 'Atualizar a tabela e a pré-visualização da ficha sem recalcular o planejamento'
        : 'Gerar o planejamento a partir dos dados informados';
}

function handleHeaderPlanningAction() {
    if (!state.schedule?.length) {
        generateSchedule();
        return;
    }

    hideAlert();
    updateUI();
    scheduleFichaPdfPreview({ immediate: true });
}

function appendPreservedDescription(target, description) {
    const text = String(description || '').trim();
    if (!text) return;

    const current = String(target.description || '').trim();
    if (!current) {
        target.description = text;
        return;
    }

    const existingBlocks = current.split(/\n\s*\n/).map(value => value.trim());
    if (!existingBlocks.includes(text)) {
        target.description = `${current}\n\n${text}`;
    }
}

function remapScheduleDescriptions(previousSchedule, newSchedule) {
    if (!Array.isArray(previousSchedule) || !previousSchedule.length || !newSchedule.length) {
        return newSchedule;
    }

    const descriptions = previousSchedule
        .map((item, originalIndex) => ({
            date: item.date,
            modality: item.modality,
            description: String(item.description || '').trim(),
            originalIndex
        }))
        .filter(item => item.description);

    if (!descriptions.length) return newSchedule;

    // Quantas descrições já foram remanejadas para cada nova atividade. Ao
    // existir mais de uma opção equivalente, prioriza uma linha ainda vazia.
    const usage = new Array(newSchedule.length).fill(0);
    const toTime = date => new Date(`${date}T00:00:00`).getTime();

    descriptions.forEach(oldItem => {
        const oldTime = toTime(oldItem.date);
        const rankedCandidates = newSchedule.map((newItem, newIndex) => {
            let tier = 3;
            if (newItem.date === oldItem.date && newItem.modality === oldItem.modality) tier = 0;
            else if (newItem.date === oldItem.date) tier = 1;
            else if (newItem.modality === oldItem.modality) tier = 2;

            return {
                newIndex,
                tier,
                usage: usage[newIndex],
                distance: Math.abs(toTime(newItem.date) - oldTime)
            };
        });

        rankedCandidates.sort((a, b) =>
            a.tier - b.tier ||
            a.usage - b.usage ||
            a.distance - b.distance ||
            a.newIndex - b.newIndex
        );

        const best = rankedCandidates[0];
        if (best) {
            appendPreservedDescription(newSchedule[best.newIndex], oldItem.description);
            usage[best.newIndex] += 1;
        }
    });

    return newSchedule;
}

function confirmPlanningRegeneration() {
    if (!state.schedule?.length) return true;

    return window.confirm(
        'Ao gerar novamente o planejamento, dias, horários, modalidades e outros dados do cronograma podem ser alterados e dados salvos podem ser perdidos.\n\n' +
        'As descrições sumárias já preenchidas serão preservadas e remanejadas para as atividades correspondentes sempre que possível.\n\n' +
        'Deseja gerar um novo planejamento?'
    );
}

function generateSchedule() {
    hideAlert();

    if (!confirmPlanningRegeneration()) {
        return;
    }

    const previousSchedule = (state.schedule || []).map(item => ({ ...item }));

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
                    endTime: calculateEndTime(startTime, hoursToAssign),
                    description: ''
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

    state.schedule = remapScheduleDescriptions(previousSchedule, schedule);
    updateUI(totalRequired);
    updateHeaderPlanningAction();
}

function addManualActivity() {
    hideAlert();
    const dateVal = document.getElementById('manualDate').value;
    const modalityVal = document.getElementById('manualModality').value;
    const hoursVal = parseFloat(document.getElementById('manualHours').value);
    const timeVal = document.getElementById('manualTime').value;
    const descriptionVal = document.getElementById('manualDescription').value.trim();

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
        endTime: calculateEndTime(timeVal || '08:00', hoursVal),
        description: descriptionVal
    });

    state.schedule.sort((a, b) => new Date(a.date) - new Date(b.date));

    document.getElementById('manualDate').value = '';
    document.getElementById('manualModality').value = 'Observação';
    document.getElementById('manualHours').value = '';
    document.getElementById('manualTime').value = '08:00';
    document.getElementById('manualDescription').value = '';

    updateUI();
}

function updateUI(totalRequired) {
    if (totalRequired === undefined) {
        totalRequired = calculateTotalRequired();
    }

    const schedule = state.schedule;
    updateHeaderPlanningAction();
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
//         tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Nenhuma atividade no cronograma.</td></tr>';
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
        tbody.innerHTML = '<tr class="schedule-empty-row"><td colspan="7" style="text-align:center;">Nenhuma atividade no cronograma.</td></tr>';
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

            const modalitySelectClass = item.modality === 'Participação'
                ? 'modality-select modality-select-part'
                : item.modality === 'Regência'
                    ? 'modality-select modality-select-reg'
                    : 'modality-select modality-select-obs';

            tr.innerHTML = `
                <td>
                    <input type="date" value="${item.date}" onchange="updateActivity(${index}, 'date', this.value)">
                </td>
                <td>${item.dayOfWeek}</td>
                <td>
                    <select class="${modalitySelectClass}" onchange="updateActivity(${index}, 'modality', this.value)">
                        <option class="modality-option-obs" value="Observação" ${item.modality === 'Observação' ? 'selected' : ''}>Observação</option>
                        <option class="modality-option-part" value="Participação" ${item.modality === 'Participação' ? 'selected' : ''}>Participação</option>
                        <option class="modality-option-reg" value="Regência" ${item.modality === 'Regência' ? 'selected' : ''}>Regência</option>
                    </select>
                </td>
                <td>
                    <input type="number" min="0.5" max="6" step="0.5" value="${item.hours}" style="width:70px" onchange="updateActivity(${index}, 'hours', this.value)">
                </td>
                <td>
                    <input type="time" value="${item.startTime || ''}" onchange="updateActivity(${index}, 'startTime', this.value)">
                </td>
                <td class="schedule-actions-cell">
                    <button type="button" class="btn btn-sm btn-danger btn-icon" onclick="deleteActivity(${index})" aria-label="Remover atividade" title="Remover atividade">
                        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                            <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-.7 11H7.7L7 9Zm3 2v7h2v-7h-2Zm4 0v7h2v-7h-2Z" fill="currentColor"/>
                        </svg>
                    </button>
                </td>
            `;
            tr.classList.add('activity-row');
            tbody.appendChild(tr);

            const descriptionTr = document.createElement('tr');
            descriptionTr.className = 'activity-description-row';
            descriptionTr.innerHTML = `
                <td colspan="6">
                    <label class="schedule-description-label" for="activity-description-${index}">
                        Descrição sumária das atividades <span>(opcional)</span>
                    </label>
                    <textarea id="activity-description-${index}" class="schedule-description" rows="2" placeholder="Descreva resumidamente as atividades realizadas" onchange="updateActivity(${index}, 'description', this.value)">${escapeHtml(item.description || '')}</textarea>
                </td>
            `;
            tbody.appendChild(descriptionTr);
        });
    });

    renderAtividadesTable(state.schedule);
}

function renderAtividadesTable(atividades) {

    // A coluna de assinatura só é necessária quando nenhuma atividade possui
    // descrição sumária preenchida. Quando existe ao menos uma descrição, a
    // área de texto ganha toda a largura disponível.
    const hasAnySummary = atividades.some(ativ => String(ativ.description || '').trim() !== '');
    const showSupervisorSignatureColumn = atividades.length > 0 && !hasAnySummary;

    const table = document.getElementById('pdf-tabela-atividades');
    const headerRow = table.querySelector('thead tr');
    const tbody = table.querySelector('tbody');

    table.classList.toggle('has-supervisor-signature-column', showSupervisorSignatureColumn);
    headerRow.innerHTML = `
        <th>Data</th>
        <th>Nº de horas</th>
        <th>Descrição Sumária das Atividades</th>
        ${showSupervisorSignatureColumn ? '<th class="pdf-supervisor-signature-header">Assinatura do Supervisor</th>' : ''}
    `;
    tbody.innerHTML = '';

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
                <td class="pdf-activity-summary">
                    <span class="pdf-modality-label ${modalidadeClass}">${escapeHtml(modalidade)}</span><span class="pdf-activity-description">${escapeHtml(ativ.description || '')}</span>
                </td>
                ${showSupervisorSignatureColumn ? '<td class="pdf-supervisor-signature-cell"></td>' : ''}
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
                ${showSupervisorSignatureColumn ? '<td></td>' : ''}
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
    state.studentName = document.getElementById('studentName').value.trim();
    state.advisorName = document.getElementById('advisorName').value.trim();
    state.supervisorName = document.getElementById('supervisorName').value.trim();
    state.internshipStage = document.querySelector('input[name="internshipStage"]:checked')?.value || 'III';

    localStorage.setItem('estagio_planning_state', JSON.stringify(state));
    alert('Planejamento salvo com sucesso!');
}

function removeStoredPlanningData() {
    // Remove somente os dados persistidos e o planejamento gerado.
    // Os campos de configuração permanecem disponíveis para o usuário editar
    // e gerar um novo planejamento imediatamente.
    localStorage.removeItem('estagio_planning_state');

    // Invalida/cancela qualquer atualização de pré-visualização ainda agendada.
    pdfPreviewVersion += 1;
    pdfPreviewPending = false;
    clearTimeout(pdfPreviewTimer);
    pdfPreviewTimer = null;

    if (pdfIdleHandle !== null && typeof cancelIdleCallback === 'function') {
        cancelIdleCallback(pdfIdleHandle);
    }
    pdfIdleHandle = null;

    // Limpa o planejamento em memória e na interface.
    state.schedule = [];
    const scheduleBody = document.getElementById('scheduleBody');
    if (scheduleBody) scheduleBody.innerHTML = '';

    const scheduleSection = document.getElementById('scheduleSection');
    if (scheduleSection) scheduleSection.classList.add('hidden');
    updateHeaderPlanningAction();

    // Limpa a pré-visualização do PDF e libera a URL temporária.
    const viewer = document.getElementById('ficha-pdf-viewer');
    const placeholder = document.getElementById('pdf-viewer-placeholder');
    const status = document.getElementById('pdf-preview-status');

    if (currentFichaPdfUrl) {
        URL.revokeObjectURL(currentFichaPdfUrl);
        currentFichaPdfUrl = null;
    }

    if (viewer) {
        viewer.removeAttribute('src');
        viewer.classList.add('hidden');
    }
    if (placeholder) placeholder.classList.remove('hidden');
    if (status) status.textContent = 'Gere ou atualize o planejamento para visualizar a ficha.';

    const staging = document.getElementById('ficha-pdf-pages');
    if (staging) staging.innerHTML = '';

    hideAlert();
    showAlert('Dados salvos, planejamento e pré-visualização do PDF foram removidos.');
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
            document.getElementById('studentName').value = state.studentName || '';
            document.getElementById('advisorName').value = state.advisorName || '';
            document.getElementById('supervisorName').value = state.supervisorName || '';
            state.internshipStage = state.internshipStage || 'III';
            const savedStageRadio = document.querySelector(`input[name="internshipStage"][value="${state.internshipStage}"]`);
            if (savedStageRadio) savedStageRadio.checked = true;
            state.schedule = (state.schedule || []).map(item => ({ ...item, description: item.description || '' }));

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

    updateHeaderPlanningAction();
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

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatDate(date) {
    return date?.split('-').reverse().join('/') || '';
}

// --- GERAÇÃO, PAGINAÇÃO E VISUALIZAÇÃO DA FICHA EM PDF ---
let currentFichaPdfUrl = null;
let pdfPreviewTimer = null;
let pdfIdleHandle = null;
let pdfGenerationQueue = Promise.resolve();
let pdfGenerationRunning = false;
let pdfPreviewPending = false;
let pdfPreviewVersion = 0;

function yieldToBrowser() {
    return new Promise(resolve => setTimeout(resolve, 0));
}

function cancelScheduledPdfPreview() {
    clearTimeout(pdfPreviewTimer);
    pdfPreviewTimer = null;

    if (pdfIdleHandle !== null && typeof cancelIdleCallback === 'function') {
        cancelIdleCallback(pdfIdleHandle);
    }
    pdfIdleHandle = null;
}


function getFichaMetadata() {
    return {
        nomeAluno: document.getElementById('studentName').value.trim(),
        nomeOrientador: document.getElementById('advisorName').value.trim(),
        nomeSupervisor: document.getElementById('supervisorName').value.trim(),
        internshipStage: document.querySelector('input[name="internshipStage"]:checked')?.value || 'III',
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
    document.getElementById('pdf-nome-supervisor').textContent =
        metadata.nomeSupervisor || '____________________________';

    const stageOrder = ['I', 'II', 'III', 'IV'];
    const selectedStage = stageOrder.includes(metadata.internshipStage) ? metadata.internshipStage : 'III';
    document.getElementById('pdf-estagio-selecionado').innerHTML = stageOrder
        .map((stage, index) => `${index === 2 ? '<br>' : ''}( ${stage === selectedStage ? 'X' : '&nbsp;'} ) Estágio Supervisionado ${stage}`)
        .join(' ');

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

    for (let rowIndex = 0; rowIndex < sourceRows.length; rowIndex += 1) {
        const sourceRow = sourceRows[rowIndex];
        const row = sourceRow.cloneNode(true);
        currentPage.tbody.appendChild(row);

        // Em cronogramas grandes, devolve periodicamente o controle ao navegador
        // para que rolagem, cliques e digitação continuem responsivos.
        if (rowIndex > 0 && rowIndex % 20 === 0) {
            await yieldToBrowser();
        }

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

async function createFichaPdfBlob({ preview = false } = {}) {
    const staging = await buildPaginatedFicha();
    const pageElements = Array.from(staging.querySelectorAll('.ficha-pdf-page'));

    if (pageElements.length === 0) {
        throw new Error('Nenhuma página foi montada para a ficha.');
    }

    const baseOptions = {
        margin: 0,
        image: { type: 'jpeg', quality: preview ? 0.84 : 0.98 },
        html2canvas: {
            // A pré-visualização prioriza fluidez. A exportação mantém alta qualidade.
            scale: preview ? 0.9 : 1.6,
            useCORS: true,
            allowTaint: false,
            logging: false,
            backgroundColor: '#ffffff',
            scrollX: 0,
            scrollY: 0,
            // A estrutura usada para montar o PDF permanece invisível no DOM
            // real. Ela só é exibida dentro do documento clonado pelo
            // html2canvas, impedindo que a tabela "pisque" atrás da interface.
            onclone: (clonedDocument) => {
                const clonedStaging = clonedDocument.getElementById('ficha-pdf-pages');
                if (clonedStaging) {
                    clonedStaging.style.visibility = 'visible';
                    clonedStaging.style.position = 'absolute';
                    clonedStaging.style.left = '0';
                    clonedStaging.style.top = '0';
                    clonedStaging.style.zIndex = '0';
                }
            }
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
    // Não reposicionamos mais o staging na área visível da aplicação.
    try {
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
            const canvasWorker = html2pdf()
                .set(baseOptions)
                .from(pageElements[index])
                .toCanvas();

            const canvas = await canvasWorker.get('canvas');
            const imageData = canvas.toDataURL('image/jpeg', preview ? 0.84 : 0.98);

            pdf.addPage('a4', 'portrait');
            pdf.addImage(imageData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');

            // Permite que o navegador processe eventos entre páginas.
            await yieldToBrowser();
        }

        return pdf.output('blob');
    } finally {
        // O staging permanece permanentemente fora da interface e invisível.
        // A limpeza das páginas temporárias é feita ao final da fila de geração.
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

async function generateFichaPdf({ download = false, previewVersion = null } = {}) {
    const exportButton = document.getElementById('btn-exportar-pdf');
    const refreshButton = document.getElementById('btn-atualizar-pdf');
    const status = document.getElementById('pdf-preview-status');

    if (!state.schedule || state.schedule.length === 0) {
        showAlert('Gere o planejamento antes de criar a ficha em PDF.');
        status.textContent = 'Não há atividades para gerar a ficha.';
        return;
    }

    // Na atualização da visualização não bloqueamos os controles da tela.
    // Somente a exportação desabilita temporariamente o próprio botão.
    if (download) exportButton.disabled = true;
    status.textContent = download
        ? 'Gerando e preparando o arquivo PDF...'
        : 'Atualizando a visualização do PDF...';

    try {
        const metadata = getFichaMetadata();
        const blob = await createFichaPdfBlob({ preview: !download });

        // Se houve uma alteração enquanto esta prévia estava sendo montada,
        // não substitui o viewer por um PDF já desatualizado.
        const previewIsCurrent = download || previewVersion === null || previewVersion === pdfPreviewVersion;
        if (previewIsCurrent) {
            updateFichaPdfViewer(blob);
        }

        if (download) {
            downloadFichaPdf(blob, metadata);
            status.textContent = 'PDF atualizado e arquivo exportado com sucesso.';
        } else if (previewIsCurrent) {
            status.textContent = 'Visualização do PDF atualizada.';
        } else {
            status.textContent = 'Há alterações mais recentes aguardando visualização.';
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

function queueFichaPdfGeneration(options = {}) {
    const isPreview = !options.download;

    if (isPreview && pdfGenerationRunning) {
        // Não cria uma fila de PDFs obsoletos. Apenas registra que existe
        // uma nova atualização a ser feita quando a atual terminar.
        pdfPreviewPending = true;
        return pdfGenerationQueue;
    }

    pdfGenerationRunning = true;
    pdfPreviewPending = false;

    pdfGenerationQueue = pdfGenerationQueue
        .catch(() => undefined)
        .then(() => generateFichaPdf(options))
        .finally(() => {
            pdfGenerationRunning = false;

            if (pdfPreviewPending && state.schedule?.length > 0) {
                pdfPreviewPending = false;
                scheduleFichaPdfPreview({ immediate: false });
            }
        });

    return pdfGenerationQueue;
}

function runPdfPreviewWhenIdle(version) {
    const run = () => {
        pdfIdleHandle = null;

        if (version !== pdfPreviewVersion || !state.schedule?.length) {
            return;
        }

        queueFichaPdfGeneration({ download: false, previewVersion: version });
    };

    if (typeof requestIdleCallback === 'function') {
        pdfIdleHandle = requestIdleCallback(run, { timeout: 1200 });
    } else {
        // Fallback: agenda para uma nova tarefa do event loop.
        setTimeout(run, 0);
    }
}

function scheduleFichaPdfPreview({ immediate = false } = {}) {
    cancelScheduledPdfPreview();

    if (!state.schedule || state.schedule.length === 0) {
        return;
    }

    const version = ++pdfPreviewVersion;
    const status = document.getElementById('pdf-preview-status');
    status.textContent = immediate
        ? 'Preparando visualização do PDF...'
        : 'Visualização será atualizada após as alterações...';

    // Evita gerar um PDF a cada tecla/campo alterado. O usuário continua
    // trabalhando normalmente e a prévia é processada quando a interface fica ociosa.
    pdfPreviewTimer = setTimeout(() => {
        pdfPreviewTimer = null;
        runPdfPreviewWhenIdle(version);
    }, immediate ? 0 : 1200);
}

// Compatibilidade com chamadas existentes dos campos de identificação.
function schedulePdfPreviewRefresh() {
    scheduleFichaPdfPreview();
}

