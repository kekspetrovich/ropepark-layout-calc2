// Глобальные переменные состояния
let lastLengthField = 'l_axes'; // 'l_axes' или 'l_edges'
let currentN = null;
let calculationResult = null;

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    initializeInputs();
    calculate();
});

// Инициализация обработчиков событий
function initializeInputs() {
    // Обработчики для полей длины
    document.getElementById('l_axes').addEventListener('input', function() {
        lastLengthField = 'l_axes';
        updateLengthFields();
        calculate();
    });
    
    document.getElementById('l_edges').addEventListener('input', function() {
        lastLengthField = 'l_edges';
        updateLengthFields();
        calculate();
    });
    
    // Обработчики для диаметров платформ
    document.getElementById('d_left').addEventListener('change', function() {
        updateLengthFields();
        calculate();
    });
    
    document.getElementById('d_right').addEventListener('change', function() {
        updateLengthFields();
        calculate();
    });
    
    // Обработчик типа элемента
    document.getElementById('element_type').addEventListener('change', function() {
        const sGroup = document.getElementById('s_group');
        if (this.value === 'board_ropes') {
            sGroup.style.display = 'flex';
        } else {
            sGroup.style.display = 'none';
        }
        calculate();
    });
    
    // Обработчики для остальных полей
    ['s', 'a_min', 'a_max', 'w', 'g_target'].forEach(id => {
        const elem = document.getElementById(id);
        if (elem) {
            elem.addEventListener('input', calculate);
        }
    });
    
    // Кнопки
    document.getElementById('btn_autofit').addEventListener('click', function() {
        autofit();
    });
    
    document.getElementById('btn_minus').addEventListener('click', function() {
        changeN(-1);
    });
    
    document.getElementById('btn_plus').addEventListener('click', function() {
        changeN(1);
    });
    
    // Кнопка показа/скрытия результатов
    document.getElementById('btn_show_output').addEventListener('click', function() {
        document.getElementById('output_section').style.display = 'block';
        this.style.display = 'none';
    });
    
    document.getElementById('btn_toggle_output').addEventListener('click', function() {
        document.getElementById('output_section').style.display = 'none';
        document.getElementById('btn_show_output').style.display = 'inline-block';
    });
    
    // Кнопка показа/скрытия лога
    document.getElementById('btn_show_log').addEventListener('click', function() {
        document.getElementById('log_section').style.display = 'block';
        this.style.display = 'none';
    });
    
    document.getElementById('btn_toggle_log').addEventListener('click', function() {
        document.getElementById('log_section').style.display = 'none';
        document.getElementById('btn_show_log').style.display = 'inline-block';
    });
    
    // Кнопка печати
    document.getElementById('btn_print').addEventListener('click', function() {
        printDiagram();
    });
    
    // Кнопка экспорта в PDF
    document.getElementById('btn_export_pdf').addEventListener('click', function() {
        exportToPDF();
    });
    
    // Первоначальный расчёт L_edges
    updateLengthFields();
}

// Нормализация числа (замена "," на ".")
function normalizeNumber(str) {
    if (typeof str !== 'string') return str;
    return str.replace(',', '.');
}

// Парсинг числа из строки
function parseNumber(str) {
    const normalized = normalizeNumber(str);
    const num = parseFloat(normalized);
    return isNaN(num) ? null : num;
}

// Получение всех входных значений
function getInputValues() {
    const d_left = parseNumber(document.getElementById('d_left').value);
    const d_right = parseNumber(document.getElementById('d_right').value);
    const l_axes = parseNumber(document.getElementById('l_axes').value);
    const l_edges = parseNumber(document.getElementById('l_edges').value);
    const element_type = document.getElementById('element_type').value;
    const s = parseNumber(document.getElementById('s').value);
    const a_min = parseNumber(document.getElementById('a_min').value);
    const a_max = parseNumber(document.getElementById('a_max').value);
    const w = parseNumber(document.getElementById('w').value);
    const g_target = parseNumber(document.getElementById('g_target').value);
    
    return {
        d_left, d_right, l_axes, l_edges, element_type, s, a_min, a_max, w, g_target
    };
}

// Обновление полей длины на основе последнего изменённого
function updateLengthFields() {
    const inputs = getInputValues();
    if (!inputs.d_left || !inputs.d_right) return;
    
    if (lastLengthField === 'l_axes' && inputs.l_axes !== null) {
        const l_edges_calc = inputs.l_axes - (inputs.d_left / 2 + inputs.d_right / 2);
        document.getElementById('l_edges').value = l_edges_calc.toFixed(1);
    } else if (lastLengthField === 'l_edges' && inputs.l_edges !== null) {
        const l_axes_calc = inputs.l_edges + (inputs.d_left / 2 + inputs.d_right / 2);
        document.getElementById('l_axes').value = l_axes_calc.toFixed(1);
    }
}

// Вычисление w_eff
function getWeff(element_type, w, s) {
    if (element_type === 'board') {
        return w;
    } else if (element_type === 'board_ropes') {
        return w - 2 * s;
    }
    return null;
}

// Расчёт для фиксированного n
function calculateForN(n, inputs) {
    const w_eff = getWeff(inputs.element_type, inputs.w, inputs.s);
    
    if (!w_eff || w_eff <= 0) return null;
    if (inputs.l_edges <= 0) return null;
    if (inputs.a_min === null || inputs.a_max === null || inputs.a_min > inputs.a_max) return null;
    
    let a, g;
    
    if (n === 1) {
        a = (inputs.l_edges - w_eff) / 2;
        g = 0;
    } else {
        // Идеальный a для g_target
        const a_needed = (inputs.l_edges - n * w_eff - (n - 1) * inputs.g_target) / 2;
        
        // Ограничиваем a
        a = Math.max(inputs.a_min, Math.min(inputs.a_max, a_needed));
        
        // Пересчитываем g
        g = (inputs.l_edges - 2 * a - n * w_eff) / (n - 1);
    }
    
    // Проверка валидности
    if (g < 0) return null;
    if (a < inputs.a_min || a > inputs.a_max) return null;
    
    return { n, a, g, w_eff };
}

// Автоподбор n
function autofit() {
    const inputs = getInputValues();
    
    // Валидация входных данных
    const errors = validateInputs(inputs);
    if (errors.length > 0) {
        showError(errors.join('; '));
        log('Ошибка автоподбора: ' + errors.join('; '));
        return;
    }
    
    const w_eff = getWeff(inputs.element_type, inputs.w, inputs.s);
    if (!w_eff || w_eff <= 0) {
        showError('w_eff <= 0');
        return;
    }
    
    // Верхняя граница для n
    const n_max = Math.floor((inputs.l_edges - 2 * inputs.a_min) / w_eff);
    if (n_max < 1) {
        // Если невозможно разместить элементы, просто не делаем ничего
        return;
    }
    
    let bestSolution = null;
    let bestScore = Infinity;
    
    // Перебор n
    for (let n = 1; n <= n_max; n++) {
        const solution = calculateForN(n, inputs);
        if (!solution) continue;
        
        // Вычисляем идеальный a для сравнения
        let a_needed;
        if (n === 1) {
            a_needed = (inputs.l_edges - w_eff) / 2;
        } else {
            a_needed = (inputs.l_edges - n * w_eff - (n - 1) * inputs.g_target) / 2;
        }
        
        const score = Math.abs(solution.g - inputs.g_target) + 0.001 * Math.abs(solution.a - a_needed);
        
        if (score < bestScore) {
            bestScore = score;
            bestSolution = solution;
        }
    }
    
    if (bestSolution) {
        currentN = bestSolution.n;
        calculationResult = bestSolution;
        updateOutput(bestSolution, inputs);
        drawDiagram(bestSolution, inputs);
    } else {
        showError('Не удалось найти решение');
        log('Автоподбор: решение не найдено');
        clearOutput();
        clearDiagram();
    }
}

// Изменение n на ±1
function changeN(delta) {
    const inputs = getInputValues();
    const w_eff = getWeff(inputs.element_type, inputs.w, inputs.s);
    
    if (!w_eff || w_eff <= 0) {
        showError('w_eff <= 0');
        return;
    }
    
    const n_max = Math.floor((inputs.l_edges - 2 * inputs.a_min) / w_eff);
    
    let newN;
    if (currentN === null) {
        // Если n ещё не установлен, используем текущий результат или 1
        newN = Math.max(1, Math.min(n_max, (calculationResult?.n || 1) + delta));
    } else {
        newN = Math.max(1, Math.min(n_max, currentN + delta));
    }
    
    if (newN < 1 || newN > n_max) {
        showError('Невозможно изменить количество элементов');
        return;
    }
    
    const solution = calculateForN(newN, inputs);
    if (!solution) {
        // Если не получается разместить, пытаемся найти максимально возможное количество
        for (let tryN = newN - 1; tryN >= 1; tryN--) {
            const trySolution = calculateForN(tryN, inputs);
            if (trySolution) {
                currentN = tryN;
                calculationResult = trySolution;
                updateOutput(trySolution, inputs);
                drawDiagram(trySolution, inputs);
                log('Автоматически установлено количество элементов: n = ' + tryN);
                return;
            }
        }
        return;
    }
    
    currentN = newN;
    calculationResult = solution;
    updateOutput(solution, inputs);
    drawDiagram(solution, inputs);
    log('Изменено количество элементов: n = ' + newN);
}

// Валидация входных данных
function validateInputs(inputs) {
    const errors = [];
    
    if (inputs.d_left === null || inputs.d_left <= 0) errors.push('D_left невалидно');
    if (inputs.d_right === null || inputs.d_right <= 0) errors.push('D_right невалидно');
    if (inputs.l_axes === null || inputs.l_axes <= 0) errors.push('L_axes невалидно');
    if (inputs.l_edges === null || inputs.l_edges <= 0) errors.push('L_edges <= 0');
    if (inputs.w === null || inputs.w <= 0) errors.push('w невалидно');
    if (inputs.a_min === null || inputs.a_min < 0) errors.push('a_min невалидно');
    if (inputs.a_max === null || inputs.a_max < 0) errors.push('a_max невалидно');
    if (inputs.a_min !== null && inputs.a_max !== null && inputs.a_min > inputs.a_max) {
        errors.push('a_min > a_max');
    }
    if (inputs.g_target === null || inputs.g_target < 0) errors.push('g_target невалидно');
    
    if (inputs.element_type === 'board_ropes') {
        if (inputs.s === null || inputs.s < 0) errors.push('s невалидно');
        const w_eff = getWeff(inputs.element_type, inputs.w, inputs.s);
        if (w_eff <= 0) errors.push('w_eff <= 0 (w - 2s <= 0)');
    }
    
    return errors;
}

// Основная функция расчёта
function calculate() {
    const inputs = getInputValues();
    
    // Логирование входных значений
    log('=== Расчёт ===');
    log('Входные значения:');
    log('  D_left: ' + inputs.d_left);
    log('  D_right: ' + inputs.d_right);
    log('  L_axes: ' + inputs.l_axes);
    log('  L_edges: ' + inputs.l_edges);
    log('  Тип элемента: ' + inputs.element_type);
    if (inputs.element_type === 'board_ropes') {
        log('  s: ' + inputs.s);
    }
    log('  a_min: ' + inputs.a_min);
    log('  a_max: ' + inputs.a_max);
    log('  w: ' + inputs.w);
    log('  g_target: ' + inputs.g_target);
    log('  Последнее изменённое поле длины: ' + lastLengthField);
    
    // Валидация
    const errors = validateInputs(inputs);
    if (errors.length > 0) {
        showError('Ошибки ввода: ' + errors.join('; '));
        clearOutput();
        clearDiagram();
        log('ОШИБКА: ' + errors.join('; '));
        return;
    }
    
    hideError();
    
    // Если n установлен, используем его
    let result;
    if (currentN !== null) {
        result = calculateForN(currentN, inputs);
        if (!result) {
            // Если не получается разместить установленное количество, сбрасываем n и делаем автоподбор
            currentN = null;
        } else {
            calculationResult = result;
        }
    }
    
    // Если result не получен, делаем автоподбор
    if (!result) {
        const w_eff = getWeff(inputs.element_type, inputs.w, inputs.s);
        if (!w_eff || w_eff <= 0) {
            showError('w_eff <= 0');
            clearOutput();
            clearDiagram();
            return;
        }
        
        const n_max = Math.floor((inputs.l_edges - 2 * inputs.a_min) / w_eff);
        if (n_max < 1) {
            showError('Невозможно разместить элементы (n_max < 1)');
            clearOutput();
            clearDiagram();
            return;
        }
        
        let bestSolution = null;
        let bestScore = Infinity;
        
        for (let n = 1; n <= n_max; n++) {
            const solution = calculateForN(n, inputs);
            if (!solution) continue;
            
            let a_needed;
            if (n === 1) {
                a_needed = (inputs.l_edges - w_eff) / 2;
            } else {
                a_needed = (inputs.l_edges - n * w_eff - (n - 1) * inputs.g_target) / 2;
            }
            
            const score = Math.abs(solution.g - inputs.g_target) + 0.001 * Math.abs(solution.a - a_needed);
            
            if (score < bestScore) {
                bestScore = score;
                bestSolution = solution;
            }
        }
        
        if (bestSolution) {
            currentN = bestSolution.n;
            result = bestSolution;
            calculationResult = result;
        } else {
            // Если решение не найдено, просто не показываем схему
            clearOutput();
            clearDiagram();
            log('ОШИБКА: решение не найдено');
            return;
        }
    }
    
    // Логирование результатов
    log('Результаты:');
    log('  n: ' + result.n);
    log('  w_eff: ' + result.w_eff.toFixed(1));
    log('  a: ' + result.a.toFixed(1));
    log('  g: ' + result.g.toFixed(1));
    if (inputs.element_type === 'board_ropes') {
        const p = inputs.w - 2 * inputs.s;
        log('  p (между подвесами одной доски): ' + p.toFixed(1));
        log('  g_rope (между канатами соседних досок): ' + result.g.toFixed(1));
    }
    
    // Обновление UI
    updateOutput(result, inputs);
    drawDiagram(result, inputs);
}

// Форматирование числа для вывода
function formatNumber(num) {
    if (num === null || isNaN(num)) return '—';
    return num.toFixed(1).replace(/\.?0+$/, '');
}

// Обновление блока результатов
function updateOutput(result, inputs) {
    const outputDiv = document.getElementById('output_values');
    let html = '';
    
    html += '<div class="output-item"><span class="output-label">n (количество элементов):</span><span class="output-value">' + result.n + '</span></div>';
    html += '<div class="output-item"><span class="output-label">g (фактический шаг):</span><span class="output-value">' + formatNumber(result.g) + ' мм</span></div>';
    html += '<div class="output-item"><span class="output-label">a (отступ до первой опорной точки):</span><span class="output-value">' + formatNumber(result.a) + ' мм</span></div>';
    html += '<div class="output-item"><span class="output-label">L_axes (между осями):</span><span class="output-value">' + formatNumber(inputs.l_axes) + ' мм</span></div>';
    html += '<div class="output-item"><span class="output-label">L_edges (между краями платформ):</span><span class="output-value">' + formatNumber(inputs.l_edges) + ' мм</span></div>';
    
    if (inputs.element_type === 'board_ropes') {
        const p = inputs.w - 2 * inputs.s;
        html += '<div class="output-item"><span class="output-label">p (между подвесами одной доски):</span><span class="output-value">' + formatNumber(p) + ' мм</span></div>';
        html += '<div class="output-item"><span class="output-label">g_rope (между канатами соседних досок):</span><span class="output-value">' + formatNumber(result.g) + ' мм</span></div>';
    }
    
    outputDiv.innerHTML = html;
}

// Очистка вывода
function clearOutput() {
    document.getElementById('output_values').innerHTML = '<div class="output-item"><span class="output-label">Результаты недоступны</span></div>';
}

// Показать ошибку
function showError(message) {
    const errorDiv = document.getElementById('error_message');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    console.error(message);
}

// Скрыть ошибку
function hideError() {
    document.getElementById('error_message').style.display = 'none';
}

// Очистка диаграммы
function clearDiagram() {
    const svg = document.getElementById('diagram');
    svg.innerHTML = '';
}

// Логирование
function log(message) {
    const logDiv = document.getElementById('log');
    const timestamp = new Date().toLocaleTimeString();
    logDiv.textContent += '[' + timestamp + '] ' + message + '\n';
    logDiv.scrollTop = logDiv.scrollHeight;
    console.log(message);
}

// Рисование SVG диаграммы
function drawDiagram(result, inputs) {
    const svg = document.getElementById('diagram');
    svg.innerHTML = '';
    
    const svgWidth = 1000;
    // Высота зависит от количества элементов для размещения всех размерных линий
    // Учитываем возможные уровни подписей от края платформы
    const maxElements = result.n || 10;
    const estimatedLabelLevels = Math.ceil(maxElements / 2); // Примерно половина элементов на каждом уровне
    const svgHeight = 600 + Math.max(0, (maxElements - 5) * 25) + estimatedLabelLevels * 30; // Динамическая высота
    const margin = 50;
    const drawWidth = svgWidth - 2 * margin;
    
    // Обновляем высоту SVG
    svg.setAttribute('height', svgHeight);
    
    // Масштаб
    const scale = drawWidth / inputs.l_axes;
    
    // Позиции
    const leftAxisX = margin;
    const rightAxisX = margin + inputs.l_axes * scale;
    const centerY = svgHeight / 2;
    
    // Рисуем оси деревьев
    const treeAxisLength = 100;
    const treeAxisTop = centerY - treeAxisLength / 2;
    const treeAxisBottom = centerY + treeAxisLength / 2;
    
    // Левая ось
    const leftAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    leftAxis.setAttribute('x1', leftAxisX);
    leftAxis.setAttribute('y1', treeAxisTop);
    leftAxis.setAttribute('x2', leftAxisX);
    leftAxis.setAttribute('y2', treeAxisBottom);
    leftAxis.setAttribute('stroke', '#8B4513');
    leftAxis.setAttribute('stroke-width', '3');
    leftAxis.setAttribute('stroke-dasharray', '5,5');
    leftAxis.setAttribute('style', 'stroke: #8B4513; stroke-width: 3; stroke-dasharray: 5,5;');
    svg.appendChild(leftAxis);
    
    // Правая ось
    const rightAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    rightAxis.setAttribute('x1', rightAxisX);
    rightAxis.setAttribute('y1', treeAxisTop);
    rightAxis.setAttribute('x2', rightAxisX);
    rightAxis.setAttribute('y2', treeAxisBottom);
    rightAxis.setAttribute('stroke', '#8B4513');
    rightAxis.setAttribute('stroke-width', '3');
    rightAxis.setAttribute('stroke-dasharray', '5,5');
    rightAxis.setAttribute('style', 'stroke: #8B4513; stroke-width: 3; stroke-dasharray: 5,5;');
    svg.appendChild(rightAxis);
    
    // Рисуем платформы
    const leftPlatformRadius = (inputs.d_left / 2) * scale;
    const rightPlatformRadius = (inputs.d_right / 2) * scale;
    
    const leftPlatform = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    leftPlatform.setAttribute('cx', leftAxisX);
    leftPlatform.setAttribute('cy', centerY);
    leftPlatform.setAttribute('r', leftPlatformRadius);
    leftPlatform.setAttribute('fill', '#90EE90');
    leftPlatform.setAttribute('stroke', '#228B22');
    leftPlatform.setAttribute('stroke-width', '2');
    leftPlatform.setAttribute('opacity', '0.7');
    leftPlatform.setAttribute('style', 'fill: #90EE90; stroke: #228B22; stroke-width: 2; opacity: 0.7;');
    svg.appendChild(leftPlatform);
    
    const rightPlatform = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    rightPlatform.setAttribute('cx', rightAxisX);
    rightPlatform.setAttribute('cy', centerY);
    rightPlatform.setAttribute('r', rightPlatformRadius);
    rightPlatform.setAttribute('fill', '#90EE90');
    rightPlatform.setAttribute('stroke', '#228B22');
    rightPlatform.setAttribute('stroke-width', '2');
    rightPlatform.setAttribute('opacity', '0.7');
    rightPlatform.setAttribute('style', 'fill: #90EE90; stroke: #228B22; stroke-width: 2; opacity: 0.7;');
    svg.appendChild(rightPlatform);
    
    // Края платформ
    const leftEdgeX = leftAxisX + leftPlatformRadius;
    const rightEdgeX = rightAxisX - rightPlatformRadius;
    
    // Рисуем элементы
    const boardHeight = 20;
    const boardY = centerY - boardHeight / 2;
    
    if (inputs.element_type === 'board') {
        // Режим "Доска"
        for (let i = 0; i < result.n; i++) {
            const boardLeftX = leftEdgeX + result.a * scale + i * (result.w_eff + result.g) * scale;
            const boardWidth = inputs.w * scale;
            
            const board = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            board.setAttribute('x', boardLeftX);
            board.setAttribute('y', boardY);
            board.setAttribute('width', boardWidth);
            board.setAttribute('height', boardHeight);
            board.setAttribute('fill', '#8B4513');
            board.setAttribute('stroke', '#654321');
            board.setAttribute('stroke-width', '1');
            board.setAttribute('style', 'fill: #8B4513; stroke: #654321; stroke-width: 1;');
            svg.appendChild(board);
        }
    } else if (inputs.element_type === 'board_ropes') {
        // Режим "Доска на канатах"
        for (let i = 0; i < result.n; i++) {
            const firstSuspensionX = leftEdgeX + result.a * scale + i * (result.w_eff + result.g) * scale;
            const boardLeftX = firstSuspensionX - inputs.s * scale;
            const boardWidth = inputs.w * scale;
            const secondSuspensionX = firstSuspensionX + result.w_eff * scale;
            
            // Доска
            const board = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            board.setAttribute('x', boardLeftX);
            board.setAttribute('y', boardY);
            board.setAttribute('width', boardWidth);
            board.setAttribute('height', boardHeight);
            board.setAttribute('fill', '#8B4513');
            board.setAttribute('stroke', '#654321');
            board.setAttribute('stroke-width', '1');
            board.setAttribute('style', 'fill: #8B4513; stroke: #654321; stroke-width: 1;');
            svg.appendChild(board);
            
            // Подвесы (вертикальные линии)
            const suspensionLineHeight = 30;
            const suspensionTopY = boardY - suspensionLineHeight;
            
            // Левый подвес
            const leftSuspension = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            leftSuspension.setAttribute('x1', firstSuspensionX);
            leftSuspension.setAttribute('y1', suspensionTopY);
            leftSuspension.setAttribute('x2', firstSuspensionX);
            leftSuspension.setAttribute('y2', boardY);
            leftSuspension.setAttribute('stroke', '#FF6B6B');
            leftSuspension.setAttribute('stroke-width', '2');
            leftSuspension.setAttribute('style', 'stroke: #FF6B6B; stroke-width: 2;');
            svg.appendChild(leftSuspension);
            
            const leftPoint = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            leftPoint.setAttribute('cx', firstSuspensionX);
            leftPoint.setAttribute('cy', suspensionTopY);
            leftPoint.setAttribute('r', 3);
            leftPoint.setAttribute('fill', '#FF6B6B');
            leftPoint.setAttribute('stroke', '#C92A2A');
            leftPoint.setAttribute('stroke-width', '1');
            leftPoint.setAttribute('style', 'fill: #FF6B6B; stroke: #C92A2A; stroke-width: 1;');
            svg.appendChild(leftPoint);
            
            // Правый подвес
            const rightSuspension = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            rightSuspension.setAttribute('x1', secondSuspensionX);
            rightSuspension.setAttribute('y1', suspensionTopY);
            rightSuspension.setAttribute('x2', secondSuspensionX);
            rightSuspension.setAttribute('y2', boardY);
            rightSuspension.setAttribute('stroke', '#FF6B6B');
            rightSuspension.setAttribute('stroke-width', '2');
            rightSuspension.setAttribute('style', 'stroke: #FF6B6B; stroke-width: 2;');
            svg.appendChild(rightSuspension);
            
            const rightPoint = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            rightPoint.setAttribute('cx', secondSuspensionX);
            rightPoint.setAttribute('cy', suspensionTopY);
            rightPoint.setAttribute('r', 3);
            rightPoint.setAttribute('fill', '#FF6B6B');
            rightPoint.setAttribute('stroke', '#C92A2A');
            rightPoint.setAttribute('stroke-width', '1');
            rightPoint.setAttribute('style', 'fill: #FF6B6B; stroke: #C92A2A; stroke-width: 1;');
            svg.appendChild(rightPoint);
        }
    }
    
    // Рисуем размерные линии (горизонтальные подписи, кроме размеров от края платформы)
    drawDimensionLine(svg, leftAxisX, 20, rightAxisX, 20, 'Расстояние по осям\n' + formatNumber(inputs.l_axes) + ' мм', 'top', false);
    drawDimensionLine(svg, leftEdgeX, 50, rightEdgeX, 50, 'Расстояние от края\nдо края платформы\n' + formatNumber(inputs.l_edges) + ' мм', 'top', false);
    
    // D_left и D_right
    drawDimensionLine(svg, leftAxisX - leftPlatformRadius, centerY - 50, leftAxisX + leftPlatformRadius, centerY - 50, 'Диаметр левой\nплатформы\n' + formatNumber(inputs.d_left) + ' мм', 'top', false);
    drawDimensionLine(svg, rightAxisX - rightPlatformRadius, centerY - 50, rightAxisX + rightPlatformRadius, centerY - 50, 'Диаметр правой\nплатформы\n' + formatNumber(inputs.d_right) + ' мм', 'top', false);
    
    // a (отступ) - выше элементов
    if (inputs.element_type === 'board') {
        const firstBoardLeft = leftEdgeX + result.a * scale;
        drawDimensionLine(svg, leftEdgeX, centerY - 100, firstBoardLeft, centerY - 100, 'Отступ от края\nдо первого элемента\n' + formatNumber(result.a) + ' мм', 'top', false);
    } else if (inputs.element_type === 'board_ropes') {
        const firstSuspensionX = leftEdgeX + result.a * scale;
        drawDimensionLine(svg, leftEdgeX, centerY - 100, firstSuspensionX, centerY - 100, 'Отступ от края\nдо первого элемента\n' + formatNumber(result.a) + ' мм', 'top', false);
    }
    
    // w (длина элемента) - выше элементов
    if (result.n > 0) {
        let firstBoardLeft;
        if (inputs.element_type === 'board') {
            firstBoardLeft = leftEdgeX + result.a * scale;
        } else {
            firstBoardLeft = leftEdgeX + result.a * scale - inputs.s * scale;
        }
        const firstBoardRight = firstBoardLeft + inputs.w * scale;
        drawDimensionLine(svg, firstBoardLeft, centerY - 140, firstBoardRight, centerY - 140, 'Длина элемента\n' + formatNumber(inputs.w) + ' мм', 'top', false);
    }
    
    // g (расстояние между элементами) - выше элементов, только первая с подписью
    if (result.n > 1) {
        let leftPoint, rightPoint;
        if (inputs.element_type === 'board') {
            // Для board: g - расстояние между правым краем первой доски и левым краем второй доски
            leftPoint = leftEdgeX + result.a * scale + result.w_eff * scale;
            rightPoint = leftEdgeX + result.a * scale + (result.w_eff + result.g) * scale;
        } else {
            // Для board_ropes: g - расстояние между правым подвесом первой доски и левым подвесом второй доски
            leftPoint = leftEdgeX + result.a * scale + result.w_eff * scale;
            rightPoint = leftEdgeX + result.a * scale + (result.w_eff + result.g) * scale;
        }
        // Рисуем только одну линию с подписью для первого шага
        drawDimensionLine(svg, leftPoint, centerY - 180, rightPoint, centerY - 180, 'Расстояние между\nэлементами\n' + formatNumber(result.g) + ' мм', 'top', false);
    }
    
    // p (для board_ropes - между подвесами одной доски)
    if (inputs.element_type === 'board_ropes' && result.n > 0) {
        const firstSuspensionLeft = leftEdgeX + result.a * scale;
        const firstSuspensionRight = firstSuspensionLeft + result.w_eff * scale;
        const p = inputs.w - 2 * inputs.s;
        drawDimensionLine(svg, firstSuspensionLeft, centerY - 80, firstSuspensionRight, centerY - 80, 'p = ' + formatNumber(p) + ' мм', 'top', false);
    }
    
    // Размерная линия от края платформы (ноль) до последнего элемента - одна линия с точками
    const zeroY = centerY + 140;
    
    // Определяем позицию последнего элемента
    let lastElementX;
    if (result.n > 0) {
        if (inputs.element_type === 'board') {
            // Левая опорная точка (левый край) последнего элемента
            lastElementX = leftEdgeX + result.a * scale + (result.n - 1) * (result.w_eff + result.g) * scale;
        } else {
            // Левая опорная точка (левый подвес) последнего элемента
            lastElementX = leftEdgeX + result.a * scale + (result.n - 1) * (result.w_eff + result.g) * scale;
        }
    } else {
        lastElementX = leftEdgeX;
    }
    
    // Рисуем одну базовую линию от края платформы до последнего элемента
    const baseLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    baseLine.setAttribute('x1', leftEdgeX);
    baseLine.setAttribute('y1', zeroY);
    baseLine.setAttribute('x2', lastElementX);
    baseLine.setAttribute('y2', zeroY);
    baseLine.setAttribute('stroke', '#2196F3');
    baseLine.setAttribute('stroke-width', '1.5');
    baseLine.setAttribute('fill', 'none');
    baseLine.setAttribute('style', 'stroke: #2196F3; stroke-width: 1.5;');
    svg.appendChild(baseLine);
    
    // Подпись "0" у края платформы - выше линии, с большим отступом
    const zeroText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    zeroText.setAttribute('x', leftEdgeX - 4); // Сдвиг влево на 4 пикселя
    zeroText.setAttribute('y', zeroY - 35);
    zeroText.setAttribute('fill', '#2196F3');
    zeroText.setAttribute('font-size', '12');
    zeroText.setAttribute('font-family', 'Arial, sans-serif');
    zeroText.setAttribute('font-weight', 'bold');
    zeroText.setAttribute('text-anchor', 'middle');
    zeroText.setAttribute('style', 'fill: #2196F3; font-size: 12px; font-family: Arial, sans-serif; font-weight: bold;');
    zeroText.setAttribute('transform', `rotate(-90 ${leftEdgeX - 4} ${zeroY - 35})`);
    zeroText.textContent = '0';
    svg.appendChild(zeroText);
    
    // Рисуем точки и подписи для каждого элемента
    // Располагаем подписи в шахматном порядке (через одну) или с достаточными интервалами
    const minLabelSpacing = 50; // Минимальный интервал между подписями в пикселях
    const labelHeight = 20; // Высота повёрнутой подписи
    
    // Собираем все позиции элементов
    const elementPositions = [];
    for (let i = 0; i < result.n; i++) {
        let elementX;
        if (inputs.element_type === 'board') {
            elementX = leftEdgeX + result.a * scale + i * (result.w_eff + result.g) * scale;
        } else {
            elementX = leftEdgeX + result.a * scale + i * (result.w_eff + result.g) * scale;
        }
        const distance = (elementX - leftEdgeX) / scale;
        elementPositions.push({ x: elementX, distance: distance, index: i });
    }
    
    // Распределяем подписи по уровням, чтобы они не накладывались
    const labelLevels = [];
    for (const pos of elementPositions) {
        let level = 0;
        // Ищем уровень, где подпись не будет накладываться на предыдущие
        while (true) {
            let canPlace = true;
            for (const existing of labelLevels) {
                if (existing.level === level && Math.abs(existing.x - pos.x) < minLabelSpacing) {
                    canPlace = false;
                    break;
                }
            }
            if (canPlace) break;
            level++;
        }
        labelLevels.push({ x: pos.x, distance: pos.distance, level: level });
    }
    
    // Рисуем точки, линии и подписи
    for (let i = 0; i < result.n; i++) {
        const pos = elementPositions[i];
        const labelInfo = labelLevels[i];
        
        // Точка на линии
        const point = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        point.setAttribute('cx', pos.x);
        point.setAttribute('cy', zeroY);
        point.setAttribute('r', 4);
        point.setAttribute('fill', '#2196F3');
        point.setAttribute('stroke', '#2196F3');
        point.setAttribute('stroke-width', '1');
        point.setAttribute('style', 'fill: #2196F3; stroke: #2196F3; stroke-width: 1;');
        svg.appendChild(point);
        
        // Вертикальная линия от точки вверх (к подписи)
        const verticalLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        verticalLine.setAttribute('x1', pos.x);
        verticalLine.setAttribute('y1', zeroY);
        verticalLine.setAttribute('x2', pos.x);
        verticalLine.setAttribute('y2', zeroY - 25 - labelInfo.level * (labelHeight + 5));
        verticalLine.setAttribute('stroke', '#2196F3');
        verticalLine.setAttribute('stroke-width', '1.5');
        verticalLine.setAttribute('fill', 'none');
        verticalLine.setAttribute('style', 'stroke: #2196F3; stroke-width: 1.5;');
        svg.appendChild(verticalLine);
        
        // Подпись размера (повёрнута на 90 градусов) - выше линии, с большим отступом от стрелок
        const labelY = zeroY - 35 - labelInfo.level * (labelHeight + 5);
        const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        labelText.setAttribute('x', pos.x - 4); // Сдвиг влево на 4 пикселя
        labelText.setAttribute('y', labelY);
        labelText.setAttribute('fill', '#2196F3');
        labelText.setAttribute('font-size', '12');
        labelText.setAttribute('font-family', 'Arial, sans-serif');
        labelText.setAttribute('font-weight', 'bold');
        labelText.setAttribute('text-anchor', 'middle');
        labelText.setAttribute('style', 'fill: #2196F3; font-size: 12px; font-family: Arial, sans-serif; font-weight: bold;');
        labelText.setAttribute('transform', `rotate(-90 ${pos.x - 4} ${labelY})`);
        labelText.textContent = formatNumber(pos.distance) + ' мм';
        svg.appendChild(labelText);
    }
}

// Функция печати схемы
function printDiagram() {
    const svg = document.getElementById('diagram');
    if (!svg || !calculationResult) {
        alert('Нет схемы для печати');
        return;
    }
    
    // Создаём новое окно для печати
    const printWindow = window.open('', '_blank');
    const svgClone = svg.cloneNode(true);
    
    // Получаем текущие размеры
    const currentWidth = parseFloat(svg.getAttribute('width')) || 1000;
    const currentHeight = parseFloat(svg.getAttribute('height')) || 600;
    
    // Размеры для A4 в альбомной ориентации (297x210 мм)
    // С отступами по 10mm рабочая область: 277mm x 190mm
    // В пикселях при 96 DPI: примерно 1046px x 718px
    const maxPrintWidth = 1046;
    const maxPrintHeight = 718;
    
    // Вычисляем масштаб, чтобы влезло и по ширине, и по высоте
    const scaleX = maxPrintWidth / currentWidth;
    const scaleY = maxPrintHeight / currentHeight;
    const scale = Math.min(scaleX, scaleY); // Берём меньший масштаб
    
    // Финальные размеры с учётом масштаба
    const printWidth = currentWidth * scale;
    const printHeight = currentHeight * scale;
    
    // Устанавливаем размеры для печати
    svgClone.setAttribute('width', printWidth);
    svgClone.setAttribute('height', printHeight);
    svgClone.setAttribute('viewBox', `0 0 ${currentWidth} ${currentHeight}`);
    svgClone.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Схема раскладки элементов</title>
            <style>
                @media print {
                    @page {
                        margin: 10mm;
                        size: A4 landscape;
                    }
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        color-adjust: exact !important;
                    }
                    body {
                        margin: 0;
                        padding: 0;
                    }
                    svg {
                        page-break-inside: avoid;
                        page-break-after: avoid;
                        page-break-before: avoid;
                    }
                }
                body {
                    margin: 0;
                    padding: 0;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    width: 277mm;
                    height: 190mm;
                    background: white;
                }
                svg {
                    border: 2px solid #000;
                    background-color: #fafafa;
                    width: ${printWidth}px;
                    height: ${printHeight}px;
                    max-width: 100%;
                    max-height: 100%;
                }
            </style>
        </head>
        <body>
            ${svgClone.outerHTML}
        </body>
        </html>
    `);
    printWindow.document.close();
    
    // Ждём загрузки и открываем диалог печати
    setTimeout(function() {
        printWindow.print();
    }, 250);
}

// Функция экспорта в PDF
function exportToPDF() {
    const svg = document.getElementById('diagram');
    if (!svg || !calculationResult) {
        alert('Нет схемы для экспорта');
        return;
    }
    
    // Проверяем наличие jsPDF
    if (typeof window.jspdf === 'undefined') {
        // Если jsPDF не загружен, используем fallback через print
        alert('Библиотека для экспорта PDF не загружена. Используется режим печати.');
        printDiagram();
        return;
    }
    
    const { jsPDF } = window.jspdf;
    
    // Получаем текущие размеры
    const currentWidth = parseFloat(svg.getAttribute('width')) || 1000;
    const currentHeight = parseFloat(svg.getAttribute('height')) || 600;
    
    // Размеры для A4 в альбомной ориентации (297x210 мм)
    // В пикселях при 96 DPI: примерно 1123px x 794px
    // С отступами по 10mm рабочая область: 277mm x 190mm (≈1046px x 718px)
    const a4Width = 297; // мм
    const a4Height = 210; // мм
    const margin = 10; // мм
    const contentWidth = a4Width - 2 * margin; // 277mm
    const contentHeight = a4Height - 2 * margin; // 190mm
    
    // Вычисляем масштаб для вписывания в A4
    const scaleX = contentWidth / (currentWidth * 0.264583); // конвертация px в mm
    const scaleY = contentHeight / (currentHeight * 0.264583);
    const scale = Math.min(scaleX, scaleY);
    
    // Финальные размеры в мм
    const finalWidth = currentWidth * 0.264583 * scale;
    const finalHeight = currentHeight * 0.264583 * scale;
    
    // Создаём PDF документ
    const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
    });
    
    // Конвертируем SVG в изображение через Canvas
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    
    const img = new Image();
    img.onload = function() {
        // Создаём canvas для конвертации в изображение
        const canvas = document.createElement('canvas');
        canvas.width = currentWidth;
        canvas.height = currentHeight;
        const ctx = canvas.getContext('2d');
        
        // Рисуем белый фон
        ctx.fillStyle = '#fafafa';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Рисуем SVG на canvas
        ctx.drawImage(img, 0, 0, currentWidth, currentHeight);
        
        // Конвертируем canvas в data URL
        const dataUrl = canvas.toDataURL('image/png');
        
        // Добавляем изображение в PDF с центрированием
        const x = (a4Width - finalWidth) / 2;
        const y = (a4Height - finalHeight) / 2;
        
        pdf.addImage(dataUrl, 'PNG', x, y, finalWidth, finalHeight);
        
        // Сохраняем PDF
        pdf.save('схема_раскладки_элементов.pdf');
        
        URL.revokeObjectURL(svgUrl);
    };
    
    img.onerror = function() {
        alert('Ошибка при экспорте схемы');
        URL.revokeObjectURL(svgUrl);
    };
    
    img.src = svgUrl;
}

// Рисование размерной линии со стрелками
function drawDimensionLine(svg, x1, y1, x2, y2, label, position, rotateText = false) {
    // Всегда рисуем линию
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    line.setAttribute('stroke', '#2196F3');
    line.setAttribute('stroke-width', '1.5');
    line.setAttribute('fill', 'none');
    line.setAttribute('style', 'stroke: #2196F3; stroke-width: 1.5;');
    svg.appendChild(line);
    
    // Стрелки рисуем только если есть подпись
    if (label) {
        const arrowSize = 8;
        const angle = Math.atan2(y2 - y1, x2 - x1);
        
        // Стрелка в начале
        const arrow1 = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const arrow1Points = [
            [x1, y1],
            [x1 + arrowSize * Math.cos(angle - Math.PI / 6), y1 + arrowSize * Math.sin(angle - Math.PI / 6)],
            [x1 + arrowSize * Math.cos(angle + Math.PI / 6), y1 + arrowSize * Math.sin(angle + Math.PI / 6)]
        ];
        arrow1.setAttribute('points', arrow1Points.map(p => p.join(',')).join(' '));
        arrow1.setAttribute('fill', '#2196F3');
        arrow1.setAttribute('stroke', '#2196F3');
        arrow1.setAttribute('style', 'fill: #2196F3; stroke: #2196F3; stroke-width: 1;');
        svg.appendChild(arrow1);
        
        // Стрелка в конце
        const arrow2 = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const arrow2Points = [
            [x2, y2],
            [x2 - arrowSize * Math.cos(angle - Math.PI / 6), y2 - arrowSize * Math.sin(angle - Math.PI / 6)],
            [x2 - arrowSize * Math.cos(angle + Math.PI / 6), y2 - arrowSize * Math.sin(angle + Math.PI / 6)]
        ];
        arrow2.setAttribute('points', arrow2Points.map(p => p.join(',')).join(' '));
        arrow2.setAttribute('fill', '#2196F3');
        arrow2.setAttribute('stroke', '#2196F3');
        arrow2.setAttribute('style', 'fill: #2196F3; stroke: #2196F3; stroke-width: 1;');
        svg.appendChild(arrow2);
        
        // Текст - размещаем над или под линией в зависимости от position
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        
        // Определяем offset в зависимости от position
        // 'top' - текст над линией (отрицательный offset)
        // 'bottom' - текст под линией (положительный offset)
        let offset;
        if (position === 'top') {
            // Увеличиваем отступ для многострочного текста
            const lineCount = label.split('\n').length;
            offset = -25 - (lineCount - 1) * 8; // Больше отступ для многострочного текста
        } else {
            offset = 20; // Под линией
        }
        
        text.setAttribute('x', midX);
        text.setAttribute('y', midY + offset);
        text.setAttribute('fill', '#2196F3');
        text.setAttribute('font-size', '12');
        text.setAttribute('font-family', 'Arial, sans-serif');
        text.setAttribute('font-weight', 'bold');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        
        if (rotateText) {
            text.setAttribute('transform', `rotate(-90 ${midX} ${midY + offset})`);
            // Для повёрнутого текста просто используем весь текст
            text.textContent = label;
        } else {
            // Для горизонтального текста разбиваем на строки по \n
            const lines = label.split('\n');
            const lineHeight = 16; // Увеличена высота строки для лучшей читаемости
            const startY = midY + offset - (lines.length - 1) * lineHeight / 2;
            
            lines.forEach((line, index) => {
                const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
                tspan.setAttribute('x', midX);
                tspan.setAttribute('dy', index === 0 ? '0' : lineHeight);
                tspan.textContent = line;
                text.appendChild(tspan);
            });
        }
        
        svg.appendChild(text);
    }
}
