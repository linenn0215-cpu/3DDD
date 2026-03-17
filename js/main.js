/**
 * main.js - 遊戲主要入口與循環
 */

let world, player, weapon;
let clock = new THREE.Clock();

const instructions = document.getElementById('instructions');
const crosshair = document.getElementById('crosshair');
const hud = document.getElementById('hud');
const hpBar = document.getElementById('hp-bar');
const hpText = document.getElementById('hp-text');
const ammoCount = document.getElementById('ammo-count');
const interactionPrompt = document.getElementById('interaction-prompt'); // 取得互動提示

// 用於記錄 E 鍵狀態
let keyE = false;
document.addEventListener('keydown', (e) => { if (e.code === 'KeyE') keyE = true; });
document.addEventListener('keyup', (e) => { if (e.code === 'KeyE') keyE = false; });

function init() {
    // 1. 初始化基礎元件
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true; // 啟用陰影
    document.body.appendChild(renderer.domElement);

    // 2. 初始化自定義模組
    world = new World();
    player = new Player(camera, world.scene, world.physicsWorld);
    weapon = new Weapon(camera, world.scene, world.physicsWorld);

    // 在 TPV 下，槍枝是相機的子物件，所以相機必須被加入場景中，Three.js 才能渲染槍
    world.scene.add(camera);

    // 3. 設定 Pointer Lock (滑鼠點擊開始遊戲)
    instructions.addEventListener('click', () => {
        player.controls.lock();
    });

    player.controls.addEventListener('lock', () => {
        instructions.style.display = 'none';
        crosshair.style.display = 'block';
        hud.style.display = 'flex';
    });

    player.controls.addEventListener('unlock', () => {
        instructions.style.display = 'flex';
        crosshair.style.display = 'none';
        hud.style.display = 'none';
    });

    // 4. 監聽視窗縮放
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // 5. 開始遊戲迴圈
    animate();

    function animate() {
        requestAnimationFrame(animate);

        const deltaTime = clock.getDelta();

        // 更新各個模組
        world.update(deltaTime);
        player.update();

        // 更新怪物邏輯
        world.enemies.forEach(enemy => {
            enemy.update(deltaTime, player);
        });

        // 更新道具拾取邏輯
        let canInteract = false;

        for (let i = world.items.length - 1; i >= 0; i--) {
            const item = world.items[i];
            const distance = player.mesh.position.distanceTo(item.mesh.position);

            if (distance < 3.0) { // 玩家距離小於 3 單位觸發提示
                canInteract = true;

                if (keyE) { // 必須按下 E 鍵才拾取
                    if (item.type === 'ammo') {
                        weapon.addAmmo(item.amount);
                    } else if (item.type === 'health') {
                        player.heal(item.amount);
                    }

                    // 移除被拾取的資源
                    world.scene.remove(item.mesh);
                    world.items.splice(i, 1);

                    // 避免連續拾取太快
                    keyE = false;
                }
            } else {
                // 原有的道具旋轉效果
                item.mesh.rotation.y += deltaTime;
                if (item.mesh.children && item.mesh.children.length === 0) { // 如果是單一模型(如血包)做全方位旋轉
                    item.mesh.rotation.x += deltaTime * 0.5;
                }
            }
        }

        // 依據是否能互動來顯示隱藏 UI 提示
        if (canInteract && player.controls.isLocked) {
            interactionPrompt.style.display = 'block';
        } else {
            interactionPrompt.style.display = 'none';
        }

        // 更新 UI 顯示
        if (player.controls.isLocked) {
            hpText.textContent = `${player.hp}/${player.maxHp}`;
            hpBar.style.width = `${(player.hp / player.maxHp) * 100}%`;
            ammoCount.textContent = `${weapon.ammo}/${weapon.maxAmmo}`;
        }

        // 渲染畫面
        renderer.render(world.scene, camera);
    }
}

// 啟動遊戲
window.onload = init;
