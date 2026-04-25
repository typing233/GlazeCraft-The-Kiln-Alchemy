let firingLoopId = null;
let lastFiringTime = 0;
let isHeating = false;
let isCooling = false;
let isHolding = false;

document.addEventListener('DOMContentLoaded', () => {
    setupFiringControls();
});

function setupFiringControls() {
    const startFiringBtn = document.getElementById('start-firing');
    const holdTempBtn = document.getElementById('hold-temperature');
    const startCoolingBtn = document.getElementById('start-cooling');
    const stopFiringBtn = document.getElementById('stop-firing');
    
    const heatRateSlider = document.getElementById('heat-rate');
    const coolRateSlider = document.getElementById('cool-rate');
    const oxygenSlider = document.getElementById('oxygen-level');
    
    if (heatRateSlider) {
        heatRateSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            const display = document.getElementById('heat-rate-value');
            if (display) display.textContent = `${value}°C/分钟`;
        });
    }
    
    if (coolRateSlider) {
        coolRateSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            const display = document.getElementById('cool-rate-value');
            if (display) display.textContent = `${value}°C/分钟`;
            appState.firingParams.cooling_rate = value;
        });
    }
    
    if (oxygenSlider) {
        oxygenSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            const display = document.getElementById('oxygen-value');
            if (display) display.textContent = `${value}%`;
            appState.firingParams.oxygen_level = value;
        });
    }
    
    if (startFiringBtn) {
        startFiringBtn.addEventListener('click', startHeating);
    }
    
    if (holdTempBtn) {
        holdTempBtn.addEventListener('click', holdTemperature);
    }
    
    if (startCoolingBtn) {
        startCoolingBtn.addEventListener('click', startCooling);
    }
    
    if (stopFiringBtn) {
        stopFiringBtn.addEventListener('click', stopFiring);
    }
}

function startHeating() {
    if (appState.firingActive) return;
    
    appState.firingActive = true;
    appState.firingPhase = '升温中';
    appState.firingStartTime = Date.now();
    lastFiringTime = Date.now();
    
    isHeating = true;
    isCooling = false;
    isHolding = false;
    
    runFiringLoop();
    updateFiringDisplay();
}

function holdTemperature() {
    if (!appState.firingActive) return;
    
    isHeating = false;
    isCooling = false;
    isHolding = true;
    
    appState.firingPhase = '保温中';
    updateFiringDisplay();
}

function startCooling() {
    if (!appState.firingActive) return;
    
    isHeating = false;
    isCooling = true;
    isHolding = false;
    
    appState.firingPhase = '冷却中';
    updateFiringDisplay();
}

function stopFiring() {
    appState.firingActive = false;
    isHeating = false;
    isCooling = false;
    isHolding = false;
    
    if (firingLoopId) {
        cancelAnimationFrame(firingLoopId);
        firingLoopId = null;
    }
    
    appState.firingPhase = '已停止';
    updateFiringDisplay();
    
    const finishBtn = document.getElementById('finish-firing');
    if (finishBtn) {
        finishBtn.disabled = false;
    }
}

function runFiringLoop() {
    if (!appState.firingActive) return;
    
    const now = Date.now();
    const deltaTime = (now - lastFiringTime) / 1000;
    lastFiringTime = now;
    
    const heatRate = parseInt(document.getElementById('heat-rate')?.value || 5);
    const coolRate = parseInt(document.getElementById('cool-rate')?.value || 10);
    
    const speedMultiplier = 10;
    
    if (isHeating) {
        appState.firingParams.current_temperature += heatRate * (deltaTime / 60) * speedMultiplier;
        appState.firingParams.current_temperature = Math.min(1400, appState.firingParams.current_temperature);
        
        if (appState.firingParams.current_temperature < 100) {
            appState.firingPhase = '低温预热';
        } else if (appState.firingParams.current_temperature < 300) {
            appState.firingPhase = '水分蒸发';
        } else if (appState.firingParams.current_temperature < 600) {
            appState.firingPhase = '氧化期中';
        } else if (appState.firingParams.current_temperature < 900) {
            appState.firingPhase = '中温烧成';
        } else if (appState.firingParams.current_temperature < 1200) {
            appState.firingPhase = '高温烧成';
        } else {
            appState.firingPhase = '超高还原';
        }
    } else if (isCooling) {
        appState.firingParams.current_temperature -= coolRate * (deltaTime / 60) * speedMultiplier;
        appState.firingParams.current_temperature = Math.max(20, appState.firingParams.current_temperature);
        
        appState.firingPhase = '冷却降温';
        
        if (appState.firingParams.current_temperature < 100) {
            stopFiring();
        }
    } else if (isHolding) {
        appState.firingPhase = '保温阶段';
    }
    
    const elapsed = Math.floor((now - appState.firingStartTime) / 1000);
    appState.firingParams.temperature_profile.push([
        appState.firingParams.current_temperature,
        elapsed
    ]);
    
    updateFiringDisplay();
    
    firingLoopId = requestAnimationFrame(runFiringLoop);
}

function updateFiringDisplay() {
    const tempValue = document.getElementById('temp-value');
    const tempStatus = document.getElementById('temp-status');
    const firingPhase = document.getElementById('firing-phase');
    const firingTime = document.getElementById('firing-time');
    
    if (tempValue) {
        tempValue.textContent = `${Math.round(appState.firingParams.current_temperature)}°C`;
    }
    
    const temp = appState.firingParams.current_temperature;
    
    let modeText = '';
    let modeColor = '';
    
    if (isHeating) {
        modeText = '🔥 加热中';
        modeColor = '#ff6b6b';
    } else if (isCooling) {
        modeText = '❄️ 冷却中';
        modeColor = '#74b9ff';
    } else if (isHolding) {
        modeText = '⏸ 保温中';
        modeColor = '#feca57';
    } else if (appState.firingActive) {
        modeText = '⚡ 运行中';
        modeColor = '#aaa';
    } else {
        modeText = '⭕ 待机中';
        modeColor = '#666';
    }
    
    let tempStageText = '';
    let tempStageColor = '';
    
    if (temp < 100) {
        tempStageText = '低温预热';
        tempStageColor = '#888';
    } else if (temp < 300) {
        tempStageText = '水分蒸发';
        tempStageColor = '#aaa';
    } else if (temp < 600) {
        tempStageText = '氧化期';
        tempStageColor = '#feca57';
    } else if (temp < 900) {
        tempStageText = '中温烧成';
        tempStageColor = '#ff8c42';
    } else if (temp < 1200) {
        tempStageText = '高温烧成';
        tempStageColor = '#ff6b6b';
    } else {
        tempStageText = '超高还原';
        tempStageColor = '#e94560';
    }
    
    if (tempStatus) {
        tempStatus.textContent = `${modeText} - ${tempStageText}`;
        tempStatus.style.color = modeColor;
    }
    
    if (firingPhase) {
        firingPhase.textContent = appState.firingPhase;
    }
    
    if (firingTime && appState.firingActive) {
        const elapsed = Math.floor((Date.now() - appState.firingStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        firingTime.textContent = `时间: ${minutes}分${seconds}秒`;
    }
    
    drawTempChart();
}
