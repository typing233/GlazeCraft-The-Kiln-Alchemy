const API_BASE = '';

const STORAGE_KEYS = {
    USER_ID: 'glazecraft_user_id',
    WORKS_BACKUP: 'glazecraft_works_backup'
};

function getOrCreateUserId() {
    let userId = localStorage.getItem(STORAGE_KEYS.USER_ID);
    if (!userId) {
        userId = 'user_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem(STORAGE_KEYS.USER_ID, userId);
        console.log('创建新用户ID:', userId);
    } else {
        console.log('使用已存在的用户ID:', userId);
    }
    return userId;
}

function getWorksFromStorage() {
    const backup = localStorage.getItem(STORAGE_KEYS.WORKS_BACKUP);
    if (backup) {
        try {
            return JSON.parse(backup);
        } catch (e) {
            console.error('解析备份作品失败:', e);
        }
    }
    return [];
}

function saveWorksToStorage(works) {
    try {
        localStorage.setItem(STORAGE_KEYS.WORKS_BACKUP, JSON.stringify(works));
        console.log('作品已备份到 localStorage');
    } catch (e) {
        console.error('备份作品失败:', e);
    }
}

function addWorkToStorage(work) {
    const works = getWorksFromStorage();
    works.unshift(work);
    saveWorksToStorage(works);
}

const appState = {
    currentStage: 'pottery',
    userId: getOrCreateUserId(),
    meshData: null,
    selectedRecipe: null,
    currentIngredients: {},
    recipeValidated: false,
    firingParams: {
        temperature_profile: [[20, 0]],
        cooling_rate: 10,
        oxygen_level: 21,
        current_temperature: 20
    },
    firingActive: false,
    firingPhase: '待机中',
    firingStartTime: 0,
    generatedTexture: null,
    selectedWork: null,
    works: []
};

let recipes = [];

document.addEventListener('DOMContentLoaded', async () => {
    console.log('GlazeCraft: 窑变炼金术 启动中...');
    console.log('当前用户ID:', appState.userId);
    
    const backupWorks = getWorksFromStorage();
    if (backupWorks.length > 0) {
        console.log('从 localStorage 恢复备份作品:', backupWorks.length);
    }
    
    await loadRecipes();
    setupNavigation();
    setupEventListeners();
    initTempChart();
});

async function loadRecipes() {
    try {
        const response = await fetch(`${API_BASE}/api/recipes`);
        recipes = await response.json();
        renderRecipeList();
    } catch (error) {
        console.error('加载配方失败:', error);
        recipes = [
            {
                id: 'recipe_001',
                name: '青瓷釉',
                description: '宋代龙泉窑经典釉色，温润如玉',
                ingredients: {
                    '长石': 40, '石英': 25, '高岭土': 20, '草木灰': 10, '氧化铁': 5
                },
                temperature_min: 1200,
                temperature_max: 1250,
                difficulty: '简单',
                hint: '氧化焰烧成，保持1200-1250度'
            },
            {
                id: 'recipe_002',
                name: '钧窑釉',
                description: '入窑一色，出窑万彩',
                ingredients: {
                    '长石': 35, '石英': 20, '方解石': 15, '草木灰': 10, 
                    '氧化铜': 8, '五氧化二磷': 7, '氧化铁': 5
                },
                temperature_min: 1280,
                temperature_max: 1320,
                difficulty: '困难',
                hint: '还原焰，窑变需要温度突变'
            },
            {
                id: 'recipe_003',
                name: '建盏油滴釉',
                description: '兔毫纹与油滴结晶的艺术',
                ingredients: {
                    '长石': 30, '石英': 15, '方解石': 15, '草木灰': 15,
                    '氧化铁': 20, '锰矿': 5
                },
                temperature_min: 1300,
                temperature_max: 1350,
                difficulty: '专家',
                hint: '高温还原，快速冷却产生结晶'
            }
        ];
        renderRecipeList();
    }
}

function renderRecipeList() {
    const container = document.getElementById('recipes-container');
    if (!container) return;
    
    container.innerHTML = recipes.map(recipe => `
        <div class="recipe-item" data-id="${recipe.id}">
            <h5>${recipe.name}</h5>
            <span class="difficulty ${recipe.difficulty}">难度: ${recipe.difficulty}</span>
            <p style="font-size: 0.85rem; color: #aaa; margin-top: 0.5rem;">${recipe.description}</p>
        </div>
    `).join('');
    
    container.querySelectorAll('.recipe-item').forEach(item => {
        item.addEventListener('click', () => selectRecipe(item.dataset.id));
    });
}

function selectRecipe(recipeId) {
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) return;
    
    appState.selectedRecipe = recipe;
    appState.recipeValidated = false;
    appState.currentIngredients = {};
    
    document.querySelectorAll('.recipe-item').forEach(item => {
        item.classList.toggle('selected', item.dataset.id === recipeId);
    });
    
    renderRecipeDetails(recipe);
    renderIngredientControls(recipe);
}

function renderRecipeDetails(recipe) {
    const detailsContainer = document.getElementById('recipe-details');
    if (!detailsContainer) return;
    
    detailsContainer.innerHTML = `
        <h4 style="color: #ff6b6b; margin-bottom: 0.75rem;">${recipe.name}</h4>
        <p><strong>描述:</strong> ${recipe.description}</p>
        <p><strong>烧成温度:</strong> ${recipe.temperature_min}°C - ${recipe.temperature_max}°C</p>
        <p><strong>难度:</strong> <span class="difficulty ${recipe.difficulty}">${recipe.difficulty}</span></p>
        <p style="margin-top: 1rem;"><strong>💡 提示:</strong> ${recipe.hint}</p>
    `;
}

function renderIngredientControls(recipe) {
    const container = document.getElementById('ingredients-container');
    if (!container) return;
    
    const ingredients = recipe.ingredients;
    const allIngredients = ['长石', '石英', '高岭土', '草木灰', '方解石', '氧化铁', '氧化铜', '五氧化二磷', '锰矿'];
    
    appState.currentIngredients = {};
    
    container.innerHTML = allIngredients.map(ingredient => {
        const targetValue = ingredients[ingredient] || 0;
        appState.currentIngredients[ingredient] = 0;
        
        return `
            <div class="ingredient-control">
                <label>${ingredient}${targetValue > 0 ? ` *` : ''}</label>
                <input type="range" 
                       id="ingredient-${ingredient}" 
                       min="0" max="50" 
                       value="0" 
                       data-target="${targetValue}">
                <span class="ingredient-value" id="value-${ingredient}">0%</span>
            </div>
        `;
    }).join('');
    
    allIngredients.forEach(ingredient => {
        const slider = document.getElementById(`ingredient-${ingredient}`);
        const valueDisplay = document.getElementById(`value-${ingredient}`);
        
        if (slider && valueDisplay) {
            slider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                valueDisplay.textContent = `${value}%`;
                appState.currentIngredients[ingredient] = value;
                updateGlazePreview();
                appState.recipeValidated = false;
                document.getElementById('recipe-result').textContent = '';
                document.getElementById('recipe-result').className = 'result-text';
            });
        }
    });
    
    updateGlazePreview();
}

function updateGlazePreview() {
    const previewBox = document.getElementById('glaze-preview');
    if (!previewBox) return;
    
    const copper = appState.currentIngredients['氧化铜'] || 0;
    const iron = appState.currentIngredients['氧化铁'] || 0;
    const phosphor = appState.currentIngredients['五氧化二磷'] || 0;
    const ash = appState.currentIngredients['草木灰'] || 0;
    
    let r = 139 + ash * 2;
    let g = 115 + iron * 1 - copper * 1;
    let b = 85 + copper * 3 + phosphor * 2;
    
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    
    const color1 = `rgb(${r}, ${g}, ${b})`;
    const color2 = `rgb(${Math.min(255, r + 20)}, ${Math.min(255, g + 15)}, ${Math.min(255, b + 10)})`;
    const color3 = `rgb(${Math.max(0, r - 20)}, ${Math.max(0, g - 15)}, ${Math.max(0, b - 10)})`;
    
    previewBox.style.background = `linear-gradient(135deg, ${color1}, ${color2}, ${color3})`;
}

function validateRecipe() {
    if (!appState.selectedRecipe) {
        document.getElementById('recipe-result').textContent = '请先选择一个配方';
        document.getElementById('recipe-result').className = 'result-text error';
        return;
    }
    
    const targetIngredients = appState.selectedRecipe.ingredients;
    let isCorrect = true;
    let totalDifference = 0;
    
    for (const [ingredient, targetValue] of Object.entries(targetIngredients)) {
        const currentValue = appState.currentIngredients[ingredient] || 0;
        const difference = Math.abs(currentValue - targetValue);
        totalDifference += difference;
        
        if (difference > 5) {
            isCorrect = false;
        }
    }
    
    const totalTarget = Object.values(targetIngredients).reduce((a, b) => a + b, 0);
    const totalCurrent = Object.values(appState.currentIngredients).reduce((a, b) => a + b, 0);
    
    if (Math.abs(totalCurrent - 100) > 10) {
        isCorrect = false;
    }
    
    if (isCorrect) {
        appState.recipeValidated = true;
        document.getElementById('recipe-result').textContent = '✅ 配方正确！可以开始烧制了。';
        document.getElementById('recipe-result').className = 'result-text success';
    } else {
        document.getElementById('recipe-result').textContent = '❌ 配方不正确，请调整原料比例。';
        document.getElementById('recipe-result').className = 'result-text error';
    }
}

function setupNavigation() {
    const navButtons = {
        'nav-pottery': 'pottery',
        'nav-glaze': 'glaze',
        'nav-firing': 'firing',
        'nav-gallery': 'gallery'
    };
    
    for (const [btnId, stage] of Object.entries(navButtons)) {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.addEventListener('click', () => switchStage(stage));
        }
    }
    
    const nextButtons = {
        'next-to-glaze': 'glaze',
        'next-to-firing': 'firing'
    };
    
    for (const [btnId, stage] of Object.entries(nextButtons)) {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.addEventListener('click', () => switchStage(stage));
        }
    }
    
    const backButtons = {
        'back-to-pottery': 'pottery',
        'back-to-glaze': 'glaze'
    };
    
    for (const [btnId, stage] of Object.entries(backButtons)) {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.addEventListener('click', () => switchStage(stage));
        }
    }
}

function switchStage(stage) {
    if (stage === 'gallery') {
        loadUserWorks();
    }
    
    appState.currentStage = stage;
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        const btnStage = btn.id.replace('nav-', '');
        btn.classList.toggle('active', btnStage === stage);
    });
    
    document.querySelectorAll('.stage').forEach(s => {
        const stageId = s.id.replace('-stage', '');
        s.classList.toggle('active', stageId === stage);
    });
}

function setupEventListeners() {
    const checkRecipeBtn = document.getElementById('check-recipe');
    if (checkRecipeBtn) {
        checkRecipeBtn.addEventListener('click', validateRecipe);
    }
    
    const finishFiringBtn = document.getElementById('finish-firing');
    if (finishFiringBtn) {
        finishFiringBtn.addEventListener('click', finishFiring);
    }
    
    const closeModalBtn = document.getElementById('close-modal');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            document.getElementById('result-modal').classList.remove('show');
        });
    }
    
    const saveWorkBtn = document.getElementById('save-work');
    if (saveWorkBtn) {
        saveWorkBtn.addEventListener('click', saveCurrentWork);
    }
    
    const shareWorkBtn = document.getElementById('share-work');
    if (shareWorkBtn) {
        shareWorkBtn.addEventListener('click', generateShareLink);
    }
}

async function loadUserWorks() {
    let serverWorks = [];
    let localWorks = getWorksFromStorage();
    
    try {
        const response = await fetch(`${API_BASE}/api/works/user/${appState.userId}`);
        if (response.ok) {
            serverWorks = await response.json();
            console.log('从服务器加载作品:', serverWorks.length);
        }
    } catch (error) {
        console.error('从服务器加载作品失败:', error);
    }
    
    const allWorksMap = new Map();
    
    for (const work of serverWorks) {
        allWorksMap.set(work.id, work);
    }
    
    for (const work of localWorks) {
        if (!allWorksMap.has(work.id)) {
            allWorksMap.set(work.id, work);
        }
    }
    
    const allWorks = Array.from(allWorksMap.values());
    
    allWorks.sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
    });
    
    appState.works = allWorks;
    
    if (serverWorks.length > 0 && localWorks.length > 0) {
        saveWorksToStorage(allWorks);
        console.log('合并并同步了服务器和本地作品');
    }
    
    console.log('最终作品列表:', appState.works.length);
    renderGallery();
}

function renderGallery() {
    const grid = document.getElementById('gallery-grid');
    if (!grid) return;
    
    if (appState.works.length === 0) {
        grid.innerHTML = '<p class="empty-gallery">还没有作品，快去创作一件吧！</p>';
        return;
    }
    
    grid.innerHTML = appState.works.map(work => `
        <div class="gallery-item" data-id="${work.id}">
            <div class="item-preview" style="background-image: url('${work.texture_data || ''}'); background-size: cover; background-position: center;"></div>
            <div class="item-name">${work.name || '未命名'}</div>
            <div class="item-date">${work.created_at || ''}</div>
        </div>
    `).join('');
    
    grid.querySelectorAll('.gallery-item').forEach(item => {
        item.addEventListener('click', () => selectWork(item.dataset.id));
    });
}

function selectWork(workId) {
    const work = appState.works.find(w => w.id === workId);
    if (!work) return;
    
    appState.selectedWork = work;
    
    document.querySelectorAll('.gallery-item').forEach(item => {
        item.classList.toggle('selected', item.dataset.id === workId);
    });
    
    const infoPanel = document.getElementById('work-info');
    if (infoPanel) {
        infoPanel.innerHTML = `
            <h4>${work.name || '未命名作品'}</h4>
            <p><strong>创建时间:</strong> ${work.created_at || '未知'}</p>
            <p><strong>描述:</strong> ${work.description || '暂无描述'}</p>
            <div style="margin-top: 1rem; width: 100%; height: 150px; border-radius: 8px; background: ${work.texture_data ? `url('${work.texture_data}') center/cover` : 'linear-gradient(135deg, #8b7355, #a0826d)'};"></div>
        `;
    }
    
    const shareBtn = document.getElementById('share-work');
    if (shareBtn) {
        shareBtn.disabled = false;
    }
}

async function generateShareLink() {
    if (!appState.selectedWork) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/share/${appState.selectedWork.id}`);
        const data = await response.json();
        
        const shareContainer = document.getElementById('share-link');
        if (shareContainer) {
            const shareUrl = `${window.location.origin}/share/${appState.selectedWork.id}`;
            shareContainer.innerHTML = `
                <p>分享链接已生成:</p>
                <code style="display: block; margin: 0.5rem 0; padding: 0.5rem; background: rgba(0,0,0,0.3); border-radius: 4px;">
                    ${shareUrl}
                </code>
                <button onclick="navigator.clipboard.writeText('${shareUrl}').then(() => alert('链接已复制到剪贴板！'))" class="control-btn" style="margin-top: 0.5rem;">
                    📋 复制链接
                </button>
            `;
        }
    } catch (error) {
        console.error('生成分享链接失败:', error);
        const shareContainer = document.getElementById('share-link');
        if (shareContainer) {
            const shareUrl = `${window.location.origin}/share/${appState.selectedWork.id}`;
            shareContainer.innerHTML = `
                <p>分享链接 (模拟):</p>
                <code>${shareUrl}</code>
            `;
        }
    }
}

let tempChartContext = null;

function initTempChart() {
    const canvas = document.getElementById('temp-chart');
    if (!canvas) return;
    
    tempChartContext = canvas.getContext('2d');
    drawTempChart();
}

function drawTempChart() {
    if (!tempChartContext) return;
    
    const canvas = document.getElementById('temp-chart');
    const ctx = tempChartContext;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    
    for (let i = 0; i <= 5; i++) {
        const y = (canvas.height / 5) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
    
    const tempProfile = appState.firingParams.temperature_profile;
    if (tempProfile.length < 2) return;
    
    const maxTemp = 1400;
    const maxTime = Math.max(60, tempProfile[tempProfile.length - 1][1]);
    
    ctx.strokeStyle = '#feca57';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    tempProfile.forEach(([temp, time], index) => {
        const x = (time / maxTime) * canvas.width;
        const y = canvas.height - (temp / maxTemp) * canvas.height;
        
        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    
    ctx.stroke();
    
    ctx.fillStyle = '#ff6b6b';
    const lastPoint = tempProfile[tempProfile.length - 1];
    const lastX = (lastPoint[1] / maxTime) * canvas.width;
    const lastY = canvas.height - (lastPoint[0] / maxTemp) * canvas.height;
    
    ctx.beginPath();
    ctx.arc(lastX, lastY, 5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#eaeaea';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(lastPoint[0])}°C`, canvas.width - 5, lastY - 5);
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
        tempStatus.textContent = '低温阶段';
        tempStatus.style.color = '#aaa';
    } else if (temp < 600) {
        tempStatus.textContent = '升温中...';
        tempStatus.style.color = '#feca57';
    } else if (temp < 1000) {
        tempStatus.textContent = '氧化焰阶段';
        tempStatus.style.color = '#ff6b6b';
    } else {
        tempStatus.textContent = '高温还原焰';
        tempStatus.style.color = '#e94560';
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

async function finishFiring() {
    appState.firingActive = false;
    
    try {
        const response = await fetch(`${API_BASE}/api/firing/generate-texture`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                firing_params: appState.firingParams,
                glaze_recipe: appState.selectedRecipe || {}
            })
        });
        
        const data = await response.json();
        appState.generatedTexture = data.texture;
    } catch (error) {
        console.error('生成纹理失败:', error);
        appState.generatedTexture = generateLocalTexture();
    }
    
    showResultModal();
}

function generateLocalTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    const temp = appState.firingParams.current_temperature;
    const oxygen = appState.firingParams.oxygen_level;
    const copper = (appState.selectedRecipe?.ingredients?.['氧化铜'] || 0) / 10;
    const iron = (appState.selectedRecipe?.ingredients?.['氧化铁'] || 0) / 10;
    
    let r = 139 + iron * 10;
    let g = 115 + copper * 15;
    let b = 85 + copper * 20;
    
    if (oxygen < 15) {
        r -= 20;
        g += 10;
        b += 30;
    }
    
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    
    const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 300);
    gradient.addColorStop(0, `rgb(${r + 20}, ${g + 15}, ${b + 10})`);
    gradient.addColorStop(0.5, `rgb(${r}, ${g}, ${b})`);
    gradient.addColorStop(1, `rgb(${r - 20}, ${g - 15}, ${b - 10})`);
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
    
    if (temp > 1200) {
        const crystalColors = ['#FFD700', '#FFC0CB', '#ADD8E6', '#90EE90', '#FFA500'];
        for (let i = 0; i < 15; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const size = Math.random() * 25 + 5;
            
            ctx.fillStyle = crystalColors[Math.floor(Math.random() * crystalColors.length)];
            ctx.globalAlpha = 0.7;
            
            ctx.beginPath();
            const points = Math.floor(Math.random() * 4) + 5;
            for (let j = 0; j < points; j++) {
                const angle = (j / points) * Math.PI * 2;
                const dist = size * (0.5 + Math.random() * 0.5);
                const px = x + Math.cos(angle) * dist;
                const py = y + Math.sin(angle) * dist;
                if (j === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }
    
    return canvas.toDataURL('image/png');
}

function showResultModal() {
    const modal = document.getElementById('result-modal');
    const resultTexture = document.getElementById('result-texture');
    const statsContent = document.getElementById('result-stats-content');
    
    if (resultTexture) {
        resultTexture.style.backgroundImage = `url('${appState.generatedTexture}')`;
        resultTexture.style.backgroundSize = 'cover';
        resultTexture.style.backgroundPosition = 'center';
    }
    
    if (statsContent) {
        const tempProfile = appState.firingParams.temperature_profile;
        const maxTemp = Math.max(...tempProfile.map(([t, _]) => t));
        const avgOxygen = appState.firingParams.oxygen_level;
        const coolingRate = appState.firingParams.cooling_rate;
        
        let kilnChangeRating = '普通';
        let ratingColor = '#aaa';
        
        if (maxTemp > 1250 && avgOxygen < 15 && coolingRate > 50) {
            kilnChangeRating = '极品窑变！';
            ratingColor = '#feca57';
        } else if (maxTemp > 1200 && (avgOxygen < 18 || coolingRate > 30)) {
            kilnChangeRating = '优质窑变';
            ratingColor = '#ff6b6b';
        } else if (maxTemp > 1100) {
            kilnChangeRating = '正常烧成';
            ratingColor = '#2ecc71';
        }
        
        statsContent.innerHTML = `
            <p><strong>最高温度:</strong> ${Math.round(maxTemp)}°C</p>
            <p><strong>氧气含量:</strong> ${avgOxygen}%</p>
            <p><strong>冷却速率:</strong> ${coolingRate}°C/分钟</p>
            <p><strong>配方:</strong> ${appState.selectedRecipe?.name || '自定义'}</p>
            <p style="margin-top: 1rem; font-weight: bold; color: ${ratingColor};">
                🔥 窑变等级: ${kilnChangeRating}
            </p>
        `;
    }
    
    modal.classList.add('show');
}

async function saveCurrentWork() {
    const workName = document.getElementById('work-name').value || '未命名作品';
    const workDesc = document.getElementById('work-description').value || '';
    
    const now = new Date();
    const workId = 'work_' + now.getTime();
    const createdAt = now.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const workData = {
        id: workId,
        user_id: appState.userId,
        name: workName,
        description: workDesc,
        mesh_data: appState.meshData || {},
        glaze_recipe: appState.selectedRecipe || {},
        firing_params: appState.firingParams,
        texture_data: appState.generatedTexture,
        created_at: createdAt
    };
    
    let saveSuccess = false;
    let serverSaved = false;
    
    try {
        const response = await fetch(`${API_BASE}/api/works`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(workData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            serverSaved = true;
            saveSuccess = true;
        }
    } catch (error) {
        console.error('保存到服务器失败:', error);
    }
    
    addWorkToStorage(workData);
    saveSuccess = true;
    
    if (saveSuccess) {
        if (serverSaved) {
            alert('✅ 作品已保存到图鉴！（服务器 + 本地双重备份）');
        } else {
            alert('✅ 作品已保存到本地图鉴！');
        }
        document.getElementById('result-modal').classList.remove('show');
        switchStage('gallery');
    } else {
        alert('❌ 作品保存失败，请重试');
    }
}
