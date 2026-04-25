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
    
    if (isHeating) {
        appState.firingParams.current_temperature += heatRate * (deltaTime / 60);
        appState.firingParams.current_temperature = Math.min(1400, appState.firingParams.current_temperature);
        
        if (appState.firingParams.current_temperature < 300) {
            appState.firingPhase = '低温脱水';
        } else if (appState.firingParams.current_temperature < 600) {
            appState.firingPhase = '氧化期';
        } else if (appState.firingParams.current_temperature < 1000) {
            appState.firingPhase = '高温升温';
        } else {
            appState.firingPhase = '烧成温度';
        }
    } else if (isCooling) {
        appState.firingParams.current_temperature -= coolRate * (deltaTime / 60);
        appState.firingParams.current_temperature = Math.max(20, appState.firingParams.current_temperature);
        
        if (appState.firingParams.current_temperature < 100) {
            stopFiring();
        }
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
    if (temp < 300) {
        if (tempStatus) {
            tempStatus.textContent = '低温阶段';
            tempStatus.style.color = '#aaa';
        }
    } else if (temp < 600) {
        if (tempStatus) {
            tempStatus.textContent = '升温中...';
            tempStatus.style.color = '#feca57';
        }
    } else if (temp < 1000) {
        if (tempStatus) {
            tempStatus.textContent = '氧化焰阶段';
            tempStatus.style.color = '#ff6b6b';
        }
    } else {
        if (tempStatus) {
            tempStatus.textContent = '高温还原焰';
            tempStatus.style.color = '#e94560';
        }
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
