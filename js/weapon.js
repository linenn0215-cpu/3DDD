/**
 * weapon.js - 處理槍枝模型、動畫與射擊彈道物理
 */

class Weapon {
    constructor(camera, scene, physicsWorld) {
        this.camera = camera;
        this.scene = scene;
        this.physicsWorld = physicsWorld;
        this.raycaster = new THREE.Raycaster();

        // --- 1. 建立槍枝視覺模型 (掛載於相機前) ---
        this.gunMesh = this.createGunMesh();
        // 將槍枝加入為相機的子物件，使其隨視角固定移動
        this.camera.add(this.gunMesh);

        // 槍枝在畫面中的偏移位置 (座標系相對於相機)
        this.gunMesh.position.set(0.6, -0.6, -1.2);
        this.gunMesh.rotation.y = -Math.PI / 12; // 稍微側向玩家

        // 彈藥系統
        this.maxAmmo = 30;
        this.ammo = this.maxAmmo;

        // --- 優化：預先建立共用子彈的幾何體與材質，避免每次發射時重複創建 ---
        this.bulletRadius = 0.15;
        this.bulletGeometry = new THREE.SphereGeometry(this.bulletRadius, 8, 8);
        this.bulletMaterial = new THREE.MeshPhongMaterial({ color: 0xf1c40f }); // 金色

        this.initListeners();
    }

    // 使用幾何體手工組裝一把 Low-poly 步槍
    createGunMesh() {
        const gunGroup = new THREE.Group();

        // 槍身
        const bodyGeo = new THREE.BoxGeometry(0.2, 0.3, 1.2);
        const bodyMat = new THREE.MeshPhongMaterial({ color: 0x2c3e50 });
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
        gunGroup.add(bodyMesh);

        // 槍柄
        const gripGeo = new THREE.BoxGeometry(0.18, 0.4, 0.2);
        const gripMesh = new THREE.Mesh(gripGeo, bodyMat);
        gripMesh.position.set(0, -0.3, 0.4);
        gripMesh.rotation.x = Math.PI / 6;
        gunGroup.add(gripMesh);

        // 槍管
        const barrelGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.8, 8);
        const barrelMat = new THREE.MeshPhongMaterial({ color: 0x95a5a6 });
        const barrelMesh = new THREE.Mesh(barrelGeo, barrelMat);
        barrelMesh.rotation.x = Math.PI / 2;
        barrelMesh.position.z = -0.7;
        gunGroup.add(barrelMesh);

        return gunGroup;
    }

    initListeners() {
        window.addEventListener('mousedown', (event) => {
            // 只有在指標鎖定且點擊左鍵時射擊
            if (event.button === 0 && player.controls.isLocked) {
                this.shoot();
            }
        });
    }

    shoot() {
        if (this.ammo <= 0) {
            console.log("沒有彈藥了！");
            return;
        }

        this.ammo--;

        // 簡單的視覺後座力
        this.gunMesh.position.z += 0.2;
        setTimeout(() => {
            this.gunMesh.position.z -= 0.2;
        }, 50);

        this.fireBullet();
    }

    // 補充彈藥
    addAmmo(amount) {
        this.ammo += amount;
        if (this.ammo > this.maxAmmo) {
            this.ammo = this.maxAmmo;
        }
    }

    fireBullet() {
        const speed = 120; // 提高子彈速度

        // --- 視覺子彈 (使用優化後共用的幾何體與材質) ---
        const mesh = new THREE.Mesh(this.bulletGeometry, this.bulletMaterial);
        this.scene.add(mesh);

        // --- 物理子彈 ---
        const shape = new CANNON.Sphere(this.bulletRadius);
        const body = new CANNON.Body({
            mass: 2, // 提高子彈質量
            shape: shape,
            collisionFilterGroup: COLLISION_GROUPS.BULLET,
            collisionFilterMask: COLLISION_GROUPS.ENVIRONMENT | COLLISION_GROUPS.ENEMY | COLLISION_GROUPS.BULLET // 可以碰到環境或怪物或其他子彈
        });

        // 加入子彈碰撞事件，處理對怪物的傷害
        body.addEventListener("collide", (e) => {
            const hitBody = e.body;
            if (hitBody.isEnemy && hitBody.enemyRef) {
                hitBody.enemyRef.takeDamage(25); // 兩發子彈可以打死血量 50 的怪物
            }
        });

        // 計算射擊起點與方向
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);

        const pos = new THREE.Vector3();
        // ★重要：將子彈往相機前方推 1.5 單位（大於玩家半徑），並稍高於中心，絕對避免與自己或極近距離的牆面干涉而出現穿透反彈
        pos.copy(this.camera.position).addScaledVector(direction, 1.5);

        body.position.set(pos.x, pos.y, pos.z);
        body.velocity.set(
            direction.x * speed,
            direction.y * speed,
            direction.z * speed
        );

        this.physicsWorld.addBody(body);
        this.trackBullet(mesh, body);

        // 子彈 2 秒後由物理與視覺世界刪除
        setTimeout(() => {
            this.scene.remove(mesh);
            this.physicsWorld.remove(body);
        }, 2000);
    }

    trackBullet(mesh, body) {
        const update = () => {
            if (body.world) {
                mesh.position.copy(body.position);
                mesh.quaternion.copy(body.quaternion);
                requestAnimationFrame(update);
            }
        };
        update();
    }
}
