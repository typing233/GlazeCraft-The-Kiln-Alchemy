document.addEventListener('DOMContentLoaded', () => {
    if (appState.currentStage === 'gallery') {
        loadUserWorks();
    }
});

function loadUserWorks() {
    fetch(`${API_BASE}/api/works/user/${appState.userId}`)
        .then(response => response.json())
        .then(works => {
            appState.works = works;
            renderGallery();
        })
        .catch(error => {
            console.error('加载作品失败:', error);
            renderGallery();
        });
}

function renderGallery() {
    const grid = document.getElementById('gallery-grid');
    if (!grid) return;
    
    if (!appState.works || appState.works.length === 0) {
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

function generateShareLink() {
    if (!appState.selectedWork) return;
    
    fetch(`${API_BASE}/api/share/${appState.selectedWork.id}`)
        .then(response => response.json())
        .then(data => {
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
        })
        .catch(error => {
            console.error('生成分享链接失败:', error);
            const shareContainer = document.getElementById('share-link');
            if (shareContainer) {
                const shareUrl = `${window.location.origin}/share/${appState.selectedWork.id}`;
                shareContainer.innerHTML = `
                    <p>分享链接 (模拟模式):</p>
                    <code>${shareUrl}</code>
                `;
            }
        });
}
