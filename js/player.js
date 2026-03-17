/**
 * player.js - 處理玩家控制、角色模型與第三人稱視角
 */

class Player {
    constructor(camera, scene, physicsWorld) {
        this.camera = camera;
        this.scene = scene;
        this.physicsWorld = physicsWorld;

        // 載入 Three.js 的 PointerLockControls (這裡主要用來旋轉視角)
        this.controls = new THREE.PointerLockControls(camera, document.body);

        // --- 1. 建立玩家視覺模型 (代表第三人稱看到的自己) ---
        this.mesh = this.createPlayerMesh();
        this.scene.add(this.mesh);

        // --- 2. 建立玩家物理剛體 (本體為一個物理球體) ---
        const radius = 0.5;
        this.body = new CANNON.Body({
            mass: 80,
            shape: new CANNON.Sphere(radius),
            position: new CANNON.Vec3(0, 5, 0),
            fixedRotation: true,
            linearDamping: 0.9,
            collisionFilterGroup: COLLISION_GROUPS.PLAYER,
            collisionFilterMask: COLLISION_GROUPS.ENVIRONMENT | COLLISION_GROUPS.ENEMY // 可以與環境和怪物碰撞，但忽略 BULLET
        });
        this.physicsWorld.addBody(this.body);

        // 玩家狀態屬性
        this.maxHp = 100;
        this.hp = this.maxHp;

        // 控制狀態
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.canJump = false;

        // 動作系統：翻滾
        this.isRolling = false;
        this.rollCooldown = false;

        this.initListeners();
    }

    // 拼湊一個低多邊形的簡易人形
    createPlayerMesh() {
        const group = new THREE.Group();

        // 身體
        const bodyGeo = new THREE.BoxGeometry(0.8, 1.2, 0.4);
        const bodyMat = new THREE.MeshPhongMaterial({ color: 0x3498db });
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
        bodyMesh.position.y = 0.6; // 腳底在 0，所以向上移一半高度
        bodyMesh.castShadow = true;
        group.add(bodyMesh);

        // 頭部
        const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
        const headMat = new THREE.MeshPhongMaterial({ color: 0xe67e22 });
        const headMesh = new THREE.Mesh(headGeo, headMat);
        headMesh.position.y = 1.4;
        headMesh.castShadow = true;
        group.add(headMesh);

        return group;
    }

    initListeners() {
        const onKeyDown = (event) => {
            if (!this.controls.isLocked) return;

            switch (event.code) {
                case 'KeyW': this.moveForward = true; break;
                case 'KeyA': this.moveLeft = true; break;
                case 'KeyS': this.moveBackward = true; break;
                case 'KeyD': this.moveRight = true; break;
                case 'Space':
                    if (this.canJump && !this.isRolling) {
                        this.body.velocity.y = 8;
                        this.canJump = false;
                    }
                    break;
                case 'ShiftLeft':
                case 'ShiftRight':
                    this.roll();
                    break;
            }
        };

        const onKeyUp = (event) => {
            switch (event.code) {
                case 'KeyW': this.moveForward = false; break;
                case 'KeyA': this.moveLeft = false; break;
                case 'KeyS': this.moveBackward = false; break;
                case 'KeyD': this.moveRight = false; break;
            }
        };

        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);

        this.body.addEventListener("collide", () => {
            this.canJump = true;
        });
    }

    // 實作翻滾：瞬間推進力
    roll() {
        if (this.isRolling || this.rollCooldown) return;

        this.isRolling = true;
        this.rollCooldown = true;

        // 以目前相機面對的水平方向作為衝刺方向
        const dir = new THREE.Vector3();
        this.camera.getWorldDirection(dir);
        dir.y = 0;
        dir.normalize();

        // 強力推進
        this.body.velocity.x = dir.x * 35;
        this.body.velocity.z = dir.z * 35;

        // 給視覺模型一個旋轉動畫
        let rollCounter = 0;
        const animateRoll = () => {
            if (rollCounter < 20) {
                this.mesh.rotation.x += 0.3;
                rollCounter++;
                requestAnimationFrame(animateRoll);
            } else {
                this.mesh.rotation.x = 0;
                this.isRolling = false;
            }
        };
        animateRoll();

        // 1 秒冷卻
        setTimeout(() => {
            this.rollCooldown = false;
        }, 1000);
    }

    // 處理玩家扣血與死亡邏輯
    takeDamage(amount) {
        if (this.hp <= 0) return; // 已經死亡則不再扣血

        this.hp -= amount;
        if (this.hp <= 0) {
            this.hp = 0;
            console.log("玩家死亡！");
            // 可擴充遊戲結束畫面
            document.exitPointerLock();
            alert("遊戲結束！您已死亡。點擊重新開始。");
            this.respawn();
        }
    }

    // 處理玩家補血
    heal(amount) {
        if (this.hp <= 0) return;
        this.hp += amount;
        if (this.hp > this.maxHp) {
            this.hp = this.maxHp;
        }
    }

    // 重生邏輯 (回原點並恢復血量)
    respawn() {
        this.hp = this.maxHp;
        this.body.position.set(0, 5, 0);
        this.body.velocity.set(0, 0, 0);
    }

    update() {
        // --- 邊界檢查 (摔落場景外) ---
        if (this.body.position.y < -15) {
            console.log("玩家跌出場景，受到跌落傷害！");
            this.takeDamage(20);
            if (this.hp > 0) {
                // 尚未死亡則拉回原點
                this.body.position.set(0, 5, 0);
                this.body.velocity.set(0, 0, 0);
            }
        }

        if (this.controls.isLocked) {
            // 翻滾中不接受移動控制
            const speed = this.isRolling ? 0 : 20;
            const inputVelocity = new THREE.Vector3();

            if (this.moveForward) inputVelocity.z += 1;
            if (this.moveBackward) inputVelocity.z -= 1;
            if (this.moveLeft) inputVelocity.x -= 1;
            if (this.moveRight) inputVelocity.x += 1;

            if (inputVelocity.length() > 0) {
                inputVelocity.normalize();

                // 轉換方向：相對於相機看向的方向
                const moveDir = new THREE.Vector3();
                moveDir.copy(inputVelocity).applyQuaternion(this.camera.quaternion);
                moveDir.y = 0;

                this.body.velocity.x = moveDir.x * speed;
                this.body.velocity.z = moveDir.z * speed;

                // 臉部朝向：讓模型平滑轉向移動的方向
                const targetRotation = Math.atan2(moveDir.x, moveDir.z);
                this.mesh.rotation.y = targetRotation;
            }
        }

        // --- 第三人稱跟隨相機 ---
        // 1. 同步模型位置到物理剛體
        this.mesh.position.copy(this.body.position);
        this.mesh.position.y -= 0.5; // 稍微修正視覺偏移

        // 2. 計算相機的目標位置 (玩家後上方)
        const offset = new THREE.Vector3(0, 2, -5); // 背後 5 單位，高 2 單位
        offset.applyQuaternion(this.camera.quaternion);

        const targetCamPos = new THREE.Vector3().copy(this.body.position).add(offset);
        // 使用 Lerp 讓畫面跟隨更穩定，不會過於晃動
        this.camera.position.lerp(targetCamPos, 0.15);
    }
}
