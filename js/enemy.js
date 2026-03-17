/**
 * enemy.js - 處理怪物的生成、追蹤玩家及生命值邏輯
 */

class Enemy {
    constructor(x, y, z, scene, physicsWorld) {
        this.scene = scene;
        this.physicsWorld = physicsWorld;

        this.hp = 50;
        this.speed = 12 + Math.random() * 5; // 升級為野狼的速度
        this.attackCooldown = 0;
        this.attackRange = 2.5; // 攻擊距離
        this.attackDamage = 20;

        // 建立視覺模型 (低多邊形野狼)
        this.mesh = new THREE.Group();
        this.mesh.position.set(x, y + 1, z);

        const wolfMat = new THREE.MeshPhongMaterial({ color: 0x4a4a4a }); // 深灰色
        const eyeMat = new THREE.MeshPhongMaterial({ color: 0xff0000 }); // 紅眼

        // 身體
        const bodyGeo = new THREE.BoxGeometry(0.8, 0.8, 2);
        const bodyMesh = new THREE.Mesh(bodyGeo, wolfMat);
        bodyMesh.position.y = 0.6;
        bodyMesh.castShadow = true;
        this.mesh.add(bodyMesh);

        // 頭部
        const headGeo = new THREE.BoxGeometry(0.6, 0.6, 0.8);
        const headMesh = new THREE.Mesh(headGeo, wolfMat);
        headMesh.position.set(0, 1.2, 1.2);
        headMesh.castShadow = true;
        this.mesh.add(headMesh);

        // 眼睛
        const eyeGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(-0.2, 1.3, 1.6);
        const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
        eyeR.position.set(0.2, 1.3, 1.6);
        this.mesh.add(eyeL, eyeR);

        // 腿部 (四條腿)
        const legGeo = new THREE.BoxGeometry(0.2, 0.8, 0.2);
        const addLeg = (px, pz) => {
            const leg = new THREE.Mesh(legGeo, wolfMat);
            leg.position.set(px, 0.4, pz);
            leg.castShadow = true;
            this.mesh.add(leg);
            return leg;
        };
        this.legs = [
            addLeg(-0.3, 0.8), // 前左
            addLeg(0.3, 0.8),  // 前右
            addLeg(-0.3, -0.6),// 後左
            addLeg(0.3, -0.6)  // 後右
        ];

        // 尾巴
        const tailGeo = new THREE.BoxGeometry(0.2, 0.2, 0.8);
        const tailMesh = new THREE.Mesh(tailGeo, wolfMat);
        tailMesh.position.set(0, 0.8, -1.2);
        tailMesh.rotation.x = -Math.PI / 6;
        this.mesh.add(tailMesh);

        this.scene.add(this.mesh);

        // 建立物理剛體 (Box 符合野狼長條形狀)
        const shape = new CANNON.Box(new CANNON.Vec3(0.4, 0.6, 1.0));
        this.body = new CANNON.Body({
            mass: 50,
            position: new CANNON.Vec3(x, y + 1.0, z),
            fixedRotation: true,
            linearDamping: 0.9,
            collisionFilterGroup: COLLISION_GROUPS.ENEMY,
            collisionFilterMask: COLLISION_GROUPS.ENVIRONMENT | COLLISION_GROUPS.PLAYER | COLLISION_GROUPS.BULLET | COLLISION_GROUPS.ENEMY
        });

        this.body.addShape(shape);
        this.physicsWorld.addBody(this.body);

        // 標記為怪物，方便子彈碰撞判斷
        this.body.isEnemy = true;
        this.body.enemyRef = this; // 儲存參照
    }

    takeDamage(amount) {
        if (this.hp <= 0) return;

        this.hp -= amount;

        // 受擊閃爍 (視覺回饋)
        this.mesh.children.forEach(child => {
            if (child.material && child.material.color) {
                child.userData.originalColor = child.material.color.getHex();
                child.material.color.setHex(0xffffff);
            }
        });

        setTimeout(() => {
            if (this.hp > 0) {
                this.mesh.children.forEach(child => {
                    if (child.material && child.material.color && child.userData.originalColor) {
                        child.material.color.setHex(child.userData.originalColor);
                    }
                });
            }
        }, 100);

        if (this.hp <= 0) {
            this.die();
        }
    }

    die() {
        this.hp = 0;
        // 將物件從場景中移除
        this.scene.remove(this.mesh);
        this.physicsWorld.remove(this.body);
    }

    update(deltaTime, player) {
        if (this.hp <= 0) return;

        // 更新視覺模型位置
        this.mesh.position.copy(this.body.position);

        // 計算與玩家的距離和方向
        const playerPos = player.body.position;
        const myPos = this.body.position;
        const distance = myPos.distanceTo(playerPos);

        // 如果玩家在存活狀態，開始追蹤
        if (player.hp > 0 && distance < 50) { // 在 50 單位內才會追蹤
            // 往玩家方向移動 (只在 XZ 平面上移動)
            const dir = new THREE.Vector3(playerPos.x - myPos.x, 0, playerPos.z - myPos.z).normalize();

            // 設定速度
            this.body.velocity.x = dir.x * this.speed;
            this.body.velocity.z = dir.z * this.speed;

            // 讓狼的頭部面向玩家
            const targetRotation = Math.atan2(dir.x, dir.z);
            this.mesh.rotation.y = targetRotation;

            // 簡單奔跑動畫 (腿部前後擺動)
            const time = Date.now() * 0.015;
            this.legs[0].rotation.x = Math.sin(time) * 0.5;
            this.legs[1].rotation.x = -Math.sin(time) * 0.5;
            this.legs[2].rotation.x = -Math.sin(time) * 0.5;
            this.legs[3].rotation.x = Math.sin(time) * 0.5;

            // 攻擊邏輯
            if (distance < this.attackRange) {
                if (this.attackCooldown <= 0) {
                    player.takeDamage(this.attackDamage);
                    this.attackCooldown = 1.5; // 每 1.5 秒攻擊一次
                }
            }
        } else {
            // 沒有追蹤時減速
            this.body.velocity.x *= 0.9;
            this.body.velocity.z *= 0.9;
        }

        // 冷卻時間遞減
        if (this.attackCooldown > 0) {
            this.attackCooldown -= deltaTime;
        }
    }
}
